import math
import os
import sys

import bmesh
import bpy


def set_bsdf_input(bsdf: bpy.types.Node, name: str, value) -> None:
    socket = bsdf.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    for curve in list(bpy.data.curves):
        if curve.users == 0:
            bpy.data.curves.remove(curve)
    for material in list(bpy.data.materials):
        if material.users == 0:
            bpy.data.materials.remove(material)


def make_material_tritan(name: str) -> bpy.types.Material:
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        set_bsdf_input(bsdf, "Base Color", (0.91, 0.93, 0.95, 1.0))
        set_bsdf_input(bsdf, "Roughness", 0.12)
        set_bsdf_input(bsdf, "Metallic", 0.0)
        set_bsdf_input(bsdf, "Transmission", 1.0)
        set_bsdf_input(bsdf, "IOR", 1.47)
        set_bsdf_input(bsdf, "Alpha", 0.2)
        set_bsdf_input(bsdf, "Clearcoat", 0.08)
        set_bsdf_input(bsdf, "Clearcoat Roughness", 0.25)
    mat.blend_method = "BLEND"
    mat.shadow_method = "NONE"
    return mat


def make_material_metal(name: str) -> bpy.types.Material:
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        set_bsdf_input(bsdf, "Base Color", (0.73, 0.73, 0.73, 1.0))
        set_bsdf_input(bsdf, "Metallic", 1.0)
        set_bsdf_input(bsdf, "Roughness", 0.24)
        set_bsdf_input(bsdf, "Specular", 0.7)
        set_bsdf_input(bsdf, "Anisotropic", 0.35)
    return mat


def make_material_rubber(name: str) -> bpy.types.Material:
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        set_bsdf_input(bsdf, "Base Color", (0.05, 0.05, 0.055, 1.0))
        set_bsdf_input(bsdf, "Metallic", 0.0)
        set_bsdf_input(bsdf, "Roughness", 0.82)
        set_bsdf_input(bsdf, "Specular", 0.3)
    return mat


def lathe_profile(name: str, profile_points: list[tuple[float, float]], steps: int = 96) -> bpy.types.Object:
    # Build rotational mesh explicitly so export always contains solid primitives.
    verts: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    ring_count = len(profile_points)

    for step in range(steps):
        angle = math.tau * (step / steps)
        c = math.cos(angle)
        s = math.sin(angle)
        for radius, height in profile_points:
            verts.append((radius * c, radius * s, height))

    def idx(step: int, ring_idx: int) -> int:
        return (step % steps) * ring_count + ring_idx

    for step in range(steps):
        next_step = (step + 1) % steps
        for ring_idx in range(ring_count - 1):
            a = idx(step, ring_idx)
            b = idx(next_step, ring_idx)
            c = idx(next_step, ring_idx + 1)
            d = idx(step, ring_idx + 1)
            faces.append((a, b, c, d))

    # Cap bottom
    bottom_z = profile_points[0][1]
    center_idx = len(verts)
    verts.append((0.0, 0.0, bottom_z))
    for step in range(steps):
        next_step = (step + 1) % steps
        faces.append((center_idx, idx(next_step, 0), idx(step, 0)))

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    for poly in mesh.polygons:
        poly.use_smooth = True
    if hasattr(mesh, "use_auto_smooth"):
        mesh.use_auto_smooth = True
        mesh.auto_smooth_angle = math.radians(35.0)
    return obj


def apply_modifier(obj: bpy.types.Object, modifier_name: str) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier_name)


