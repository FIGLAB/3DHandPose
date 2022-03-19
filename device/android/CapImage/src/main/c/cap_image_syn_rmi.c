#define LOG_MODULE "CapImage.SynRMIDriver"

#include "log.h"

#include <errno.h>
#include <fcntl.h>
#include <math.h>
#include <pthread.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "syn_rmi.h"
#include "read_cap.h"
#include "sys_util.h"
#include "read_touch.h"

#include <linux/input.h>

/* Required device-specific defines */
#if !defined(CI_CAPW) || !defined(CI_CAPH) || !defined(CI_SCREENW) || !defined(CI_SCREENH) || !defined(CI_INPUTNR)
#error A required define was not provided - check your build configuration.
#endif

/* Optional device-specific defines */
#ifndef CI_NEEDS_TRANSPOSE
#define CI_NEEDS_TRANSPOSE 0
#endif

#if !defined(CI_PHYSW) || !defined(CI_PHYSH)
#warning "Device physical size not specified"
#define CI_PHYSW NAN
#define CI_PHYSH NAN
#endif

#ifndef CI_PERSISTENT_FD
/* 0: fd is reopened on every request. 1: fd is only reopened on resume. */
#define CI_PERSISTENT_FD 0
#endif

#ifndef CI_RAW_MODE
#define CI_RAW_MODE F54_RAW_16BIT_IMAGE
#endif

/* Variables for java_cap_image */
int cap_image_width = CI_CAPW, cap_image_height = CI_CAPH;
int cap_screen_width = CI_SCREENW, cap_screen_height = CI_SCREENH;
float cap_phys_width = CI_PHYSW, cap_phys_height = CI_PHYSH;

#define PERROR(fmt, ...) ERROR(fmt ": %s", ##__VA_ARGS__, strerror(errno))

/* Preprocessor fun to get a nice static string */
#define __EVENT_PATH(N) "/dev/input/event" #N
#define _EVENT_PATH(N) __EVENT_PATH(N)
#define EVENT_PATH _EVENT_PATH(CI_INPUTNR)

#define RMI_PATH "/dev/rmi0"

/* We only support the 16-bit report types. */
enum f54_report_types {
    F54_16BIT_IMAGE = 2, // 2*T*R bytes
    F54_RAW_16BIT_IMAGE = 3, // 2*T*R bytes

    F54_TRUE_BASELINE = 9,  // 2*T*R bytes

    F54_FULL_RAW_CAP = 19, // 2*T*R bytes
    F54_FULL_RAW_CAP_RX_COUPLING_COMP = 20, // 2*T*R bytes
    F54_SENSOR_SPEED = 22, // 2*T*R bytes
    F54_ADC_RANGE = 23, // 2*T*R bytes
    F54_RAW_CAP = 41, // 2*T*R bytes
};

static uint8_t report_type = F54_16BIT_IMAGE;

/* Global state */
static int initialized = 0;
static int resumed = 0;

static int rmifd = -1;

static struct syn_pdt *pdt;
static struct syn_func_desc *f12, *f54;

static int f12_ctrl28;
static struct syn_reg_desc *f12_query_desc, *f12_ctrl_desc, *f12_data_desc;

static pthread_mutex_t cap_image_req_mutex;


