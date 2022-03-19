package com.figlab.capimage;

/** This class must be kept in sync with native_touch.h */
public class NativeTouch {
    /* Anything set to -1 is invalid. */
    public int id = -1;
    public int x = -1;
    public int y = -1;

    /* These extra fields are *device-specific*.
     * They may not always be present, and their units and precise meaning are device-specific.
     */
    public int touch_major = -1;
    public int touch_minor = -1;
    public int width_major = -1;
    public int width_minor = -1;
    public int orientation = -1;
    public int pressure = -1; // contact pressure
    public int distance = -1; // hover distance
}
