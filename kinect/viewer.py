# coding: utf-8

import numpy as np
#import cv2
import sys
from pylibfreenect2 import Freenect2, SyncMultiFrameListener
from pylibfreenect2 import FrameType, Registration, Frame
from pylibfreenect2 import createConsoleLogger, setGlobalLogger
from pylibfreenect2 import LoggerLevel

from http.server import BaseHTTPRequestHandler, HTTPServer
import json

#from pylibfreenect2 import OpenCLKdePacketPipeline
#pipeline = OpenCLKdePacketPipeline(2)
from pylibfreenect2 import OpenGLPacketPipeline
pipeline = OpenGLPacketPipeline()
#from pylibfreenect2 import OpenCLPacketPipeline
#pipeline = OpenCLPacketPipeline()
#from pylibfreenect2 import CpuPacketPipeline
#pipeline = CpuPacketPipeline()
print("Packet pipeline:", type(pipeline).__name__)
setGlobalLogger(None)


from PyQt5 import QtGui
from PyQt5 import QtCore
print("Qt version {0}".format(QtCore.QT_VERSION_STR))
from PyQt5 import QtWidgets
from PyQt5.QtWidgets import QApplication, QWidget, QDialog, QPushButton, QVBoxLayout, QLabel

#import matplotlib
#matplotlib.use("Qt5Agg")
#import matplotlib.pyplot as plt
#from matplotlib.figure import Figure
#from matplotlib.animation import TimedAnimation
#from matplotlib.lines import Line2D
#from matplotlib.backends.backend_qt4agg import FigureCanvasQTAgg as FigureCanvas

import pyqtgraph as pg

import threading

import time

TIMESTAMP = 0
TIMESTAMP_HTTP = 0
imgDepth = np.zeros((424, 512),  np.int32)
imgIr = np.zeros((424, 512),  np.int32)
FPS = 0.0

from pathlib import Path
Path("./data/").mkdir(parents=True, exist_ok=True)


class DataSignals(QtCore.QObject):
    save = QtCore.pyqtSignal(int)
    
