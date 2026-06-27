import React, { useState } from 'react';
import { Card, Slider, Toggle, Stat, Stats } from './redisviz/controls';
import { C, tint } from './redisviz/theme';
import { distributions, spreadRatio } from './redisviz/redisMath';

// Slot-balance explorer. Hashes the real partition tags (naive index strings vs
// the precomputed table shipped with Centrifugo) through CRC16 and shows how
// many partitions land on each Redis node, live, for any cluster size. The
// precomputed set stays balanced (max-min <= 1) at every size; the naive one
// bunches because consecutive short strings hash into a narrow band of slots.

const PARTITION_OPTS = [128, 256, 512, 1024];
const MAX_NODES = 24;

function BarPanel({ x, y, w, h, counts, color, ideal, scaleMax, label, subColor }) {
  const n = counts.length;
  const gap = n > 40 ? 1 : n > 24 ? 1.5 : 3;
  const bw = (w - gap * (n - 1)) / n;
  const mx = Math.max(...counts);
  const mn = Math.min(...counts);
  const yOf = (v) => h - (v / scaleMax) * h;
  return (
    <g transform={`translate(${x},${y})`}>
      {/* label */}
      <text x="0" y="-10" fontSize="11.5" fontWeight="700" fill={color} fontFamily="system-ui, sans-serif">{label}</text>
      {/* ideal line, label parked in the right gutter so it never sits on a bar */}
      <line x1="0" y1={yOf(ideal)} x2={w} y2={yOf(ideal)} stroke={C.muted} strokeWidth="1" strokeDasharray="3,4" opacity="0.6" />
      <text x={w + 8} y={yOf(ideal) + 3.5} fontSize="9" fill={C.muted} textAnchor="start" fontFamily="ui-monospace, monospace">ideal</text>
      <text x={w + 8} y={yOf(ideal) + 14} fontSize="9" fill={C.muted} textAnchor="start" fontFamily="ui-monospace, monospace">{ideal.toFixed(1)}</text>
      {/* baseline */}
      <line x1="0" y1={h} x2={w} y2={h} stroke={C.border} strokeWidth="1" />
      {counts.map((v, i) => {
        const isMax = v === mx;
        const isMin = v === mn && mx !== mn;
        const bx = i * (bw + gap);
        const bh = (v / scaleMax) * h;
        return (
          <g key={i}>
            <rect
              x={bx} y={h - bh} width={bw} height={bh} rx={bw > 6 ? 2 : 0}
              fill={isMax ? color : isMin ? tint(color, 0.45) : tint(color, 0.78)}
            />
            {n <= 12 && (
              <text x={bx + bw / 2} y={h - bh - 4} fontSize="9.5" fill={isMax ? color : C.muted}
                textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight={isMax ? 700 : 400}>{v}</text>
            )}
          </g>
        );
      })}
    </g>
  );
}

export default function SlotBalanceDiagram() {
  const [partitions, setPartitions] = useState(128);
  const [nodes, setNodes] = useState(6);

  const { naive, precomputed } = distributions(partitions, nodes);
  const ideal = partitions / nodes;
  const scaleMax = Math.max(...naive, ...precomputed, ideal) * 1.18;

  const naiveSpread = spreadRatio(naive);
  const preSpread = spreadRatio(precomputed);
  const naiveMax = Math.max(...naive), naiveMin = Math.min(...naive);
  const preMax = Math.max(...precomputed), preMin = Math.min(...precomputed);

  const W = 720, panelW = 624, panelH = 96, padX = 30;

  return (
    <Card
      title="Where partitions land: naive tags vs precomputed tags"
      subtitle="Each partition is a hash tag; its CRC16 slot decides which Redis node owns it. Real tags, real CRC16 — the same table Centrifugo ships."
      right={
        <Toggle
          options={PARTITION_OPTS.map((p) => ({ value: p, label: `${p}` }))}
          value={partitions}
          onChange={setPartitions}
          accent={C.amber}
        />
      }
    >
      <div className="rv-controls">
        <Slider label="Redis cluster nodes" value={nodes} min={2} max={MAX_NODES} step={1}
          onChange={setNodes} accent={C.amber} />
        <div className="rv-control" style={{ flex: '2 1 320px', alignSelf: 'flex-end', paddingBottom: 2 }}>
          <div className="rv-control-label" style={{ lineHeight: 1.5 }}>
            {partitions} partitions across {nodes} nodes · ideal ≈ {ideal.toFixed(1)} per node
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} 250`} className="rv-svg" xmlns="http://www.w3.org/2000/svg" style={{ margin: '2px 0 6px' }}>
        <BarPanel x={padX} y={26} w={panelW} h={panelH} counts={naive} color={C.hot}
          ideal={ideal} scaleMax={scaleMax} label={`Naive tags  {0} {1} … {${partitions - 1}}`} />
        <BarPanel x={padX} y={26 + panelH + 32} w={panelW} h={panelH} counts={precomputed} color={C.green}
          ideal={ideal} scaleMax={scaleMax} label="Precomputed tags" />
      </svg>

      <Stats>
        <Stat label="Naive — busiest vs lightest"
          value={`${naiveMax} vs ${naiveMin}`}
          color={C.hot}
          sub={`${naiveSpread.toFixed(2)}× imbalance`} />
        <Stat label="Precomputed — busiest vs lightest"
          value={`${preMax} vs ${preMin}`}
          color={C.green}
          sub={preMax - preMin <= 1 ? 'perfectly even (max−min ≤ 1)' : `${preSpread.toFixed(2)}× imbalance`} />
      </Stats>

      <div className="rv-caption">
        Drag the cluster size: the naive tags swing wildly at some sizes while the precomputed set stays flat at <b style={{ color: C.green }}>every</b> size
        from 1 node up to the partition count. Same partitions, same connection count — only the tag string each partition uses changes.
      </div>
    </Card>
  );
}
