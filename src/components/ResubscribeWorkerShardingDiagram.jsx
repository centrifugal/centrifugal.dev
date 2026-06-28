import React from 'react';

// On reconnect a node replays its subscriptions across a pool of worker
// goroutines so the resubscribe is fast. How the work is split matters: shard
// the channels across workers by a hash of the channel name and every
// partition's channels scatter across all workers — each worker then issues its
// own SSUBSCRIBE per partition, so the per-partition batch fragments into as
// many partial commands as there are workers. Assign whole partitions to workers
// instead and each partition's channels stay together in one fat command:
// ~partitions commands instead of workers × partitions.

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

const workersY = [60, 96, 132, 168];
const partsY = [74, 114, 154];

function Panel({ x0, mode }) {
  const hot = mode === 'hash';
  const w = 336;
  const wx = x0 + 16;          // worker column x
  const wWidth = 60;
  const px = x0 + w - 76;      // partition column x
  const pWidth = 60;
  const color = hot ? C.hot : C.node;
  const wRight = wx + wWidth;

  // lines: by-hash → every worker to every partition; by-partition → worker i to partition i
  const lines = [];
  if (hot) {
    workersY.forEach((wy, i) => partsY.forEach((py, j) => {
      lines.push(<line key={`${i}-${j}`} x1={wRight} y1={wy + 13} x2={px} y2={py + 13}
        stroke={C.hot} strokeWidth="1" opacity="0.42" />);
    }));
  } else {
    partsY.forEach((py, j) => {
      lines.push(<line key={j} x1={wRight} y1={workersY[j] + 13} x2={px} y2={py + 13}
        stroke={C.node} strokeWidth="1.6" opacity="0.9" markerEnd="url(#rws-green)" />);
    });
  }

  return (
    <g>
      {lines}

      {/* workers */}
      {workersY.map((wy, i) => {
        const idle = !hot && i === 3;
        return (
          <g key={i} opacity={idle ? 0.4 : 1}>
            <rect x={wx} y={wy} width={wWidth} height={26} rx="6" fill={C.slot}
              stroke={idle ? C.border : color} strokeWidth="1.3" />
            <text x={wx + wWidth / 2} y={wy + 17} fontSize="10" fill={idle ? C.muted : C.text}
              textAnchor="middle" fontFamily="system-ui, sans-serif">w{i + 1}</text>
          </g>
        );
      })}

      {/* partitions grouped as one Redis node */}
      <rect x={px - 8} y={partsY[0] - 12} width={pWidth + 16} height={partsY[2] + 26 - partsY[0] + 24}
        rx="9" fill="none" stroke={C.border} strokeDasharray="4,4" strokeWidth="1" />
      <text x={px + pWidth / 2} y={partsY[0] - 18} fontSize="9" fill={C.muted} textAnchor="middle"
        fontFamily="system-ui, sans-serif">Redis node</text>
      {partsY.map((py, j) => (
        <g key={j}>
          <rect x={px} y={py} width={pWidth} height={26} rx="6" fill={C.slot} stroke={C.redis} strokeWidth="1.2" />
          <text x={px + pWidth / 2} y={py + 17} fontSize="9.5" fill={C.redis} textAnchor="middle"
            fontFamily="ui-monospace, monospace">p{j + 1}</text>
        </g>
      ))}
    </g>
  );
}

export default function ResubscribeWorkerShardingDiagram() {
  return (
    <svg viewBox="0 0 760 250" xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}>
      <defs>
        <marker id="rws-green" markerWidth="8" markerHeight="6" refX="6.5" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={C.node} />
        </marker>
      </defs>

      <text x="380" y="24" fontSize="12.5" fontWeight="bold" fill={C.text} textAnchor="middle"
        fontFamily="system-ui, sans-serif">One reconnect, N parallel resubscribe workers</text>

      <line x1="380" y1="40" x2="380" y2="208" stroke="#2c2c34" strokeWidth="1" strokeDasharray="3,4" />

      {/* LEFT: by channel hash */}
      <text x="184" y="44" fontSize="11.5" fontWeight="bold" fill={C.hot} textAnchor="middle"
        fontFamily="system-ui, sans-serif">Workers shard by channel hash</text>
      <Panel x0={12} mode="hash" />
      <text x="184" y="208" fontSize="10" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        every partition's channels hit every worker
      </text>
      <text x="184" y="226" fontSize="11" fill={C.hot} textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="bold">
        N × partitions partial SSUBSCRIBEs
      </text>

      {/* RIGHT: by partition */}
      <text x="576" y="44" fontSize="11.5" fontWeight="bold" fill={C.node} textAnchor="middle"
        fontFamily="system-ui, sans-serif">Workers grouped by partition</text>
      <Panel x0={412} mode="part" />
      <text x="576" y="208" fontSize="10" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        each worker owns whole partitions
      </text>
      <text x="576" y="226" fontSize="11" fill={C.node} textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="bold">
        partitions full SSUBSCRIBEs — up to N× fewer
      </text>
    </svg>
  );
}
