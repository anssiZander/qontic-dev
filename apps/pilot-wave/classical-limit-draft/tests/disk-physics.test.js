import test from 'node:test';
import assert from 'node:assert/strict';
import { obstacleParameters } from '../src/obstacle-physics.js';
import { DISK, diskParameters, diskProfile, diskPotential, diskAcceleration, ClassicalDiskTrajectory } from '../src/disk-physics.js';

test('the disk is radial, finite, smooth at both edges and uses the potential gradient as its force', () => {
  for (const s of [0, .3, .7, 1]) {
    const p = obstacleParameters(s), disk = diskParameters(p);
    assert.equal(diskPotential(disk.x, disk.y, disk), disk.height);
    assert.equal(diskProfile(disk.radius), 0);
    assert.equal(diskProfile(disk.radius - disk.edgeWidth), 1);
    assert.ok(Math.abs(diskPotential(disk.x + disk.turningRadius, disk.y, disk) - p.speed ** 2 / (2 * p.alpha)) < 1e-9);
    for (const r of [.081, .093, .11, .119, .121]) for (const angle of [0, .45, 2.2]) {
      const x = disk.x + r * Math.cos(angle), y = disk.y + r * Math.sin(angle), h = 1e-7;
      const force = diskAcceleration(x, y, p.alpha, disk);
      const numerical = [
        -p.alpha * (diskPotential(x + h, y, disk) - diskPotential(x - h, y, disk)) / (2 * h),
        -p.alpha * (diskPotential(x, y + h, disk) - diskPotential(x, y - h, disk)) / (2 * h),
      ];
      assert.ok(Math.hypot(force[0] - numerical[0], force[1] - numerical[1]) < 1e-7);
      assert.ok(Math.abs(diskPotential(x, y, disk) - disk.height * diskProfile(r)) < 1e-9);
    }
  }
});

test('classical trail storage stays bounded and reconstructs old samples', () => {
  const p = obstacleParameters(.3), disk = diskParameters(p);
  const path = new ClassicalDiskTrajectory([.44, .515], [.18, 0], p.alpha, disk);
  const old = path.at(2.234);
  path.at(40);
  assert.ok(path.samples.length < 25000);
  assert.ok(path.checkpoints.length < 200);
  const recovered = path.at(2.234);
  assert.ok(Math.hypot(old[0] - recovered[0], old[1] - recovered[1]) < 1e-12);
});

test('the classical disk comparison scatters, conserves energy, converges in time and supports past trail queries', () => {
  for (const s of [0, .3, 1]) {
    const p = obstacleParameters(s), disk = diskParameters(p);
    for (const y of [DISK.y, .515, .8]) {
      const a = new ClassicalDiskTrajectory([.44, y], [.18, 0], p.alpha, disk);
      const b = new ClassicalDiskTrajectory([.44, y], [.18, 0], p.alpha, disk, .0005);
      const before = a.at(1), last = a.at(5), fine = b.at(5);
      assert.deepEqual(a.at(1), before);
      assert.ok(Math.hypot(last[0] - fine[0], last[1] - fine[1]) < 1e-5);
      assert.ok(a.maxEnergyError < 2e-5, `${s}: relative energy error ${a.maxEnergyError}`);
      if (y === DISK.y) assert.ok(a.state[2] < 0);
      if (y === .515) assert.ok(last[1] > .65);
      if (y === .8) assert.ok(Math.abs(last[0] - 1.34) < 1e-10);
    }
  }
});
