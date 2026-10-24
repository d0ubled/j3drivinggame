# Jasmine Drive Ultra

[Play Ultra](../ultra.html) · [Play Classic](../classic.html)

Ultra is a separate graphics edition. The original game remains available in `classic.html`, with explicitly requested shared usability fixes; `index.html` remains the Classic entry point with a link to Ultra.

## Included in this release

- Three.js r170 renderer, physically based materials, ACES tone mapping, sunlight, hemisphere lighting, soft shadows and atmospheric haze.
- Procedural asphalt, masonry, concrete and grass textures, with mipmaps and anisotropic filtering.
- Reflective glass and paint, beveled vehicle bodies, three cabin profiles, rotating wheels, brake lights and turn signals.
- A 3D dashboard, steering wheel, digital instruments and a rear-view mirror (medium/high quality).
- Clouded sky, distant hills, storefront signs, raised curbs and the existing city detail.
- Material-batched static geometry, cached city chunks and instanced vehicle parts.
- Low, medium and high presets; FPS display; graphics preference saved locally.
- The existing city, eight freeway lanes, widened onramps, guardrail openings, parking traffic, controls, horns, scoring and collision rules.

This is a procedural graphics upgrade, not a commercial photorealistic asset pack. Buildings and vegetation still originate from the game's existing procedural layout. Ambient-occlusion/bloom postprocessing, external art assets, richer building variants and adaptive performance tuning remain future polish.

## Files

- `../classic.html`: Classic edition, including shared HUD usability fixes. The original snapshot is retained in Git history.
- `../index.html`: Classic with an Ultra navigation link.
- `../ultra.html`: Ultra UI and error/loading handling.
- `game.js`: driving simulation, HUD and world geometry.
- `renderer.js`: Three.js presentation, materials, cars, cockpit and quality settings.

Classic is intentionally independent. Future gameplay fixes must be consciously applied to both editions; Ultra does not rewrite Classic on load.

## Runtime and hosting

Serve over HTTP(S); do not open the module-based Ultra page directly with `file://`. GitHub Pages serves these files without a build step.

Ultra imports a pinned Three.js module from:
https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js

That external download is required on a first visit. If it fails, or the browser cannot initialize WebGL2, Ultra displays an error with a Classic link. Classic has no Three.js dependency.

Three.js is MIT-licensed: https://github.com/mrdoob/three.js/blob/r170/LICENSE

## Graphics presets

| Setting | Low | Medium | High |
| --- | --- | --- | --- |
| Pixel-ratio cap | 1 | 1.25 | 1.75 |
| Dynamic shadows | Off | 2048 map | 4096 map |
| Rear-view mirror | Off | Every 4 frames | Every 2 frames |

Actual frame rate depends on device and browser. No measured FPS claim is made until a real-browser benchmark is available.

## Controls

W/Up accelerate; S/Down/Space brake; A/D or arrows steer; Q/E signal; R drive/reverse while stopped; P parking brake; H horn; V cockpit/chase; hold Z/X to look sideways; hold C to check approaching freeway traffic.

## Checks

Run from the repository root with Node.js:

```sh
node --check ultra/game.js
node --check ultra/renderer.js
node tests/ultra-game.cjs
node tests/ultra-renderer.mjs
```

The renderer check downloads the pinned Three.js module to a temporary directory. Set `THREE_MODULE` to an existing local module path to run it without downloading.

The checks exercise actual Three.js CPU-side geometry/material/camera APIs, finite mesh data, handedness and horizon placement, graphics presets, the mirror code path, eight freeway lanes, ramp grades/joins, driving clearance, vertical collision separation and camera modes. WebGL drawing is mocked: these checks do **not** compile GPU shaders or verify visual appearance.

## Browser acceptance pass still required

Use the same four locations for Classic/Ultra comparisons:

1. Initial city intersection: signal visibility, cockpit instruments and road paint.
2. Parking lot: traffic, shadows, parking and reverse/chase view.
3. Each on/offramp: pavement clearance, barrier openings and merge visibility.
4. Freeway: all eight lanes, frame rate and overpass separation.

Check Chrome/Edge and a touch device at low/medium/high settings. Test resizing, pause/restart, mute, signal/horn reactions, and the no-WebGL/CDN-failure fallback.

Development browser launch was rejected by the environment's automatic approval policy. No screenshot or visual-playtest result is claimed for this release.

## City and freeway detail update

Ultra now replaces the uniform building blocks with four facade families, a taller central district, glazed storefronts, window mullions, parapets, roof pavilions and planters. Added freeway details include longitudinal bridge girders, overhead exit gantries on all four sides, median lighting, pavement expansion joints and barrier reflectors. Reflectors respect existing ramp openings; sign supports and planters stay outside travel lanes. Road geometry and Classic are unchanged.
