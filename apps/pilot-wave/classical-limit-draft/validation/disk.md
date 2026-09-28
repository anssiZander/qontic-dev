# Disk trial — 2026-09-28

Qontic draft only, on `codex/classical-limit-disk`, based on `f07e6d9` from `Anssi`.
The standalone ClassicalLimit and legacy WebGPU app are not part of this change.
The disk is a finite smooth repulsive potential, not a Dirichlet hard circle.

## Numerical evidence

Chromium 1223, Windows, ANGLE D3D11, NVIDIA RTX 4070 Ti SUPER.
At t = 3.5, seed 2, 16 particles, horizontal launch:

| Check | 30% classicality | 100% classicality |
|---|---:|---:|
| Production grid | 257 × 161 | 2049 × 1281 |
| Refined grid | 513 × 321 | 4097 × 2561 |
| Integrated absolute density difference, refined grid | 0.000152 | 0.004122 |
| Largest trajectory difference, refined grid | 0.000459 | 0.003379 |
| Integrated absolute density difference, half timestep | 0.0000175 | 0.0000689 |
| Largest trajectory difference, half timestep | 0.000456 | 0.0000250 |
| Production-grid relative energy drift | 0.0000067 | 0.0000548 |
| Probability inside the flat potential core | 6.7e-8 | 1.3e-13 |

The density difference is an L1 integral in normalized probability units;
the trajectory difference is in world units (box width 1.6).
Energy is checked independently on the CPU from the full complex wave,
using the eighth-order kinetic operator and the analytic disk potential.
Grid refinement keeps the physical potential width and height fixed.

64-particle runs at classicality 0, 0.3, 0.65 and 1 reached 12 simulation
seconds through repeated box and disk encounters. All positions remained
finite and inside the outer walls. No guidance retries were needed in these
cases. The largest raw probability error was 0.000151 (0.0151%); no wave
renormalization was applied. The classical comparison's largest relative
energy error in this sweep was below 5e-8.

An additional seed-7 stress check used 256 particles for 20 simulation seconds
at (classicality, direction) = (0, 0°), (0.3, -15°), and (1, 0°). All three
finished without failures, GL errors or guidance retries. The maximum raw
probability error was 0.000250 (0.0250%).

These are finite-grid convergence checks, not proof of exact continuum
trajectories for all seeds, launch angles, or arbitrarily long runs.

## Cost relative to the knife scene

Same GPU, 64 particles, identical production grids. After warm-up to t=2.5,
measure three groups of 20 wave updates at dt=1/60. Values below are median
wall-clock milliseconds per simulated second, including completed GPU work
and readback, excluding the visual renderer and video encoder.

| Classicality | Knife | Disk | Disk / knife |
|---|---:|---:|---:|
| 0% | 101 ms | 105 ms | 1.04 |
| 30% | 66 ms | 64 ms | 0.97 |
| 65% | 68 ms | 73 ms | 1.07 |
| 100% | 614 ms | 826 ms | 1.34 |

Small differences at the less expensive settings are within timing noise;
the classical endpoint has a material extra cost from its smaller timestep.
This short local benchmark does not guarantee frame rates on other hardware.
The free-box physics is unchanged.

## Integration and reproduction

- `npm test`: 17 numerical tests.
- `npm run check`: syntax checks for 29 JavaScript files.
- `npm run build`: standalone static bundle.
- `tests/disk.browser.spec.js`: refinement, 64-particle stability, all three
  scene switches, per-scene settings, fresh samples, wave/legend visibility,
  independent reference, responsive layout, context recovery, and export.
- Nine existing browser regressions cover the free and knife solvers,
  independent controls, responsive layout, quiver accuracy/appearance, scene
  memory, the independent free-Gaussian benchmark, and velocity video export.
- Disk recording decoded independently with ffprobe: 1920 × 1200, 30 fps,
  30 frames for one second, retaining live state and the disk model.
- Desktop/mobile screenshots and a decoded recording frame inspected.
- The actual nested Qontic URL on a root HTTP server loaded without asset or
  page errors. Catalog navigation was retained and embed mode hid its links.

Run the browser tests on a known server with `CLASSICALLIMIT_PORT` and select
an installed browser with `CLASSICALLIMIT_BROWSER`. Generated measurements,
screenshots and videos stay local under `validation/`; the tests reproduce them.

To discard the trial after its commit, switch back to `Anssi` and reload the
preview. The disk changes are retained on the experimental branch for recovery.
