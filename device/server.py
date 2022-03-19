import sys
import socket 
import json
import queue
import math
import time
import threading
import multiprocessing
import numpy as np

from PyQt5 import QtGui
from PyQt5 import QtCore
print("Qt version {0}".format(QtCore.QT_VERSION_STR))
from PyQt5 import QtWidgets
import pyqtgraph as pg

import cv2
print("OpenCV version {0} ".format(cv2.__version__))

WINDOW_LENGTH = 1
#PixelSizeInMM = 4.022

class DataSignals(QtCore.QObject):
    result = QtCore.pyqtSignal(object)
    fps = QtCore.pyqtSignal(int)

class DataUDPListener(QtCore.QThread):
    '''
    DataUDPListener thread
    '''
    def __init__(self, *args, **kwargs):
        super(DataUDPListener, self).__init__()

        self.args = args
        self.kwargs = kwargs
        self.signals = DataSignals()    


        self.port = 7000 
        self.ip = "0.0.0.0" 
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind((self.ip, self.port))
        print("DataUDPListener: Waiting for data...")
        self.q = queue.Queue(WINDOW_LENGTH)

        self.fpsSecond = 0
        self.fpsCounter = 0


    def run(self):
        '''
        Your code goes in this function
        '''
        print("DataUDPListener: Run...")
        while True:
            data, addr = self.sock.recvfrom(1024*8) # blocking
            dataString = data.decode("utf-8")
            #print("received: %s" % dataString)

            if dataString[-1] == "}":

                dataDict = json.loads(dataString)
                if self.q.full():
                    self.q.get()

                time = dataDict["timeStamp"]
                if time//1000 != self.fpsSecond:
                    self.fpsSecond = time//1000
                    #print("FPS: %i" % self.fpsCounter)
                    self.signals.fps.emit(self.fpsCounter)
                    self.fpsCounter = 0
                else :
                    self.fpsCounter += 1
                m = dataDict["matrix"]
                m = np.array(m)
                #print("length" + str(len(m)))
                m = m.astype(np.float32)
                m = m.reshape((49,37))
                self.q.put(m)
                #print("DataUDPListener: Message time : %i from %s"  % (time, addr))
                self.signals.result.emit(list(self.q.queue))


class Window(QtWidgets.QDialog):
    def __init__(self, parent=None):
        super(Window, self).__init__(parent)

        self.fpsProcess = 0.0
        self.fpsUpdateCounter = 0

        self.sockSend = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

        self.buttonStart = QtWidgets.QPushButton('Start')
        self.buttonStart.clicked.connect(self.start)

        self.labelFps = QtWidgets.QLabel("FPS")

        win = pg.GraphicsWindow()
        self.plot = win.addPlot()

        imagedata = np.random.random((49,37))
        self.image = pg.ImageItem(imagedata, levels=(0,255))
        self.plot.invertY()
        self.plot.setAspectLocked(True)
        self.plot.addItem(self.image)
        self.plot.hideAxis('left')
        self.plot.hideAxis('bottom')


        self.scatterPlot = pg.ScatterPlotItem(size=10, pen=pg.mkPen(None), brush=pg.mkBrush(255, 0, 0, 120))
        self.plot.addItem(self.scatterPlot)

        # set the layout
        layout = QtWidgets.QGridLayout()
        layout.setSpacing(10)

        layout.addWidget(self.buttonStart, 0, 0)
        layout.addWidget(self.labelFps, 0, 1)
        layout.addWidget(win, 1, 0, 5, 2)
        self.setLayout(layout)
        
        self.listener = DataUDPListener()
        self.listener.signals.result.connect(self.plotData)
        self.listener.signals.fps.connect(self.updateFps)
        

    def start(self):
        self.listener.start()

    def sendData(self, dataReturnJsonString):
        byte_message = bytes(dataReturnJsonString, "utf-8")
        try:
            self.sockSend.sendto(byte_message, ("192.168.43.189", 7001))
        except OSError as e:
            print("Error #002: Wrong Ip")

    def prepareSendData(self, lstXY, lstRadius):
        try:
            x = [sublist[0] for sublist in lstXY]
            y = [sublist[1] for sublist in lstXY]
            retrunDict = {"x" : x, "y" : y, "r" : lstRadius}
            print(retrunDict)
            jsonString = json.dumps(retrunDict)
            self.sendData(jsonString)      
        except Exception as e:
            print("Error #002: prepareSendData")
            print(e)   

    def precessedData (self, data):
        duration = time.time() - self.timeStartworker
        self.fpsProcess = 1 / duration
        self.scatterPlot.clear()

        lstMeanBlob, lstXy = data[0], data[1]
        if len(lstMeanBlob) == 0 and len(lstXy) == 0:
            return 

        
        lstXyUsed = []
        lstRadius = []
        for i, blob in enumerate(lstMeanBlob):
            try:
                r, a, b = pipeline.getEllipseSize(blob, pixe_size=PixelSizeInMM)
                if r != None:
                    print(r, lstXy[i])
                    lstRadius.append(r)
                    lstXyUsed.append(lstXy[i])
            except Exception as e:
                print("Error #001: Pipeline failed")
                print(e)

        self.prepareSendData(lstXyUsed, lstRadius) 

        try:
            pixelScale = self.image.pixelSize()[0]
            spots = [{'pos': lstXyUsed[i], 'data': 1, "size":lstRadius[i]/PixelSizeInMM * pixelScale} for i in range(len(lstXyUsed))] # + [{'pos': [0,0], 'data': 1}]
            self.scatterPlot.addPoints(spots)
        except Exception as e:
            print("Error #003: scatterPlot add Points")
            print(e)

        
        
       

    def updateFps (self, fps):
        self.fpsUpdateCounter= self.fpsUpdateCounter % 4
        self.labelFps.setText("FPS: %0.2f%s" % (fps, "." * self.fpsUpdateCounter))
        self.fpsUpdateCounter += 1
        
    def plotData (self, blobs):
        img = blobs[-1].T
        self.image.setImage(img, levels=(0,255))

if __name__ == "__main__":
    
    app = QtWidgets.QApplication(sys.argv)

    main = Window()
    main.show()

    sys.exit(app.exec_())