int cap_init(void) {
    system("su -c 'echo 0 > /sys/fs/selinux/enforce'");

    sudo_chmod(0666, "%s", RMI_PATH);
    sudo_chcon("u:object_r:null_device:s0", "%s", RMI_PATH);
    sudo_chmod(0666, "%s", EVENT_PATH);
    sudo_chcon("u:object_r:null_device:s0", "%s", EVENT_PATH);

    rmifd = open(RMI_PATH, O_RDWR);
    if (rmifd < 0) {
        PERROR("ERROR #001: open(%s) failed", RMI_PATH);
        goto fail_open_rmi;
    }

    /* Find functions */
    if (!pdt) {
        pdt = syn_pdt_read(rmifd);
        if (!pdt) {
            ERROR("ERROR #002: syn_pdt_read failed");
            goto fail_func;
        }
        f54 = pdt->funcs[0x54];
        if (!f54) {
            ERROR("ERROR #003: Function F54 not found!");
            pdt = NULL;
            goto fail_func;
        }
        f12 = pdt->funcs[0x12];
        if (f12) {
            INFO("Function F12 found - touch input reporting enabled");
            f12_query_desc = syn_reg_desc_read(rmifd, f12->query_base + 1);
            f12_ctrl_desc = syn_reg_desc_read(rmifd, f12->query_base + 4);
            f12_data_desc = syn_reg_desc_read(rmifd, f12->query_base + 7);
            pread(rmifd, &f12_ctrl28, 1, f12->ctrl_base + f12_ctrl_desc->reg_map[28]);
        }
    }

    /* We could autodetect F54 image size from F54_Query0 and F54_Query1 but those aren't
     * always correct. Better to just hardcode the value for the device model (CAPW, CAPH)
     * once we figure it out. */

    /* Will reopen in resume() */
    close(rmifd);
    rmifd = -1;

    initialized = 1;
    return 0;

//---------------------------
fail_func:
    errno = EINVAL;
//---------------------------
    close(rmifd);
    rmifd = -1;
fail_open_rmi:
//---------------------------
    initialized = 0;
    return -1;
}

int cap_resume(void) {
    pthread_mutex_lock(&cap_image_req_mutex);
    if (!initialized) {
        ERROR("ERROR #004: resume called while not initialized!");
        errno = EINVAL;
        pthread_mutex_unlock(&cap_image_req_mutex);
        return -1;
    }
    if (resumed) {
        pthread_mutex_unlock(&cap_image_req_mutex);
        return 0;
    }

    rmifd = open(RMI_PATH, O_RDWR);
    if (rmifd < 0) {
        PERROR("ERROR #005: open(%s) failed", RMI_PATH);
        goto fail_open_rmi;
    }

    /* write report type */
    if (pwrite(rmifd, &report_type, 1, f54->data_base) < 0) {
        PERROR("ERROR #006: pwrite failed");
        goto fail_cfg_rmi;
    }
#if !CI_PERSISTENT_FD
    close(rmifd);
    rmifd = -1;
#endif

    resumed = 1;
    pthread_mutex_unlock(&cap_image_req_mutex);
    return 0;

//---------------------------
fail_cfg_rmi:
//---------------------------
    close(rmifd);
    rmifd = -1;
fail_open_rmi:
//---------------------------
    pthread_mutex_unlock(&cap_image_req_mutex);
    return -1;
}

int cap_pause(void) {
    pthread_mutex_lock(&cap_image_req_mutex);
    if (!resumed) {
        pthread_mutex_unlock(&cap_image_req_mutex);
        return 0;
    }

    close(rmifd);
    rmifd = -1;
    resumed = 0;
    pthread_mutex_unlock(&cap_image_req_mutex);
    return 0;
}

static int configure_report() {
    /* write report type */
    if (pwrite(rmifd, &report_type, 1, f54->data_base) < 0) {
        PERROR("ERROR #007: pwrite report_type failed");
        goto fail_write_rmi;
    }

    /* Trigger report read */
    if (pwrite(rmifd, &(uint8_t) {1}, 1, f54->cmd_base) < 0) {
        PERROR("ERROR #008: pwrite report_read failed");
        goto fail_write_rmi;
    }

    /* Reset report index */
    if(pwrite(rmifd, &(uint8_t[2]) {0, 0}, 2, f54->data_base + 1) < 0) {
        PERROR("ERROR #009: pwrite report_index failed");
        goto fail_write_rmi;
    }

    return 0;

fail_write_rmi:
    return -1;
}

