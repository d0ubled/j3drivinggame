# Jasmine Driving School — Requirements and Decisions

This document records the requirements and decisions established during development of `d0ubled/j3drivinggame`. It consolidates the conversation and the current `main/index.html` implementation. Later explicit user decisions supersede earlier requests.

**Baseline:** gameplay source commit `8f65b67c103ab36f29ada6097187e25230dd4960` (wider onramps and drivable merge aprons). This is a requirements baseline, not a claim that every visual or gameplay behavior has been verified in a browser.

## 1. Product and scope

- Build a playable browser driving game, branded **Jasmine Driving School / jasmine drive**.
- Start in a first-person cockpit view.
- Support free driving around a large city, turns onto other roads, parking, traffic lights, lane changes, and freeway driving.
- Emphasize recognizable road behavior and increasingly realistic graphics.
- Preserve existing gameplay when improving graphics, road geometry, or traffic.
- The three introductory objectives are stopping at a red light, signaling a road turn, and parking in a marked space. Completing them allows continued exploration.

## 2. Player vehicle and driving

| Requirement | Current decision |
| --- | --- |
| Posted speed limit | 70 mph |
| Maximum forward speed | 150 mph |
| Reverse | Available when nearly stopped; automatically show the direction behind the car |
| Steering | Smooth steering, with reduced steering sensitivity at higher speeds |
| Braking | Service brake and a separate parking brake |
| Turn signals | Left/right blinkers for turns and lane changes; cancel after a completed turn |
| Horn | Player can honk; surrounding cars react |
| Collision outcome | A crash ends the drive and presents a restart option |
| Parking | Enter the lot, align with an empty marked bay, stop, and apply the parking brake |

- The requested collision rule is to end the game when the player crashes into anything.
- Current collision implementation checks the vehicle footprint against drivable surfaces and checks overlap with moving and parked cars. It is not a separate physical collider for every decorative mesh.
- Objects on another vertical road level must not produce a collision merely because their horizontal positions overlap.
- Score starts at 100. Current penalties deduct five points for applicable violations, including speeding, red lights, driving on the wrong side, and failing to signal. Feedback must explain the violation.
- Current reverse speed is capped at 4 m/s; drive/reverse and parking engagement require speed below approximately 0.3 m/s.

## 3. Controls and cameras

| Input | Action |
| --- | --- |
| W / Up arrow | Accelerate |
| S / Down arrow / Space | Brake |
| A / D or Left / Right arrows | Steer |
| Q / E | Left / right turn signal |
| R | Toggle drive / reverse while nearly stopped |
| P | Apply / release parking brake |
| H | Honk |
| V or View button | Toggle cockpit / third-person view |
| Hold Z / X | Look left / right |
| Hold C | Look toward approaching freeway traffic |
| Sound button | Toggle audio |
| Pause / Restart buttons | Pause or restart the drive |

- Third-person camera sits behind and above the player's visible car.
- Both views must follow road elevation and ramp slope.
- Reverse viewing must work in both camera modes.
- Use a wide field of view so the player can see traffic and junctions more naturally.
- Preserve the selected camera mode on restart.
- Provide on-screen driving buttons for touch devices.
- Clear held inputs and pause when the window loses focus.

## 4. City and local streets

- Provide a larger connected city with two-way streets, intersections, buildings, roadside details, and a reachable parking lot.
- Allow actual turns onto other roads; the game must not be limited to following one road.
- Populate interior streets as well as roads around the outside of the city.
- Current city grid uses five road coordinates per axis: -320, -160, 0, 160, and 320 meters.
- Current local roads have two lanes per direction, with a 16-meter paved width and sidewalks.
- Include center lines, broken lane lines, stop lines, crossings, and clear road edges.
- Local roads on all four sides continue beneath the elevated freeway.
- The minimap must show local roads, freeway, entrance/exit ramps, parking, and the player's position.

## 5. Traffic lights

- Provide recognizable red, amber, and green signals at intersections.
- Lights must remain visible when the player is stopped at the stop line.
- Mount heads on the far side of intersections and provide multiple lane-facing heads.
- Include a nearby-signal HUD showing the active state and distance to the stopping line.
- NPC traffic must obey the same light state as the player and stop before the intersection.
- Cars already inside an intersection should be allowed to clear it.
- Current coordinated cycle is 34 seconds: each main direction receives 12 seconds of green and 3 seconds of amber, with intervening all-red periods.

## 6. NPC traffic

