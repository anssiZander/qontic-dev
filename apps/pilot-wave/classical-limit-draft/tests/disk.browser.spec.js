import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

test.beforeAll(() => mkdir('validation', { recursive: true }));
const snapshot = page => page.evaluate(() => window.__classicalLimit.snapshot());

for (const classicality of [.3, 1]) test(`disk at ${classicality} conserves probability and converges with grid and timestep refinement`, async ({ page }) => {
  test.setTimeout(240000);
  await page.goto('/?scene=disk&paused=1&test=1');
  await page.waitForFunction(() => window.__classicalLimit?.ready);
  const report = await page.evaluate(async classicality => {
    const { ObstacleExperiment } = await import('/src/obstacle-gpu.js');
    const { diskPotential } = await import('/src/disk-physics.js');
    const gl = document.createElement('canvas').getContext('webgl2');
    const energy = (e, wave) => {
      const { nx, ny, dx, alpha } = e.params;
      const node = (x, y, component) => {
        let sign = 1;
        if (x < 0) { x = -x; sign *= -1; } if (x > nx) { x = 2 * nx - x; sign *= -1; }
        if (y < 0) { y = -y; sign *= -1; } if (y > ny) { y = 2 * ny - y; sign *= -1; }
        return sign * wave[4 * (y * e.width + x) + component];
      };
      let total = 0, coreProbability = 0;
      const weights = [0, -1.6, .2, -8 / 315, 1 / 560];
      for (let y = 1; y < ny; y++) for (let x = 1; x < nx; x++) {
        const k = 4 * (y * e.width + x), rho = wave[k] ** 2 + wave[k + 1] ** 2;
        const potential = diskPotential(x * dx, y * dx, e.disk);
        if (Math.hypot(x * dx - e.disk.x, y * dx - e.disk.y) < e.disk.radius - e.disk.edgeWidth) coreProbability += rho * dx * dx;
        for (let c = 0; c < 2; c++) {
          let laplacian = 205 / 36 * wave[k + c];
          for (let d = 1; d <= 4; d++) laplacian += weights[d] * (node(x + d, y, c) + node(x - d, y, c) + node(x, y + d, c) + node(x, y - d, c));
          total += wave[k + c] * (alpha / (2 * dx * dx) * laplacian + potential * wave[k + c]) * dx * dx;
        }
      }
      return { total, coreProbability };
    };
    const run = (refinement, stepScale) => {
      const e = new ObstacleExperiment(gl, { disk: true, classicality, count: 16, refinement, stepScale, seed: 2 });
      const initialEnergy = energy(e, e.readWave()).total;
      e.evaluate(3.5); const wave = e.readWave(), measured = energy(e, wave);
      const result = { state: e.diagnostics(), wave, width: e.width, height: e.height, ...measured, energyError: Math.abs(measured.total / initialEnergy - 1) };
      e.dispose(); return result;
    };
    const coarse = run(1, 1), fine = run(2, 1), halfStep = run(1, .5);
    const difference = (a, b, stride) => {
      let densityL1 = 0, maxParticleDifference = 0;
      for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
        const k = 4 * (y * a.width + x), l = 4 * (stride * y * b.width + stride * x);
        densityL1 += Math.abs(a.wave[k] ** 2 + a.wave[k + 1] ** 2 - b.wave[l] ** 2 - b.wave[l + 1] ** 2) * a.state.params.dx ** 2;
      }
      for (let i = 0; i < a.state.positions.length; i += 2) maxParticleDifference = Math.max(maxParticleDifference, Math.hypot(a.state.positions[i] - b.state.positions[i], a.state.positions[i + 1] - b.state.positions[i + 1]));
      return { densityL1, maxParticleDifference, shadowDifference: Math.abs(a.state.shadowProbability - b.state.shadowProbability) };
    };
    return { grid: difference(coarse, fine, 2), timestep: difference(coarse, halfStep, 1),
      cases: [coarse, fine, halfStep].map(({ state, coreProbability, energyError }) => ({ state, coreProbability, energyError })), glError: gl.getError() };
  }, classicality);
  await writeFile(`validation/disk-convergence-${classicality}.json`, JSON.stringify(report, null, 2));
  expect(report.glError).toBe(0);
  expect(report.grid.densityL1).toBeLessThan(.03);
  expect(report.grid.maxParticleDifference).toBeLessThan(.006);
  expect(report.grid.shadowDifference).toBeLessThan(.006);
  expect(report.timestep.densityL1).toBeLessThan(.002);
  expect(report.timestep.maxParticleDifference).toBeLessThan(.002);
  for (const result of report.cases) {
    expect(result.state.maxNormError).toBeLessThan(.001);
    expect(result.energyError).toBeLessThan(.001);
    expect(result.coreProbability).toBeLessThan(.001);
    if (classicality < .5) expect(result.state.shadowProbability).toBeGreaterThan(.005);
    // The narrow classical packet casts a much stronger geometric shadow.
    else expect(result.state.shadowProbability).toBeLessThan(.02);
  }
});