def assign_material(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def build_model() -> None:
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    m_tritan = make_material_tritan("MAT_Tritan")
    m_metal = make_material_metal("MAT_MetalCap")
    m_rubber = make_material_rubber("MAT_RubberLoop")

    # Main bottle body (roughly 800 ml office bottle proportions)
    body_profile = [
        (0.0, 0.000),
        (0.026, 0.000),
        (0.030, 0.003),
        (0.032, 0.010),
        (0.033, 0.020),
        (0.033, 0.205),
        (0.0315, 0.228),
        (0.0275, 0.244),
        (0.0210, 0.256),
        (0.0190, 0.266),
    ]
    body = lathe_profile("Bottle_Body", body_profile, steps=112)
    solidify = body.modifiers.new(name="Solidify", type="SOLIDIFY")
    solidify.thickness = -0.0026
    solidify.offset = -1.0
    solidify.use_even_offset = True
    solidify.use_rim = True
    bevel = body.modifiers.new(name="Bevel", type="BEVEL")
    bevel.width = 0.0008
    bevel.segments = 2
    bevel.limit_method = "ANGLE"
    bevel.angle_limit = math.radians(40.0)
    apply_modifier(body, "Solidify")
    apply_modifier(body, "Bevel")
    assign_material(body, m_tritan)

    # Metal cap
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=72,
        radius=0.0205,
        depth=0.022,
        location=(0.0, 0.0, 0.278),
    )
    cap = bpy.context.active_object
    cap.name = "Bottle_Cap"
    cap_bevel = cap.modifiers.new(name="Bevel", type="BEVEL")
    cap_bevel.width = 0.0009
    cap_bevel.segments = 3
    cap_bevel.limit_method = "ANGLE"
    cap_bevel.angle_limit = math.radians(30.0)
    apply_modifier(cap, "Bevel")
    for poly in cap.data.polygons:
        poly.use_smooth = True
    assign_material(cap, m_metal)

    # Thin gasket ring below cap
    bpy.ops.mesh.primitive_torus_add(
        major_segments=72,
        minor_segments=18,
        major_radius=0.0194,
        minor_radius=0.0009,
        location=(0.0, 0.0, 0.2665),
    )
    gasket = bpy.context.active_object
    gasket.name = "Bottle_Gasket"
    for poly in gasket.data.polygons:
        poly.use_smooth = True
    assign_material(gasket, m_rubber)

    # Carrying rubber loop near neck
    curve_data = bpy.data.curves.new("CarryLoopCurve", "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 20
    curve_data.bevel_depth = 0.0015
    curve_data.bevel_resolution = 4
    curve_data.fill_mode = "FULL"
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(3)

    loop_points = [
        (0.0195, 0.0, 0.2668),
        (0.0420, 0.0, 0.2910),
        (0.0475, 0.0, 0.2480),
        (0.0210, 0.0, 0.2380),
    ]
    for idx, point in enumerate(loop_points):
        bp = spline.bezier_points[idx]
        bp.co = point
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    spline.use_cyclic_u = True

    loop_obj = bpy.data.objects.new("Bottle_CarryLoop", curve_data)
    bpy.context.collection.objects.link(loop_obj)
    loop_obj.rotation_euler = (0.0, math.radians(6.0), math.radians(18.0))

    bpy.ops.object.select_all(action="DESELECT")
    loop_obj.select_set(True)
    bpy.context.view_layer.objects.active = loop_obj
    bpy.ops.object.convert(target="MESH")
    loop_mesh = bpy.context.active_object
    for poly in loop_mesh.data.polygons:
        poly.use_smooth = True
    assign_material(loop_mesh, m_rubber)

    # Parent parts for easy move/rotation in Blender.
    root = bpy.data.objects.new("OfficeBottle_Root", None)
    bpy.context.collection.objects.link(root)
    for child in (body, cap, gasket, loop_mesh):
        child.parent = root


def parse_output_paths() -> tuple[str, str]:
    args = []
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1 :]

    blend_out = args[0] if len(args) > 0 else os.path.join(os.getcwd(), "office_tritan_bottle.blend")
    glb_out = args[1] if len(args) > 1 else os.path.splitext(blend_out)[0] + ".glb"
    return blend_out, glb_out


def main() -> None:
    blend_out, glb_out = parse_output_paths()
    os.makedirs(os.path.dirname(blend_out), exist_ok=True)
    os.makedirs(os.path.dirname(glb_out), exist_ok=True)

    clear_scene()
    build_model()

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
