package com.figlab.capimage;

import android.util.Log;

import com.google.gson.Gson;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.UnknownHostException;

public class CapImageServer implements CapImageStreamer.CapImageCallback {
    private static final String TAG = CapImageServer.class.getSimpleName();

    private String streamIpAddress = "128.2.101.24";

    private DatagramSocket socket;
    InetAddress addrIp;
    int port = 7000;

    int i = -10;

    private Gson gson = new Gson();

    private CapImageStreamer capStreamer = new CapImageStreamer(this);

    public CapImageServer(){
        setStreamIp(streamIpAddress);
    }

    public void test(){
        Log.d(TAG, "CapImageServer TEST");
    }

    public static int testStatic (){
        return -100;
    }

    public int test2 (){
        i = i + 1;
        return i;
    }

    public void start(){

        capStreamer.start();
    }


    public void stop(){

        capStreamer.stop();
    }

    public void setStreamIp(String streamIpAddress) {
        this.streamIpAddress = streamIpAddress;

        try {
            addrIp = InetAddress.getByName(streamIpAddress);

        } catch (UnknownHostException e) {
            Log.e(TAG, "Error #010:" + e.toString());
        }
    }

    public void setStreamPort(int pPort) {
        this.port = pPort;

        if (socket != null) {
            socket = null;
        }
    }

    @Override
    public void onCapImage(final CapacitiveImage sample) {
        Log.d(TAG, "START New Capacitive Image");
        new Thread( new Runnable() { @Override public void run() {
            String json = gson.toJson(sample);
            //saveToFile(json);
            sendPacket(json);
            // Run whatever background code you want here.
        } } ).start();

        Log.d(TAG, "END New Capacitive Image");
    }

    private void sendPacket(String message) {
        Log.d(TAG, "sendPacket");
        if (message.length() == 0) {
            Log.e(TAG, "ERROR #001: No Data to send");
            return;
        }

        byte[] messageData = message.getBytes();

        try {
            if (addrIp != null) {
                DatagramPacket sendPacket = new DatagramPacket(messageData, 0, messageData.length, addrIp, port);
                if (socket == null) {
                    socket = new DatagramSocket(port);
                }
                Log.i(TAG, "Sending data to: " + addrIp.toString() + ":" + port);
                socket.send(sendPacket);
            } else {
                Log.e(TAG, "ERROR #004: ip address not set");
            }
        } catch (UnknownHostException e) {
            Log.e(TAG, "ERROR #002: UnknownHostException " + e.toString());
        } catch (IOException e) {
            Log.e(TAG, "ERROR #003: IOException " + e.toString());
        }
    }
}