class Handler(BaseHTTPRequestHandler):
    def __init__(self, request, client_address, server):
        BaseHTTPRequestHandler.__init__(self, request, client_address, server)
        self.signals = None
        
    def _set_response(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    def do_GET(self):
        logging.info("GET request,\nPath: %s\nHeaders:\n%s\n", str(self.path), str(self.headers))

    def do_POST(self):
        global TIMESTAMP_HTTP
        content_length = int(self.headers['Content-Length']) 
        post_data = self.rfile.read(content_length)
        dataString = post_data.decode('utf-8')
        
        #print("POST request,\nPath: %s\nHeaders:\n%s\n\nBody:\n%s\n",
        #        str(self.path), str(self.headers), dataString)
                
        dataDict = json.loads(dataString)
        TIMESTAMP_HTTP = dataDict["timeStamp"]
        print("Time", TIMESTAMP_HTTP)
        #print("BaseHTTPRequestHandler: Message time : %i from %s"  % (time, addr))
        self.signals.save.emit(TIMESTAMP_HTTP)

    def setSignals(self, signals):
    	self.signals = signals

class QtWebServer(QtCore.QThread):
    def __init__(self, *args, **kwargs):
        super(QtWebServer, self).__init__()

        self.args = args
        self.kwargs = kwargs
        self.signals = DataSignals()    

        self.port = 7777 
        self.ip = "0.0.0.0" 
        
        print("QtWebServer: Waiting for data...")
        
        Handler.signals = self.signals
        self.httpd = HTTPServer((self.ip, self.port), Handler)
        
        #self.httpd.handler.seignals(singals)
        
        #httpd.server_close()


    def run(self):
        '''
        Your code goes in this function
        '''
        print("Server: Run...")
        try:
        	self.httpd.serve_forever()
        except KeyboardInterrupt:
        	pass
        

def getData():

    global imgDepth, imgIr
    global TIMESTAMP
    global FPS

        # Create and set logger
    logger = createConsoleLogger(LoggerLevel.Debug)
    setGlobalLogger(logger)

    fn = Freenect2()
    num_devices = fn.enumerateDevices()
    if num_devices == 0:
        print("No device connected!")
        sys.exit(1)

    serial = fn.getDeviceSerialNumber(0)
    device = fn.openDevice(serial, pipeline=pipeline)

    listener = SyncMultiFrameListener(FrameType.Color | FrameType.Ir | FrameType.Depth)

    # Register listeners
    device.setColorFrameListener(listener)
    device.setIrAndDepthFrameListener(listener)
    device.start()

    # NOTE: must be called after device.start()
    registration = Registration(device.getIrCameraParams(), device.getColorCameraParams())

    undistorted = Frame(512, 424, 4)
    registered = Frame(512, 424, 4)
    bigdepth = None
    color_depth_map = None

    # Optinal parameters for registration
    # set True if you need
    need_bigdepth = False
    need_color_depth_map = False

    if need_bigdepth:
        bigdepth = Frame(1920, 1082, 4)
    if need_color_depth_map:
        color_depth_map = np.zeros((424, 512),  np.int32).ravel()

    start_time = time.time()
    FPS_avg = 1 # displays the frame rate every 1 second
    counter = 0
    while True:
        frames = listener.waitForNewFrame()
        new_time = int(time.time()*1000)

        color = frames["color"]
        ir = frames["ir"]
        depth = frames["depth"]

        registration.apply(color, depth, undistorted, registered,
                           bigdepth=bigdepth,
                           color_depth_map=color_depth_map)
        

        # NOTE for visualization:
        # cv2.imshow without OpenGL backend seems to be quite slow to draw all
        # things below. Try commenting out some imshow if you don't have a fast
        # visualization backend.
        #if False:
        #    cv2.imshow("ir", ir.asarray() / 65535.)
        #
        #if False:
        #    cv2.imshow("color", cv2.resize(color.asarray(),  (int(1920 / 3), int(1080 / 3))))
#
        #if False:
        #    cv2.imshow("registered", registered.asarray(np.uint8))
#
        #if need_bigdepth:
        #    mat = bigdepth.asarray(np.float32)
        #    mat = np.clip(mat, a_min = 0, a_max = 1000000) 
        #    print("bigdepth: " + str(np.min(mat)) + ", " + str(np.max(mat)))
        #    mat = mat / np.max(mat)
        #    cv2.imshow("bigdepth", cv2.resize(mat , (int(1920 / 3), int(1082 / 3))))
        #if need_color_depth_map:
        #    cv2.imshow("color_depth_map", color_depth_map.reshape(424, 512))


        mat = depth.asarray(dtype=np.float32)
        mat = mat.astype(np.uint16)
        imgDepth = np.clip(mat, a_min = 0, a_max = 18750)
        #np.save("./data/" + str(time.time_ns()) + "_" + str(TIMESTAMP) + ".npy", mat)

        imgIr = ir.asarray(dtype=np.float32)
        #print(imgIr.shape, np.min(imgIr), np.max(imgIr))
        #imgIr = np.clip(mat, a_min = 0, a_max = 255)

        #print("depth: " + str(np.min(imgDepth)) + ", " + str(np.max(imgDepth)) + " shape: " + str(imgDepth.shape) )
        listener.release(frames)

        counter+=1
        if (time.time() - start_time) > FPS_avg :
            FPS = counter / (time.time() - start_time)
            counter = 0
            start_time = time.time()

        #done
        TIMESTAMP = new_time

    device.stop()
    device.close()


class Window(QDialog):
    def __init__(self, parent=None):
        super(Window, self).__init__(parent)
        self.resize(800, 600)
        self.oldTS = 0
        
        win = pg.GraphicsWindow()
        

        imagedata = np.random.random((49,37))
        self.image = pg.ImageItem(imagedata, levels=(0,255))

        imagedata = np.random.random((49,37))
        self.imageIR = pg.ImageItem(imagedata, levels=(0,255))

        self.plot1 = win.addPlot()
        self.plot1.addItem(self.image)
        self.plot2 = win.addPlot()
        self.plot2.addItem(self.imageIR)
        self.button = QPushButton('Plot')
        self.labelFPS = QLabel('FPS')

        thread = threading.Thread(target = getData)
        thread.daemon = True
        thread.start()
        
        # set the layout
        layout = QtWidgets.QGridLayout()
        layout.setSpacing(10)

        self.buttonSave = QtWidgets.QPushButton('Save')
        self.buttonSave.clicked.connect(self.save)

        layout.addWidget(self.labelFPS, 0, 0)
        layout.addWidget(self.buttonSave, 0, 1)
        layout.addWidget(win, 1, 0, 5, 2)
        self.setLayout(layout)
        
        self.listener = QtWebServer()
        self.listener.signals.save.connect(self.saveCommand)
        self.listener.start()
        
        thread2 = threading.Thread(target = self.loop)
        thread2.daemon = True
        thread2.start()
        
        
    def showData(self):
        global TIMESTAMP
        global imgDepth, imgIr
        if (TIMESTAMP != self.oldTS):
            self.oldTS = TIMESTAMP
            self.image.setImage(imgDepth, levels=(0,2000))
            self.imageIR.setImage(imgIr)
        
            self.labelFPS.setText("FPS %.2f" % FPS)
        
    def loop(self):
        while True:
            self.showData()


    def saveCommand(self, ts):
        print("Saving... %i .... %i" % (ts, TIMESTAMP_HTTP))
        np.save("./data/" + str(TIMESTAMP_HTTP) + "_depth.npy", imgDepth)
        np.save("./data/" + str(TIMESTAMP_HTTP) + "_ir.npy", imgIr)
        print("Saved")
        
    def save(self):
        print("Saving...")
        np.save("./data/" + str(TIMESTAMP) + "_depth.npy", imgDepth)
        np.save("./data/" + str(TIMESTAMP) + "_ir.npy", imgIr)
        print("Saved")

if __name__ == "__main__":
    import sys

    app = QApplication(sys.argv)

    main = Window()
    main.show()

    sys.exit(app.exec_())
