const WIDTH = 218, ROW_HEIGHT = 26, PADDING = 10;

export function particleLegendEntries(appearance) {
  return [
    ...(appearance.showParticles ? [{ label: 'Bohmian particle', color: '#ffe096', dashed: false }] : []),
    ...(appearance.showReference ? [{ label: 'Classical particle', color: '#59e6ff', dashed: true }] : []),
  ];
}

export function particleLegendLayout(appearance, displayWidth, outputWidth = displayWidth) {
  const scale = outputWidth / Math.max(600, displayWidth);
  const rows = particleLegendEntries(appearance).length;
  return { scale, width: WIDTH * scale, height: (rows * ROW_HEIGHT + 2 * PADDING) * scale, margin: 16 * scale };
}

// Use the same artwork in the live scene and the encoded video frames.
export function paintParticleLegend(canvas, appearance, scale = 2) {
  const entries = particleLegendEntries(appearance);
  const height = entries.length * ROW_HEIGHT + 2 * PADDING;
  canvas.width = Math.max(1, Math.round(WIDTH * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / height, 0, 0);
  ctx.fillStyle = 'rgba(8, 11, 21, 0.90)';
  ctx.strokeStyle = '#333b53'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(.5, .5, WIDTH - 1, height - 1, 8); ctx.fill(); ctx.stroke();
  ctx.font = '500 14px system-ui, sans-serif'; ctx.textBaseline = 'middle';
  entries.forEach((entry, row) => {
    const y = PADDING + ROW_HEIGHT * (row + .5);
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = entry.color;
    ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.setLineDash(entry.dashed ? [3, 5] : []);
    ctx.beginPath(); ctx.moveTo(13, y); ctx.lineTo(39, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowColor = entry.color; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.arc(39, y, 4, 0, 2 * Math.PI); ctx.fill();
    if (entry.dashed) {
      ctx.shadowBlur = 0; ctx.strokeStyle = '#effcff'; ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#e8e9f3'; ctx.fillText(entry.label, 55, y);
  });
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', entries.map(entry => `${entry.label}: ${entry.dashed ? 'cyan, dashed trail' : 'yellow, solid trail'}`).join('. '));
  return canvas;
}
