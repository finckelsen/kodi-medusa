#!/usr/bin/env python3
"""
Headless Blender setup for TACX bottle:
- imports generated OBJ
- applies viewport-friendly materials
- saves a ready-to-open .blend
"""

from __future__ import annotations

import argparse
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    argv = []
    if "--" in __import__("sys").argv:
        argv = __import__("sys").argv[__import__("sys").argv.index("--") + 1 :]

    parser = argparse.ArgumentParser()
    parser.add_argument("--input-obj", type=Path, required=True)
    parser.add_argument("--output-blend", type=Path, required=True)
    return parser.parse_args(argv)


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_obj(path: Path) -> None:
    p = str(path)
    if hasattr(bpy.ops.wm, "obj_import"):
        bpy.ops.wm.obj_import(filepath=p)
    else:
        bpy.ops.import_scene.obj(filepath=p)


def ensure_principled(mat: bpy.types.Material) -> bpy.types.ShaderNodeBsdfPrincipled:
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    output = None
    bsdf = None
    for n in nodes:
        if n.type == "OUTPUT_MATERIAL":
            output = n
        if n.type == "BSDF_PRINCIPLED":
            bsdf = n

    if output is None:
        output = nodes.new("ShaderNodeOutputMaterial")
    if bsdf is None:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
        links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    return bsdf


def set_input_if_exists(node: bpy.types.Node, name: str, value: float) -> None:
    if name in node.inputs:
        node.inputs[name].default_value = value


def setup_materials() -> tuple[bpy.types.Material, bpy.types.Material]:
    body = bpy.data.materials.get("body_plastic") or bpy.data.materials.new("body_plastic")
    cap = bpy.data.materials.get("cap_black") or bpy.data.materials.new("cap_black")

    body_bsdf = ensure_principled(body)
    cap_bsdf = ensure_principled(cap)

    body_bsdf.inputs["Base Color"].default_value = (0.84, 0.84, 0.84, 1.0)
    set_input_if_exists(body_bsdf, "Roughness", 0.72)
    set_input_if_exists(body_bsdf, "Metallic", 0.0)
    set_input_if_exists(body_bsdf, "IOR", 1.47)
    set_input_if_exists(body_bsdf, "Alpha", 0.56)
    set_input_if_exists(body_bsdf, "Specular", 0.10)
    set_input_if_exists(body_bsdf, "Specular IOR Level", 0.10)
    if "Transmission Weight" in body_bsdf.inputs:
        body_bsdf.inputs["Transmission Weight"].default_value = 0.12
    elif "Transmission" in body_bsdf.inputs:
        body_bsdf.inputs["Transmission"].default_value = 0.12

    cap_bsdf.inputs["Base Color"].default_value = (0.07, 0.07, 0.07, 1.0)
    set_input_if_exists(cap_bsdf, "Roughness", 0.68)
    set_input_if_exists(cap_bsdf, "Metallic", 0.0)
    set_input_if_exists(cap_bsdf, "Alpha", 1.0)

    if hasattr(body, "blend_method"):
        body.blend_method = "BLEND"
    if hasattr(body, "shadow_method"):
        body.shadow_method = "HASHED"
    if hasattr(body, "use_screen_refraction"):
        body.use_screen_refraction = True

    return body, cap


def assign_materials(body: bpy.types.Material, cap: bpy.types.Material) -> None:
    for obj in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
        name = obj.name.lower()
        target = None

        if "bottlebody" in name:
            target = body
        elif "bottlecap" in name:
            target = cap
        else:
            slot_names = [slot.material.name.lower() for slot in obj.material_slots if slot.material]
            if any("body" in n for n in slot_names):
                target = body
            elif any("cap" in n for n in slot_names):
                target = cap

        if target is not None:
            if obj.data.materials:
                obj.data.materials[0] = target
            else:
                obj.data.materials.append(target)

        for poly in obj.data.polygons:
            poly.use_smooth = True


def setup_scene_defaults() -> None:
    scene = bpy.context.scene
    if "BLENDER_EEVEE_NEXT" in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys():
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    elif "BLENDER_EEVEE" in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys():
        scene.render.engine = "BLENDER_EEVEE"

    if hasattr(scene, "eevee") and hasattr(scene.eevee, "use_ssr"):
        scene.eevee.use_ssr = True
    if hasattr(scene, "eevee") and hasattr(scene.eevee, "use_ssr_refraction"):
        scene.eevee.use_ssr_refraction = True


def main() -> None:
    args = parse_args()
    clean_scene()
    import_obj(args.input_obj)
    body, cap = setup_materials()
    assign_materials(body, cap)
    setup_scene_defaults()
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output_blend))
    print(f"Saved blend: {args.output_blend}")


if __name__ == "__main__":
    main()
