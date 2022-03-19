import sys
import json
import numpy as np
import cv2
from flask import Flask, request, g
from glob import glob
import os
from sklearn.neighbors import NearestNeighbors
from sklearn.decomposition import PCA
from scipy import ndimage, misc, spatial
from skimage.transform import resize
import matplotlib.pyplot as plt
import requests
import time
from werkzeug.middleware.profiler import ProfilerMiddleware
from copy import deepcopy
from scipy.spatial.transform import Slerp, Rotation

###############
#### Model ####
###############


def get_matrix(data):
    matrix = np.array(data["matrix"], dtype=np.float32)
    matrix = matrix.reshape((49, 37))
    return matrix


def T(translation, n=3, m=3):
    result = np.eye(n, m)
    result[:len(translation), -1] = translation
    return result


def R(theta, n=3, m=3):
    result = np.eye(n, m)
    result[:2, :2] = [
        [np.cos(theta), -np.sin(theta)],
        [np.sin(theta),  np.cos(theta)],
    ]
    return result


def S(scale):
    result = np.eye(3, 3)
    result[0, 0] = scale
    result[1, 1] = scale
    return result


def tiny_image(matrix, transform=np.eye(3, 3), threshold=25, align=True, binary_output=True, final_size=50, scale=1):
    # threshold the cap matrix to get tiny image
    threshold = 25

    transform[:] = T([-final_size/2, -final_size/2])

    if align:
        # estimate rotation
        points_to_keep = np.stack(np.nonzero(
            matrix >= threshold), axis=1)

        if points_to_keep.shape[0] > 1:
            pca = PCA(n_components=2).fit(points_to_keep)
            # mean = pca.mean_
            # median = np.median(points_to_keep, axis=0)
            eig = pca.components_[0]

            # research note: use mean/median for proper orientation
            # eig *= np.sign((median - mean)@eig)
            theta = np.arctan2(eig[1], eig[0])
            angles_from_axes = [theta, theta - np.pi/2,
                                theta - np.pi, theta + np.pi/2, theta + np.pi]
            theta2 = angles_from_axes[np.argmin(np.abs(angles_from_axes))]

            # correct rotation/translation
            center = (np.min(points_to_keep, axis=0) +
                      np.max(points_to_keep, axis=0)) / 2

            transform[:] = R(theta2)@T(-center[::-1])

        # crop and rescale
        transform[:] = T([final_size/2, final_size/2])@S(scale)@transform
        matrix = cv2.warpAffine(matrix,
                                transform[0:2, :],
                                (final_size, final_size),
                                flags=cv2.INTER_LINEAR)

    if binary_output:
        # binaryfy
        binary = np.zeros(matrix.shape, dtype=int)
        binary[matrix < threshold] = 0
        binary[matrix >= threshold] = 1

        return binary
    else:
        # simple thresholding
        matrix = np.maximum(threshold, matrix)
        return matrix


def norm_image(matrix, transform=np.eye(3, 3), scale=1):
    return tiny_image(matrix, transform=transform, threshold=0, binary_output=False, scale=scale)


def compute_flow(array1, array2):
    return cv2.calcOpticalFlowFarneback(array1, array2, None, 0.5, 3, 5, 3, 3, 1.2, 0)


def warp_flow(im, flow, inter=cv2.INTER_LINEAR):
    starting_pos = np.transpose(np.indices(
        flow.shape[: 2]), [1, 2, 0])[:, :, :: -1]

    flow_map = (-flow + starting_pos).astype(np.float32)

    return cv2.remap(im, flow_map, None, inter)


def count_blobs(image, threshold=25):
    b = image >= threshold
    b = b.astype(np.uint8)

    retval, _ = cv2.connectedComponents(b)

    return retval - 1


def blob_weights(image, threshold=25):
    b = image > threshold
    b = b.astype(np.uint8)

    n, labels = cv2.connectedComponents(b)

    blob_images = (labels[:, :, None] == np.arange(0, n)
                   [None, None, :]).astype(float)
    blob_images[:, :, 0] = 0

    sigma = 10
    for i in range(1, n):
        blob_images[:, :, i] = cv2.GaussianBlur(
            blob_images[:, :, i], (sigma * 2 + 1, sigma * 2 + 1), sigma)

    expanded_labels = np.argmax(blob_images, axis=2)

    return np.bincount(labels.flatten())[expanded_labels.flatten()].reshape(expanded_labels.shape)

