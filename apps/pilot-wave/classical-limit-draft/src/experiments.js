import { Experiment } from './physics.js';
import { ObstacleExperiment } from './obstacle-gpu.js';

export const SCENES = Object.freeze({
  free: Object.freeze({ label: 'Without barrier', filename: 'without-barrier', classicality: 0, angle: 45,
    heading: 'REFLECTING BOX', note: 'The full classical range, with a compact packet and gentler spreading.' }),
  barrier: Object.freeze({ label: 'With barrier', filename: 'with-barrier', classicality: 0.3, angle: 0,
    heading: 'KNIFE-EDGE DIFFRACTION', note: 'Diffraction around a knife edge, with its own classical range.' }),
  disk: Object.freeze({ label: 'Disk', filename: 'disk', classicality: 0.3, angle: 0,
    heading: 'DISK SCATTERING', note: 'A round, strongly repulsive obstacle with a smooth edge. Small quantum penetration is possible.' }),
});

export function sceneKey(value) {
  if (value && typeof value === 'object') return sceneKey(value.scene ?? value.obstacle);
  if (typeof value === 'string' && Object.hasOwn(SCENES, value)) return value;
  return value ? 'barrier' : 'free';
}

// Live playback and recording must select the same solver and calibration.
// The free scene retains the original separable solver and its full endpoint.
export function createExperiment(gl, settings) {
  const scene = sceneKey(settings);
  return scene === 'free' ? new Experiment(settings) : new ObstacleExperiment(gl, { ...settings, disk: scene === 'disk' });
}
