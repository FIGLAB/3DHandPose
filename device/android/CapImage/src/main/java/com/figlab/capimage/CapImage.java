package com.figlab.capimage;

import android.os.Build;
import android.util.Log;
import android.util.Size;
import android.util.SizeF;

public final class CapImage {
    private static final String TAG = CapImage.class.getSimpleName();
    /* These fields are filled in by the native library */
    @SuppressWarnings("unused")
    private static int capWidth, capHeight;
    @SuppressWarnings("unused")
    private static int screenWidth, screenHeight;
    @SuppressWarnings("unused")
    private static float physWidth, physHeight;

    /** Number of capacitive pixels in the horizontal direction */
    public static int getCapWidth() { return capWidth; }
    /** Number of capacitive pixels in the vertical direction */
    public static int getCapHeight() { return capHeight; }
    /** Size of the capacitive array */
    public static Size getCapSize() {
        return new Size(capWidth, capHeight);
    }

    /** Number of display pixels in the horizontal direction */
    public static int getScreenWidth() { return screenWidth; }
    /** Number of display pixels in the vertical direction */
    public static int getScreenHeight() { return screenHeight; }
    /** Native resolution of the display */
    public static Size getScreenSize() {
        return new Size(screenWidth, screenHeight);
    }

    /** Physical width of the touchscreen, in millimetres */
    public static float getPhysicalWidth() { return physWidth; }
    /** Physical height of the touchscreen, in millimetres */
    public static float getPhysicalHeight() { return physHeight; }
    /** Touchscreen size (excluding bezels, etc.) in millimetres */
    public static SizeF getPhysicalSize() {
        return new SizeF(physWidth, physHeight);
    }

    /** Initialize capacitive image capture */
    private static native void init();
    /** Pause capture, releasing resources. This should be done before the screen goes to sleep. */
    public static native void pause();
    /** Resume capture. This usually *must* be done after the screen comes back from sleep. */
    public static native void resume();
    private static native boolean setMode(int mode);

    public static boolean setImageType(ImageType type) {
        return setMode(type.id);
    }

    public enum ImageType {
        DEFAULT(0),
        RAW(1),
        BASELINE(2),
        ;

        ImageType(int id) {
            this.id = id;
        }
        private int id;
    }

    /** Obtain a capacitive image immediately.
     *
     * @return Flattened capacitive image (size interpreted using capWidth/capHeight)
     */
    public static native short[] readImage();

    /** Wait for the next finger touch, and get the capacitive image immediately afterwards.
     * This method avoids the delay introduced by the Android input framework.
     * @param touch Touch object to be filled in - must not be {@code null}.
     * @return Flattened capacitive image (size interpreted using deviceInfo)
     */
    public static native short[] waitForTouch(NativeTouch touch);

    static {
        /* Try a build-specific library; fall back to the generic product-library if that fails */
        try {
            System.loadLibrary("CapImage_" + Build.PRODUCT + "_" + Build.ID);
        } catch(UnsatisfiedLinkError e) {
            Log.d("CapImage", "Build-specific library not loaded: " + e.toString());
            System.loadLibrary("CapImage_" + Build.PRODUCT);
        }

        init();
    }
}