# def blob_dilation(image, flow, threshold=25):
#     b = image > threshold
#     b = b.astype(np.uint8)

#     n, labels = cv2.connectedComponents(b)

#     blob_images = (labels[:, :, None] == np.arange(0, n)[None, None, :]).astype(float)
#     blob_images[:, :, 0] = 0

#     for i in range(1, n):
#         blob_images[:, :, i] = warp_flow(blob_images[:, :, i], flow, inter=cv2.INTER_NEAREST)

#     pass


def nn_flow(query_matrix, scale=1, limit=None, k=None):
    query_tiny = tiny_image(query_matrix).reshape(1, -1)

    if k and k < len(pose_data):
        _, indices = pose_model.kneighbors(query_tiny, k)
        poses = [list(pose_data.keys())[index] for index in indices[0]]
    else:
        poses = pose_data

    results = []
    query_transform = np.eye(3, 3)
    query_norm = norm_image(
        query_matrix, transform=query_transform, scale=scale)

    for pose in poses:
        pose_norm = pose_data[pose]["norm_image"]

        flow = compute_flow(query_norm, pose_norm)

        blob_w = blob_weights(query_norm)

        query_blob_count = count_blobs(query_matrix)
        blob_diff = query_blob_count - pose_data[pose]["blob_count"]

        flow_mag = np.sum(np.linalg.norm(flow, axis=2) / blob_w)

        cost = flow_mag + 10 * abs(blob_diff)

        result = {
            "pose": pose,
            "flow_mag": float(flow_mag),
            "cost": float(cost),
            "flow": flow,
            "query_transform": query_transform
        }

        results.append(result)

    results.sort(key=lambda x: x["cost"])

    if limit:
        return results[:limit]
    return results


def colorize(im, threshold=25):
    b = im > threshold
    b = b.astype(np.uint8)

    _, labels = cv2.connectedComponents(b)

    result = np.zeros((*im.shape, 3), dtype=np.uint8)

    result[:, :, 0] = (labels * 137.5 / 2) % 180
    result[:, :, 1:] = 255

    return (im[:, :, None] * cv2.cvtColor(result, cv2.COLOR_HSV2RGB) / 255).astype(np.uint8)


last_transforms = None


def compute_hand_pose(query_matrix, pose, scale=1, smoothing=0, fac=1, flowRef=[], no_transform=False):
    q_transform = np.eye(3, 3)
    p_transform = pose_data[pose]["norm_transform"]

    norm_qm = norm_image(query_matrix, transform=q_transform, scale=scale)
    flow = compute_flow(pose_data[pose]["norm_image"], norm_qm)
    flowRef.append(flow)

    def transform_at_pt(p_pt, do_flow):
        n_pt = p_transform @ [*p_pt, 1]
        n_pt = n_pt[:2] / n_pt[2]

        k = 1
        neighborhood = flow[int(max(0, n_pt[1] - k)): int(min(flow.shape[1], n_pt[1] + k + 1)),
                            int(max(0, n_pt[0] - k)): int(min(flow.shape[0], n_pt[0] + k + 1))]

        if not do_flow or neighborhood.size == 0:
            n_pt_transformed = n_pt
        else:
            n_pt_transformed = n_pt + np.mean(neighborhood, axis=(0, 1)) * fac

        q_pt_transformed = np.linalg.inv(q_transform) @ [*n_pt_transformed, 1]
        q_pt_transformed = q_pt_transformed[:2] / q_pt_transformed[2]
        q_pt_transformed *= scale

        return q_pt_transformed

    data = {}

    def copy_transformed(name):
        if name not in pose_data[pose]["ik_targets"]:
            return
        if name not in data:
            data[name] = {}

        p_pt3 = pose_data[pose]["ik_targets"][name]["location"]

        if no_transform:
            data[name]["location"] = p_pt3
        else:
            p_pt = p_pt3[:2]
            t_pt = transform_at_pt(
                p_pt, dot(pose_data[pose]["ik_targets"][name], "flow", True))
            t_pt3 = [*t_pt, p_pt3[2]]
            data[name]["location"] = t_pt3

    copy_transformed("armature")
    copy_transformed("index")
    copy_transformed("pinky")
    copy_transformed("wrist")
    copy_transformed("middle")
    copy_transformed("ring")
    copy_transformed("thumb")

    p_rot = spatial.transform.Rotation.from_quat(
        pose_data[pose]["ik_targets"]["armature"]["rotation"])

    rot_matrix = np.linalg.inv(q_transform) @ p_transform
    rot_matrix[:, 2] = 0
    rot_matrix[2, :] = 0
    rot_matrix[2, 2] = 1

    t_rot = spatial.transform.Rotation.from_matrix(rot_matrix)

    q_rot = t_rot * p_rot

    if "armature" in data:
        if no_transform:
            data["armature"]["rotation"] = pose_data[pose]["ik_targets"]["armature"]["rotation"]
        else:
            data["armature"]["rotation"] = list(q_rot.as_quat())

    if not no_transform:
        data["scale"] = 1/scale

    # smoothing
    global last_transforms

    def interpolate_location(name):
        data[name]["location"] = (np.array(data[name]["location"]) * (
            1 - smoothing) + np.array(last_transforms[name]["location"]) * smoothing).tolist()

    def interpolate_rotation(name):
        r = Rotation.from_quat(
            [data[name]["rotation"], last_transforms[name]["rotation"]])
        data[name]["rotation"] = list(
            Slerp([0, 1], r)([smoothing])[0].as_quat())

    if last_transforms:
        interpolate_location("armature")
        interpolate_rotation("armature")
        interpolate_location("index")
        interpolate_location("pinky")
        interpolate_location("wrist")
        interpolate_location("middle")
        interpolate_location("ring")
        interpolate_location("thumb")

    last_transforms = data

    headers = {"Content-Type": "application/json"}
    url = 'http://127.0.0.1:6070/compute-ik'
    r = requests.post(url, data=json.dumps(data), headers=headers)
    return r.json()

