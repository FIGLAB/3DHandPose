package com.figlab.capimage;

public class CapImageStreamer {
    public interface CapImageCallback {
        void onCapImage(CapacitiveImage sample);
    }

    private CapImageCallback callback;
    private Thread readThread;
    private boolean readThreadShouldRun;

    public CapImageStreamer(CapImageCallback callback) {
        this.callback = callback;
    }

    /* Start streaming cap images. Call this in your onResume. */
    public void start() {
        CapImage.resume();
        if(readThread != null)
            return;
        readThreadShouldRun = true;
        readThread = new Thread(new Runnable() {
            @Override
            public void run() {
                while(readThreadShouldRun) {
                    long time = System.currentTimeMillis();
                    short[] img = CapImage.readImage();
                    //callback.onCapImage(new CapacitiveImage(time, img));
                    callback.onCapImage(new CapacitiveImage(time, img));
                }
            }
        });
        readThread.start();
    }

    /* Start streaming cap images. Call this in your onPause. */
    public void stop() {
        CapImage.pause();
        if(readThread != null) {
            readThreadShouldRun = false;
            try {
                readThread.join();
            } catch(InterruptedException e) {
                e.printStackTrace();
            }
            readThread = null;
        }
    }
}
