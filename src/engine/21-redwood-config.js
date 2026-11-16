/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the Redwood world: every number that makes the homestead map a vast old-growth redwood forest lives here.
   One place to tune it, one file (plus its callers) to revert. Plain data, no DOM / THREE.
     world      how much bigger the shared map is than the original 280 x 200 m snowfield (per axis), and where the
                original snowfield (the "core": plots, hills, Iron Hills) sits inside it. The core keeps its coordinates,
                so plots, saves and the realtime server agree with older builds.
     stream     camera-centred ground streaming in the renderer (only chunks near the view exist)
     forest     the redwoods: giants, younger redwoods, ferns, sorrel, fallen logs, stumps
     camera     how low you can look and how far you can zoom in the castle game
     mist       fog distances and colours on the forest floor */
(function (G) {
  const K = (G.K = G.K || {});

  const REDWOOD = {
    world: {
      axis: 10,                       // x per axis: 10 -> 100x the area (5600 x 4000 tiles, 2.8 x 2.0 km). 1 = the old map.
      core: { w: 560, h: 400 },       // the original snowfield in tiles; it stays at the world origin
      forestTerrainFrom: 34,          // metres beyond the core edge where the snow has fully given way to forest floor
      heightGrid: 16,                 // tiles between forest-floor height samples (bilinear in between): keeps a 22M-tile map quick to make
    },
    stream: {
      aboveTiles: 400000,             // worlds bigger than this stream their ground; smaller ones (the editor, old maps) build everything
      nearM: 56,                      // full-detail ground (32 texels per metre) inside this radius of the view
      farM: 150,                      // low-detail ground (6 texels per metre) out to here; nothing beyond
      hysteresisM: 20,                // a chunk is dropped only this far beyond its radius, so walking back and forth does not thrash
      buildsPerFrame: 6,              // new chunks created per frame at most
      ppuNear: 32, ppuFar: 6,
    },
    forest: {
      seed: 5309,
      cellM: 16,                      // generation cell (matches the renderer's chunk)
      giant: { spacingM: 15, chance: 0.62, heightM: [60, 90], baseRM: [1.5, 3], canopyFromM: [30, 40] },
      mid: { spacingM: 7.5, chance: 0.42, heightM: [20, 40], baseRM: [0.45, 1.1] },
      young: { per100m2: 0.055, max: 9000 },   // choppable young redwoods (doc props, after the core's own props)
      fern: { spacingM: 2.6, chance: 0.55 },
      sorrel: { spacingM: 2.2, chance: 0.5 },
      log: { spacingM: 22, chance: 0.35 }, stump: { spacingM: 26, chance: 0.3 },
      coreClearM: 24,                 // no giants within this distance of any plot centre (they ramp in beyond it)
      coreRampM: 46,
      drawGiantsM: 360, drawGiantsLodM: 150, drawMidM: 190, drawFloorM: 70,   // instance draw radii
      refreshM: 6,                    // re-gather instances when the view moves this far
    },
    camera: { minPitch: -0.62, lookUpFrom: 0.22, maxDist: 60, far: 1200, groundClearM: 0.9 },
    mist: { color: '#7d8f98', nightColor: '#121a24', near: 14, far: 240, castleNear: 8, castleFar: 32 },
  };
  /** world size in tiles for the current tunables */
  REDWOOD.size = () => ({ w: REDWOOD.world.core.w * REDWOOD.world.axis, h: REDWOOD.world.core.h * REDWOOD.world.axis });

  K.REDWOOD = REDWOOD;
})(typeof window !== 'undefined' ? window : globalThis);
