#!/usr/bin/env python3
"""
Generate 360-wrap PDF templates for product artwork.

Outputs:
- kodiprint-storefront/public/templates/vinga-lean-360-template.pdf
- kodiprint-storefront/public/templates/tacx-shiva-360-template.pdf
- kodiprint-storefront/public/templates/vinga-lean-360-template-simple.pdf
- kodiprint-storefront/public/templates/tacx-shiva-360-template-simple.pdf
- kodiprint-storefront/public/templates/README_WRAP_TEMPLATES.txt

Dimensions are based on current product metadata label_zone values.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon


BLEED_MM = 5.0
SAFE_MM = 5.0


def polygon_area(points: list[tuple[float, float]]) -> float:
    area = 0.0
    n = len(points)
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return 0.5 * area


def offset_convex_polygon(
    points: Iterable[tuple[float, float]], offset_mm: float
) -> list[tuple[float, float]]:
    pts = list(points)
    if len(pts) < 3:
        raise ValueError("Polygon must have at least 3 points")

    # Ensure CCW winding for stable outward normal
    if polygon_area(pts) < 0:
        pts.reverse()

    lines: list[tuple[float, float, float]] = []
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        dx = x2 - x1
        dy = y2 - y1
        length = (dx * dx + dy * dy) ** 0.5
        if length <= 1e-9:
            raise ValueError("Degenerate polygon edge")

        # For CCW polygon, interior is left of each edge, so outward is right normal.
        nx = dy / length
        ny = -dx / length
        c = nx * x1 + ny * y1 + offset_mm
        lines.append((nx, ny, c))

    out: list[tuple[float, float]] = []
    for i in range(n):
        n1x, n1y, c1 = lines[(i - 1) % n]
        n2x, n2y, c2 = lines[i]
        det = n1x * n2y - n1y * n2x
        if abs(det) <= 1e-9:
            raise ValueError("Adjacent polygon edges are parallel")
        x = (c1 * n2y - n1y * c2) / det
        y = (n1x * c2 - c1 * n2x) / det
        out.append((x, y))
    return out


def draw_template(
    output_pdf: Path,
    trim_polygon: list[tuple[float, float]],
    title: str,
) -> None:
    bleed_polygon = offset_convex_polygon(trim_polygon, BLEED_MM)
    safe_polygon = offset_convex_polygon(trim_polygon, -SAFE_MM)

    all_x = [p[0] for p in bleed_polygon]
    all_y = [p[1] for p in bleed_polygon]
    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)
    width_mm = max_x - min_x
    height_mm = max_y - min_y

    fig = plt.figure(figsize=(width_mm / 25.4, height_mm / 25.4))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(min_x, max_x)
    ax.set_ylim(min_y, max_y)
    ax.set_aspect("equal")
    ax.axis("off")

    # Bleed (outer)
    ax.add_patch(
        Polygon(
            bleed_polygon,
            closed=True,
            fill=False,
            edgecolor="#ff00aa",
            linewidth=0.8,
            linestyle=(0, (3, 2)),
        )
    )

    # Trim (final cut)
    ax.add_patch(
        Polygon(
            trim_polygon,
            closed=True,
            fill=False,
            edgecolor="#ff8a00",
            linewidth=1.0,
            linestyle="solid",
        )
    )

    # Safe area
    ax.add_patch(
        Polygon(
            safe_polygon,
            closed=True,
            fill=False,
            edgecolor="#00a8ff",
            linewidth=0.8,
            linestyle=(0, (2, 2)),
        )
    )

    # Center lines
    trim_x = [p[0] for p in trim_polygon]
    trim_y = [p[1] for p in trim_polygon]
    cx = (min(trim_x) + max(trim_x)) / 2
    cy = (min(trim_y) + max(trim_y)) / 2
    ax.plot([cx, cx], [min_y, max_y], color="#666666", linewidth=0.3, linestyle=(0, (1, 2)))
    ax.plot([min_x, max_x], [cy, cy], color="#666666", linewidth=0.3, linestyle=(0, (1, 2)))

    fig.savefig(output_pdf, format="pdf", dpi=300, transparent=True)
    plt.close(fig)
    print(f"Generated: {output_pdf}")
    print(f"  {title} bleed page size: {width_mm:.2f} x {height_mm:.2f} mm")


def draw_single_line_template(
    output_pdf: Path,
    trim_polygon: list[tuple[float, float]],
    title: str,
) -> None:
    bleed_polygon = offset_convex_polygon(trim_polygon, BLEED_MM)
    all_x = [p[0] for p in bleed_polygon]
    all_y = [p[1] for p in bleed_polygon]
    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)
    width_mm = max_x - min_x
    height_mm = max_y - min_y

    fig = plt.figure(figsize=(width_mm / 25.4, height_mm / 25.4))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(min_x, max_x)
    ax.set_ylim(min_y, max_y)
    ax.set_aspect("equal")
    ax.axis("off")

    # Only one trim line - this is what the configurator clips against.
    ax.add_patch(
        Polygon(
            trim_polygon,
            closed=True,
            fill=False,
            edgecolor="#ff8a00",
            linewidth=1.0,
            linestyle="solid",
        )
    )

    fig.savefig(output_pdf, format="pdf", dpi=300, transparent=True)
    plt.close(fig)
    print(f"Generated: {output_pdf}")
    print(f"  {title} simple page size: {width_mm:.2f} x {height_mm:.2f} mm")


def rect_polygon(width_mm: float, height_mm: float) -> list[tuple[float, float]]:
    w2 = width_mm / 2
    return [(-w2, 0.0), (w2, 0.0), (w2, height_mm), (-w2, height_mm)]


def trapezoid_polygon(
    top_width_mm: float, bottom_width_mm: float, height_mm: float
) -> list[tuple[float, float]]:
    tw2 = top_width_mm / 2
    bw2 = bottom_width_mm / 2
    return [(-bw2, 0.0), (bw2, 0.0), (tw2, height_mm), (-tw2, height_mm)]


def write_readme(path: Path) -> None:
    content = """KODIPRINT 360 WRAP TEMPLATES

