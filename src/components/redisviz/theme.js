// Shared palette for the Redis Pub/Sub scaling visualizations. Mirrors the
// CSS custom properties in redisviz.css so SVG fills (JS) and HTML chrome (CSS)
// stay in lockstep. Kept close to the existing static diagrams' colors.
export const C = {
  bg: '#17171b',
  panel: '#1e1e24',
  slot: '#23242b',
  border: '#2c2c34',
  text: '#d6d6db',
  muted: '#8a8a94',
  green: '#5bef7b', // good / balanced / "after"
  amber: '#f5c451', // Redis nodes / neutral highlight
  hot: '#fe5e5e', // problem / waste / "before"
  blue: '#62b0ff', // secondary accent (messages in flight)
  grid: '#34343d',
};

// Tints used for soft fills behind bars/areas.
export const tint = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
};