int cap_request(void) {
    if (!resumed) {
        ERROR("ERROR #010: request called while not resumed");
        errno = EINVAL;
        return -1;
    }

    pthread_mutex_lock(&cap_image_req_mutex);
#if !CI_PERSISTENT_FD
    rmifd = open(RMI_PATH, O_RDWR);
    if (rmifd < 0) {
        PERROR("ERROR #011: open(%s) failed", RMI_PATH);
        goto fail_open_rmi;
    }
#endif

    if (configure_report() < 0) {
        PERROR("ERROR #012: configure_report failed");
        goto fail_write_rmi;
    }

    pthread_mutex_unlock(&cap_image_req_mutex);
    return 0;

fail_write_rmi:
    close(rmifd);
    rmifd = -1;
#if !CI_PERSISTENT_FD
fail_open_rmi:
#endif

    pthread_mutex_unlock(&cap_image_req_mutex);
    return -1;
}

static struct input_event create_event(int type, int code, int value) {
    struct input_event res = {
            .type = type,
            .code = code,
            .value = value,
    };
    return res;
}

static struct native_touch write_event(int eventfd, int slot, uint8_t *data) {
    int idx = 0;

    int objtype = (f12_ctrl28 & 0x01) ? data[idx++] : -1;
    int x_lsb = (f12_ctrl28 & 0x02) ? data[idx++] : 0;
    int x_msb = (f12_ctrl28 & 0x04) ? data[idx++] : 0;
    int y_lsb = (f12_ctrl28 & 0x08) ? data[idx++] : 0;
    int y_msb = (f12_ctrl28 & 0x10) ? data[idx++] : 0;
    int z = (f12_ctrl28 & 0x20) ? data[idx++] : -1;
    int wx = (f12_ctrl28 & 0x40) ? data[idx++] : -1;
    int wy = (f12_ctrl28 & 0x80) ? data[idx++] : -1;

    struct native_touch touch = {
            .id = -1,
            .x = x_lsb + (x_msb << 8),
            .y = y_lsb + (y_msb << 8),

    };
    struct input_event events[16];
    int eventno = 0;

    events[eventno++] = create_event(EV_ABS, ABS_MT_SLOT, slot);

    if (objtype == 0) {
        events[eventno++] = create_event(EV_ABS, ABS_MT_TRACKING_ID, -1);
    } else {
        touch.id = slot;
        events[eventno++] = create_event(EV_ABS, ABS_MT_TRACKING_ID, slot);
        events[eventno++] = create_event(EV_ABS, ABS_MT_POSITION_X, touch.x);
        events[eventno++] = create_event(EV_ABS, ABS_MT_POSITION_Y, touch.y);
        if (wx >= 0 && wy >= 0) {
            if (wx >= wy) {
                touch.touch_major = wx;
                touch.touch_minor = wy;
                touch.orientation = 0;
            } else {
                touch.touch_major = wy;
                touch.touch_minor = wx;
                touch.orientation = 90;
            }
        }
        events[eventno++] = create_event(EV_ABS, ABS_MT_TOUCH_MAJOR, touch.touch_major);
        events[eventno++] = create_event(EV_ABS, ABS_MT_WIDTH_MINOR, touch.touch_minor);
        events[eventno++] = create_event(EV_ABS, ABS_MT_ORIENTATION, touch.orientation);
        if (z >= 0) {
            touch.pressure = z;
        } else {
            touch.pressure = 1;
        }
        events[eventno++] = create_event(EV_ABS, ABS_MT_PRESSURE, touch.pressure);
    }

    write(eventfd, events, eventno * sizeof(struct input_event));
    return touch;
}

void cap_read(int16_t *data) {
    pthread_mutex_lock(&cap_image_req_mutex);

    while (1) {
        uint8_t cmdstatus;
        if (pread(rmifd, &cmdstatus, 1, f54->cmd_base) <= 0) {
            PERROR("ERROR #013: read f54 cmd status failed");
            goto fail;
        }

        if (!(cmdstatus & 1)) {
            /* Report done! */
            break;
        }
    }

    int report_size = 2 * cap_image_width * cap_image_height;
    int data_addr = f54->data_base + 3;
#if CI_NEEDS_TRANSPOSE
    {
        int16_t transposed_data[cap_image_width * cap_image_height];
        int x, y;
        if(pread(rmifd, transposed_data, report_size, data_addr) < report_size) {
            PERROR("ERROR #014: read f54 report data failed");
            goto fail;
        }
        for (y = 0; y < cap_image_height; y++) {
            for (x = 0; x < cap_image_width; x++) {
                data[y * cap_image_width + x] = transposed_data[x * cap_image_height + y];
            }
        }
    }
#else
    if(pread(rmifd, data, report_size, data_addr) < report_size) {
        PERROR("ERROR #015: read f54 report data failed");
        goto fail;
    }
#endif

fail:
#if !CI_PERSISTENT_FD
    close(rmifd);
    rmifd = -1;
#endif
    pthread_mutex_unlock(&cap_image_req_mutex);
}

