import { BOX, clamp } from './physics.js';

// A finite, radially symmetric repulsive potential. The outer radius is where
// V first becomes nonzero; the interior plateau starts one edgeWidth inward.
// Keep the physical edge width fixed when refining the numerical grid.
export const DISK = Object.freeze({ x: 0.9, y: 0.43, radius: 0.12, edgeWidth: 0.04 });

export function diskProfile(radius, disk = DISK) {
  const u = clamp((disk.radius - radius) / disk.edgeWidth, 0, 1);
  return u ** 3 * (10 - 15 * u + 6 * u * u);
}

export function diskParameters(params) {
  const launchEnergy = params.speed ** 2 / (2 * params.alpha);
  // Cover the carrier energy and the broad quantum packet's momentum spread.
  const height = 10 * launchEnergy + 4 * params.alpha / params.sigma ** 2;
  let lo = DISK.radius - DISK.edgeWidth, hi = DISK.radius;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (height * diskProfile(mid) > launchEnergy) lo = mid; else hi = mid;
  }
  return Object.freeze({ ...DISK, height, turningRadius: (lo + hi) / 2 });
}

export function diskPotential(x, y, disk) {
  return disk.height * diskProfile(Math.hypot(x - disk.x, y - disk.y), disk);
}

// Classical acceleration uses the same potential as the wave: m = 1/alpha,
// hence a = -alpha grad(V). This is not an imposed specular circle bounce.
export function diskAcceleration(x, y, alpha, disk) {
  const dx = x - disk.x, dy = y - disk.y, r = Math.hypot(dx, dy);
  const u = (disk.radius - r) / disk.edgeWidth;
  if (u <= 0 || u >= 1 || r === 0) return [0, 0];
  const a = alpha * disk.height * 30 * u * u * (1 - u) ** 2 / (disk.edgeWidth * r);
  return [a * dx, a * dy];
}

export class ClassicalDiskTrajectory {
  constructor(initial, velocity, alpha, disk, dt = 0.001) {
    this.alpha = alpha; this.disk = disk; this.dt = dt;
    this.state = [...initial, ...velocity];
    this.capacity = Math.ceil(12 / dt) + 2; this.stepCount = 0;
    this.samples = new Float64Array(2 * this.capacity); this.samples.set(initial);
    this.checkpointStride = Math.round(1 / dt); this.checkpoints = [...this.state];
    this.initialEnergy = this.energy(); this.maxEnergyError = 0;
  }
  energy() {
    const [x, y, vx, vy] = this.state;
    return (vx * vx + vy * vy) / (2 * this.alpha) + diskPotential(x, y, this.disk);
  }
  step() {
    const h = this.dt, p = this.state;
    const derivative = state => [state[2], state[3], ...diskAcceleration(state[0], state[1], this.alpha, this.disk)];
    const offset = (k, amount) => p.map((v, i) => v + amount * k[i]);
    const a = derivative(p), b = derivative(offset(a, h / 2));
    const c = derivative(offset(b, h / 2)), d = derivative(offset(c, h));
    for (let i = 0; i < 4; i++) p[i] += h * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6;
    for (let axis = 0; axis < 2; axis++) {
      const length = axis ? BOX.height : BOX.width;
      // The disk's force is zero near the box walls, so these reflections are
      // exact during a wall encounter; RK4 is then simply a straight drift.
      while (p[axis] < 0 || p[axis] > length) {
        p[axis] = p[axis] < 0 ? -p[axis] : 2 * length - p[axis];
        p[axis + 2] = -p[axis + 2];
      }
    }
    this.maxEnergyError = Math.max(this.maxEnergyError, Math.abs(this.energy() / this.initialEnergy - 1));
    this.stepCount++;
    const index = 2 * (this.stepCount % this.capacity);
    this.samples[index] = p[0]; this.samples[index + 1] = p[1];
    if (this.stepCount % this.checkpointStride === 0) this.checkpoints.push(...p);
  }
  at(time) {
    const q = Math.max(0, time) / this.dt, i = Math.floor(q), f = q - i;
    // Keep only recent dense samples for trails; old times can be reconstructed
    // from one-second checkpoints without retaining every integration step.
    if (i < this.stepCount - this.capacity + 1) {
      const block = Math.floor(i / this.checkpointStride), state = this.checkpoints.slice(4 * block, 4 * block + 4);
      const past = new ClassicalDiskTrajectory(state.slice(0, 2), state.slice(2), this.alpha, this.disk, this.dt);
      return past.at(time - block * this.checkpointStride * this.dt);
    }
    while (this.stepCount <= i) this.step();
    const a = 2 * (i % this.capacity), b = 2 * ((i + 1) % this.capacity);
    return [0, 1].map(axis => this.samples[a + axis] * (1 - f) + this.samples[b + axis] * f);
  }
}

// Shared with the GPU propagator. The potential is real and diagonal, leaving
// the kinetic operator Hermitian and the existing guidance interpolation valid.
export const diskPotentialGLSL = `
uniform vec4 diskGeometry;
uniform float diskHeight;
float diskPotential(vec2 point){
  float u=clamp((diskGeometry.z-length(point-diskGeometry.xy))/max(diskGeometry.w,1e-8),0.0,1.0);
  return diskHeight*u*u*u*(10.0+u*(-15.0+6.0*u));
}
`;
