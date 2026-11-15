# Matching the Grok models: the reconstruction strategy

Status: plan, written 2026-11-14 before execution. Owner: the Asset Lab worker. Pilot: `hero_knight`, then `woodcutter`.

The rule from now on: **no eyeball rounds.** Every change is scored against the reference in the lab at a calibrated
camera, and a round is kept only if the scorecard improves.

## What I measured before writing this

- The lab's new silhouette metric (flat white mask render vs the ref alpha) puts the hand-sculpted knight round 5 at
  **IoU 68.0%** (17.9% of the ref uncovered, 20.2% of the model outside the ref). That is the baseline to beat.
- Ref alpha: the cutouts carry a soft orange glow halo (alpha 40-200 around the whole figure). It inflates the ref mask by
  2-4 px all round, so the scorer must use `alpha > 200` (or erode the glow) or IoU is capped below 100% for any model.
- Ref block size: the Grok cubes are not one lattice. Helmet and pauldron blocks are ~9-11 px at 482 px wide, tabard
  blocks ~6-7 px, and the pauldron blocks are **rotated to follow the curve** of the plate. The figure is about 60-65 blocks
  tall at its coarsest; ours is 93 voxels tall, so our bevelled cubes read finer and busier than Grok's.
- TripoSR prior (`_scratch/fidelity-spike/b/knight-mesh.json`): 41k vertices, 82k triangles, z-up, unit box, vertex colours.
  It was reconstructed from this very ref image, so its input view is (by construction) close to the ref camera.
- Turnaround `grok-hd/img/s6-turnaround-r1-*.jpg`: three views per image (front 3/4, side, back), each standing on a snow
  base. Identity drifts between them (helmet, cape sigil, sword grip), as the fidelity-spike report also found.

## Critique of the proposed pipeline, step by step

| # | Proposed | Verdict | Why / what changes |
|---|---|---|---|
| 1 | Calibrate the ref camera by IoU search | **Keep**, add landmarks | 3 DOF (yaw, pitch, fov; framing already fits bbox). Pure IoU is flat near the optimum and confused by pose error, so add 6 landmark points (helm top, visor centre, buckle, both foot contacts, shield centre, sword tip) as a second term. The ref is a generated image, so there is no exact camera; we take the best fit and lock it. |
| 2 | Recover the voxel lattice (Hough on bevel lines) | **Change** | There is no single lattice to recover: block sizes vary 6-11 px and blocks rotate to follow curved plates. Hough/edge histograms will return noise. Replace with **depth back-projection** (step 3b below): we get 3D positions of the visible surface from the aligned prior's depth, and the colours from the ref pixels, without needing the image's cubes to be axis-aligned. Keep one cheap, robust lattice measurement: the **dominant block period** (autocorrelation of the luminance gradient), used to choose our voxel size so our block rhythm matches Grok's. |
| 3 | TripoSR prior + turnaround carving + symmetry | **Keep, re-weighted** | TripoSR melts thin parts (blade, shield rim, visor) and fuses sword/leg and shield/torso. So: (a) use it only for the **bulk volume** (torso, legs, helm, pauldrons, cape), voxelized at our resolution; (b) render its depth at the ref camera and back-project the ref's visible pixels onto it to place the visible shell; (c) build **thin, rigid, separable parts as fitted primitives** (sword, shield, crossguard) whose parameters are solved against the ref by landmarks + IoU; (d) mirror the left/right symmetric parts (legs, pauldrons, helm) where the ref shows only one side. Turnaround views are a different-but-similar knight, so they are a **soft prior for the back** (cape length, back of helm), never a hard carving constraint. |
| 4 | Colour by projection, k-means LAB palette 24-32 | **Keep, plus de-lighting** | Raw pixels carry Grok's baked light (warm rim, dark undersides). Projecting them as albedo double-lights the model in game. Fix: render our own shape flat-white under the matched "Grok rim" light, divide the ref by that shading (clamped), then quantize. Palette per material cluster (steel, red cloth, gold, leather, black) so each cube gets a clean flat colour. Hidden faces take the nearest visible voxel colour of the same cluster. |
| 5 | Segment and rig after reconstruction | **Keep** | Spatial rules first (height bands + left/right + known primitive parts), colour clusters second. Bones stay the existing VoxelAnimator set (hips, torso, head, armR, weapon, armL, shield, cape, legR, legL), so walk/attack keep working. Rest pose = ref pose (stance baked into the voxels; bone rest rotations ~0). |
| 6 | In-page optimizer | **Keep** | Scorer and search run inside the lab page: render to a 160x210 offscreen target, `readPixels`, score. A few hundred evaluations per call, one tool round-trip per search. |
| 7 | Scorecard IoU>=0.92, dE<8, SSIM>=0.75, turnaround IoU>=0.85 | **Keep 3, relax 1** | Turnaround views show a different pose and partly different knight, so turnaround IoU is capped by drift. Score it on the head+torso band only, target >= 0.80, and treat it as a regression guard rather than a goal. |
| 8 | Generalize to all 37 | **Keep** | Buildings are easier: static, no rig, one TripoSR lodge prior exists; the rest need TripoSR runs (~2 min CPU each). |

