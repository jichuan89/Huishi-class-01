"""Package image-to-3D responses as editable, separable Blender assets."""
from __future__ import annotations

import json
import subprocess
import uuid
from pathlib import Path

import biomed_models


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "generated" / "image-models"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


BLENDER_SCRIPT = r'''
import bpy
import json
import sys
from mathutils import Vector

config_path = sys.argv[sys.argv.index("--config") + 1]
with open(config_path, "r", encoding="utf-8") as source:
    config = json.load(source)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=config["inputPath"])
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
if not meshes:
    raise RuntimeError("GLB 中没有可编辑网格")

material_parts = []
for obj in list(meshes):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for other in bpy.context.selected_objects:
        if other != obj:
            other.select_set(False)
    if len(obj.data.materials) > 1:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.separate(type="MATERIAL")
        bpy.ops.object.mode_set(mode="OBJECT")
        material_parts.extend(list(bpy.context.selected_objects))
    else:
        material_parts.append(obj)

parts = []
for object_index, obj in enumerate(list(dict.fromkeys(material_parts)), 1):
    if obj.name not in bpy.context.scene.objects:
        continue
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    separated = list(bpy.context.selected_objects)
    for island_index, part in enumerate(separated, 1):
        part.name = "Part %02d-%02d" % (object_index, island_index)
        part["partKey"] = "part_%02d_%02d" % (object_index, island_index)
        part["partLabel"] = part.name
        part["source"] = config["sourceLabel"]
        parts.append(part)

for obj in bpy.context.scene.objects:
    if obj not in parts and obj.type not in {"CAMERA", "LIGHT"}:
        bpy.data.objects.remove(obj, do_unlink=True)

for obj in bpy.context.scene.objects:
    obj.select_set(obj in parts)
if parts:
    bpy.context.view_layer.objects.active = parts[0]

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 900
scene.render.resolution_y = 700
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = config["previewPath"]
scene.world = bpy.data.worlds.new("Image model world")
scene.world.color = (0.015, 0.02, 0.03)
bpy.ops.object.camera_add(location=(4.8, -7.5, 4.0))
camera = bpy.context.object
camera.data.type = "ORTHO"
camera.data.ortho_scale = 6.5
camera.rotation_euler = ((Vector((0, 0, 0)) - camera.location).to_track_quat("-Z", "Y").to_euler())
scene.camera = camera
bpy.ops.object.light_add(type="AREA", location=(4, -4, 6))
key_light = bpy.context.object
key_light.data.energy = 1100
key_light.data.size = 5
key_light.rotation_euler = ((Vector((0, 0, 0)) - key_light.location).to_track_quat("-Z", "Y").to_euler())
bpy.ops.object.light_add(type="AREA", location=(-4, -2, 3))
bpy.context.object.data.energy = 700
bpy.context.object.data.size = 4
bpy.ops.wm.save_as_mainfile(filepath=config["blendPath"])
bpy.ops.object.select_all(action="DESELECT")
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.export_scene.gltf(filepath=config["outputPath"], export_format="GLB", use_selection=True, export_extras=True)
bpy.ops.render.render(write_still=True)
with open(config["partsPath"], "w", encoding="utf-8") as target:
    json.dump([{"name": obj.name, "partKey": obj["partKey"], "source": obj["source"]} for obj in parts], target, ensure_ascii=False)
'''


def _relative(path: Path) -> str:
    return str(path.relative_to(ROOT)).replace("\\", "/")


def _urls(output_dir: Path, glb: Path, blend: Path | None, preview: Path | None):
    result = {
        "glbUrl": "/api/3d/download/" + _relative(glb).split("generated/", 1)[1],
        "blendUrl": "/api/3d/download/" + _relative(blend).split("generated/", 1)[1] if blend else "",
        "previewUrl": "/api/3d/preview/" + _relative(preview).split("generated/", 1)[1] if preview else "",
    }
    return result


def package_glb(glb_bytes: bytes, source_label: str, mode: str):
    if not glb_bytes.startswith(b"glTF"):
        raise ValueError("3D 服务没有返回有效 GLB 文件")
    run_dir = OUTPUT_DIR / f"{mode}_{uuid.uuid4().hex[:8]}"
    run_dir.mkdir(parents=True, exist_ok=True)
    input_path = run_dir / "source.glb"
    output_path = run_dir / "model.glb"
    blend_path = run_dir / "model.blend"
    preview_path = run_dir / "preview.png"
    parts_path = run_dir / "parts.json"
    input_path.write_bytes(glb_bytes)
    blender = biomed_models.find_blender()
    if not blender:
        return {"status": "uneditable", "editable": False, "message": "模型已生成，但未找到 Blender，暂不能拆分部件", "glbUrl": "", "blendUrl": "", "previewUrl": "", "parts": []}
    config_path = run_dir / "config.json"
    runner_path = run_dir / "runner.py"
    config_path.write_text(json.dumps({"inputPath": str(input_path), "outputPath": str(output_path), "blendPath": str(blend_path), "previewPath": str(preview_path), "partsPath": str(parts_path), "sourceLabel": source_label}, ensure_ascii=False), encoding="utf-8")
    runner_path.write_text(BLENDER_SCRIPT, encoding="utf-8")
    try:
        completed = subprocess.run([str(blender), "--background", "--factory-startup", "--python-exit-code", "1", "--python", str(runner_path), "--", "--config", str(config_path)], cwd=str(ROOT), capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300, check=False)
        if completed.returncode != 0 or not output_path.is_file() or not blend_path.is_file() or not preview_path.is_file():
            (run_dir / "blender.log").write_text((completed.stdout or "") + "\n" + (completed.stderr or ""), encoding="utf-8")
            return {"status": "failed", "editable": False, "message": "Blender 拆分失败，已保留生成日志", "glbUrl": "", "blendUrl": "", "previewUrl": "", "parts": []}
        parts = json.loads(parts_path.read_text(encoding="utf-8"))
        return {"status": "generated", "editable": True, "message": f"已生成可拆分模型，共 {len(parts)} 个部件", "parts": parts, **_urls(run_dir, output_path, blend_path, preview_path)}
    finally:
        config_path.unlink(missing_ok=True)
        runner_path.unlink(missing_ok=True)
