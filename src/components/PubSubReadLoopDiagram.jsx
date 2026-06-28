import React from 'react';

// The point is not "many connections". One Pub/Sub connection is usually fast
// enough. What matters is that the goroutine reading the socket does NOTHING but
// read — it must keep up, or Redis fills its output buffer and drops the
// connection. Decoding and delivery are handed off to a pool of workers (one per
// core) so the work runs in parallel; picking the worker by hash(channel) keeps
// each channel's messages in order while different channels spread across cores.
// A single reader usually keeps up; a few pipelined connections help only if it
// doesn't.

const C = {
  bg: '#17171b',
  redis: '#f5c451',
  node: '#5bef7b',
  hot: '#fe5e5e',
  muted: '#8a8a94',
  text: '#d6d6db',
  slot: '#23242b',
  border: '#2c2c34',
};

const workers = [132, 235, 338, 441, 544]; // x of each worker box (w = 84)

export default function PubSubReadLoopDiagram() {
  return (
    <svg
      viewBox="0 0 760 332"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="rl-green" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.node} />
        </marker>
        <marker id="rl-redis" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.redis} />
        </marker>
      </defs>

      <text x="24" y="28" fontSize="13" fontWeight="bold" fill={C.node} fontFamily="system-ui, sans-serif">
        Keep up with Redis: read fast, process in parallel
      </text>

      {/* Redis */}
      <rect x="300" y="44" width="160" height="34" rx="7" fill={C.slot} stroke={C.redis} strokeWidth="1.6" />
      <text x="380" y="65" fontSize="11" fill={C.redis} textAnchor="middle" fontFamily="system-ui, sans-serif">Redis · Pub/Sub</text>

      {/* connection */}
      <line x1="380" y1="78" x2="380" y2="106" stroke={C.redis} strokeWidth="2" markerEnd="url(#rl-redis)" />
      <text x="393" y="90" fontSize="10" fill={C.redis} fontFamily="ui-monospace, monospace">1 connection</text>
      <text x="393" y="102" fontSize="8.5" fill={C.muted} fontFamily="system-ui, sans-serif">usually enough</text>

      {/* read loop */}
      <rect x="268" y="108" width="224" height="50" rx="8" fill={C.slot} stroke={C.node} strokeWidth="1.8" />
      <text x="380" y="129" fontSize="12" fontWeight="bold" fill={C.node} textAnchor="middle" fontFamily="system-ui, sans-serif">read loop</text>
      <text x="380" y="146" fontSize="9.5" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">drains the socket — nothing else</text>

      {/* keep-up warning to the right */}
      <line x1="492" y1="133" x2="508" y2="133" stroke={C.hot} strokeWidth="1.4" />
      <text x="512" y="128" fontSize="10" fill={C.hot} fontFamily="system-ui, sans-serif" fontWeight="600">must keep up</text>
      <text x="512" y="141" fontSize="8.8" fill={C.muted} fontFamily="system-ui, sans-serif">a slow reader gets its</text>
      <text x="512" y="152" fontSize="8.8" fill={C.muted} fontFamily="system-ui, sans-serif">connection dropped by Redis</text>

      {/* dispatch into the pool */}
      <line x1="380" y1="160" x2="380" y2="186" stroke={C.node} strokeWidth="2" markerEnd="url(#rl-green)" />
      <rect x="300" y="172" width="160" height="15" rx="7.5" fill={C.bg} />
      <text x="380" y="183" fontSize="9.5" fill={C.node} textAnchor="middle" fontFamily="ui-monospace, monospace">hash(channel)</text>

      {/* worker pool */}
      <text x="116" y="206" fontSize="9.5" fill={C.muted} fontFamily="system-ui, sans-serif">worker pool · one goroutine per core</text>
      <rect x="116" y="212" width="528" height="80" rx="9" fill="none" stroke={C.node} strokeWidth="1.1" strokeDasharray="5,4" />

      {workers.map((x, i) => {
        const cx = x + 42;
        return (
          <g key={i}>
            <line x1="380" y1="190" x2={cx} y2="228" stroke={C.node} strokeWidth="1.2" opacity="0.75" markerEnd="url(#rl-green)" />
            <rect x={x} y="230" width="84" height="38" rx="7" fill={C.slot} stroke={C.node} strokeWidth="1.3" />
            <text x={cx} y="246" fontSize="9.5" fill={C.node} textAnchor="middle" fontFamily="system-ui, sans-serif">worker</text>
            <text x={cx} y="259" fontSize="8.2" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">decode + deliver</text>
          </g>
        );
      })}

      <text x="380" y="284" fontSize="9.5" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">
        runs in parallel across cores · same channel → same worker, so per-channel order is kept
      </text>

      {/* footer */}
      <text x="380" y="306" fontSize="10.5" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">
        The read path must never block. If workers fall behind, it's time to scale the nodes.
      </text>
      <text x="380" y="322" fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        One connection usually keeps up — add a few pipelined connections only if a single reader can't.
      </text>
    </svg>
  );
}
