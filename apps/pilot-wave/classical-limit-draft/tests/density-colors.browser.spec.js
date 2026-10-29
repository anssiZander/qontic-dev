import { test, expect } from '@playwright/test';

test('density pixels share the CPU palette and ignore peak, brightness, classicality and zoom', async ({ page }) => {
  await page.goto('/?test=1&paused=1');
  await page.waitForFunction(() => window.__classicalLimit?.ready);
  const report = await page.evaluate(async () => {
    const { Renderer, TrailHistory } = await import('/src/renderer.js');
    const palette = globalThis.QonticDensityColors;
    const renderer = new Renderer(document.createElement('canvas'));
    renderer.recordingSize = [160, 100]; renderer.recordingScale = 1;
    const gl = renderer.gl, field = gl.createTexture(), samples = [];
    const axis = density => ({ n: 4, peak: density, updateTexture() {},
      texture: new Float32Array(Array.from({ length: 4 }, () => [Math.sqrt(density), 0, density, 0]).flat()) });
    try {
      for (const is2D of [false, true]) for (const density of [0, 1, 5, 14, 30, 60, 120, 1000]) {
        const probability = density / palette.CLASSICAL_LIMIT_AREA;
        const experiment = { is2D, xAxis: axis(probability), yAxis: axis(1), waveTexture: field,
          peak: probability, params: { nx: 3, ny: 3, classicality: 0 }, time: 0 };
        if (is2D) {
          gl.bindTexture(gl.TEXTURE_2D, field);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 4, 4, 0, gl.RGBA, gl.FLOAT,
            new Float32Array(Array.from({ length: 16 }, () => [Math.sqrt(probability), 0, 0, 0]).flat()));
        }
        const pixels = [];
        // Deliberately change all former display-normalization inputs while
        // keeping the actual probability density at the sampled pixel fixed.
        for (const [peak, brightness, classicality, zoom] of [[1, .2, 0, 1], [1000, 8, 1, 2]]) {
          experiment.peak = peak; experiment.xAxis.peak = peak; experiment.yAxis.peak = 1;
          experiment.params.classicality = classicality; renderer.zoom = zoom;
          renderer.render(experiment, new TrailHistory(0), { showWave: true, showPhase: false, brightness });
          const pixel = new Uint8Array(4);
          gl.readPixels(80, 50, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          pixels.push([...pixel].slice(0, 3));
        }
        samples.push({ is2D, density, expected: palette.color(density).map(v => Math.round(v * 255)), pixels });
      }
      return { samples, glError: gl.getError() };
    } finally { gl.deleteTexture(field); renderer.dispose(); }
  });
  expect(report.glError).toBe(0);
  for (const sample of report.samples) {
    expect(sample.pixels[0], `fixed density ${sample.density}, 2D=${sample.is2D}`).toEqual(sample.pixels[1]);
    for (let c = 0; c < 3; c++) expect(Math.abs(sample.pixels[0][c] - sample.expected[c])).toBeLessThanOrEqual(1);
  }
});

test('minimal density legend follows wave visibility in every scene and fits small screens', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?test=1&paused=1&seed=41');
  await page.waitForFunction(() => window.__classicalLimit?.ready);
  const labels = await page.evaluate(() => {
    const fillText = CanvasRenderingContext2D.prototype.fillText, labels = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { labels.push(text); return fillText.call(this, text, ...args); };
    try { globalThis.QonticDensityColors.paintLegend(document.createElement('canvas')); }
    finally { CanvasRenderingContext2D.prototype.fillText = fillText; }
    return labels;
  });
  expect(labels).toEqual(['|ψ|²']);
  for (const scene of ['free', 'barrier', 'disk']) {
    await page.evaluate(scene => window.__classicalLimit.configure({ scene }), scene);
    await page.locator('#wave-density').click();
    await expect(page.locator('#density-legend')).toBeVisible();
    await expect(page.locator('#phase-legend')).toBeHidden();
    await page.evaluate(() => window.__classicalLimit.run(.05));
    const state = await page.evaluate(() => window.__classicalLimit.snapshot());
    expect(state.failed).toBe(false); expect(state.glError).toBe(0);
    await page.locator('#show-wave').uncheck();
    await expect(page.locator('#density-legend')).toBeHidden();
    await page.locator('#show-wave').check();
    await expect(page.locator('#density-legend')).toBeVisible();
    await page.locator('#wave-phase').click();
    await expect(page.locator('#density-legend')).toBeHidden();
    await expect(page.locator('#phase-legend')).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#wave-density').click();
  const stage = await page.locator('#canvas-wrap').boundingBox(), legend = await page.locator('#density-legend').boundingBox();
  expect(legend.x).toBeGreaterThan(stage.x); expect(legend.y).toBeGreaterThan(stage.y);
  expect(legend.x + legend.width).toBeLessThan(stage.x + stage.width);
  expect(legend.y + legend.height).toBeLessThan(stage.y + stage.height);
  expect(errors).toEqual([]);
});