test('disk ensembles survive the slider and repeated reflections', async ({ page }) => {
  test.setTimeout(240000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?scene=disk&paused=1&test=1');
  await page.waitForFunction(() => window.__classicalLimit?.ready);
  const states = [];
  for (const classicality of [0, .3, .65, 1]) {
    const state = await page.evaluate(classicality => {
      const api = window.__classicalLimit;
      api.configure({ scene: 'disk', classicality, angle: 0, count: 64, seed: 2 });
      api.run(12, .04); return api.snapshot();
    }, classicality);
    states.push(state);
    await writeFile('validation/disk-stability.json', JSON.stringify({ states, errors }, null, 2));
    expect(state.finite).toBe(true); expect(state.failed).toBe(false); expect(state.glError).toBe(0);
    expect(state.maxNormError).toBeLessThan(.001); expect(state.guidanceFailure).toBeUndefined();
    expect(state.classicalEnergyError).toBeLessThan(.0001);
    for (let i = 0; i < state.positions.length; i += 2) {
      expect(state.positions[i]).toBeGreaterThan(0); expect(state.positions[i]).toBeLessThan(1.6);
      expect(state.positions[i + 1]).toBeGreaterThan(0); expect(state.positions[i + 1]).toBeLessThan(1);
    }
  }
  expect(errors).toEqual([]);
});

test('disk scene, appearance, resize, independent reference and context recovery work together', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?test=1&paused=1'); await page.waitForFunction(() => window.__classicalLimit?.ready);
  await expect(page.locator('#scene-free')).toBeChecked();
  await page.locator('#scene-disk').check();
  await expect.poll(async () => (await snapshot(page)).scene).toBe('disk');
  expect((await snapshot(page)).settings.angle).toBe(0);
  await page.evaluate(() => { window.__classicalLimit.configure({ classicality: .3, count: 64, seed: 2 }); window.__classicalLimit.run(3.5); });
  await page.screenshot({ path: 'validation/disk-ensemble.png', fullPage: true });
  await page.locator('#show-wave').uncheck(); await expect(page.locator('#phase-legend')).toBeHidden();
  await page.locator('#show-particles').uncheck();
  const state = await snapshot(page);
  expect(state.appearance.showReference).toBe(true); expect(state.appearance.showVelocity).toBe(true);
  const drawing = await page.evaluate(async () => {
    const { Renderer } = await import('/src/renderer.js');
    const points = Renderer.prototype.drawPoints, trails = Renderer.prototype.drawTrails, calls = [];
    Renderer.prototype.drawPoints = function (...args) { calls.push(['points', args[3]]); return points.apply(this, args); };
    Renderer.prototype.drawTrails = function (...args) { calls.push(['trails', args[4]]); return trails.apply(this, args); };
    try { window.__classicalLimit.run(.1); } finally { Renderer.prototype.drawPoints = points; Renderer.prototype.drawTrails = trails; }
    return calls;
  });
  expect(drawing).toEqual([['trails', true], ['points', true]]);
  await page.locator('#show-wave').check(); await page.locator('#show-particles').check();
  for (const scene of ['barrier', 'free', 'disk']) {
    await page.locator(`#scene-${scene}`).check();
    await expect.poll(async () => (await snapshot(page)).scene).toBe(scene);
    const q = await snapshot(page); expect(q.time).toBe(0); expect(q.failed).toBe(false); expect(q.glError).toBe(0);
  }
  expect((await snapshot(page)).params.classicality).toBe(.3);
  await page.evaluate(() => window.__classicalLimit.run(3));
  const beforeResize = await snapshot(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  expect((await snapshot(page)).positions).toEqual(beforeResize.positions);
  await page.screenshot({ path: 'validation/disk-mobile.png', fullPage: true });
  await page.evaluate(() => window.__classicalLimit.recoverContext());
  await expect(page.locator('#error')).toBeHidden({ timeout: 15000 });
  await expect.poll(async () => (await snapshot(page)).time).toBe(0);
  expect((await snapshot(page)).scene).toBe('disk'); expect((await snapshot(page)).glError).toBe(0);
  expect(errors).toEqual([]);
});

test('the disk records the same scene at 30 fps without disturbing live state', async ({ page }) => {
  await page.goto('/?scene=disk&classicality=.3&count=16&seed=2&paused=1&test=1');
  await page.waitForFunction(() => window.__classicalLimit?.ready);
  await page.evaluate(() => window.__classicalLimit.run(2.5));
  await page.locator('#export-size').selectOption('1920');
  await page.locator('#export-duration').fill('1');
  await page.locator('#export-start').selectOption('current');
  const before = await snapshot(page), downloaded = page.waitForEvent('download');
  await page.locator('#record').click(); await expect(page.locator('#scene-disk')).toBeDisabled();
  const download = await downloaded, filename = 'validation/disk-export.mp4';
  expect(download.suggestedFilename()).toContain('-disk-'); await download.saveAs(filename);
  await expect(page.locator('#scene-disk')).toBeEnabled();
  const after = await snapshot(page);
  expect(after.time).toBe(before.time); expect(after.positions).toEqual(before.positions);
  expect(after.lastExport.scene).toBe('disk'); expect(after.lastExport.frames).toBe(30);
  expect(after.lastExport.finalState.disk).toEqual(before.disk);
  expect(after.lastExport.finalState.maxNormError).toBeLessThan(.001);
  const media = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-of', 'json', filename], { encoding: 'utf8' }));
  expect(media.streams[0].avg_frame_rate).toBe('30/1'); expect(Number(media.streams[0].nb_read_frames)).toBe(30);
  execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', filename, '-frames:v', '1', '-y', 'validation/disk-export.png']);
  await writeFile('validation/disk-export.json', JSON.stringify({ report: after.lastExport, media }, null, 2));
});
