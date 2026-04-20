import os
import re
import sys

import bpy


def slugify(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", value).strip("_")


def set_bsdf_input(bsdf: bpy.types.Node, socket_name: str, value) -> None:
    socket = bsdf.inputs.get(socket_name)
    if socket is not None:
        socket.default_value = value


def make_solid_texture(path: str, rgba: tuple[float, float, float, float], size: int = 8) -> bpy.types.Image:
    img_name = os.path.splitext(os.path.basename(path))[0]
    image = bpy.data.images.new(name=img_name, width=size, height=size, alpha=True)
    pixel = list(rgba)
    image.pixels = pixel * (size * size)
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    return image


def ensure_uv_map(obj: bpy.types.Object) -> None:
    if obj.type != "MESH":
        return
    mesh = obj.data
    if mesh.uv_layers and len(mesh.uv_layers) > 0:
        return
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=66.0, island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def attach_basecolor_textures(output_dir: str) -> None:
    tex_dir = os.path.join(output_dir, "textures")
    os.makedirs(tex_dir, exist_ok=True)

    used_materials = set()
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            if slot.material is not None:
                used_materials.add(slot.material)

    for mat in used_materials:
        if not mat.use_nodes:
            mat.use_nodes = True
        nt = mat.node_tree
        if nt is None:
            continue

        bsdf = nt.nodes.get("Principled BSDF")
        if bsdf is None:
            continue

        base_color = bsdf.inputs.get("Base Color")
        alpha_input = bsdf.inputs.get("Alpha")
        rgba = (1.0, 1.0, 1.0, 1.0)
        if base_color is not None:
            c = base_color.default_value
            alpha = alpha_input.default_value if alpha_input is not None else 1.0
            rgba = (c[0], c[1], c[2], alpha)

        tex_name = f"{slugify(mat.name)}_basecolor.png"
        tex_path = os.path.join(tex_dir, tex_name)
        image = make_solid_texture(tex_path, rgba, size=8)

        tex_node = None
        for node in nt.nodes:
            if node.type == "TEX_IMAGE" and getattr(node, "image", None) is not None:
                if node.image.name == image.name:
                    tex_node = node
                    break
        if tex_node is None:
            tex_node = nt.nodes.new("ShaderNodeTexImage")
        tex_node.image = image
        tex_node.label = f"{mat.name} BaseColor"
        tex_node.location = (bsdf.location.x - 260, bsdf.location.y)

        if base_color is not None:
            for link in list(nt.links):
                if link.to_node == bsdf and link.to_socket == base_color:
                    nt.links.remove(link)
            nt.links.new(tex_node.outputs["Color"], base_color)

        if alpha_input is not None:
            for link in list(nt.links):
                if link.to_node == bsdf and link.to_socket == alpha_input:
                    nt.links.remove(link)
            nt.links.new(tex_node.outputs["Alpha"], alpha_input)

        # Keep transparency settings for OBJ/MTL export consumers.
        mat.blend_method = "BLEND"


def parse_args() -> str:
    args = []
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1 :]

    if len(args) >= 1:
        return args[0]

    cwd = os.getcwd()
    return os.path.join(cwd, "office_tritan_bottle_obj", "office_tritan_bottle.obj")


def main() -> None:
    out_obj = parse_args()
    out_obj = os.path.abspath(out_obj)
    out_dir = os.path.dirname(out_obj)
    os.makedirs(out_dir, exist_ok=True)

    # Ensure all mesh objects have UVs before assigning image textures.
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            ensure_uv_map(obj)

    attach_basecolor_textures(out_dir)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.select_set(True)
    active = bpy.data.objects.get("Bottle_Body")
    if active is not None:
        bpy.context.view_layer.objects.active = active

    bpy.ops.wm.obj_export(
        filepath=out_obj,
        export_selected_objects=True,
        export_uv=True,
        export_normals=True,
        export_materials=True,
        export_pbr_extensions=False,
        path_mode="COPY",
        apply_modifiers=True,
        export_triangulated_mesh=False,
        export_object_groups=False,
        export_material_groups=True,
    )

    print(f"[OK] OBJ exported: {out_obj}")
    print(f"[OK] MTL path:    {os.path.splitext(out_obj)[0] + '.mtl'}")
    print(f"[OK] Textures dir:{os.path.join(out_dir, 'textures')}")


if __name__ == "__main__":
    main()
