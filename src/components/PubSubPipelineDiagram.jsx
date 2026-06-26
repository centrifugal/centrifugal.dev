import React from 'react';

// Library level: stop paying a syscall + round trip per command. The client
// pipelines in-flight commands and a tiny flush delay coalesces them into a
// single write. SUBSCRIBE itself takes many channels at once.

const C = {
  bg: '#17171b',
  cmd: '#5b8def',
  redis: '#f5c451',
  hot: '#fe5e5e',
  muted: '#888',
  text: '#ccc',
  slot: '#23242b',
};

const cells = ['c1', 'c2', 'c3'];

export default function PubSubPipelineDiagram() {
  return (
    <svg
      viewBox="0 0 740 270"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="pipe-blue" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.cmd} />
        </marker>
      </defs>

      <text x="20" y="26" fontSize="13" fontWeight="bold" fill={C.text} fontFamily="system-ui, sans-serif">
        Stop paying a round trip per command
      </text>

      {/* Redis tall box on the right */}
      <rect x="600" y="50" width="116" height="168" rx="9" fill={C.slot} stroke={C.redis} strokeWidth="1.8" />
      <text x="658" y="128" fontSize="13" fill={C.redis} textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="bold">Redis</text>
      <text x="658" y="147" fontSize="10" fill={C.muted} textAnchor="middle" fontFamily="monospace">PUB/SUB</text>

      {/* top lane: per-command */}
      <text x="24" y="74" fontSize="11" fill={C.hot} fontFamily="system-ui, sans-serif">naive</text>
      {cells.map((c, i) => (
        <g key={c}>
          <rect x={120 + i * 64} y="56" width="56" height="28" rx="6" fill={C.slot} stroke={C.cmd} strokeWidth="1.3" />
          <text x={120 + i * 64 + 28} y="74" fontSize="11" fill={C.cmd} textAnchor="middle" fontFamily="monospace">{c}</text>
        </g>
      ))}
      <line x1="316" y1="62" x2="596" y2="62" stroke={C.cmd} strokeWidth="1.2" markerEnd="url(#pipe-blue)" opacity="0.7" />
      <line x1="316" y1="70" x2="596" y2="70" stroke={C.cmd} strokeWidth="1.2" markerEnd="url(#pipe-blue)" opacity="0.7" />
      <line x1="316" y1="78" x2="596" y2="78" stroke={C.cmd} strokeWidth="1.2" markerEnd="url(#pipe-blue)" opacity="0.7" />
      <text x="455" y="104" fontSize="9.5" fill={C.hot} textAnchor="middle" fontFamily="system-ui, sans-serif">3 commands → 3 writes, 3 round trips</text>

      {/* bottom lane: pipelined */}
      <text x="24" y="184" fontSize="11" fill={C.text} fontFamily="system-ui, sans-serif">pipelined</text>
      <rect x="112" y="150" width="208" height="40" rx="8" fill="none" stroke={C.redis} strokeWidth="1.3" strokeDasharray="5,4" />
      {cells.map((c, i) => (
        <g key={c}>
          <rect x={120 + i * 64} y="156" width="56" height="28" rx="6" fill={C.slot} stroke={C.cmd} strokeWidth="1.3" />
          <text x={120 + i * 64 + 28} y="174" fontSize="11" fill={C.cmd} textAnchor="middle" fontFamily="monospace">{c}</text>
        </g>
      ))}
      <text x="216" y="208" fontSize="9.5" fill={C.redis} textAnchor="middle" fontFamily="system-ui, sans-serif">coalesced within MaxFlushDelay (~100µs)</text>
      <line x1="324" y1="170" x2="596" y2="170" stroke={C.cmd} strokeWidth="4.5" markerEnd="url(#pipe-blue)" />
      <text x="460" y="160" fontSize="9.5" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">many commands → 1 write</text>

      <text x="370" y="252" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        Implicit pipelining amortizes the syscall; one SUBSCRIBE carries up to 512 channels — vital when millions of ephemeral channels churn.
      </text>
    </svg>
  );
}
