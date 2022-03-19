# HandIK

## Setup

These instructions can help you get started with HandIK. While some parts are
specific to Ubuntu, these instructions should serve as a general outline of 
how to install HandIK other operating systems.

### Main Server

*Prerequisites.* Ensure the following are installed on your terminal. 

* [node](https://nodejs.org/en/) (once installed, run `node -v` to ensure the
  version is 12 or higher)

* [yarn](https://yarnpkg.com/)

* [unbuffer](https://linux.die.net/man/1/unbuffer) (included in the package
  `expect`, do `sudo apt install expect` on Ubuntu e.g.)

* Run `python3 -m pip install numpy flask scikit-learn scipy scikit-image matplotlib requests Werkzeug` to install the necessary packages

* Install OpenCV 2 for Python 3. Use [this guide](https://docs.opencv.org/master/d2/de6/tutorial_py_setup_in_ubuntu.html) for Ubuntu, or follow a similar guide for other operating systems.

1. cd to server (folder)
2. Run `yarn install` to install dependencies
3. Run `yarn compile` to build
4. Run `yarn start` to start the server

<!-- ### IK Server

*Prerequisites.* Ensure blender is installed on the command line. Use `sudo apt install blender` on Ubuntu

1. Open a separate terminal
2. cd to server (folder), if it is not already the current directory
3. Run `wget
https://download.blender.org/release/Blender2.83/blender-2.83.9-linux64.tar.xz`
to download blender
4. Run `mkdir -p blender && tar -xf blender-2.83.9-linux64.tar.xz -C blender` to extract 
5. Run `blender/blender-2.83.9-linux64/2.83/python/bin/python3.7m -m ensurepip`
to install pip for python in blender
6. Run `blender/blender-2.83.9-linux64/2.83/python/bin/python3.7m -m pip install flask` 
to install flask for python in blender
3. Run `blender/blender-2.83.9-linux64/blender res/hand.blend -b -P hand_ik_flask.py` to start blender server -->

### Blender View

*Prerequisites.* Ensure [Blender](https://www.blender.org/) (version at least 2.83) is installed.

1. Start blender
2. Open `server/res/hand.blend`
3. Press the play icon in the lower right of the left panel (you may have to
expand the panel to see the button). The right panel will update automatically.

### Tablet Application

*Prerequisites.* It is recommended to use Android Studio for this portion.

1. Using Android Studio, import `device/android` as a Gradle project. 

2. Edit `android/HandIK/src/main/java/com/figlab/handik/MainActivity.java`, line
27 to reflect the local ip address of the computer running the servers above.

3. Use Android Studio to compile and upload the app to your tablet.

### Starting Up

Navigate to http://localhost:5000/view/hand/blender2 to start!