## The final pipeline (what I will build)

All tools live in the lab page (`src/app/lab-fit.js`, a set of small classes) and are driven from the console / the
automation hook. Output is **data**, not hand code: `src/models/<id>.vox.js` holds a palette and run-length voxel data per
part; `src/models/<id>.js` registers it and may add hand overrides on top. Hand sculpting becomes a refinement layer, not the
source of truth.

1. **Scorer** (`FitScorer`): offscreen render at the locked camera -> silhouette IoU (ref alpha > 200), mean CIELAB dE over the
   overlap, luminance SSIM (8x8 windows), landmark error. One number per term, printed every round.
2. **Camera calibration** (`CameraFit`): grid over yaw 0.3-0.9, pitch 0.1-0.5, fov 10-30 (+ ortho limit), then
   coordinate-descent refine. Fit with the current hand model and again once the prior is aligned; lock as `view` in the
   model's registry meta.
3. **Prior alignment** (`PriorFit`): load the TripoSR mesh JSON, search axis permutation (z-up -> y-up, front axis), yaw,
   scale, offset to maximize IoU at the locked camera.
4. **Back-projection** (`SurfaceLift`): render the aligned prior's depth at the ref camera; for every ref pixel with alpha > 200
   lift (u, v, depth) to 3D and drop it into the voxel grid; that is the visible shell with sampled colours.
5. **Volume** (`VolumeFill`): voxelize the prior (inside test by ray parity) for the hidden bulk; mirror symmetric parts; carve
   anything outside the ref silhouette at the ref camera (a voxel that projects onto transparent ref pixels is wrong).
6. **Fitted primitives** (`PartFit`): sword (hilt point, direction, length, width), shield (centre, radii, normal, dome), visor
   slit; parameters solved against landmarks + IoU.
7. **Palette** (`PaletteFit`): de-light, k-means in CIELAB per material cluster, snap every voxel.
8. **Segment + rig** (`RigSplit`): assign voxels to bones by rules; export `<id>.vox.js`.
9. **Rounds**: change -> score -> keep if better -> `knight-rN.png` (ref | render | silhouette diff, with the scorecard in the label).

## Risks

- **TripoSR alignment**: its canonical camera may not match exactly; mitigated by the IoU search over 6 DOF and by carving to the
  ref silhouette (step 5), which removes most misalignment error on the visible side.
- **Thin parts**: blade, crossguard, shield rim, visor slit are below TripoSR's resolution; handled as fitted primitives.
- **Baked lighting**: de-lighting is approximate; the dE term will show whether it helps (keep whichever scores better).
- **Back side is invented**: only the turnaround's drifting views inform it. Acceptable for a game hero seen mostly from the
  front 3/4; noted in the scorecard as unverified.
- **Animation seams**: back-projected voxels at bone boundaries (shoulder, hip) can tear when the rig moves; RigSplit pads
  joints with a 1-voxel overlap.
- **Voxel count / perf**: a lifted shell can be denser than the hand model; greedy meshing + per-part meshes keep it well under
  the 16.7 ms frame budget, measured with `lab.perf()` every round.

## Time estimate (knight)

| Step | Estimate |
|---|---|
| Scorer + offscreen render + scorecard in snapshots | 45 min |
| Camera calibration | 30 min |
| Prior load + alignment | 60 min |
| Back-projection + volume + carve | 90 min |
| Fitted sword/shield/visor | 45 min |
| Palette + de-light | 45 min |
| Segment + rig + `.vox.js` export | 60 min |
| Scored rounds to target | 60-90 min |
| **Knight total** | **~7-8 h** |
| Lodge (static, reuses everything) | ~1.5 h |
| Each further asset (TripoSR run + fit + rounds) | ~45-75 min, parallelizable by file |
