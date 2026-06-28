import React, { useState } from 'react';
import { Card, Slider, Stat, Stats, fmt } from './redisviz/controls';
import { C, tint } from './redisviz/theme';

// Classic vs sharded Pub/Sub inside a Redis Cluster.
//
// A publisher sends one PUBLISH to ONE node. With classic Pub/Sub that node then
// copies the message to EVERY other node over the cluster bus — a subscriber
// could be anywhere, so each node carries a copy whether it has a subscriber or
// not. Per publish that is N nodes carrying it, and adding nodes only makes each
// one busier. Sharded Pub/Sub (SPUBLISH / Redis 7+) routes the publish straight
// to the ONE node that owns the channel's slot, with no internal broadcast — so
// it stays at one copy and scales like independent instances.

// ---- one cluster panel (left = classic broadcast, right = sharded) ----
function ClusterPanel({ x0, w, nodes, mode }) {
  const cx = x0 + w / 2;
  const hot = mode === 'classic';

  // publisher sits at the top, centered
  const pubW = 88, pubH = 26, pubY = 48;
  const pubAnchorY = pubY + pubH;

  // node grid — recomputed for N = 3..12 so it never overflows
  const padInner = 16;
  const innerW = w - 2 * padInner;
  const cols = nodes <= 6 ? 3 : 4;
  const rows = Math.ceil(nodes / cols);
  const colGap = 10, rowGap = 16, nodeH = 30;
  const nodeW = (innerW - colGap * (cols - 1)) / cols;
  const gridH = rows * nodeH + (rows - 1) * rowGap;
  const regionTop = 116, regionBottom = 252;
  const gridTop = regionTop + Math.max(0, (regionBottom - regionTop - gridH) / 2);

  const ownerIdx = Math.floor(nodes / 2); // deterministic owner for sharded
  // the one node the publisher sends to. Classic: an arbitrary entry node, kept
  // near the top-centre so the broadcast clearly fans out from it.
  const sourceIdx = hot ? Math.floor(Math.min(cols, nodes) / 2) : ownerIdx;

  // place every node
  const pos = [];
  for (let i = 0; i < nodes; i++) {
    const row = Math.floor(i / cols);
    const idxInRow = i - row * cols;
    const cnt = Math.min(cols, nodes - row * cols);
    const rowW = cnt * nodeW + (cnt - 1) * colGap;
    const startX = x0 + padInner + (innerW - rowW) / 2;
    const nx = startX + idxInRow * (nodeW + colGap);
    const ny = gridTop + row * (nodeH + rowGap);
    pos.push({ nx, ny });
  }

  const src = pos[sourceIdx];
  const srcCx = src.nx + nodeW / 2;
  const srcCy = src.ny + nodeH / 2;

  return (
    <g>
      {/* CLASSIC: the entry node copies the message to every other node over the
          cluster bus. These N-1 internal copies are the amplification/waste. */}
      {hot && pos.map((p, i) => {
        if (i === sourceIdx) return null;
        return (
          <line key={`b${i}`} className="rv-amp-flow"
            x1={srcCx} y1={srcCy} x2={p.nx + nodeW / 2} y2={p.ny + nodeH / 2}
            stroke={C.hot} strokeWidth="1.5" opacity="0.5" markerEnd="url(#amp-hot)" />
        );
      })}

      {/* the publish itself: publisher -> the single node it sends to */}
      <line className="rv-amp-flow"
        x1={cx} y1={pubAnchorY} x2={srcCx} y2={src.ny}
        stroke={hot ? C.blue : C.green} strokeWidth="1.9"
        markerEnd={hot ? 'url(#amp-blue)' : 'url(#amp-green)'} />

      {/* publisher */}
      <rect x={cx - pubW / 2} y={pubY} width={pubW} height={pubH} rx="7"
        fill={C.slot} stroke={C.blue} strokeWidth="1.4" />
      <text x={cx} y={pubY + 17} fontSize="11" fill={C.blue} textAnchor="middle"
        fontFamily="system-ui, sans-serif">publisher</text>
      <text x={cx + pubW / 2 + 7} y={pubY + 16} fontSize="9.5" fill={C.muted} textAnchor="start"
        fontFamily="ui-monospace, monospace">{hot ? 'PUBLISH' : 'SPUBLISH'}</text>

      {/* nodes */}
      {pos.map((p, i) => {
        const active = hot || i === ownerIdx; // classic: all carry it; sharded: owner only
        const isSource = i === sourceIdx;
        const stroke = active ? (hot ? C.hot : C.green) : C.border;
        const dot = hot ? C.hot : C.green;
        return (
          <g key={i} opacity={active ? 1 : 0.42}>
            <rect x={p.nx} y={p.ny} width={nodeW} height={nodeH} rx="6"
              fill={active && !hot ? tint(C.green, 0.1) : C.slot}
              stroke={isSource ? C.blue : stroke} strokeWidth={active || isSource ? 1.7 : 1.2} />
            <text x={p.nx + nodeW / 2} y={p.ny + nodeH / 2 + 3.5} fontSize="10"
              fill={active ? C.text : C.muted} textAnchor="middle"
              fontFamily="ui-monospace, monospace">n{i + 1}</text>
            {active && (
              <circle className="rv-amp-pulse" cx={p.nx + nodeW - 8} cy={p.ny + 8} r="3" fill={dot} />
            )}
          </g>
        );
      })}

      {/* per-side summary under the grid */}
      <text x={cx} y="272" fontSize="11" textAnchor="middle" fontFamily="system-ui, sans-serif">
        <tspan fill={hot ? C.hot : C.green} fontWeight="700">
          {hot ? `${nodes} copies` : '1 copy'}
        </tspan>
        <tspan fill={C.muted}>{hot ? ' — every node carries it' : ' — only the owner node'}</tspan>
      </text>
    </g>
  );
}

