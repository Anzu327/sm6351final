"""Project Natural Earth 1:110m countries to the VISITORS Equal Earth plane."""

import json
import math
import sys
from pathlib import Path

from shapely import make_valid, segmentize, union_all
from shapely.geometry import Polygon, box, shape


REGIONS = (
    "North America", "South America", "Europe", "Africa", "Asia", "Oceania", "Antarctica",
)

# Generalized Europe–Asia divide for the transcontinental country polygons.
EUROPE_SIDE = Polygon([
    (-35, 34), (24, 34), (28, 40), (29, 41), (31, 42), (37, 45),
    (44, 43), (48, 42), (51, 46), (51, 51), (58, 55), (60, 59),
    (61, 64), (65, 68), (68, 70), (73, 84), (-35, 84),
])


def polygons(geometry):
    if geometry.geom_type == "Polygon" and not geometry.is_empty:
        yield geometry
    elif hasattr(geometry, "geoms"):
        for part in geometry.geoms:
            yield from polygons(part)


def project(lon, lat):
    # Match the coefficients and orientation in src/earth-heatmap.js.
    m = math.sqrt(3) / 2
    a1, a2, a3, a4 = 1.340264, -.081106, .000893, .003796
    theta = math.asin(m * math.sin(math.radians(lat)))
    t2 = theta * theta
    t6 = t2 ** 3
    x = math.radians(lon) * math.cos(theta) / (m * (a1 + 3*a2*t2 + t6*(7*a3 + 9*a4*t2)))
    y = -theta * (a1 + a2*t2 + t6*(a3 + a4*t2))
    return x, y


def rings(geometry):
    for polygon in polygons(segmentize(geometry, 2)):
        for ring in (polygon.exterior, *polygon.interiors):
            yield [project(x, y) for x, y in ring.coords[:-1]]


def main(source):
    features = json.loads(Path(source).read_text(encoding="utf-8"))["features"]
    groups = {name: [] for name in REGIONS}
    for feature in features:
        properties = feature["properties"]
        region = properties["CONTINENT"]
        if region not in groups:
            continue
        geometry = make_valid(shape(feature["geometry"]))
        if properties["ADM0_A3"] in {"RUS", "KAZ", "TUR", "GEO", "AZE"}:
            groups["Europe"].append(geometry.intersection(EUROPE_SIDE))
            groups["Asia"].append(geometry.difference(EUROPE_SIDE))
        else:
            for part in polygons(geometry):
                # French Guiana is part of South America on this map.
                part_region = "South America" if region == "Europe" and part.centroid.x < -25 else region
                groups[part_region].append(part)

    # Use the principal side of the dateline for framing. Keep the original
    # islands in the clickable outlines on the world map.
    framing = {
        "Asia": box(0, -90, 180, 90),
        "North America": box(-180, -90, 0, 90),
        "Oceania": box(90, -90, 180, 90),
    }
    outlines = []
    for name, group in groups.items():
        geometry = union_all(group).simplify(.14, preserve_topology=True)
        visible = geometry.intersection(framing[name]) if name in framing else geometry
        xs, ys = zip(*(point for ring in rings(visible) for point in ring))
        bounds = [round(n, 4) for n in (min(xs), min(ys), max(xs), max(ys))]
        path = "".join(
            "M" + "L".join(f"{x:.4f},{y:.4f}" for x, y in ring) + "Z"
            for ring in rings(geometry)
        )
        outlines.append({"name": name, "bounds": bounds, "path": path})
    target = Path(__file__).resolve().parents[1] / "src/data/continent-outlines.json"
    target.write_text(json.dumps(outlines, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
