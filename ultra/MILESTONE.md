# Sunset Park graphics benchmark

This Ultra-only detail pass improves the four houses in the western row of Sunset Park, including HOME at (180, -180), the furnished interior, and the selectable car model.

Exterior: fascia and corner trim, foundations, siding courses, framed windows and shutters, porch lanterns, an address plaque and driveway joints. Interior: upholstery piping, button details, a folded throw, headboard channels, books and coastal wall art. Cars: grille slats, mirror inserts, panel seams, trim and rotating wheel spokes. The existing accidentally commented-out outdoor background/fog initialization is restored.

Assets are original procedural geometry using the existing Three.js renderer; no scanned GLB assets or external downloads are added. Repeated exterior parts use instancing and the benchmark block is hidden beyond 230 meters from its center. Geometry and driving footprints are unchanged.

## Validation
Run from the repository root:
- `node --check ultra/renderer.js`
- PowerShell: `$env:THREE_MODULE='ultra/vendor/three.module.js'; node tests/ultra-milestone.mjs`

The renderer regression checks and benchmark batching, culling, and HOME walkway clearance checks pass. Edge failed to launch in the test environment; GPU appearance and measured before/after frame rate remain unverified.

## Visual acceptance still needed
1. Drive to HOME in Sunset Park, select Car, and press V. Check the car from the front, back and sides.
2. Walk from the sidewalk to the front door. Check porch scale, readable address, unobstructed access and no flickering surfaces.
3. Enter HOME; inspect the sofa, bed and media console. Use the existing sitting, resting, TV and light controls.
4. Compare low/medium/high settings and FPS at the same locations against the previous revision. Check distant culling while approaching the street.
5. Approve the sample area's appearance and performance before extending the art treatment or introducing licensed GLB replacements throughout the city.
