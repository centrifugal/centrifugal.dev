#!/usr/bin/env node
/**
 * Renders a diagram component to a standalone .svg (and .png when
 * rsvg-convert is installed) so it can be eyeballed without a browser.
 *
 *   node scripts/render-diagram.js src/components/ConsumersDiagram.jsx [outDir]
 *
 * The component must render an <svg> root and take no required props.
 */
const babel = require('@babel/core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');

const input = process.argv[2];
const outDir = process.argv[3] || path.join(os.tmpdir(), 'diagrams');
if (!input) {
  console.error('usage: node scripts/render-diagram.js <component.jsx> [outDir]');
  process.exit(1);
}

const { code } = babel.transformFileSync(input, {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'classic' }],
  ],
  babelrc: false,
  configFile: false,
});

// Compile next to the source so relative imports and node_modules resolve.
const tmpFile = path.join(path.dirname(input), `.render-${path.basename(input)}.cjs`);
fs.writeFileSync(tmpFile, code);
let Component;
try {
  const mod = require(path.resolve(tmpFile));
  Component = mod.default || mod;
} finally {
  fs.unlinkSync(tmpFile);
}

fs.mkdirSync(outDir, { recursive: true });
const name = path.basename(input, path.extname(input));
const svgPath = path.join(outDir, `${name}.svg`);
const markup = renderToStaticMarkup(React.createElement(Component));
fs.writeFileSync(svgPath, markup);
console.log('svg:', svgPath);

try {
  const pngPath = path.join(outDir, `${name}.png`);
  execFileSync('rsvg-convert', ['-w', '1400', '-o', pngPath, svgPath]);
  console.log('png:', pngPath);
} catch (e) {
  console.log('png: skipped (install librsvg for rsvg-convert)');
}
