import React, { useState } from 'react';
import { Card, Slider, Stat, Stats, fmt } from './redisviz/controls';
import { C } from './redisviz/theme';

// Linear-scaling throughput slider. A single Redis instance tops out near a
// fixed ceiling (benchmarked at ~650k msg/s, 256-byte messages, all delivered).
// Independent Redis instances picked by client-side sharding share nothing, so
// aggregate throughput is just the ceiling times the number of instances.
//
// The flip side is connections: every subscriber node opens its own pipeline
// connections to every instance, so the total into Redis is
// subscriber nodes × instances × pipeline conns — the post's 24 × 8 × N.

const PER_INSTANCE = 650000; // single Redis instance ceiling, msg/s
const MAX_N = 16;

// Compact throughput label: 650000 -> "650k", 5200000 -> "5.2M".
function fmtThru(n) {
  if (n <= 0) return '0';
  if (n >= 1e6) {
    const s = (Math.round(n / 1e5) / 10).toFixed(1);
    return (s.endsWith('.0') ? s.slice(0, -2) : s) + 'M';
  }
  return Math.round(n / 1000) + 'k';
}

export default function ThroughputScalingDiagram() {
  const [n, setN] = useState(8);
  const [subNodes, setSubNodes] = useState(24);
  const [pipe, setPipe] = useState(1);

  const total = n * PER_INSTANCE;
  const totalConns = subNodes * n * pipe;     // all connections into the cluster
  const perInstanceConns = subNodes * pipe;   // connections landing on one instance

  // ---- SVG geometry ----
  const W = 720, H = 132;
  const trackX = 34, trackY = 46, trackW = 652, trackH = 48;
  const segW = trackW / MAX_N;            // width of one instance's slice
  const fillW = n * segW;                 // green portion grows linearly with n
  const ceilingX = trackX + segW;         // right edge of the first segment

  // separators between every instance slot across the whole axis
  const seps = [];
  for (let i = 1; i < MAX_N; i++) {
    const x = trackX + i * segW;
    const inside = i < n;
    seps.push(
      <line key={`s${i}`} x1={x} y1={trackY} x2={x} y2={trackY + trackH}
        stroke={inside ? C.bg : C.grid}
        strokeWidth={inside ? 1.5 : 1}
        opacity={inside ? 0.6 : 0.5} />
    );
  }

  // axis ticks under the track at multiples of 4 instances
  const ticks = [0, 4, 8, 12, 16].map((i) => {
    const x = trackX + i * segW;
    return (
      <g key={`t${i}`}>
        <line x1={x} y1={trackY + trackH} x2={x} y2={trackY + trackH + 5}
          stroke={C.border} strokeWidth="1" />
        <text x={x} y={trackY + trackH + 18} fontSize="9.5" fill={C.muted}
          textAnchor="middle" fontFamily="ui-monospace, monospace">
          {fmtThru(i * PER_INSTANCE)}
        </text>
      </g>
    );
  });

  // aggregate label rides the right edge of the green fill
  const labelInside = fillW > 96;
  const labelX = labelInside ? trackX + fillW - 10 : trackX + fillW + 9;

  return (
    <Card
      title="Throughput scales linearly as you add Redis instances"
      subtitle="One instance has a fixed ceiling. Independent instances share nothing, so aggregate throughput is just that ceiling times the count."
    >
      <div className="rv-controls">
        <Slider label="Independent Redis instances" value={n} min={1} max={MAX_N} step={1}
          onChange={setN} accent={C.green} />
        <Slider label="Subscriber nodes" value={subNodes} min={8} max={200} step={8}
          onChange={setSubNodes} accent={C.blue} format={fmt} />
        <Slider label="Pipeline conns / instance" value={pipe} min={1} max={4} step={1}
          onChange={setPipe} accent={C.amber} />
      </div>

      <div className="rv-control-label" style={{ lineHeight: 1.5, margin: '-2px 0 10px' }}>
        {n} {n === 1 ? 'instance' : 'instances'} × {fmtThru(PER_INSTANCE)} msg/s each = <b style={{ color: C.green }}>{fmtThru(total)} msg/s</b>
        <span style={{ color: C.muted }}> · connections {fmt(subNodes)} × {n}{pipe > 1 ? ` × ${pipe}` : ''} = </span>
        <b style={{ color: C.amber }}>{fmt(totalConns)}</b>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="rv-svg" xmlns="http://www.w3.org/2000/svg" style={{ margin: '2px 0 8px' }}>
        {/* full-axis track: capacity from 0 to 16 instances */}
        <rect x={trackX} y={trackY} width={trackW} height={trackH} rx="8"
          fill={C.slot} stroke={C.border} strokeWidth="1" />

        {/* green fill — grows smoothly with the instance count */}
        <rect x={trackX} y={trackY} height={trackH} rx="8"
          fill={C.green}
          style={{ width: `${fillW}px`, transition: 'width 0.42s cubic-bezier(0.22,0.61,0.36,1)' }} />

        {/* separators between instance slots */}
        {seps}

        {/* single-instance ceiling marker on the first segment boundary */}
        <line x1={ceilingX} y1={trackY - 12} x2={ceilingX} y2={trackY + trackH + 4}
          stroke={C.amber} strokeWidth="1.5" strokeDasharray="3,3" opacity="0.95" />
        <circle cx={ceilingX} cy={trackY - 12} r="2.5" fill={C.amber} />
        <text x={ceilingX + 7} y={trackY - 8} fontSize="11" fill={C.amber}
          fontFamily="ui-monospace, monospace" fontWeight="700">
          single-instance ceiling ({fmtThru(PER_INSTANCE)})
        </text>

        {/* aggregate value riding the fill edge */}
        <text x={labelX} y={trackY + trackH / 2 + 4.5} fontSize="13" fontWeight="700"
          fontFamily="ui-monospace, monospace"
          textAnchor={labelInside ? 'end' : 'start'}
          fill={labelInside ? '#11140f' : C.green}>
          {fmtThru(total)} msg/s
        </text>

        {ticks}
      </svg>

      <Stats>
        <Stat label="Aggregate throughput" value={`${fmtThru(total)} msg/s`} color={C.green}
          sub={`${n} × one-instance ceiling`} />
        <Stat label="Total connections to Redis" value={fmt(totalConns)} color={C.amber}
          sub="subscriber nodes × instances × pipe" />
        <Stat label="Per Redis instance" value={fmt(perInstanceConns)} color={C.text}
          sub="connections landing on each one" />
      </Stats>

      <div className="rv-caption">
        Every instance you add takes about <b>1/N</b> of the load and contributes its own ~{fmtThru(PER_INSTANCE)} msg/s, so throughput
        grows in a straight line. The flip side rides along: every subscriber node opens its own pipeline connections to every instance,
        so the total into Redis is <b style={{ color: C.amber }}>subscriber nodes × instances × pipeline conns</b>. That product is what
        starts to bite at scale — the connection widgets further down tackle it.
      </div>
    </Card>
  );
}
