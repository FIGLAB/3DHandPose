#pragma once

#include "native_touch.h"

void mt_slot_wait_for_no_touch(int eventfd);
struct native_touch mt_slot_wait_for_touch(int eventfd);
