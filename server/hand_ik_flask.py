import bpy
from mathutils import Matrix
import json
from flask import Flask, request
import os
import sys

DIR = os.path.join(os.path.dirname(bpy.data.filepath), '..')
if not DIR in sys.path:
    sys.path.append(DIR)

from hand_ik import compute_ik, reload_cap_image, record, depth_mode, shaded_mode

app = Flask(__name__)


@app.route('/compute-ik', methods=['POST'])
def compute_ik_():
    data = request.get_json()
    result = compute_ik(data)
    return json.dumps(result)

@app.route('/reload-cap-image', methods=['POST'])
def reload_cap_image_():
    data = request.get_json()
    reload_cap_image(data)
    return 200


@app.route('/record', methods=['POST'])
def record_():
    data = request.get_json()
    record(data)
    return 200

@app.route('/depth-mode', methods=['POST'])
def depth_mode_():
    depth_mode()
    return 200

@app.route('/shaded-mode', methods=['POST'])
def shaded_mode_():
    shaded_mode()
    return 200

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=6070)
