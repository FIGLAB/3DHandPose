#pragma once

#include <stdint.h>

#include "native_touch.h"

/* Keep in sync with com.figlab.capimage.CapImage.ImageType */
enum image_mode {
    IMAGE_MODE_DEFAULT = 0,
    IMAGE_MODE_RAW = 1,
    IMAGE_MODE_BASELINE = 2,
};

extern int cap_image_width, cap_image_height;
extern int cap_screen_width, cap_screen_height;
extern float cap_phys_width, cap_phys_height;

int cap_init(void);
int cap_resume(void);
int cap_pause(void);
int cap_request(void);
void cap_read(int16_t *data);
struct native_touch cap_on_touch(int16_t *data);
int cap_set_mode(enum image_mode mode);
