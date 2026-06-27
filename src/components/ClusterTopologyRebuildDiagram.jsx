import React from 'react';

// When the cluster rebalances, a slot can move from one Redis node to another.
// The app holds a map of partition -> owning node and one connection per node;
// on a move it resubscribes the affected partition on the new owner's
// connection. Here partition p4's slot moves from node B to node C.

const C = {
  bg: '#17171b',
  redis: '#f5c451',
  node: '#5bef7b',
  muted: '#8a8a94',
  text: '#d6d6db',
  slot: '#23242b',
  border: '#2c2c34',
  blue: '#62b0ff',
};

const NODE_W = 96;
const NODE_H = 50;
const nodeXs = [14, 122, 230]; // within a 336-wide panel
const NODE_Y = 72;

function Panel({ x0, title, sub, map, highlight, hotConn }) {
  const cx = x0 + 336 / 2;
  const appY = 176, appW = 124;
  const order = ['A', 'B', 'C'];

  return (
    <g>
      <text x={cx} y="44" fontSize="11.5" fontWeight="700" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">{title}</text>
      <text x={cx} y="59" fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">{sub}</text>

      {/* connections app -> each node (owner of the moved partition highlighted) */}
      {order.map((n, i) => {
        const nx = x0 + nodeXs[i] + NODE_W / 2;
        const hot = hotConn === n;
        return (
          <line key={`c${n}`} x1={cx} y1={appY} x2={nx} y2={NODE_Y + NODE_H}
            stroke={hot ? C.node : C.border} strokeWidth={hot ? 1.8 : 1.1} opacity={hot ? 0.95 : 0.6} />
        );
      })}

      {/* nodes with their partitions */}
      {order.map((n, i) => {
        const nx = x0 + nodeXs[i];
        const ncx = nx + NODE_W / 2;
        const parts = map[n];
        const cell = 28;
        const startX = ncx - (parts.length * cell) / 2;
        return (
          <g key={n}>
            <rect x={nx} y={NODE_Y} width={NODE_W} height={NODE_H} rx="7" fill={C.slot} stroke={C.redis} strokeWidth="1.3" />
            <text x={ncx} y={NODE_Y + 17} fontSize="10" fill={C.redis} textAnchor="middle" fontFamily="system-ui, sans-serif">node {n}</text>
            {parts.map((p, j) => {
              const on = p === highlight;
              return (
                <text key={p} x={startX + j * cell + cell / 2} y={NODE_Y + 37} fontSize="10.5"
                  fill={on ? C.node : C.muted} textAnchor="middle" fontFamily="ui-monospace, monospace"
                  fontWeight={on ? 700 : 400}>{p}</text>
              );
            })}
          </g>
        );
      })}

      {/* app node */}
      <rect x={cx - appW / 2} y={appY} width={appW} height="28" rx="7" fill={C.slot} stroke={C.blue} strokeWidth="1.4" />
      <text x={cx} y={appY + 18} fontSize="10" fill={C.blue} textAnchor="middle" fontFamily="system-ui, sans-serif">application node</text>
    </g>
  );
}

export default function ClusterTopologyRebuildDiagram() {
  const before = { A: ['p1', 'p2'], B: ['p3', 'p4'], C: ['p5', 'p6'] };
  const after = { A: ['p1', 'p2'], B: ['p3'], C: ['p5', 'p6', 'p4'] };

  return (
    <svg viewBox="0 0 760 250" xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}>
      <text x="380" y="24" fontSize="13" fontWeight="bold" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">
        When a slot moves, the app rewires the subscription
      </text>

      <line x1="380" y1="38" x2="380" y2="206" stroke="#2c2c34" strokeWidth="1" strokeDasharray="3,4" />

      <Panel x0={12} title="Before" sub="p4's slot lives on node B" map={before} highlight="p4" hotConn="B" />
      <Panel x0={412} title="After rebalance" sub="p4's slot moved to node C" map={after} highlight="p4" hotConn="C" />

      {/* move indicator centred over the divider, at node-row height */}
      <rect x="350" y={NODE_Y + 8} width="60" height="20" rx="10" fill={C.bg} stroke={C.node} strokeWidth="1" />
      <text x="380" y={NODE_Y + 21} fontSize="9.5" fill={C.node} textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="700">p4 ▸ C</text>

      <text x="380" y="234" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        The app spots the move — an unsolicited sunsubscribe, or the 30-second CLUSTER SLOTS poll — and resubscribes p4 on node C's connection.
      </text>
    </svg>
  );
}
