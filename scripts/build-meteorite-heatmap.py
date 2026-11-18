"""Bake a spherical Gaussian KDE from the project's catalogue into a texture.

Run with Python, NumPy, SciPy, and Pillow when the catalogue changes.
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 1440, 720
BANDWIDTH_DEGREES = 0.9
EARTH_RADIUS_KM = 6371
SIGMA = np.deg2rad(BANDWIDTH_DEGREES)
MAX_DENSITY = 10000  # records per 100,000 km²


def unit_vectors(lon, lat):
    lon, lat = np.deg2rad(lon), np.deg2rad(lat)
    return np.stack((np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)), axis=-1)


def main():
    catalogue = json.loads((ROOT / 'src/data/meteorite-catalogue.json').read_text(encoding='utf-8'))
    points = [(row[7], row[6]) for row in catalogue['rows'] if row[6] is not None and row[7] is not None]
    if len(points) != catalogue['meta']['mapped']:
        raise ValueError('Catalogue mapped count does not match its coordinate pairs')
    locations, counts = np.unique(points, axis=0, return_counts=True)
    tree = cKDTree(unit_vectors(locations[:, 0], locations[:, 1]))
    longitudes = (np.arange(WIDTH) + .5) * 360 / WIDTH - 180
    latitudes = 90 - (np.arange(HEIGHT) + .5) * 180 / HEIGHT
    search_radius = 2 * np.sin(2 * SIGMA)  # Chord length at four standard deviations.
    density = np.zeros((HEIGHT, WIDTH))
    for start in range(0, HEIGHT, 8):
        lon, lat = np.meshgrid(longitudes, latitudes[start:start + 8])
        vectors = unit_vectors(lon.ravel(), lat.ravel())
        pairs = cKDTree(vectors).sparse_distance_matrix(tree, search_radius, output_type='coo_matrix')
        angle = 2 * np.arcsin(pairs.data / 2)
        weights = counts[pairs.col] * np.exp(-.5 * (angle / SIGMA)**2)
        density[start:start + 8] = np.bincount(pairs.row, weights=weights, minlength=lon.size).reshape(lon.shape)
    density *= 100000 / (2 * np.pi * (EARTH_RADIUS_KM * SIGMA)**2)
    normalized = np.log1p(density) / np.log1p(MAX_DENSITY)
    pixels = np.rint(255 * np.clip(normalized, 0, 1)).astype('uint8')
    target = ROOT / 'public/visitors/meteorite-heatmap.png'
    # RGB avoids luminance texture differences across WebGL implementations.
    Image.fromarray(pixels).convert('RGB').save(target, optimize=True)
    print(f'{len(points):,} records, {len(locations):,} distinct locations, {WIDTH}x{HEIGHT}, peak {density.max():,.1f} per 100,000 sq km')


if __name__ == '__main__':
    main()