- Cars must move, rather than appearing as static roadway decoration.
- Distribute traffic across the city, including interior roads, and across all freeway lanes.
- NPCs must maintain safe following distances, brake for obstacles, and avoid deliberately driving into the player.
- NPCs must use turn signals for intended turns and parking maneuvers.
- Nearby drivers should respond to the player's turn signals by leaving a courtesy gap when relevant.
- Drivers should react to the horn where appropriate. Current reactions include a brief hazard acknowledgement, cautious slowing by crossing traffic, and quicker progress by an unobstructed car ahead.
- Horn or signal reactions must not override red lights or following-distance constraints.
- NPCs should travel faster when conditions permit and slow for intersections, turns, parking, and other traffic.
- Freeway traffic must generally travel faster than local-street traffic.
- Current baseline: 64 city cars on eight overlapping routes; local clear-road target speeds are roughly 35–50 mph, with slower turns.
- Current baseline: 64 freeway cars, eight in each of eight lanes; nominal cruise targets are approximately 60–70 mph.
- Current freeway NPCs follow their assigned circular lanes. NPC lane-changing or automatic ramp routing is not an established implemented feature.
- Current city turn signaling is route-based; it does not establish a general lane-changing AI system.

## 7. Parking lot

- Provide a connected, clearly marked parking lot the player can enter from local streets.
- Include marked spaces, occupied spaces, and enough room to maneuver.
- Other cars must enter the lot, signal, park, wait, reverse out, and return to the street.
- Parking vehicles should wait when the aisle or backing maneuver is obstructed.
- Treat occupied bays as unavailable for the player's parking objective.
- Current lot contains 14 marked spaces, four static parked cars, and three visiting cars.
- Current lot bounds are approximately x=25–88 and z=38–108 meters; its driveway joins the street around z=65–79.

## 8. Freeway layout

- **Four lanes in each direction: eight travel lanes total.**
- Separate opposing directions with a median.
- Maintain consistent lane width and markings through the circuit.
- Provide a realistic elevated freeway with overpasses, supports, barriers, and roads passing below.
- Entrance and exit paths must be distinct and smoothly curved, rather than making a 90-degree turn directly into freeway traffic.
- Provide access on all four sides. The selected implementation has one entrance and one exit on each side: eight ramps total.
- Retain sufficient sight distance and tools to inspect approaching freeway traffic before merging.
- Freeway traffic and the player must use the same road elevation.

### Current geometry decisions

- Circular freeway centered on the city, nominal center radius 560 meters.
- Deck elevation: 7.2 meters.
- Four-meter lanes.
- Inner-direction lane centers: 545, 549, 553, and 557 meters.
- Outer-direction lane centers: 563, 567, 571, and 575 meters.
- Opposing carriageways are separated around radii 559–561 meters.
- Ramps connect to the outermost lane at radius 575 meters.
- Use cloverleaf-style curved ramps with gradual elevation changes and tangential freeway joins.
- Current ramps have 129 path samples each and a maximum tested grade below 8%.
- Keep ground-level underpass roads and elevated surfaces distinct in driving and collision calculations.

## 9. Onramps, offramps, and merge clearance

- Widen onramps overall and eliminate the narrow point that prevented the player from merging.
- **Current onramp paved width: 8 meters through the curved ramp**, with a gradual widening from the local-road approach.
- Current offramps retain approximately 5.4 meters of paved width.
- Paved merge aprons must be drivable across their full intended width; visual asphalt and the drivable-surface calculation must agree.
- Leave space for the entire vehicle footprint, not just its center point.
- Keep guardrails and barriers out of the merge path.
- Determine freeway guardrail openings from actual entrance/exit pavement widths and elevations, including clearance at both ends of each rendered rail segment; fixed angular openings alone are insufficient.
- Trim ramp-side rail sections where they enter the freeway, for both entrances and exits. Preserve barriers away from ramp connections.
- Align ramp pavement, shoulders, paint, deck edges, and guardrails at the freeway connection.
- Use a gradual merge taper to the outside freeway lane, rather than a sudden narrow connector.
- Current entry taper covers approximately 0.13 radians (about 75 meters), with its outer edge transitioning from radius 583 to 579 meters.
- Provide white dashed lane markings, yellow median-edge markings, solid shoulder edges, and broken merge-edge markings only where merging occurs.
- Current freeway dash pattern is 3 meters of paint followed by 9 meters of gap.
- Include orderly gore hatching and direction arrows. Avoid overlapping, contradictory paint or visible gaps between ramp segments.

## 10. Merge visibility and assistance

