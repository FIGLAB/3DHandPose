package com.figlab.handik;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.os.Build;
import android.os.Environment;
import android.util.AttributeSet;
import android.util.Log;
import android.util.Size;
import android.view.MotionEvent;
import android.view.View;

import com.figlab.capimage.CapImage;
import com.figlab.capimage.CapImageStreamer;
import com.figlab.capimage.CapacitiveImage;
import com.figlab.capimage.TouchDetector;
import com.figlab.capimage.TouchTracker;
import com.figlab.capimage.TouchTracker.TouchMap;
import com.figlab.capimage.TouchTracker.TouchMapCallback;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Locale;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;

import com.google.gson.Gson;

public class CapView extends View implements TouchMapCallback, CapImageStreamer.CapImageCallback, UDPResultListener {
    private static final String TAG = CapView.class.getSimpleName();


    // --------------------------------------------------------
    // --------------------------------------------------------
    //                        OPTIONS
    // --------------------------------------------------------
    // --------------------------------------------------------
    private boolean showInformation = true;
    private boolean showText = false;
    private boolean showMatrix = true;
    private boolean showNegativeValues = false;
    private boolean showTouchPoints = false;
    private int viewOffset = 0;

    // TODO: Set your IP
    private String streamIpAddress = "192.168.1.34";
    // --------------------------------------------------------

    private DatagramSocket socket;
    InetAddress addrIp;
    int port = 7000;
    PipelineResult pipelineResult = new PipelineResult();

    private Gson gson = new Gson();
    private FileWriter writer = null;

    private short[] capImage;
    private FPSTracker capFPS = new FPSTracker();



    private CapImageStreamer capStreamer = new CapImageStreamer(this);
    private TouchDetector touchDetector = new TouchDetector();
    private TouchTracker touchTracker = new TouchTracker();
    private TouchMap touchMap;
    private String ipAddress;

    private double capPixelSizeInMm;

    private long time;

    boolean drawText = false;

    // Scanner, Coin, Dungeon, Card

    public CapView(Context context) {
        super(context);
        File root = new File(Environment.getExternalStorageDirectory().getAbsolutePath(), "CapacitiveMatrices");
        Log.i(TAG, "Save Path: " + root.toString());
        if (!root.exists()) {
            if (!root.mkdirs()){
                Log.e(TAG, "Error #001: Folder not created");
            }
        }

        String filename = "recording_" + System.currentTimeMillis() + "-HandIK.json";
        File file = new File(root, filename);
        try {
            writer = new FileWriter(file, true);
        } catch (IOException e) {
            Log.e(TAG, "Error #007:" + e.toString());
        }


        if (Build.PRODUCT.equals("gts210vewifixx")){
            capPixelSizeInMm = 4.022;
        } else {
            throw new UnsupportedOperationException("Your device is not supported. Build.PRODUCT:" + Build.PRODUCT + " Build.ID:" + Build.ID);
        }



    //pipelineResult = new PipelineResult(new Float[]{50.0f, 100f}, new Float[]{50.0f, 100f}, new Float[]{25.0f, 35f});

    }

    public CapView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    public CapView(Context context, AttributeSet attrs, int defStyle) {
        super(context, attrs, defStyle);
    }

    @Override
    public void onCapImage(final CapacitiveImage sample) {
        this.capImage = sample.getCapImg();
        new Thread( new Runnable() { @Override public void run() {
            String json = gson.toJson(sample);
            saveToFile(json);
            sendPacket(json);
            // Run whatever background code you want here.
        } } ).start();
        if(capImage != null)
            touchTracker.update(touchDetector.findTouchPoints(capImage), CapView.this);
        capFPS.update();
        postInvalidate();
    }

    private Paint capPaint = new Paint();

    private Paint capValTextPaint = new Paint() {{
        setTextSize(8 * getResources().getDisplayMetrics().density);
        setColor(Color.BLACK);
    }};
    private Paint statusTextPaint = new Paint() {{
        setTextSize(12 * getResources().getDisplayMetrics().density);
        setColor(Color.WHITE);
    }};
    private Paint touchPaint = new Paint() {{
        setColor(Color.RED);
        setStrokeWidth(2);
    }};

