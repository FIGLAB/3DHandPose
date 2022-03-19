#pragma once

/** Struct representing a native Linux touch input.
 *
 * Should match the {@link com.figlab.capimage.NativeTouch NativeTouch} Java class */
struct native_touch {
    int id;
    int x;
    int y;

    int touch_major;
    int touch_minor;
    int width_major;
    int width_minor;
    int orientation;
    int pressure; // contact pressure
    int distance; // hover distance
};
