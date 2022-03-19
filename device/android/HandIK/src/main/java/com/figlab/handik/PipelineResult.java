package com.figlab.handik;

public class PipelineResult {
    public Float[] x;
    public Float[] y;
    public Float[] r;

    public PipelineResult (){
        this.x = new Float[0];
        this.y = new Float[0];
        this.r = new Float[0];
    }

    public PipelineResult (Float[] x, Float[] y, Float[] r){
        this.x = x;
        this.y = y;
        this.r = r;
    }
}
