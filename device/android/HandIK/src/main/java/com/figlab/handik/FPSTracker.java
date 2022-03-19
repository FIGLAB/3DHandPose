package com.figlab.handik;

public class FPSTracker {
    private double alpha;
    private double prev;
    private double delta;

    public FPSTracker(double alpha) {
        this.alpha = alpha;
        reset();
    }

    public FPSTracker() {
        this(0.05);
    }

    /* Reset the FPS tracker */
    public void reset() {
        prev = Double.NaN;
        delta = Double.NaN;
    }

    /* Tick the FPS tracker. Call this at a fixed rate. */
    public void tick() {
        if (Double.isNaN(this.prev))
            return;
        if (Double.isNaN(this.delta))
            return;

        double now = System.currentTimeMillis() / 1000.0;
        if (now - this.prev < delta) {
            /* Update happened recently, ignore this tick */
            return;
        }
        double newdelta = now - this.prev;
        this.delta += this.alpha * (newdelta - this.delta);
    }

    /* Update the FPS tracker. Call when a new event arrives. */
    public void update() {
        double now = System.currentTimeMillis() / 1000.0;

        if (Double.isNaN(this.prev)) {
            /* First event */
            this.prev = now;
            return;
        }

        if (Double.isNaN(this.delta)) {
            /* Second event, use it to build initial FPS estimate */
            this.delta = now - this.prev;
            this.prev = now;
            return;
        }

        double newdelta = now - this.prev;
        this.delta += this.alpha * (newdelta - this.delta);
        this.prev = now;
    }

    /* Get the current FPS */
    public double fps() {
        return 1.0 / this.delta;
    }
}
