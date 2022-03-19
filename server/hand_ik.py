import bpy
from mathutils import Matrix
import json
import numpy as np
import os

DIR = os.path.join(os.path.dirname(bpy.data.filepath), '..')

def get_bone_matrix(armature, bone):
    return armature.matrix_world @ bone.matrix


def matrix_to_list(matrix):
    return [list(row) for row in matrix]


def quaternion_to_list(q):
    return {"w":q[0],"x":q[1],"y":q[3],"z":q[2]}


def copy_location(target, source):
    location = source["location"] if "location" in source else source

    target.location.x = location[0]
    target.location.y = location[1]
    target.location.z = location[2]


def copy_rotation(target, source):
    rotation = source["rotation"] if "rotation" in source else source

    target.rotation_quaternion.w = rotation[0]
    target.rotation_quaternion.x = rotation[1]
    target.rotation_quaternion.y = rotation[2]
    target.rotation_quaternion.z = rotation[3]


def copy_scale(target, source):
    scale = source["scale"] if "scale" in source else source

    target.scale.x = scale[0]
    target.scale.y = scale[1]
    target.scale.z = scale[2]


def compute_ik(data):
    def if_exists_do(name, f):
        if name in data:
            f(bpy.data.objects[name.title()], data[name])

    if "scale" in data:
        bpy.data.objects["Scale"].scale.x = data["scale"]
        bpy.data.objects["Scale"].scale.y = data["scale"]
        bpy.data.objects["Scale"].scale.z = data["scale"]

    if_exists_do("armature", copy_location)
    if_exists_do("armature", copy_rotation)

    if_exists_do("thumb", copy_location)
    if_exists_do("index", copy_location)
    if_exists_do("middle", copy_location)
    if_exists_do("ring", copy_location)
    if_exists_do("pinky", copy_location)
    if_exists_do("wrist", copy_location)

    bpy.context.view_layer.update()

    result = {"armature": {}, "bones": {}}

    armature = bpy.data.objects["Armature"]
    result["armature"] = quaternion_to_list(armature.matrix_world.to_quaternion())

    pose = bpy.data.objects["Armature"].pose
    for bone in pose.bones:
        #print(bone.matrix.to_quaternion())
        #result["bones"][bone.name] = matrix_to_list(get_bone_matrix(armature, bone))
        result["bones"][bone.name] = quaternion_to_list(get_bone_matrix(armature, bone).to_quaternion())


    return result

def reload_cap_image(data):
    image = bpy.data.images['cap-image']

    matrix = np.array(data)

    pixels = np.tile(matrix[::-1, :, None] / 255, (1, 1, 4))
    pixels[:, :, 3] = 1

    image.pixels = pixels.flatten().tolist()

def record(data):
    depth_mode()
    bpy.context.scene.render.filepath = f"{DIR}/output/{data['timeStamp']}-depth.png"
    bpy.ops.render.render(write_still = True)

    shaded_mode()
    bpy.context.scene.render.filepath = f"{DIR}/output/{data['timeStamp']}-render.png"
    bpy.ops.render.render(write_still = True)


def set_material(target, material):
    if len(target.material_slots) < 1:
        # if there is no slot then we append to create the slot and assign
        target.data.materials.append(material)
    else:
        # we always want the material in slot[0]
        target.material_slots[0].material = material

def depth_mode():
    # change material
    hand_mesh = bpy.data.objects["hand_mesh"]
    depth_material = bpy.data.materials["depth"]
    set_material(hand_mesh, depth_material)

    # hide objects
    bpy.data.objects["Screen"].hide_render = True
    bpy.data.objects["Tablet"].hide_render = True

def shaded_mode():
    # change material
    hand_mesh = bpy.data.objects["hand_mesh"]
    diffuse_material = bpy.data.materials["diffuse"]
    set_material(hand_mesh, diffuse_material)

    # hide objects
    bpy.data.objects["Screen"].hide_render = False
    bpy.data.objects["Tablet"].hide_render = False