export default function BroadcastAmplificationDiagram() {
  const [nodes, setNodes] = useState(6);
  const [rate, setRate] = useState(200000);

  const classicCopies = nodes;
  const shardedCopies = 1;
  const classicTraffic = nodes * rate;
  const wasted = (nodes - 1) * rate;

  const W = 720, H = 290;
  const dividerX = 360;

  return (
    <Card
      title="Classic broadcast vs sharded delivery"
      subtitle="A publisher sends one message to one node. Classic Pub/Sub makes that node copy it to every other node over the cluster bus; sharded Pub/Sub routes it straight to the single node that owns the channel's slot."
    >
      <style>{`
        .rv-amp-flow {
          stroke-dasharray: 5 7;
          animation: rv-amp-dash 0.95s linear infinite;
        }
        @keyframes rv-amp-dash { to { stroke-dashoffset: -12; } }
        .rv-amp-pulse { animation: rv-amp-glow 1.8s ease-in-out infinite; transform-origin: center; }
        @keyframes rv-amp-glow { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @media (prefers-reduced-motion: reduce) {
          .rv-amp-flow { animation: none; stroke-dasharray: none; }
          .rv-amp-pulse { animation: none; }
        }
      `}</style>

      <div className="rv-controls">
        <Slider label="Redis cluster nodes" value={nodes} min={3} max={12} step={1}
          onChange={setNodes} accent={C.amber} />
        <Slider label="Publish rate" value={rate} min={50000} max={650000} step={10000}
          onChange={setRate} accent={C.blue} format={(v) => `${fmt(v)}/s`} />
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="rv-svg" xmlns="http://www.w3.org/2000/svg"
        style={{ margin: '2px 0 6px' }}>
        <defs>
          <marker id="amp-hot" markerWidth="8" markerHeight="6" refX="6.5" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={C.hot} />
          </marker>
          <marker id="amp-green" markerWidth="8" markerHeight="6" refX="6.5" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={C.green} />
          </marker>
          <marker id="amp-blue" markerWidth="8" markerHeight="6" refX="6.5" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={C.blue} />
          </marker>
        </defs>

        {/* panel headers */}
        <text x="180" y="26" fontSize="12.5" fontWeight="700" fill={C.hot} textAnchor="middle"
          fontFamily="system-ui, sans-serif">Classic Pub/Sub</text>
        <text x="180" y="40" fontSize="10" fill={C.muted} textAnchor="middle"
          fontFamily="system-ui, sans-serif">one node copies it to all the rest</text>

        <text x="540" y="26" fontSize="12.5" fontWeight="700" fill={C.green} textAnchor="middle"
          fontFamily="system-ui, sans-serif">Sharded Pub/Sub</text>
        <text x="540" y="40" fontSize="10" fill={C.muted} textAnchor="middle"
          fontFamily="system-ui, sans-serif">one copy to the owner</text>

        {/* shared vertical divider */}
        <line x1={dividerX} y1="14" x2={dividerX} y2="258" stroke={C.border}
          strokeWidth="1" strokeDasharray="3,5" />

        <ClusterPanel x0={12} w={336} nodes={nodes} mode="classic" />
        <ClusterPanel x0={372} w={336} nodes={nodes} mode="sharded" />
      </svg>

      <Stats>
        <Stat label="Copies per publish — classic" value={fmt(classicCopies)} color={C.hot}
          sub={`${fmt(classicTraffic)} msg/s of internal traffic`} />
        <Stat label="Copies per publish — sharded" value={fmt(shardedCopies)} color={C.green}
          sub={`${fmt(rate)} msg/s of internal traffic`} />
        <Stat label="Amplification" value={`${fmt(nodes)}×`} color={C.hot}
          sub={`${fmt(wasted)} msg/s carried for nothing`} />
      </Stats>

      <div className="rv-caption">
        Classic Pub/Sub copies every message to every node, so adding nodes lowers throughput instead of raising it —
        in the benchmark a 3-node cluster bogged down to seconds of latency near <b style={{ color: C.hot }}>400k msg/s</b>,
        below a single instance's 650k, and worse with more nodes. Sharded Pub/Sub sends one copy to the owning node, so it
        scales like independent instances: about <b style={{ color: C.green }}>650k × N</b>.
      </div>
    </Card>
  );
}
