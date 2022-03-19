package com.figlab.capimage;

import java.io.Serializable;

public class CapacitiveImage implements Serializable {

    @SuppressWarnings({"unused"})
    private short[] matrix;

    private long timeStamp;

    public CapacitiveImage(){

    }

    public CapacitiveImage(long timestamp, short[] matrix) {
        this.matrix = matrix;
        this.timeStamp = timestamp;
    }

    @SuppressWarnings("unused")
    public long getTimeStamp() {
        return timeStamp;
    }

    public void set(long timestamp, short[] matrix) {
        this.matrix = matrix;
        this.timeStamp = timestamp;
    }

    public short[] getCapImg() {
        return this.matrix;
    }
}
