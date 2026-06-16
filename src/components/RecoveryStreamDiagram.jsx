import React from 'react';

// The per-channel history stream: an append-only, bounded sliding window of
// publications. Each publication gets an incremental offset; the whole stream is
// stamped with an epoch (its identity). The window size and age are capped by
// history_size and history_ttl — older publications fall out.

const C = {
  bg: '#17171b',
  pub: '#5b8def',
  epoch: '#f5c451',
  evict: '#fe5e5e',
  muted: '#888',
  text: '#ccc',
  slot: '#23242b',
};

const CELL_W = 76;
const CELL_H = 46;
const Y = 78;

// offsets 9..12 are inside the window; 8 is being evicted.
const WINDOW = [9, 10, 11, 12];

export default function RecoveryStreamDiagram() {
  const startX = 150;
  return (
    <svg
      viewBox="0 0 720 210"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="stream-arr" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <polygon points="0 0, 10 4, 0 8" fill={C.pub} />
        </marker>
      </defs>

      <text x="20" y="28" fontSize="13" fontWeight="bold" fill={C.text} fontFamily="system-ui, sans-serif">
        Channel <tspan fontFamily="monospace" fill={C.pub}>chat:42</tspan> history stream
      </text>
      <text x="700" y="28" fontSize="11" fill={C.epoch} textAnchor="end" fontFamily="monospace">
        epoch: gWuY
      </text>

      {/* evicted cell (left, fading out) */}
      <g opacity="0.4">
        <rect x={startX - CELL_W - 16} y={Y} width={CELL_W} height={CELL_H} rx="7" fill={C.slot} stroke={C.evict} strokeWidth="1.2" strokeDasharray="4,3" />
        <text x={startX - CELL_W - 16 + CELL_W / 2} y={Y + 21} fontSize="12" fill={C.evict} textAnchor="middle" fontFamily="monospace" fontWeight="bold">#8</text>
        <text x={startX - CELL_W - 16 + CELL_W / 2} y={Y + 37} fontSize="9" fill={C.evict} textAnchor="middle" fontFamily="system-ui, sans-serif">evicted</text>
      </g>

      {/* window cells */}
      {WINDOW.map((off, i) => {
        const x = startX + i * (CELL_W + 8);
        const latest = i === WINDOW.length - 1;
        return (
          <g key={off}>
            <rect x={x} y={Y} width={CELL_W} height={CELL_H} rx="7" fill={C.slot} stroke={C.pub} strokeWidth={latest ? 1.8 : 1.2} />
            <text x={x + CELL_W / 2} y={Y + 20} fontSize="12.5" fill={C.pub} textAnchor="middle" fontFamily="monospace" fontWeight="bold">#{off}</text>
            <text x={x + CELL_W / 2} y={Y + 36} fontSize="9" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">pub</text>
            {latest && <text x={x + CELL_W / 2} y={Y - 8} fontSize="9.5" fill={C.pub} textAnchor="middle" fontFamily="system-ui, sans-serif">top offset</text>}
          </g>
        );
      })}

      {/* append arrow */}
      {(() => {
        const lastX = startX + WINDOW.length * (CELL_W + 8);
        return (
          <>
            <line x1={lastX - 4} y1={Y + CELL_H / 2} x2={lastX + 44} y2={Y + CELL_H / 2} stroke={C.pub} strokeWidth="1.6" markerEnd="url(#stream-arr)" />
            <text x={lastX + 20} y={Y - 4} fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">append</text>
            <text x={lastX + 20} y={Y + CELL_H + 16} fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">offset++</text>
          </>
        );
      })()}

      {/* window brace + config labels */}
      <line x1={startX} y1={Y + CELL_H + 26} x2={startX + WINDOW.length * (CELL_W + 8) - 8} y2={Y + CELL_H + 26} stroke={C.muted} strokeWidth="1" />
      <text x={startX + (WINDOW.length * (CELL_W + 8) - 8) / 2} y={Y + CELL_H + 42} fontSize="11" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">
        sliding window — newest <tspan fontFamily="monospace" fill={C.text}>history_size</tspan> publications, kept for <tspan fontFamily="monospace" fill={C.text}>history_ttl</tspan>
      </text>

      <text x="360" y="198" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        Lose the stream (engine restart, eviction) and the <tspan fontFamily="monospace" fill={C.epoch}>epoch</tspan> changes — marking it a different stream.
      </text>
    </svg>
  );
}
