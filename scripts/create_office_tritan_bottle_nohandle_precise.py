import math
import os
import sys

import bpy


def set_bsdf_input(bsdf: bpy.types.Node, name: str, value) -> None:
    socket = bsdf.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for block in list(bpy.data.meshes):
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)


def create_lathe_mesh(name: str, profile: list[tuple[float, float]], steps: int = 128) -> bpy.types.Object:
    verts: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    n = len(profile)

    for step in range(steps):
        ang = math.tau * (step / steps)
        c = math.cos(ang)
        s = math.sin(ang)
        for radius, z in profile:
            verts.append((radius * c, radius * s, z))

    def idx(step: int, ring: int) -> int:
        return (step % steps) * n + ring

    for step in range(steps):
        nxt = (step + 1) % steps
        for ring in range(n - 1):
            a = idx(step, ring)
            b = idx(nxt, ring)
            c = idx(nxt, ring + 1)
            d = idx(step, ring + 1)
            faces.append((a, b, c, d))

    center_bottom = len(verts)
    verts.append((0.0, 0.0, profile[0][1]))
    for step in range(steps):
        nxt = (step + 1) % steps
        faces.append((center_bottom, idx(nxt, 0), idx(step, 0)))

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for poly in mesh.polygons:
        poly.use_smooth = True
    if hasattr(mesh, "use_auto_smooth"):
        mesh.use_auto_smooth = True
        mesh.auto_smooth_angle = math.radians(35)
    return obj


def apply_modifier(obj: bpy.types.Object, mod_name: str) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod_name)


def assign_material(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def make_material_tritan() -> bpy.types.Material:
    mat = bpy.data.materials.new("MAT_Tritan")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        set_bsdf_input(bsdf, "Base Color", (0.90, 0.92, 0.94, 1.0))
        set_bsdf_input(bsdf, "Roughness", 0.09)
        set_bsdf_input(bsdf, "Metallic", 0.0)
        set_bsdf_input(bsdf, "Transmission", 1.0)
        set_bsdf_input(bsdf, "IOR", 1.47)
        set_bsdf_input(bsdf, "Alpha", 0.18)
        set_bsdf_input(bsdf, "Clearcoat", 0.1)
        set_bsdf_input(bsdf, "Clearcoat Roughness", 0.24)
    mat.blend_method = "BLEND"
    mat.shadow_method = "NONE"
    return mat


def make_material_metal() -> bpy.types.Material:
    mat = bpy.data.materials.new("MAT_MetalCap")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        set_bsdf_input(bsdf, "Base Color", (0.73, 0.73, 0.73, 1.0))
        set_bsdf_input(bsdf, "Metallic", 1.0)
        set_bsdf_input(bsdf, "Roughness", 0.23)
        set_bsdf_input(bsdf, "Specular", 0.68)
        set_bsdf_input(bsdf, "Anisotropic", 0.32)
    return mat


def make_material_rubber() -> bpy.types.Material:
    mat = bpy.data.materials.new("MAT_RubberRing")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        set_bsdf_input(bsdf, "Base Color", (0.04, 0.04, 0.045, 1.0))
        set_bsdf_input(bsdf, "Metallic", 0.0)
        set_bsdf_input(bsdf, "Roughness", 0.86)
        set_bsdf_input(bsdf, "Specular", 0.28)
    return mat


def build() -> None:
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    m_tritan = make_material_tritan()
    m_metal = make_material_metal()
    m_rubber = make_material_rubber()

    # Outer silhouette tuned to reference image:
    # narrow neck, soft shoulder transition, long straight body, slightly rounded foot.
    body_profile = [
        (0.0000, 0.0000),
        (0.0262, 0.0000),
        (0.0282, 0.0025),
        (0.0291, 0.0070),
        (0.0297, 0.0160),
        (0.0298, 0.2100),
        (0.0289, 0.2240),
        (0.0260, 0.2360),
        (0.0228, 0.2460),
        (0.0207, 0.2530),
        (0.0196, 0.2590),
        (0.0193, 0.2660),
    ]
    body = create_lathe_mesh("Bottle_Body", body_profile, steps=144)
    solid = body.modifiers.new("Solidify", type="SOLIDIFY")
    solid.thickness = -0.0025
    solid.offset = -1.0
    solid.use_even_offset = True
    solid.use_rim = True
    bev = body.modifiers.new("Bevel", type="BEVEL")
    bev.width = 0.00075
    bev.segments = 2
    bev.limit_method = "ANGLE"
    bev.angle_limit = math.radians(38)
    apply_modifier(body, "Solidify")
    apply_modifier(body, "Bevel")
    assign_material(body, m_tritan)

    # Stainless cap
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=96,
        radius=0.0202,
        depth=0.0230,
        location=(0.0, 0.0, 0.2775),
    )
    cap = bpy.context.active_object
    cap.name = "Bottle_Cap"
    cap_bev = cap.modifiers.new("Bevel", type="BEVEL")
    cap_bev.width = 0.00085
    cap_bev.segments = 3
    cap_bev.limit_method = "ANGLE"
    cap_bev.angle_limit = math.radians(30)
    apply_modifier(cap, "Bevel")
    for poly in cap.data.polygons:
        poly.use_smooth = True
    assign_material(cap, m_metal)

    # Thin rubber sealing ring below cap
    bpy.ops.mesh.primitive_torus_add(
        major_segments=96,
        minor_segments=18,
        major_radius=0.0192,
        minor_radius=0.0009,
        location=(0.0, 0.0, 0.2655),
    )
    ring = bpy.context.active_object
    ring.name = "Bottle_SealRing"
    for poly in ring.data.polygons:
        poly.use_smooth = True
    assign_material(ring, m_rubber)

    # Root
    root = bpy.data.objects.new("OfficeBottle_NoHandle_Root", None)
    bpy.context.collection.objects.link(root)
    for child in (body, cap, ring):
        child.parent = root


def parse_args() -> tuple[str, str]:
    args = []
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1 :]
    blend_out = args[0] if len(args) > 0 else os.path.join(os.getcwd(), "office_tritan_bottle_nohandle_precise.blend")
    glb_out = args[1] if len(args) > 1 else os.path.splitext(blend_out)[0] + ".glb"
    return blend_out, glb_out


def main() -> None:
    blend_out, glb_out = parse_args()
    os.makedirs(os.path.dirname(blend_out), exist_ok=True)
    os.makedirs(os.path.dirname(glb_out), exist_ok=True)

    clear_scene()
    build()

    bpy.ops.wm.save_as_mainfile(filepath=blend_out)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects.get("Bottle_Body")

    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_yup=True,
    )

    print(f"[OK] Saved BLEND: {blend_out}")
    print(f"[OK] Saved GLB:   {glb_out}")


if __name__ == "__main__":
    main()
