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

## Vehicle selection and tree clearance

Choose Car, Motorcycle, Bus, Pickup truck or Minivan on the start screen or using the Vehicle selector. Stop before switching. A switch is rejected if the new vehicle would extend off the drivable surface or overlap traffic/parked vehicles on the same road level. Press V to see the complete model.

Each choice has its own model, color, dimensions, acceleration, steering wheelbase and eye height. Bus and pickup models have raised driving views; the motorcycle has handlebars in first person and a seated rider in third person. Models retain rotating wheels, brake lights and turn signals. The original forward-speed cap remains unchanged.

Every tree-placement request now goes through a deterministic clearance check for the entire canopy around streets, sidewalks, the lot, building footprints, the freeway and all ramps. Conflicting trees are moved to a nearby clear location or omitted. Orphan trunks from the older scenery loop have been removed.

The digital instrument texture is corrected for Ultra's mirrored scene coordinates, and speed/gear use separate fixed fields. The supplemental speed/gear HUD sits at the left edge in both camera modes.

Automated checks cover five model builds, safe selection, vehicle eye heights, generated-tree clearance and dashboard text orientation. A browser visual playtest is still required.


## Neighborhoods, home, walking, and mixed traffic

Ultra has two residential blocks: Palm Grove (northwest) and Sunset Park (southeast). Their two-way local streets connect to the city grid on all four sides. There are 32 houses with pitched roofs, garages, driveways, porches, and windows. The HOME marker identifies your house in Sunset Park; its front door is teal with a gold panel.

- Stop at ground level and press G to leave your selected vehicle. G returns when you are close to it; press P afterward to release the parking brake. Vehicle switching is disabled on foot.
- W/S or Up/Down walk; A/D or Left/Right turn; Shift runs outdoors. Walking is first-person. Buildings and interior furniture block movement.
- Press F at your home door to enter. Approach an object and press F to toggle the TV or lights, sit on the sofa (F again to stand), rest in bed, or get a snack. Rest and food replenish the displayed energy. Press F at the inside front door to leave. Other houses are exterior scenery.
- Your vehicle remains parked outside. Driving traffic continues while you walk outdoors and pauses while you are inside. Restart returns to driving. House activities are session-local, not saved between reloads.
- City and freeway traffic include cars, motorcycles, minivans, pickups, and buses. Long vehicles have larger following distances and stop farther back at red lights. Buses cruise up to 30 mph on streets and 60 mph on the freeway, subject to traffic.
- 32 animated pedestrians walk back and forth on residential sidewalks, stop near the player or parked vehicle, and stay out of the road intersections. Hitting a pedestrian ends the drive; traffic can also hit you while you are on foot.

Pedestrians use a reusable instanced mesh, preserving cached city geometry. Automated tests cover neighborhood road and driveway continuity, home access, all interactions, pedestrian route clearance, mixed fleet membership, following distance, walking-camera visibility, and renderer geometry. GPU rendering and visual appearance still need a browser playtest. Classic is unchanged.