#################
#### Helpers ####
#################


def keypoint_to_dict(kp):
    return {"pt": kp.pt, "size": kp.size}


def dot(dic, key, default=None):
    return dic[key] if key in dic else default

#####################
#### Controllers ####
#####################


app = Flask(__name__)

pose_data = None
pose_model = None


def init():
    global pose_data, pose_model

    # load hand-pose data
    pose_data = {}
    for filename in glob('./res/sample-data/*.json'):
        print(f"Loading {filename}")

        key = os.path.splitext(os.path.basename(filename))[0]
        pose_data[key] = json.load(open(filename))
        pose_data[key]["matrix"] = get_matrix(pose_data[key])

        transform = np.eye(3, 3)
        pose_data[key]["tiny_image"] = tiny_image(
            pose_data[key]["matrix"], transform=transform)
        pose_data[key]["tiny_transform"] = transform

        transform = np.eye(3, 3)
        pose_data[key]["norm_image"] = norm_image(
            pose_data[key]["matrix"], transform=transform)
        pose_data[key]["norm_transform"] = transform

        pose_data[key]["norm_image_colorized"] = colorize(
            pose_data[key]["norm_image"])

        pose_data[key]["blob_count"] = count_blobs(pose_data[key]["matrix"])

        pose_data[key]["ik_targets"] = {}

    for filename in glob('./res/ik-targets/*.json'):
        print(f"Loading {filename}")
        key = os.path.splitext(os.path.basename(filename))[0]

        if key in pose_data:
            pose_data[key]["ik_targets"] = json.load(open(filename))

    # create hand pose model
    X = np.stack([pose_data[pose]["tiny_image"].flatten()
                  for pose in pose_data])
    pose_model = NearestNeighbors(
        n_neighbors=5, algorithm='ball_tree', metric="hamming").fit(X)


init()

# Basic Profiling

# @app.before_request
# def before_request():
#     g.start = time.time()


# @app.teardown_request
# def teardown_request(exception=None):
#     elapsed_time = time.time() - g.start

#     print(f"Time elapsed for {request.path}: {elapsed_time:.4f}")

# Controllers

@app.route('/get-matrix', methods=['POST'])
def get_matrix_():
    data = request.get_json()

    if "pose" in data:
        if data["pose"] not in pose_data:
            return f"Error: Pose \"{data['pose']}\" not found in database", 500
        return json.dumps(pose_data[data["pose"]]["matrix"].tolist())

    matrix = get_matrix(data)
    return json.dumps(matrix.tolist())


