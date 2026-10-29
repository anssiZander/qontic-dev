import './density-colors.js';

const palette = globalThis.QonticDensityColors;
export const densityLegendLayout = palette.legendLayout;
export const paintDensityLegend = palette.paintLegend;
export const densityLegendColor = density => palette.color(density).map(v => Math.round(v * 255));
