"""Open a Blender asset headlessly and capture its principal views for QA."""
import argparse
import json
from pathlib import Path

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--blend', required=True)
parser.add_argument('--output', required=True)
import sys
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
bpy.ops.wm.open_mainfile(filepath=args.blend)
output = Path(args.output).resolve()
output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
meshes = [obj for obj in scene.objects if obj.type == 'MESH']
assert meshes and all(len(obj.data.polygons) for obj in meshes)
minimum = Vector([min((obj.matrix_world @ Vector(corner))[axis] for obj in meshes for corner in obj.bound_box) for axis in range(3)])
maximum = Vector([max((obj.matrix_world @ Vector(corner))[axis] for obj in meshes for corner in obj.bound_box) for axis in range(3)])
center = (minimum + maximum) / 2
extent = max(maximum - minimum)
for obj in meshes:
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
for obj in scene.objects:
    if obj.type == 'LIGHT':
        obj.data.energy *= 0.4
scene.render.resolution_x = 500
scene.render.resolution_y = 500
if scene.camera is None:
    bpy.ops.object.camera_add()
    scene.camera = bpy.context.object
scene.camera.data.type = 'ORTHO'
scene.camera.data.ortho_scale = extent * 1.25
for label, direction in [('x', (1, 0, 0)), ('nx', (-1, 0, 0)), ('y', (0, 1, 0)), ('ny', (0, -1, 0)), ('z', (0, 0, 1)), ('nz', (0, 0, -1))]:
    camera = scene.camera
    camera.location = center + Vector(direction) * extent * 4
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(output / (label + '.png'))
    bpy.ops.render.render(write_still=True)
(output / 'verification.json').write_text(json.dumps({'objects': len(meshes), 'vertices': sum(len(obj.data.vertices) for obj in meshes), 'faces': sum(len(obj.data.polygons) for obj in meshes), 'materials': sum(len(obj.data.materials) for obj in meshes)}), encoding='utf-8')
