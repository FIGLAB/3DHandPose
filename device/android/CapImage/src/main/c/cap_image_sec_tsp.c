#define LOG_MODULE "CapImage.SecTSPDriver"

#include "log.h"

#include <errno.h>
#include <fcntl.h>
#include <math.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

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

/* Variables for java_cap_image */
int cap_image_width = CI_CAPW, cap_image_height = CI_CAPH;
int cap_screen_width = CI_SCREENW, cap_screen_height = CI_SCREENH;
float cap_phys_width = CI_PHYSW, cap_phys_height = CI_PHYSH;

#define PERROR(fmt, ...) ERROR(fmt ": %s", ##__VA_ARGS__, strerror(errno))

/* Global state */
static int initialized = 0;
static int resumed = 0;

static int cmdfd = -1;
static FILE *resultf = NULL;
static char *readcmd = "run_delta_read_all";

static pthread_mutex_t cap_image_req_mutex;

/* Preprocessor fun to get a nice static string */
#define __EVENT_PATH(N) "/dev/input/event" #N
#define _EVENT_PATH(N) __EVENT_PATH(N)
#define EVENT_PATH _EVENT_PATH(CI_INPUTNR)

#define CMD_PATH "/sys/class/sec/tsp/cmd"
#define RESULT_PATH "/sys/class/sec/tsp/cmd_result"

int cap_init(void) {
    system("su -c 'echo 0 > /sys/fs/selinux/enforce'");

    sudo_chmod(0666, "%s", CMD_PATH);
    sudo_chcon("u:object_r:null_device:s0", "%s", CMD_PATH);
    sudo_chmod(0666, "%s", RESULT_PATH);
    sudo_chcon("u:object_r:null_device:s0", "%s", RESULT_PATH);

    cmdfd = open(CMD_PATH, O_WRONLY);
    if (cmdfd < 0) {
        PERROR("open(%s) failed", CMD_PATH);
        goto fail_open_cmd;
    }

    resultf = fopen(RESULT_PATH, "r");
    if (!resultf) {
        PERROR("fopen(%s) failed", RESULT_PATH);
        goto fail_open_result;
    }

    initialized = 1;
    return 0;

//---------------------------
    fclose(resultf);
    resultf = NULL;
fail_open_result:
//---------------------------
    close(cmdfd);
    cmdfd = -1;
fail_open_cmd:
//---------------------------
    initialized = 0;
    return -1;
}

int cap_resume(void) {
    pthread_mutex_lock(&cap_image_req_mutex);
    if (!initialized) {
        ERROR("resume called while not initialized!");
        errno = EINVAL;
        goto fail_state;
    }
    if (resumed) {
        pthread_mutex_unlock(&cap_image_req_mutex);
        return 0;
    }

    resumed = 1;
    pthread_mutex_unlock(&cap_image_req_mutex);
    return 0;

fail_state:
//---------------------------
    pthread_mutex_unlock(&cap_image_req_mutex);
    return -1;
}

int cap_pause(void) {
    pthread_mutex_lock(&cap_image_req_mutex);
    if (!resumed) {
        goto done;
    }

    resumed = 0;
done:
    pthread_mutex_unlock(&cap_image_req_mutex);
    return 0;
}

int cap_request(void) {
    pthread_mutex_lock(&cap_image_req_mutex);

    if (!resumed) {
        ERROR("Error #001: request called while not resumed");
        errno = EINVAL;
        goto fail_state;
    }

    if (pwrite(cmdfd, readcmd, strlen(readcmd), 0) != (ssize_t)strlen(readcmd)) {
        if (errno == EBUSY) {
            PERROR("failed to write command %s, busy - trying to flush", readcmd);
            rewind(resultf);
            fflush(resultf);
            fscanf(resultf, "%*s");
        } else {
            PERROR("failed to write command %s", readcmd);
        }
        goto fail_write_cmd;
    }

    pthread_mutex_unlock(&cap_image_req_mutex);
    return 0;

fail_write_cmd:
fail_state:
    pthread_mutex_unlock(&cap_image_req_mutex);
    return -1;
}

void cap_read(int16_t *data) {
    pthread_mutex_lock(&cap_image_req_mutex);

    rewind(resultf);
    fflush(resultf);
    fscanf(resultf, "%*[^:]:");

#if CI_NEEDS_TRANSPOSE
    for(int i=0; i<CI_CAPW; i++) {
        for(int j=0; j<CI_CAPH; j++) {
            int val = -1;
            fscanf(resultf, "%d,", &val);
            data[j * CI_CAPW + i] = (int16_t)val;
        }
    }
#else
    for(int i=0; i<CI_CAPH; i++) {
        for(int j=0; j<CI_CAPW; j++) {
            int val = -1;
            fscanf(resultf, "%d,", &val);
            data[i * CI_CAPW + j] = (int16_t)val;
        }
    }
#endif

    pthread_mutex_unlock(&cap_image_req_mutex);
}

struct native_touch cap_on_touch(int16_t *data) {
    int eventfd = open(EVENT_PATH, O_RDONLY);
    if (eventfd < 0) {
        PERROR("Failed to open %s", EVENT_PATH);
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

int cap_set_mode(enum image_mode mode) {
    switch(mode) {
    case IMAGE_MODE_DEFAULT:
        readcmd = "run_delta_read_all";
        return 1;
    case IMAGE_MODE_RAW:
        readcmd = "run_rawcap_read_all";
        return 1;
    case IMAGE_MODE_BASELINE:
        readcmd = "run_reference_read_all";
        return 1;
    default:
        return 0;
    }
}