    private Paint buttonPaint = new Paint() {{
        setColor(Color.GRAY);
        setStyle(Style.FILL);
        setStrokeWidth(2);
    }};

    private void drawCapImage(Canvas canvas) {
        if (!showMatrix){
            return;
        }

        Size screenSize = CapImage.getScreenSize();
        Size capSize = CapImage.getCapSize();
        int capw = capSize.getWidth();
        int caph = capSize.getHeight();
        float pxw = screenSize.getWidth() / (float) capw;
        float pxh = screenSize.getHeight() / (float) caph;

        for(int y = 0; y < caph; y++) {
            for(int x = 0; x < capw; x++) {
                int val = capImage[y * capw + x];
                if(val < 0 & showNegativeValues) {
                    int color = Math.max(0, Math.min(-val * 5, 255));
                    capPaint.setARGB(255, 0, color, color);
                    capValTextPaint.setARGB(255, 0, 0, 0);
                } else if(val > 0) {
                    int color =  Math.max(0, Math.min(val, 255));
                    capPaint.setARGB(255, color, color, color);
                    int tcolor = (color < 127) ? 180 : 0;
                    capValTextPaint.setARGB(255, tcolor, tcolor, tcolor);
                } else {
                    continue;
                }

                canvas.drawRect(x * pxw, y * pxh, (x + 1) * pxw, (y + 1) * pxh, capPaint);
                if (showText) {
                    canvas.drawText(Integer.toString(val), x * pxw, (y + 1) * pxh, capValTextPaint);
                }
            }
        }
    }

    private void drawTouchPoint(Canvas canvas, MotionEvent.PointerCoords touch) {
        drawTouchPoint(canvas, touch, 10, Color.TRANSPARENT);
    }

    Paint _paintBlur = new Paint();


    /***
     *
     * @param canvas
     * @param touch
     * @param r
     * @param glow Color.TRANSPARENT for no glow effect
     */
    private void drawTouchPoint(Canvas canvas, MotionEvent.PointerCoords touch, double r, int glow) {
        canvas.save();

        //_paintBlur.set(_paintSimple);
        //_paintBlur.setColor(Color.argb(235, 255, 0, 0));

        //_paintSimple.setAntiAlias(true);
        //_paintSimple.setDither(true);
        //_paintSimple.setColor(Color.argb(248, 255, 255, 255));
        //_paintSimple.setStrokeWidth(10f);
        //_paintSimple.setStyle(Paint.Style.STROKE);
        //_paintSimple.setStrokeJoin(Paint.Join.ROUND);
        //_paintSimple.setStrokeCap(Paint.Cap.ROUND);

        canvas.translate(touch.x, touch.y);
        touchPaint.setStyle(Paint.Style.STROKE);

        if (glow != Color.TRANSPARENT){
            _paintBlur.setStyle(Paint.Style.FILL);
            _paintBlur.setStrokeWidth(10f);
            _paintBlur.setDither(true);
            _paintBlur.setAntiAlias(true);
            RadialGradient radialGradient = new RadialGradient(0,0, (float)r*2, glow, Color.TRANSPARENT , Shader.TileMode.CLAMP);
            _paintBlur.setShader(radialGradient);
            canvas.drawOval((float)-r, (float)-r, (float)r, (float)r, _paintBlur);
        } else  {
            canvas.drawOval((float)-r, (float)-r, (float)r, (float)r, touchPaint);
        }

        if (false){
            if(touch.pressure > 0) {
                float pr = touch.pressure * 20;
                canvas.drawOval(-pr, -pr, pr, pr, touchPaint);
            }
            /* TODO: orientation, distance */
            if(touch.touchMajor > 0 && touch.touchMinor > 0) {
                float rx = touch.touchMajor * 20;
                float ry = touch.touchMinor * 20;
                canvas.drawOval(-rx, -ry, rx, ry, touchPaint);
            }
            canvas.rotate(touch.orientation);
        }
        canvas.restore();
    }





    private float[] fingerHSV = new float[] {0, 1, 1};

