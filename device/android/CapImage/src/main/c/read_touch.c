#define LOG_MODULE "CapImage.ReadTouch"
#include "log.h"

#include "read_touch.h"

#include <unistd.h>
#include <string.h>
#include <errno.h>

#include <linux/input.h>

#define MAX_EVENTS 32 // maximum number of events to get at once
#define MAX_TOUCHES 32 // maximum number of touch slots to support

static void read_mt_slots(int fd, struct native_touch touches[static MAX_TOUCHES]) {
    /* Retrieve initial slot data for the touches. */
    struct {
        __u32 code;
        __s32 values[MAX_TOUCHES];
    } input_mt_request;

    #define GET_ABS(__code, __field) do { \
        input_mt_request.code = __code; \
        memset(input_mt_request.values, -1, sizeof(input_mt_request.values)); \
        if(ioctl(fd, EVIOCGMTSLOTS(sizeof(input_mt_request)), &input_mt_request) >= 0) { \
            for(int __slot=0; __slot<MAX_TOUCHES; __slot++) { \
                touches[__slot].__field = input_mt_request.values[__slot]; \
            } \
        } else { \
            VERBOSE("ioctl for code %d failed: %s", __code, strerror(errno)); \
        } \
    } while(0)

    GET_ABS(ABS_MT_TRACKING_ID, id);
    GET_ABS(ABS_MT_POSITION_X, x);
    GET_ABS(ABS_MT_POSITION_Y, y);
    GET_ABS(ABS_MT_TOUCH_MAJOR, touch_major);
    GET_ABS(ABS_MT_TOUCH_MINOR, touch_minor);
    GET_ABS(ABS_MT_WIDTH_MAJOR, width_major);
    GET_ABS(ABS_MT_WIDTH_MINOR, width_minor);
    GET_ABS(ABS_MT_ORIENTATION, orientation);
    GET_ABS(ABS_MT_PRESSURE, pressure);
    GET_ABS(ABS_MT_DISTANCE, distance);
#undef GET_ABS
}

static int read_cur_slot(int eventfd) {
    struct input_absinfo slot_info = {0};
    if (ioctl(eventfd, EVIOCGABS(ABS_MT_SLOT), &slot_info) < 0) {
        ERROR("ioctl(EVIOCGABS) failed: %s", strerror(errno));
        return 0;
    } else if (slot_info.value >= 0 && slot_info.value < MAX_TOUCHES) {
        return slot_info.value;
    } else {
        return 0;
    }
}

void mt_slot_wait_for_no_touch(int eventfd) {
    uint32_t touch_bitmask = 0;
    {
        struct native_touch touches[MAX_TOUCHES];
        memset(touches, -1, sizeof(touches));
        read_mt_slots(eventfd, touches);
        for (int i = 0; i < MAX_TOUCHES; i++) {
            if (touches[i].id >= 0)
                touch_bitmask |= (1 << i);
        }
    }

    int cur_slot = read_cur_slot(eventfd);
    struct input_event event = {
            .type = EV_SYN,
            .code = SYN_REPORT,
            .value = 0,
    };
    /* Only exit once we've received the SYN_REPORT */
    while(touch_bitmask || event.type != EV_SYN || event.code != SYN_REPORT) {
        ssize_t res = read(eventfd, &event, sizeof(event));
        if(res < (int)sizeof(event)) {
            ERROR("Short read on eventfd!");
            goto done;
        }
        if (event.type != EV_ABS)
            continue;
        if (event.code == ABS_MT_SLOT && event.value >= 0 && event.value < MAX_TOUCHES)
            cur_slot = event.value;
        else if (event.code == ABS_MT_TRACKING_ID) {
            if (event.value == -1) {
                touch_bitmask &= ~(1 << cur_slot);
            } else {
                touch_bitmask |= (1 << cur_slot);
            }
        }
    }
done:
    return;
}

struct native_touch mt_slot_wait_for_touch(int eventfd) {
    struct native_touch touches[MAX_TOUCHES];
    memset(touches, -1, sizeof(touches));
    struct native_touch *touch = &touches[0];

    /* Load current values */
    read_mt_slots(eventfd, touches);
    touch = &touches[read_cur_slot(eventfd)];

    struct input_event events[MAX_EVENTS];
    while(1) {
        /* Batch read for efficiency */
        ssize_t res = read(eventfd, events, sizeof(events));
        if(res == -1) {
            ERROR("read failed: %s", strerror(errno));
            goto done;
        } else if(res < (int)sizeof(struct input_event)) {
            ERROR("short read: got %zd bytes", res);
            goto done;
        }

        for(const struct input_event *event = &events[0];
            event < &events[res / sizeof(struct input_event)];
            event++) {
            VERBOSE("event type=%d code=0x%02x value=%08x", event->type, event->code, (uint32_t)event->value);

            if(event->type == EV_KEY && event->code == BTN_TOUCH) {
                continue;
            } else if(event->type == EV_ABS) {
                switch(event->code) {
                    case ABS_MT_SLOT:
                        /* We're switching input slots. If we have a complete touch, return it now. */
                        if(touch->id >= 0)
                            goto done;
                        touch = &touches[event->value];
                        break;
                    case ABS_MT_TRACKING_ID:
                        /* n.b. touch->id might be -1, in which case it means "touch up" */
                        touch->id = event->value;
                        break;
                    case ABS_MT_POSITION_X:
                        touch->x = event->value;
                        break;
                    case ABS_MT_POSITION_Y:
                        touch->y = event->value;
                        break;
                    case ABS_MT_TOUCH_MAJOR:
                        touch->touch_major = event->value;
                        break;
                    case ABS_MT_TOUCH_MINOR:
                        touch->touch_minor = event->value;
                        break;
                    case ABS_MT_WIDTH_MAJOR:
                        touch->width_major = event->value;
                        break;
                    case ABS_MT_WIDTH_MINOR:
                        touch->width_minor = event->value;
                        break;
                    case ABS_MT_ORIENTATION:
                        touch->orientation = event->value;
                        break;
                    case ABS_MT_PRESSURE:
                        touch->pressure = event->value;
                        break;
                    case ABS_MT_DISTANCE:
                        touch->distance = event->value;
                        break;
                    default:
                        DEBUG("Unhandled EV_ABS: code=0x%02x value=%08x", event->code, (uint32_t)event->value);
                        break;
                }
            } else if(event->type == EV_SYN && event->code == SYN_REPORT) {
                /* If we have a complete touch, report it now. */
                if(touch->id >= 0)
                    goto done;
            } else {
                DEBUG("Unhandled event: type=%d code=0x%02x value=%08x", event->type, event->code, (uint32_t)event->value);
            }
        }
    }

done:
    return *touch;
}
