## Getting Started

Make sure you have `python3` installed and on the path. The following modules are required:
- flask
- numpy
- opencv
- opencv-contrib-python
- sklearn
- scikit-image

These can be installed with the following command
```
pip3 install flask numpy opencv-python opencv-contrib-python sklearn scikit-image
```

In order to use Blender's IK without GUI, use the following method to install `flask` (instead of `scipy`) https://blender.stackexchange.com/a/122337/5009 . Run with the following command: `blender res/hand.blend --background --python hand_ik_flask.py`

This project uses [yarn](https://classic.yarnpkg.com/en/). Install the
JavaScript modules with `yarn install`.

Compile and run with `npm run build && npm run start`. (Note: you must have
the `unbuffer` command which can be found in the `expect` package)