    @Override
    protected void onDraw(Canvas canvas) {
        canvas.drawRGB(0, 0, 0);

        canvas.save();
        canvas.translate(0, -viewOffset * CapImage.getScreenSize().getHeight() / (float)CapImage.getCapSize().getHeight());
        if(capImage != null) {
            drawCapImage(canvas);
        }



        if(touchMap != null & showTouchPoints) {
            for(Map.Entry<MotionEvent.PointerProperties, MotionEvent.PointerCoords> ent : touchMap.entrySet()) {
                fingerHSV[0] = (ent.getKey().id * 100) % 360; // hue
                touchPaint.setColor(Color.HSVToColor(fingerHSV));

                drawTouchPoint(canvas, ent.getValue());
            }
        }
        canvas.restore();

        float statusTextHeight = statusTextPaint.getTextSize();
        int statusTextY = 1;

        if (showInformation) {
            canvas.drawText(String.format(Locale.ROOT, "Tablet IP: %s", ipAddress), 0, (statusTextY++) * statusTextHeight, statusTextPaint);
            canvas.drawText(String.format(Locale.ROOT, "Stream IP: %s", streamIpAddress), 0, (statusTextY++) * statusTextHeight, statusTextPaint);
            canvas.drawText(String.format(Locale.ROOT, "View offset: %d", viewOffset), 0, (statusTextY++) * statusTextHeight, statusTextPaint);
            canvas.drawText(String.format(Locale.ROOT, "Read FPS: %.1f", capFPS.fps()), 0, (statusTextY++) * statusTextHeight, statusTextPaint);
        }


        if (pipelineResult != null){
            drawPipelineResult(canvas);
        }


    }

    private double distance (double x1, double x2, double y1, double y2){
        return Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
    }

    private void drawPipelineResult(Canvas canvas){
        //TODO: You may want to updated the drawing based on your IK Model Resutls.
    }

    public void onResume() {
        capStreamer.start();
    }

    public void onPause() {
        capStreamer.stop();
    }

    public void onVolumeUp() {
        viewOffset++;
        invalidate();
    }

    public void onVolumeDown() {
        viewOffset--;
        invalidate();
    }

    @Override
    public void onNewTouchMap(TouchMap newTouchMap) {
        touchMap = newTouchMap;
    }


    public void close(){
        try {
            writer.close();
        } catch (IOException e) {
            Log.e(TAG, "Error #004: " + e.toString());
        }
    }

    private void saveToFile(String data) {
        if (data.length() == 0)
            return;
        try {
            writer.append(data + "\n");
        } catch (Exception e) {
            //Log.e(TAG," Error #002: " + e.toString());
        }
    }

    private void sendPacket(String message) {

        if (message.length() == 0)
            return;

        byte[] messageData = message.getBytes();

        try {
            if (addrIp != null) {
                DatagramPacket sendPacket = new DatagramPacket(messageData, 0, messageData.length, addrIp, port);
                if (socket == null) {
                    socket = new DatagramSocket(port);
                }
                socket.send(sendPacket);
            }
        } catch (UnknownHostException e) {
            Log.e("MainActivity sendPacket", "getByName failed");
        } catch (IOException e) {
            Log.e("MainActivity sendPacket", "send failed: " + e.toString());
        }
    }

    public void onDestroy() {
        socket.disconnect();
        socket.close();
    }

    public void setIp(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    @Override
    public void onResult(PipelineResult result) {
        this.pipelineResult = result;
        time = System.currentTimeMillis();
        Timer timer = new Timer();
        timer.schedule(new TimerTask() {
            @Override
            public void run() {
                Log.d(TAG, "run");
                // Your database code here
                if (time + 500 < System.currentTimeMillis()){
                    pipelineResult = new PipelineResult();
                }
            }
        }, 500);
    }

    public void setStreamIp(String streamIpAddress) {
        this.streamIpAddress = streamIpAddress;

        try {
            addrIp = InetAddress.getByName(streamIpAddress);

        } catch (UnknownHostException e) {
            Log.e(TAG, "Error #010:" + e.toString());
        }
    }
}
