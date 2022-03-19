package com.figlab.handik;

import android.util.Log;

import com.google.gson.Gson;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.SocketException;
import java.util.Arrays;

public class UDPReceiver implements Runnable {
    private static final String TAG = UDPReceiver.class.getSimpleName();

    UDPResultListener resultListener;

    private int port;
    private boolean run = true;
    DatagramSocket udpSocket;
    byte[] message = new byte[500];

    public UDPReceiver (int pPort, UDPResultListener pResultListener){
        this.port = pPort;
        this.resultListener = pResultListener;

        try {
            udpSocket = new DatagramSocket(port);
        } catch (SocketException e) {
            e.printStackTrace();
        }
    }

    @Override
    public void run() {
        while (run) {
            try {

                DatagramPacket packet = new DatagramPacket(message,message.length);
                Log.i(TAG, "wait to receive ...");
                udpSocket.receive(packet);
                String text = new String(message, 0, packet.getLength());
                PipelineResult result =  new Gson().fromJson(text, PipelineResult.class);
                resultListener.onResult(result);
                Log.d(TAG, "Received data x:" + Arrays.toString(result.x) +  " y: "+ Arrays.toString(result.y) + " r: "+ Arrays.toString(result.r));
            }catch (IOException e) {
                Log.e(TAG, "IOException: " + e.toString());
                run = false;
            }
        }
    }
}
