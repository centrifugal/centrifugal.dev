import React, { useState, useRef } from 'react';

const GRID = 16;
const TILE = 16;
const VIEW_W = 11;
const VIEW_H = 5;
const ORIGIN_X = 72;
const ORIGIN_Y = 20;
const WORLD_PX = GRID * TILE; // 256
const VIEW_W_PX = VIEW_W * TILE;
const VIEW_H_PX = VIEW_H * TILE;

export default function TileViewportDiagram() {
  const [viewX, setViewX] = useState(ORIGIN_X + 3 * TILE);
  const [viewY, setViewY] = useState(ORIGIN_Y + 5 * TILE);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });
  const svgRef = useRef(null);

  function getSvgPoint(e) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  function onPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();
    e.target.setPointerCapture?.(e.pointerId);
    const { x, y } = getSvgPoint(e);
    dragOffsetRef.current = { dx: x - viewX, dy: y - viewY };
    setDragging(true);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = getSvgPoint(e);
    let newX = x - dragOffsetRef.current.dx;
    let newY = y - dragOffsetRef.current.dy;
    newX = Math.max(ORIGIN_X, Math.min(ORIGIN_X + WORLD_PX - VIEW_W_PX, newX));
    newY = Math.max(ORIGIN_Y, Math.min(ORIGIN_Y + WORLD_PX - VIEW_H_PX, newY));
    setViewX(newX);
    setViewY(newY);
  }

  function onPointerUp(e) {
    e.target.releasePointerCapture?.(e.pointerId);
    setDragging(false);
  }

  // Tiles intersected by the viewport rectangle (any overlap, however small).
  const colStart = Math.floor((viewX - ORIGIN_X) / TILE);
  const colEnd = Math.ceil((viewX + VIEW_W_PX - ORIGIN_X) / TILE);
  const rowStart = Math.floor((viewY - ORIGIN_Y) / TILE);
  const rowEnd = Math.ceil((viewY + VIEW_H_PX - ORIGIN_Y) / TILE);

  // 1-tile prefetch margin: tiles tracked but currently outside the viewport.
  const prefetchColStart = Math.max(0, colStart - 1);
  const prefetchColEnd = Math.min(GRID, colEnd + 1);
  const prefetchRowStart = Math.max(0, rowStart - 1);
  const prefetchRowEnd = Math.min(GRID, rowEnd + 1);

  const visibleCount = (colEnd - colStart) * (rowEnd - rowStart);
  const trackedCount =
    (prefetchColEnd - prefetchColStart) * (prefetchRowEnd - prefetchRowStart);

  const tiles = [];
  for (let col = prefetchColStart; col < prefetchColEnd; col++) {
    for (let row = prefetchRowStart; row < prefetchRowEnd; row++) {
      const insideViewport =
        col >= colStart && col < colEnd && row >= rowStart && row < rowEnd;
      tiles.push(
        <rect
          key={`${col},${row}`}
          x={ORIGIN_X + col * TILE}
          y={ORIGIN_Y + row * TILE}
          width={TILE}
          height={TILE}
          fill={insideViewport ? '#bfdbfe' : '#e0ecfb'}
        />
      );
    }
  }

  const verticalLines = [];
  for (let i = 1; i < GRID; i++) {
    const x = ORIGIN_X + i * TILE;
    verticalLines.push(
      <line key={`v${i}`} x1={x} y1={ORIGIN_Y} x2={x} y2={ORIGIN_Y + WORLD_PX} />
    );
  }
  const horizontalLines = [];
  for (let i = 1; i < GRID; i++) {
    const y = ORIGIN_Y + i * TILE;
    horizontalLines.push(
      <line key={`h${i}`} x1={ORIGIN_X} y1={y} x2={ORIGIN_X + WORLD_PX} y2={y} />
    );
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 400 320"
      style={{
        maxWidth: '100%',
        height: 'auto',
        display: 'block',
        margin: '1.5em auto',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <defs>
        <linearGradient id="tvd-world-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fafbfc" />
          <stop offset="100%" stopColor="#eef2f7" />
        </linearGradient>
        <filter id="tvd-vp-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#2563eb" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* World */}
      <rect
        x={ORIGIN_X}
        y={ORIGIN_Y}
        width={WORLD_PX}
        height={WORLD_PX}
        fill="url(#tvd-world-bg)"
        stroke="#cbd5e1"
        strokeWidth="1"
      />

      {/* Tracked tiles (viewport + prefetch ring) */}
      {tiles}

      {/* Grid lines */}
      <g stroke="#e2e8f0" strokeWidth="0.5">
        {verticalLines}
        {horizontalLines}
      </g>

      {/* World border on top so the stroke is crisp over the tiles */}
      <rect
        x={ORIGIN_X}
        y={ORIGIN_Y}
        width={WORLD_PX}
        height={WORLD_PX}
        fill="none"
        stroke="#cbd5e1"
        strokeWidth="1"
        pointerEvents="none"
      />

      {/* Viewport with shadow */}
      <g filter="url(#tvd-vp-shadow)">
        <rect
          x={viewX}
          y={viewY}
          width={VIEW_W_PX}
          height={VIEW_H_PX}
          fill="rgba(37, 99, 235, 0.07)"
          stroke="#2563eb"
          strokeWidth={hover || dragging ? 2.5 : 2}
          style={{
            pointerEvents: 'all',
            cursor: dragging ? 'grabbing' : 'grab',
            transition: 'stroke-width 120ms ease',
            touchAction: 'none',
          }}
          onPointerDown={onPointerDown}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
        />
      </g>

      <text
        x={viewX + VIEW_W_PX / 2}
        y={viewY + VIEW_H_PX / 2 + 4}
        fontFamily="-apple-system, system-ui, sans-serif"
        fontSize="11"
        fontWeight="600"
        fill="#1e3a8a"
        textAnchor="middle"
        style={{ pointerEvents: 'none' }}
      >
        viewport
      </text>

      {/* Caption */}
      <text
        x="200"
        y="294"
        fontFamily="-apple-system, system-ui, sans-serif"
        fontSize="11"
        fontWeight="500"
        fill="#374151"
        textAnchor="middle"
      >
        Drag the viewport. Darker tiles are visible; lighter ring is prefetch margin.
      </text>
      <text
        x="200"
        y="310"
        fontFamily="-apple-system, system-ui, sans-serif"
        fontSize="10"
        fill="#6b7280"
        textAnchor="middle"
      >
        Tracking{' '}
        <tspan fontWeight="700" fill="#2563eb">
          {trackedCount}
        </tspan>{' '}
        of {GRID * GRID} tiles ({visibleCount} visible + {trackedCount - visibleCount} prefetch).
      </text>
    </svg>
  );
}
