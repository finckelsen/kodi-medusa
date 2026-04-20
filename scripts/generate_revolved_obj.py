#!/usr/bin/env python3
"""
Create a lathed OBJ mesh from a single side-image silhouette.

This script is tuned for bottle-like objects on a plain background.
It extracts the outer contour row-by-row and revolves it around a
vertical axis to produce a watertight mesh. It can also split the mesh
into two material zones (body and cap) and emit an MTL file.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path
from statistics import median
from typing import List, Sequence, Tuple

from PIL import Image


def moving_average(values: Sequence[float], window: int) -> List[float]:
    if window < 1:
        return list(values)
    out: List[float] = []
    half = window // 2
    for i in range(len(values)):
        lo = max(0, i - half)
        hi = min(len(values), i + half + 1)
        out.append(sum(values[lo:hi]) / (hi - lo))
    return out


def sample_profile(
    image_path: Path,
    threshold: float,
    smooth_window: int,
    smooth_passes: int,
    target_height_m: float,
    max_rings: int,
    flat_bottom_frac: float,
) -> List[Tuple[float, float]]:
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    px = img.load()

    # Estimate background as the median border color.
    border = []
    for x in range(w):
        border.append(px[x, 0])
        border.append(px[x, h - 1])
    for y in range(h):
        border.append(px[0, y])
        border.append(px[w - 1, y])
    bg = [median([c[i] for c in border]) for i in range(3)]

    rows: List[Tuple[int, int, int]] = []
    for y in range(h):
        xs = []
        for x in range(w):
            r, g, b = px[x, y]
            d = math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2)
            if d > threshold:
                xs.append(x)
        if xs:
            rows.append((y, min(xs), max(xs)))

    if len(rows) < 20:
        raise RuntimeError("Could not detect a clear silhouette. Try a lower threshold.")

    # Find a stable center using the middle section of the object.
    y0 = rows[0][0]
    y1 = rows[-1][0]
    mid_lo = y0 + int((y1 - y0) * 0.3)
    mid_hi = y0 + int((y1 - y0) * 0.7)
    centers = [
        (xmin + xmax) / 2
        for y, xmin, xmax in rows
        if y >= mid_lo and y <= mid_hi
    ]
    axis_x = median(centers)

    pairs: List[Tuple[float, float]] = []
    for y, xmin, xmax in rows:
        r = max(axis_x - xmin, xmax - axis_x)
        z = float(y1 - y)  # bottom=0, top=positive
        pairs.append((z, max(0.0, float(r))))

    # Always process profile from bottom -> top.
    pairs.sort(key=lambda p: p[0])
    z_px = [p[0] for p in pairs]
    radii_px = [p[1] for p in pairs]

    smooth_passes = max(1, smooth_passes)
    for _ in range(smooth_passes):
        radii_px = moving_average(radii_px, smooth_window)

    # Reduce rings to keep mesh density manageable.
    if max_rings > 1 and len(radii_px) > max_rings:
        n = len(radii_px)
        keep = sorted({round(i * (n - 1) / (max_rings - 1)) for i in range(max_rings)})
        radii_px = [radii_px[i] for i in keep]
        z_px = [z_px[i] for i in keep]

    # Add tip points on axis so top and bottom are closed.
    z_bottom = z_px[0]
    z_top = z_px[-1]
    z_px = [z_bottom] + z_px + [z_top]
    radii_px = [0.0] + radii_px + [0.0]

    height_px = z_top - z_bottom
    scale = target_height_m / (height_px if height_px > 0 else 1.0)
    profile = [((z - z_bottom) * scale, r * scale) for z, r in zip(z_px, radii_px)]

    # Optional flat sealed base for production-friendly bottle bottoms.
    if flat_bottom_frac > 0:
        flat_bottom_frac = max(0.0, min(0.25, flat_bottom_frac))
        total_h = profile[-1][0]
        z_limit = total_h * flat_bottom_frac
        body = profile[1:-1]
        base_candidates = [r for z, r in body if z <= z_limit]
        if base_candidates:
            base_r = max(base_candidates)
            flattened = []
            for z, r in body:
                if z <= z_limit:
                    flattened.append((z, base_r))
                else:
                    flattened.append((z, r))
            profile = [profile[0]] + flattened + [profile[-1]]

    return profile


def write_revolved_obj(
    profile: Sequence[Tuple[float, float]],
    out_path: Path,
    segments: int,
    cap_ratio: float,
    write_mtl: bool,
) -> None:
    if len(profile) < 4:
        raise RuntimeError("Profile is too short to build a mesh.")

    # We expect first and last points to be on axis (r=0).
    if profile[0][1] != 0.0 or profile[-1][1] != 0.0:
        raise RuntimeError("Profile must start/end on axis.")

    body = profile[1:-1]
    vertices: List[Tuple[float, float, float]] = []
    body_faces: List[Tuple[int, ...]] = []
    cap_faces: List[Tuple[int, ...]] = []

    z_min = profile[0][0]
    z_max = profile[-1][0]
    cap_ratio = max(0.0, min(1.0, cap_ratio))
    cap_z = z_min + (z_max - z_min) * cap_ratio

    # Bottom center
    vertices.append((0.0, 0.0, profile[0][0]))
    bottom_center_idx = 1

    # Rings
    ring_start_indices: List[int] = []
    for z, r in body:
        ring_start_indices.append(len(vertices) + 1)
        for s in range(segments):
            a = 2.0 * math.pi * s / segments
            x = r * math.cos(a)
            y = r * math.sin(a)
            vertices.append((x, y, z))

    # Top center
    vertices.append((0.0, 0.0, profile[-1][0]))
    top_center_idx = len(vertices)

    first_ring = ring_start_indices[0]
    last_ring = ring_start_indices[-1]

    # Bottom fan
    for s in range(segments):
        s1 = (s + 1) % segments
        a = first_ring + s
        b = first_ring + s1
        body_faces.append((bottom_center_idx, a, b))

    # Side quads
    for ring_i in range(len(ring_start_indices) - 1):
        lo = ring_start_indices[ring_i]
        hi = ring_start_indices[ring_i + 1]
        z_mid = (body[ring_i][0] + body[ring_i + 1][0]) * 0.5
        target = cap_faces if z_mid >= cap_z else body_faces
        for s in range(segments):
            s1 = (s + 1) % segments
            v1 = lo + s
            v2 = lo + s1
            v3 = hi + s1
            v4 = hi + s
            target.append((v1, v2, v3, v4))

    # Top fan
    for s in range(segments):
        s1 = (s + 1) % segments
        a = last_ring + s
        b = last_ring + s1
        cap_faces.append((top_center_idx, b, a))

    # Ensure both objects always get faces.
    if not cap_faces:
        cap_faces.extend(body_faces[-segments:])
        del body_faces[-segments:]
    if not body_faces:
        body_faces.extend(cap_faces[:segments])
        del cap_faces[:segments]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    mtl_name = out_path.with_suffix(".mtl").name
    with out_path.open("w", encoding="utf-8") as f:
        f.write("# Generated lathed mesh\n")
        if write_mtl:
            f.write(f"mtllib {mtl_name}\n")
        for x, y, z in vertices:
            f.write(f"v {x:.6f} {y:.6f} {z:.6f}\n")
        f.write("o BottleBody\n")
        if write_mtl:
            f.write("usemtl body_plastic\n")
        for face in body_faces:
            f.write("f " + " ".join(str(i) for i in face) + "\n")
        f.write("o BottleCap\n")
        if write_mtl:
            f.write("usemtl cap_black\n")
        for face in cap_faces:
            f.write("f " + " ".join(str(i) for i in face) + "\n")

    if write_mtl:
        mtl_path = out_path.with_suffix(".mtl")
        with mtl_path.open("w", encoding="utf-8") as f:
            f.write("# Generated material presets for Three.js start values\n")
            f.write("newmtl body_plastic\n")
            f.write("Ka 0.50 0.50 0.50\n")
            f.write("Kd 0.82 0.82 0.82\n")
            f.write("Ks 0.08 0.08 0.08\n")
            f.write("Ns 28.0\n")
            # Slightly cloudy translucent plastic
            f.write("d 0.60\n")
            f.write("illum 2\n\n")
            f.write("newmtl cap_black\n")
            f.write("Ka 0.03 0.03 0.03\n")
            f.write("Kd 0.06 0.06 0.06\n")
            f.write("Ks 0.12 0.12 0.12\n")
            f.write("Ns 120.0\n")
            f.write("d 1.0\n")
            f.write("illum 2\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a revolved OBJ from side image.")
    parser.add_argument("image", type=Path, help="Path to side image")
    parser.add_argument("output", type=Path, help="Path to output OBJ")
    parser.add_argument("--threshold", type=float, default=16.0, help="Background diff threshold")
    parser.add_argument("--smooth", type=int, default=17, help="Smoothing window (odd number)")
    parser.add_argument("--smooth-passes", type=int, default=3, help="How many smoothing passes")
    parser.add_argument("--height", type=float, default=0.265, help="Target model height in meters")
    parser.add_argument("--segments", type=int, default=64, help="Radial segments")
    parser.add_argument("--rings", type=int, default=140, help="Max vertical rings")
    parser.add_argument("--cap-ratio", type=float, default=0.78, help="Height ratio where cap material starts")
    parser.add_argument("--flat-bottom-frac", type=float, default=0.045, help="Lower height fraction flattened to a sealed flat base")
    parser.add_argument("--no-mtl", action="store_true", help="Do not write/use MTL file")
    args = parser.parse_args()

    profile = sample_profile(
        image_path=args.image,
        threshold=args.threshold,
        smooth_window=args.smooth,
        smooth_passes=args.smooth_passes,
        target_height_m=args.height,
        max_rings=args.rings,
        flat_bottom_frac=args.flat_bottom_frac,
    )
    write_revolved_obj(
        profile=profile,
        out_path=args.output,
        segments=args.segments,
        cap_ratio=args.cap_ratio,
        write_mtl=not args.no_mtl,
    )

    print(f"Wrote OBJ: {args.output}")
    if not args.no_mtl:
        print(f"Wrote MTL: {args.output.with_suffix('.mtl')}")
    print(f"Profile points: {len(profile)}, radial segments: {args.segments}")


if __name__ == "__main__":
    main()
