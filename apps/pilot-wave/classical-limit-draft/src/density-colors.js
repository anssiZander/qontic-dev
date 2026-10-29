// Canonical density colors for Free Particle and Classical Limit.
// Edit this file, then run: node apps/shared/sync-density-colors.mjs
// Local runtime copies let either app run or deploy independently.
(() => {
  'use strict';
  // D is normalized probability density per fraction of the FIXED scene area.
  // These convert units, never the current viewport, packet width or peak.
  const FREE_PARTICLE_AREA_NM2 = 100 * 60;
  const CLASSICAL_LIMIT_AREA = 1.6 * 1;
  // Medium Gaussian D_peak is about 60: Free Particle sigma=(2,8) nm;
  // Classical Limit sigma=0.065 box units. A fixed shoulder avoids clipping
  // denser packets into a flat magenta center, without auto-exposure.
  const SHOULDER = 14;
  // sRGB stops, in increasing perceptual lightness. The cool, low-chroma
  // bridge between green and crimson avoids both brown and particle-yellow.
  // Green starts lower; a broad mint-to-rose transition gives red more room
  // without changing the fixed density scale or the bright magenta endpoint.
  const STOPS = [
    [0.000, [0.000, 0.000, 0.000]],
    [0.045, [0.009, 0.018, 0.028]],
    [0.135, [0.025, 0.155, 0.145]],
    [0.270, [0.025, 0.300, 0.190]],
    [0.430, [0.045, 0.400, 0.180]],
    [0.500, [0.260, 0.400, 0.365]],
    [0.540, [0.395, 0.370, 0.405]],
    [0.585, [0.625, 0.250, 0.335]],
    [0.620, [0.730, 0.120, 0.180]],
    [0.750, [0.755, 0.135, 0.380]],
    [0.810, [0.700, 0.160, 0.750]],
    [0.930, [0.750, 0.300, 0.850]],
    [1.000, [0.820, 0.480, 0.930]],
  ];
  // Oklab conversion matrices: https://bottosson.github.io/posts/oklab/
  // Convert only while constructing the shared LUT, never per rendered pixel.
  const linear = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const srgb = v => v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  function toLab(rgb) {
    const [r, g, b] = rgb.map(linear);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function fromLab([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]
      .map(v => Math.max(0, Math.min(1, srgb(v))));
  }
  const labs = STOPS.map(([, rgb]) => toLab(rgb));
  const spans = STOPS.slice(1).map(([t], i) => t - STOPS[i][0]);
  const slopes = spans.map((h, i) => labs[i].map((v, c) => (labs[i + 1][c] - v) / h));
  // Shape-preserving cubic slopes keep lightness increasing, with continuous
  // first derivatives. Unlike easing every segment to rest, this does not
  // create brightness plateaus (visible rings) inside the green region.
  const tangents = labs.map((lab, i) => lab.map((_, c) => {
    if (i === 0) return slopes[0][c];
    if (i === labs.length - 1) return slopes[i - 1][c];
    const left = slopes[i - 1][c], right = slopes[i][c];
    if (left * right <= 0) return 0;
    const w1 = 2 * spans[i] + spans[i - 1], w2 = spans[i] + 2 * spans[i - 1];
    return (w1 + w2) / (w1 / left + w2 / right);
  }));
  const SIZE = 4096;
  const rgba = new Uint8Array(SIZE * 4);
  const colors = Array.from({ length: SIZE }, (_, i) => {
    const t = i / (SIZE - 1);
    const hi = STOPS.findIndex((stop, index) => index > 0 && t <= stop[0]);
    const lo = hi - 1, h = spans[lo], u = (t - STOPS[lo][0]) / h;
    const u2 = u * u, u3 = u2 * u;
    const lab = labs[lo].map((v, c) => (2 * u3 - 3 * u2 + 1) * v
      + (u3 - 2 * u2 + u) * h * tangents[lo][c]
      + (-2 * u3 + 3 * u2) * labs[hi][c] + (u3 - u2) * h * tangents[hi][c]);
    const rgb = fromLab(lab).map(v => Math.round(255 * v));
    rgba.set([...rgb, 255], i * 4);
    return rgb.map(v => v / 255);
  });
  const coordinate = density => {
    const d = Math.max(0, density);
    return d / (d + SHOULDER);
  };
  const at = t => colors[Math.round(Math.max(0, Math.min(1, t)) * (SIZE - 1))];
  const color = density => at(coordinate(density));
  const css = rgb => `rgb(${rgb.map(v => Math.round(v * 255)).join(',')})`;
  const LEGEND_WIDTH = 216, LEGEND_HEIGHT = 60;
  function legendLayout(displayWidth, outputWidth = displayWidth) {
    const scale = outputWidth / Math.max(600, displayWidth);
    return { scale, width: LEGEND_WIDTH * scale, height: LEGEND_HEIGHT * scale, margin: 16 * scale };
  }
  function paintLegend(canvas, scale = 2) {
    canvas.width = Math.round(LEGEND_WIDTH * scale); canvas.height = Math.round(LEGEND_HEIGHT * scale);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(canvas.width / LEGEND_WIDTH, 0, 0, canvas.height / LEGEND_HEIGHT, 0, 0);
    ctx.fillStyle = 'rgba(8, 11, 21, 0.94)'; ctx.strokeStyle = '#333b53'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(.5, .5, LEGEND_WIDTH - 1, LEGEND_HEIGHT - 1, 8); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '500 15px system-ui, sans-serif'; ctx.fillStyle = '#e8e9f3';
    ctx.fillText('|ψ|²', 14, 17);
    const gradient = ctx.createLinearGradient(14, 0, LEGEND_WIDTH - 14, 0);
    for (let i = 0; i <= 256; i++) gradient.addColorStop(i / 256, css(at(i / 256)));
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.roundRect(14, 33, LEGEND_WIDTH - 28, 14, 3); ctx.fill(); ctx.stroke();
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Probability density: dark teal through green, red and magenta to violet as density increases.');
    return canvas;
  }
  const glsl = `
vec3 fixedDensityColor(float density) {
  float d = max(density, 0.0);
  float t = d / (d + ${SHOULDER.toFixed(1)});
  return texture(densityPalette, vec2((t * ${(SIZE - 1).toFixed(1)} + 0.5) / ${SIZE.toFixed(1)}, 0.5)).rgb;
}`;
  globalThis.QonticDensityColors = Object.freeze({ FREE_PARTICLE_AREA_NM2, CLASSICAL_LIMIT_AREA,
    SHOULDER, STOPS, SIZE, rgba, coordinate, at, color, css, LEGEND_WIDTH, LEGEND_HEIGHT, legendLayout, paintLegend, glsl });
})();
