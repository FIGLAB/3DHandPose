import argparse
import os
import numpy as np
import cv2
import json


def itoj(input_filename):
    output_filename = os.path.splitext(input_filename)[0] + '.json'

    input_image = cv2.imread(input_filename, cv2.IMREAD_GRAYSCALE)
    result = {"matrix": input_image.flatten().tolist()}

    json.dump(result, open(output_filename, 'w'))


def jtoi(input_filename):
    output_filename = os.path.splitext(input_filename)[0] + '.png'

    input_json = json.load(open(input_filename))
    result = np.array(input_json["matrix"]).reshape(49, 37)

    cv2.imwrite(output_filename, result)


parser = argparse.ArgumentParser()
group = parser.add_mutually_exclusive_group(required=True)
group.add_argument("--itoj", action='store_true', help="convert image to json")
group.add_argument("--jtoi", action='store_true', help="convert json to image")
parser.add_argument("input_filenames", type=str, nargs='+')

args = parser.parse_args()

if args.itoj:
    for input_filename in args.input_filenames:
        itoj(input_filename)

if args.jtoi:
    for input_filename in args.input_filenames:
        jtoi(input_filename)