@app.route('/get-tiny-image', methods=['POST'])
def get_tiny_image():
    data = request.get_json()

    result = {}
    if "pose" in data and data["pose"]:
        if data["pose"] not in pose_data:
            return f"Error: Pose \"{data['pose']}\" not found in database", 500
        result["image"] = pose_data[data["pose"]]["tiny_image"].tolist()
        result["transform"] = pose_data[data["pose"]]["tiny_transform"].tolist()
    else:
        matrix = get_matrix(data)
        transform = np.eye(3, 3)
        result["image"] = tiny_image(matrix, transform=transform).tolist()
        result["transform"] = transform[:2].tolist()

    return json.dumps(result)


@app.route('/get-norm-image', methods=['POST'])
def get_norm_image():
    data = request.get_json()

    result = {}
    if "pose" in data and data["pose"]:
        if data["pose"] not in pose_data:
            return f"Error: Pose \"{data['pose']}\" not found in database", 500
        result["image"] = pose_data[data["pose"]]["norm_image"].tolist()
        result["transform"] = pose_data[data["pose"]]["norm_transform"].tolist()
    else:
        matrix = get_matrix(data)
        scale = dot(data, "scale", 1)
        transform = np.eye(3, 3)
        result["image"] = norm_image(
            matrix, transform=transform, scale=scale).tolist()
        result["transform"] = transform[:2].tolist()

    return json.dumps(result)


@app.route('/get-norm-image-colorized', methods=['POST'])
def get_norm_image_colorized():
    data = request.get_json()

    if "pose" in data and data["pose"]:
        if data["pose"] not in pose_data:
            return f"Error: Pose \"{data['pose']}\" not found in database", 500
        return json.dumps(pose_data[data["pose"]]["norm_image_colorized"].tolist())

    matrix = get_matrix(data)
    scale = dot(data, "scale", 1)
    return json.dumps(colorize(norm_image(matrix, scale=scale)).tolist())


@app.route('/match-nn-flow', methods=['POST'])
def match_nn_flow():
    data = request.get_json()
    matrix = get_matrix(data)

    limit = dot(data, "limit")
    k = dot(data, "k")
    scale = dot(data, "scale", 1)
    matches = nn_flow(matrix, limit=limit, k=k, scale=scale)

    results = []
    for match in matches:
        result = {
            "pose": match["pose"],
            "flowMag": match["flow_mag"],
            "cost": match["cost"]
        }

        if dot(data, "returnWarpedImage"):
            result["warpedImage"] = warp_flow(norm_image(
                matrix, scale=scale), match["flow"]).tolist()
        if dot(data, "returnWarpedImageColorized"):
            result["warpedImageColorized"] = warp_flow(
                pose_data[match["pose"]]["norm_image_colorized"], -match["flow"]).tolist()
        if dot(data, "returnFlow"):
            result["flow"] = match["flow"].astype(float).tolist()
        if dot(data, "returnTransform"):
            result["transform"] = (np.linalg.inv(
                match["query_transform"])@pose_data[match["pose"]].norm_transform)[:2].tolist()

        results.append(result)

    return json.dumps(results)


@app.route('/compute-hand-pose', methods=['POST'])
def compute_hand_pose_():
    data = request.get_json()

    for attr in ["pose", "matrix"]:
        if attr not in data:
            return f"{attr} not specified", 500

    matrix = get_matrix(data)
    flowRef = []
    result = compute_hand_pose(matrix, data["pose"], dot(data, "scale", 1), smoothing=dot(
        data, "smoothing", 0), fac=dot(data, "fac", 1), flowRef=flowRef, no_transform=dot(data, "noTransform", False))

    if dot(data, "returnFlow"):
        result["flow"] = flowRef[0].tolist()

    return json.dumps(result)


@app.route('/update-cap-image', methods=['POST'])
def update_cap_image():
    data = request.get_json()
    matrix = get_matrix(data)

    url = 'http://127.0.0.1:6070/reload-cap-image'
    headers = {"Content-Type": "application/json"}
    requests.post(url, data=json.dumps(matrix.tolist()), headers=headers)

    return {}, 200

#####################
#### Entry Point ####
#####################


if __name__ == '__main__':
    # set up profiling
    # app.config['PROFILE'] = True
    # app.wsgi_app = ProfilerMiddleware(app.wsgi_app, restrictions=[30])

    # run app
    app.run(host='0.0.0.0', port=6060, debug=True)