Files:
- vinga-lean-360-template.pdf
- tacx-shiva-360-template.pdf
- vinga-lean-360-template-simple.pdf
- tacx-shiva-360-template-simple.pdf

Guide lines:
- Magenta dashed = BLEED (5 mm outside trim)
- Orange solid = TRIM (final print contour)
- Cyan dashed = SAFE AREA (5 mm inside trim)
- Gray dotted = center lines

Dimensions (trim):
- Vinga Lean: 230.6 x 149.0 mm (cylindrical)
- Tacx Shiva: trapezoid, top 250.6 mm, bottom 239.5 mm, height 102.0 mm

Important:
- Keep logos/text inside SAFE AREA.
- Extend background colors/images to BLEED.
- Before final upload to configurator, remove/hide guide lines.
- For automatic clipping in configurator, prefer the *-simple.pdf files
  (single orange trim line only).
"""
    path.write_text(content, encoding="utf-8")
    print(f"Generated: {path}")


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out_dir = root / "kodiprint-storefront" / "public" / "templates"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Based on live product metadata (label_zone) currently in DB.
    vinga_trim_w = 230.6
    vinga_trim_h = 149.0

    tacx_top_w = 250.6
    tacx_bottom_w = 239.5
    tacx_h = 102.0

    draw_template(
        out_dir / "vinga-lean-360-template.pdf",
        rect_polygon(vinga_trim_w, vinga_trim_h),
        title="Vinga Lean",
    )
    draw_template(
        out_dir / "tacx-shiva-360-template.pdf",
        trapezoid_polygon(tacx_top_w, tacx_bottom_w, tacx_h),
        title="Tacx Shiva",
    )
    draw_single_line_template(
        out_dir / "vinga-lean-360-template-simple.pdf",
        rect_polygon(vinga_trim_w, vinga_trim_h),
        title="Vinga Lean",
    )
    draw_single_line_template(
        out_dir / "tacx-shiva-360-template-simple.pdf",
        trapezoid_polygon(tacx_top_w, tacx_bottom_w, tacx_h),
        title="Tacx Shiva",
    )
    write_readme(out_dir / "README_WRAP_TEMPLATES.txt")


if __name__ == "__main__":
    main()
