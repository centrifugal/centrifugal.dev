import React from 'react';

// Classic (non-sharded) Pub/Sub in Redis Cluster: a PUBLISH that arrives at one
// node is copied to every other node over the cluster bus — even nodes with no
// subscriber for that channel. Here only node 5 has a subscriber, yet all five
// carry the message. More nodes just means more wasted copies.

const C = { bg: '#17171b', pub: '#5b8def', sub: '#5bef7b', hot: '#fe5e5e', muted: '#888', text: '#ccc', slot: '#23242b' };
const centers = [80, 218, 356, 494, 632];
const NW = 100;
const NTOP = 136;
const NH = 46;

export default function ClusterBroadcastDiagram() {
  const entry = centers[0];
  const subNode = centers[4];
  return (
    <svg
      viewBox="0 0 740 330"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="cb-hot" markerWidth="9" markerHeight="7" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.hot} />
        </marker>
        <marker id="cb-blue" markerWidth="9" markerHeight="7" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.pub} />
        </marker>
        <marker id="cb-green" markerWidth="9" markerHeight="7" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.sub} />
        </marker>
      </defs>

      <text x="20" y="26" fontSize="13" fontWeight="bold" fill={C.text} fontFamily="system-ui, sans-serif">
        Classic Cluster Pub/Sub: every node gets every message
      </text>

      {/* broadcast arcs from the entry node to all the others */}
      {centers.slice(1).map((cx, i) => {
        const ctrlX = (entry + cx) / 2;
        const ctrlY = 94 - i * 26;
        return (
          <path
            key={i}
            d={`M ${entry} ${NTOP - 2} Q ${ctrlX} ${ctrlY} ${cx} ${NTOP - 2}`}
            fill="none"
            stroke={C.hot}
            strokeWidth="1.5"
            markerEnd="url(#cb-hot)"
            opacity="0.8"
          />
        );
      })}
      <text x="356" y="62" fontSize="10" fill={C.hot} textAnchor="middle" fontFamily="system-ui, sans-serif">
        copied to every node
      </text>

      {/* cluster nodes — all carry the message (red); most have no subscriber */}
      {centers.map((cx, i) => (
        <g key={i}>
          <rect x={cx - NW / 2} y={NTOP} width={NW} height={NH} rx="8" fill={C.slot} stroke={C.hot} strokeWidth="1.7" />
          <text x={cx} y={NTOP + 21} fontSize="11.5" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">node {i + 1}</text>
          <circle cx={cx} cy={NTOP + 35} r="4.5" fill={C.hot} />
          {i !== 0 && i !== 4 && (
            <text x={cx} y="204" fontSize="9" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">no subscriber</text>
          )}
        </g>
      ))}

      {/* publisher into the entry node */}
      <rect x={entry - 52} y="240" width="104" height="38" rx="8" fill={C.slot} stroke={C.pub} strokeWidth="1.4" />
      <text x={entry} y="263" fontSize="11" fill={C.pub} textAnchor="middle" fontFamily="system-ui, sans-serif">publisher</text>
      <line x1={entry} y1="240" x2={entry} y2={NTOP + NH + 1} stroke={C.pub} strokeWidth="1.5" markerEnd="url(#cb-blue)" />
      <text x={entry + 46} y="216" fontSize="10" fill={C.muted} fontFamily="monospace">PUBLISH</text>

      {/* the one real subscriber */}
      <line x1={subNode} y1={NTOP + NH + 1} x2={subNode} y2="238" stroke={C.sub} strokeWidth="1.5" markerEnd="url(#cb-green)" />
      <rect x={subNode - 52} y="240" width="104" height="38" rx="8" fill={C.slot} stroke={C.sub} strokeWidth="1.4" />
      <text x={subNode} y="263" fontSize="11" fill={C.sub} textAnchor="middle" fontFamily="system-ui, sans-serif">subscriber</text>
      <text x={subNode - 46} y="216" fontSize="10" fill={C.muted} textAnchor="end" fontFamily="monospace">delivered</text>

      <text x="370" y="300" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        Only node 5 has a subscriber for this channel, yet every node still receives a copy.
      </text>
      <text x="370" y="318" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        The nodes in between carry the message for nothing — and it gets worse with every node you add.
      </text>
    </svg>
  );
}