- The player must be able to see when it is safe to enter the freeway.
- Provide look-left/look-right controls and a dedicated approaching-traffic view.
- Show a merge panel on the later part of an entrance ramp.
- The panel shows approaching vehicles across the four lanes of the relevant carriageway, along with front distance and time to traffic behind.
- Current advisory reports an open gap when there is more than 5 seconds to the closest approaching outer-lane car and more than 30 meters to the car ahead.
- An open-gap message is advisory; the player must still check traffic and steer.
- Freeway cars should reserve space for a nearby merging player where possible.
- Widening ramps must preserve traffic visibility, signs, and these assistance features.

## 11. Graphics and environment

- Improve realism incrementally while retaining playable performance.
- Fix road rendering glitches during driving, especially surface overlap, paint ordering, and ramp joins.
- Use hardware depth testing for correct ordering of roads, vehicles, glass, and buildings.
- Keep a Canvas 2D fallback when WebGL is unavailable.
- Provide textured asphalt, concrete, grass, and masonry; avoid unstable or flickering surface detail.
- Include more detailed vehicle bodies, wheels, windows, mirrors, lights, brake lights, and blinkers.
- Improve car finishes and glass reflections.
- Add building windows, ledges, doors, roof equipment, and roadside architectural details.
- Include natural-looking tree canopies, shrubs, streetlights, and building shadows.
- Provide sky gradients, clouds, sunlight, and distance haze.
- Keep distant detail simpler and cull sufficiently distant objects to limit rendering cost.
- These are procedural visual approximations; a photorealistic engine, external model pack, or physically based lighting system has not been selected.

## 12. Sound

- Include engine sound that responds to vehicle speed, turn-signal ticks, reverse warning, collision sound, and a horn.
- Provide an audio toggle.
- Start/resume audio through user interaction to comply with browser playback behavior.
- Current sounds are synthesized using browser audio APIs rather than external recordings.

## 13. UI and game lifecycle

- Provide a start screen with controls and a concise description of the world.
- Show speed, selected gear/parking state, turn signals, score, objectives, and contextual notices.
- Provide a visible crash explanation and restart control when a drive ends.
- Keep the traffic-light status and merge panel legible without unnecessarily blocking the driving view.
- Support browser resizing and touch-oriented layouts.

## 14. Repository and publishing

- Authoritative repository: https://github.com/d0ubled/j3drivinggame
- Authoritative game source: `index.html` on `main`.
- Publish through **GitHub Pages**. The initial GitLab Pages request was explicitly corrected to GitHub Pages.
- The current game is a self-contained HTML document with inline CSS and JavaScript, using native browser rendering/audio APIs.
- Continue updating the existing game rather than replacing it with an unrelated project.
- Repository updates and publishing were authorized during the development conversation.
- A pushed commit does not by itself establish that the Pages deployment has finished; verify workflow/deployment status before claiming a release is live.

## 15. Superseded decisions

| Earlier request | Current governing decision |
| --- | --- |
| Maximum speed of 100 mph | Maximum forward speed of 150 mph |
| “Four-lane freeway” without direction clarified | Four lanes each way, eight total |
| GitLab Pages | GitHub Pages |
| First-person-only initial concept | First-person default plus optional third-person view |
| Earlier narrow entrance ramps | Wider 8-meter onramps and fully drivable merge aprons |

The 70 mph speed limit remains in effect even though the player's maximum speed increased.

## 16. Validation and outstanding verification

### Required regression checks

- Game source parses and the game can initialize.
- Both camera modes work, including reverse and elevated roads.
- Moving traffic remains present on interior roads and all freeway lanes.
- Lights, signaling, horn reactions, parking, and collision behavior remain functional after changes.
- Ramp joins remain smooth, graded, and drivable with the whole vehicle footprint.
- The player can merge without hitting an unintended narrow pavement boundary or barrier.
- Ground-level vehicles do not collide with vehicles directly above them.
- Road paint and surfaces remain stable while driving.
- Deployment serves the updated source.

### Evidence available at this baseline

- Automated checks passed for eight freeway lanes and correct traffic directions.
- Ramp grade, tangent joins, vehicle-footprint clearance, and continuous underpass-road checks passed.
- Camera geometry and separate vertical collision-layer checks passed.
- The latest widening checks covered all four entrances, vehicle centers offset 2.2 meters to either side of the ramp center, and continuous drivable merge aprons.
- Renderer checks used mathematical/state checks and mocked rendering interfaces. They do not substitute for real-browser shader compilation, visual inspection, or a driving playtest.
- A successful in-browser visual review has not been recorded. Confirm the ramp experience, lighting, markings, frame rate, and mobile usability by playtesting.
- Treat the broad “crash into anything” requirement and general NPC signaling behavior as acceptance goals; decorative-object collision coverage and every traffic interaction are not proven by the geometry tests above.
