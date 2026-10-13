"""Build the offline heart-v2 semantic anatomy template with Blender.

Run with:
    blender --background --factory-startup --python scripts/build_heart_anatomy_template.py

The source FBX is from Z-Anatomy (CC BY-SA 4.0). The generated template keeps
that license and is intended for teaching, not measurement or diagnosis.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(
    os.environ.get(
        "Z_ANATOMY_HEART_FBX",
        ROOT.parent / "third_party" / "Z-Anatomy-Sample" / "Assets" / "Models" / "1.0 Models" / "CardioVascular41.fbx",
    )
)
OUTPUT_DIR = ROOT / "teacher-studio-service" / "assets" / "anatomy"
OUTPUT_GLB = OUTPUT_DIR / "heart-v2.glb"
OUTPUT_MANIFEST = OUTPUT_DIR / "heart-v2.json"


PARTS = [
    ("myocardium", "心肌外壳", "Myocardium", "myocardium"),
    ("left_atrium", "左心房腔体", "Left atrium cavity", "chambers"),
    ("right_atrium", "右心房腔体", "Right atrium cavity", "chambers"),
    ("left_ventricle", "左心室腔体", "Left ventricle cavity", "chambers"),
    ("right_ventricle", "右心室腔体", "Right ventricle cavity", "chambers"),
    ("interatrial_septum", "房间隔", "Interatrial septum", "septa"),
    ("interventricular_septum", "室间隔", "Interventricular septum", "septa"),
    ("aorta", "主动脉", "Aorta", "vessels"),
    ("pulmonary_arteries", "肺动脉干及分支", "Pulmonary trunk and arteries", "vessels"),
    ("pulmonary_veins", "肺静脉", "Pulmonary veins", "vessels"),
    ("superior_vena_cava", "上腔静脉", "Superior vena cava", "vessels"),
    ("inferior_vena_cava", "下腔静脉", "Inferior vena cava", "vessels"),
    ("mitral_valve", "二尖瓣", "Mitral valve", "valves"),
    ("tricuspid_valve", "三尖瓣", "Tricuspid valve", "valves"),
    ("aortic_valve", "主动脉瓣", "Aortic valve", "valves"),
    ("pulmonary_valve", "肺动脉瓣", "Pulmonary valve", "valves"),
]

SOURCE_GROUPS = {
    "myocardium": ["Left atrium", "Right atrium", "Left ventricle", "Right ventricle"],
    "aorta": ["Ascending aorta", "Aortic arch", "Thoracic aorta"],
    "pulmonary_arteries": ["Pulmonary trunk", "Bifurcation of pulmonary trunk", "Left pulmonary artery", "Right pulmonary artery"],
    "pulmonary_veins": ["Left inferior pulmonary vein", "Left superior pulmonary vein", "Right inferior pulmonary vein", "Right superior pulmonary vein"],
    "superior_vena_cava": ["Superior vena cava"],
    "inferior_vena_cava": ["Inferior vena cava (thoracic part)"],
    "mitral_valve": ["Posterior leaflet of left atrioventricular valve"],
    "tricuspid_valve": ["Inferior leaflet of right atrioventricular valve", "Septal leaflet of right atrioventricular valve"],
    "aortic_valve": ["Left coronary leaflet", "Right coronary leaflet", "Non-coronary leaflet"],
    "pulmonary_valve": ["Anterior semilunar leaflet of pulmonary valve", "Left semilunar leaflet of pulmonary valve", "Right semilunar leaflet of pulmonary valve"],
}

COLORS = {
    "myocardium": (0.58, 0.08, 0.10, 1.0),
    "chambers": (0.12, 0.56, 0.82, 0.34),
    "septa": (0.92, 0.56, 0.34, 1.0),
    "vessels": (0.82, 0.16, 0.19, 1.0),
    "valves": (0.96, 0.78, 0.28, 1.0),
}


def material(name: str, group: str):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    color = COLORS[group]
    mat.diffuse_color = color
    mat.surface_render_method = "DITHERED" if color[3] < 1 else "DITHERED"
    shader = next((node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if shader:
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = 0.42 if group == "myocardium" else 0.52
        shader.inputs["Alpha"].default_value = color[3]
        if group == "myocardium" and "Subsurface Weight" in shader.inputs:
            shader.inputs["Subsurface Weight"].default_value = 0.08
    return mat


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return Vector(tuple(min(point[axis] for point in corners) for axis in range(3))), Vector(
        tuple(max(point[axis] for point in corners) for axis in range(3))
    )


def duplicate_join(names: list[str], output_name: str):
    duplicates = []
    for name in names:
        source = bpy.data.objects.get(name)
        if not source or source.type != "MESH":
            continue
        world_matrix = source.matrix_world.copy()
        duplicate = source.copy()
        duplicate.data = source.data.copy()
        duplicate.parent = None
        duplicate.matrix_world = world_matrix
        bpy.context.scene.collection.objects.link(duplicate)
        duplicates.append(duplicate)
    if not duplicates:
        raise RuntimeError(f"Missing source mesh for {output_name}: {names}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in duplicates:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = duplicates[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = output_name
    return result


def ellipsoid_from(source_name: str, output_name: str, scale_factor: tuple[float, float, float]):
    source = bpy.data.objects[source_name]
    minimum, maximum = world_bounds(source)
    center = (minimum + maximum) / 2
    dimensions = maximum - minimum
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24, location=center)
    obj = bpy.context.object
    obj.name = output_name
    obj.scale = Vector(tuple(max(0.003, dimensions[i] * scale_factor[i] / 2) for i in range(3)))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def septum_between(source_a: str, source_b: str, output_name: str, atrial: bool):
    min_a, max_a = world_bounds(bpy.data.objects[source_a])
    min_b, max_b = world_bounds(bpy.data.objects[source_b])
    center_a, center_b = (min_a + max_a) / 2, (min_b + max_b) / 2
    center = (center_a + center_b) / 2
    span_a, span_b = max_a - min_a, max_b - min_b
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=center)
    obj = bpy.context.object
    obj.name = output_name
    obj.scale = (
        max(0.003, abs(center_a.x - center_b.x) * 0.22),
        max(0.010, min(span_a.y, span_b.y) * (0.34 if atrial else 0.42)),
        max(0.012, min(span_a.z, span_b.z) * (0.38 if atrial else 0.48)),
    )
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def set_metadata(obj, key: str, label: str, label_en: str, group: str, derived: bool = False):
    obj.name = key
    obj["partKey"] = key
    obj["partLabel"] = label
    obj["labelEn"] = label_en
    obj["layer"] = "anatomy"
    obj["group"] = group
    obj["semantic"] = True
    obj["anatomyProfile"] = "heart-v2"
    obj["source"] = "Z-Anatomy / Z-Anatomy-Sample"
    obj["license"] = "CC BY-SA 4.0"
    obj["teachingApproximation"] = bool(derived)
    obj.data.materials.clear()
    obj.data.materials.append(material(label_en, group))
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


if not SOURCE.is_file():
    raise RuntimeError(f"Z-Anatomy FBX not found: {SOURCE}")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(SOURCE))

created = {}
for key, names in SOURCE_GROUPS.items():
    created[key] = duplicate_join(names, key)

for key, source_name, factors in [
    ("left_atrium", "Left atrium", (0.62, 0.62, 0.58)),
    ("right_atrium", "Right atrium", (0.62, 0.62, 0.58)),
    ("left_ventricle", "Left ventricle", (0.55, 0.55, 0.70)),
    ("right_ventricle", "Right ventricle", (0.55, 0.55, 0.68)),
]:
    created[key] = ellipsoid_from(source_name, key, factors)

created["interatrial_septum"] = septum_between("Left atrium", "Right atrium", "interatrial_septum", True)
created["interventricular_septum"] = septum_between("Left ventricle", "Right ventricle", "interventricular_septum", False)

source_objects = set(created.values())
for obj in list(bpy.context.scene.objects):
    if obj not in source_objects:
        bpy.data.objects.remove(obj, do_unlink=True)

root = bpy.data.objects.new("Anatomy", None)
bpy.context.scene.collection.objects.link(root)
manifest_parts = []
for key, label, label_en, group in PARTS:
    obj = created[key]
    derived = key in {"left_atrium", "right_atrium", "left_ventricle", "right_ventricle", "interatrial_septum", "interventricular_septum"}
    set_metadata(obj, key, label, label_en, group, derived)
    if group in {"myocardium", "vessels"} and len(obj.data.polygons) < 30000:
        modifier = obj.modifiers.new("Teaching surface refinement", "SUBSURF")
        modifier.levels = 1
        modifier.render_levels = 1
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
    obj.parent = root
    manifest_parts.append({
        "name": key,
        "partKey": key,
        "partLabel": label,
        "labelEn": label_en,
        "layer": "anatomy",
        "group": group,
        "semantic": True,
        "teachingApproximation": derived,
    })

# Normalize to a stable four-unit teaching asset while preserving proportions.
all_min = Vector(tuple(min(world_bounds(obj)[0][i] for obj in created.values()) for i in range(3)))
all_max = Vector(tuple(max(world_bounds(obj)[1][i] for obj in created.values()) for i in range(3)))
center = (all_min + all_max) / 2
extent = max(all_max - all_min)
scale = 4.0 / extent
root.location = -center * scale
root.scale = (scale, scale, scale)

bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
for obj in created.values():
    obj.select_set(True)
bpy.context.view_layer.objects.active = created["myocardium"]
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT_GLB),
    export_format="GLB",
    use_selection=True,
    export_extras=True,
    export_apply=True,
)

manifest = {
    "profile": "heart-v2",
    "organType": "heart",
    "modelKind": "semantic-anatomy-template",
    "partCount": len(manifest_parts),
    "parts": manifest_parts,
    "reference": {
        "title": "Z-Anatomy",
        "sourceUrl": "https://github.com/LluisV/Z-Anatomy",
        "sampleUrl": "https://github.com/LluisV/Z-Anatomy-Sample",
        "license": "CC BY-SA 4.0",
    },
    "notice": "教学用途，非诊断或测量用途。透明心腔与程序生成间隔为教学可视化近似。",
}
OUTPUT_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Built {OUTPUT_GLB} with {len(manifest_parts)} semantic parts")