static struct native_touch fallback_cap_on_touch(int16_t *data) {
    int eventfd = open(EVENT_PATH, O_RDONLY);
    if (eventfd < 0) {
        PERROR("ERROR #016: Failed to open %s", EVENT_PATH);
        struct native_touch touch;
        memset(&touch, -1, sizeof(touch));
        return touch;
    }
    struct native_touch touch = mt_slot_wait_for_touch(eventfd);
    close(eventfd);
    cap_request();
    cap_read(data);
    return touch;
}

struct native_touch cap_on_touch(int16_t *data) {
    if (!f12) {
        return fallback_cap_on_touch(data);
    }

    int nobjs = f12_data_desc->regs[f12_data_desc->reg_map[1]].size / 8;
    int bitcount = __builtin_popcount(f12_ctrl28);
    if (bitcount <= 0) {
        ERROR("ERROR #017: Reading F12_2D_Ctrl28 returned invalid result %02x", f12_ctrl28);
        return fallback_cap_on_touch(data);
    }

    /* F12 is enabled - let's use it to achieve low-latency reads */
    int eventfd = open(EVENT_PATH, O_RDWR);
    if (eventfd < 0) {
        PERROR("ERROR #018: Failed to open %s", EVENT_PATH);
        struct native_touch touch;
        memset(&touch, -1, sizeof(touch));
        return touch;
    }
    mt_slot_wait_for_no_touch(eventfd);

    uint8_t touch_data[nobjs][bitcount];
#if !CI_PERSISTENT_FD
    rmifd = open(RMI_PATH, O_RDWR);
    if (rmifd < 0) {
        PERROR("ERROR #019: open(%s) failed", RMI_PATH);
        return fallback_cap_on_touch(data);
    }
#endif
    /* Wait for touch */
    while (1) {
        if (pread(rmifd, touch_data, sizeof(touch_data), f12->data_base + f12_data_desc->reg_map[1]) <
                (int)sizeof(touch_data)) {
            ERROR("ERROR #020: Short read on F12_2D_Data1");
            close(rmifd);
            return fallback_cap_on_touch(data);
        }

        int objidx;
        for (objidx = 0; objidx < nobjs; objidx++) {
            if (touch_data[objidx][0])
                break;
        }
        if (objidx < nobjs)
            break;
    }

    configure_report();

    /* Convert this touch event so it is visible to the system */
    struct native_touch out_touch = {
            .id = -1,
    };
    struct input_event key_touch = create_event(EV_KEY, BTN_TOUCH, 1);
    write(eventfd, &key_touch, sizeof(struct input_event));
    for (int i = 0; i < nobjs; i++) {
        struct native_touch new_touch = write_event(eventfd, i, touch_data[i]);
        if (new_touch.id >= 0 && out_touch.id < 0)
            out_touch = new_touch;
    }
    struct input_event syn_report = create_event(EV_SYN, SYN_REPORT, 0);
    write(eventfd, &syn_report, sizeof(struct input_event));
    close(eventfd);

    /* Wait for and read the cap image report */
    cap_read(data);

#if !CI_PERSISTENT_FD
    close(rmifd);
#endif
    return out_touch;
}

int cap_set_mode(enum image_mode mode) {
    switch(mode) {
    case IMAGE_MODE_DEFAULT:
        report_type = F54_16BIT_IMAGE;
        return 1;
    case IMAGE_MODE_RAW:
        report_type = CI_RAW_MODE;
        return 1;
    case IMAGE_MODE_BASELINE:
        report_type = F54_TRUE_BASELINE;
        return 1;
    default:
        return 0;
    }
}
