import React from 'react';

// How several logical messages collapse into a single transport frame:
// newline-delimited in JSON, varint length-prefixed in Protobuf. One write,
// one read — fewer system calls under load.

const C = {
  bg: '#17171b',
  command: '#5b8def',
  accent: '#f5c451',
  muted: '#888',
  text: '#ccc',
  card: '#23242b',
};

export default function ProtocolBatchingDiagram() {
  const cmds = ['{"id":7,"publish":{…}}', '{"id":8,"subscribe":{…}}', '{"id":9,"history":{…}}'];
  return (
    <svg
      viewBox="0 0 710 290"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="batch-arr" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <polygon points="0 0, 10 4, 0 8" fill={C.muted} />
        </marker>
      </defs>

      {/* three logical commands */}
      <text x="105" y="26" fontSize="12" fontWeight="bold" fill={C.command} textAnchor="middle" fontFamily="system-ui, sans-serif">3 commands queued</text>
      {cmds.map((c, i) => (
        <g key={i} transform={`translate(20, ${40 + i * 40})`}>
          <rect width="170" height="30" rx="6" fill={C.card} stroke={C.command} strokeWidth="1.2" />
          <text x="12" y="19" fontSize="10.5" fill={C.text} fontFamily="monospace">{c}</text>
        </g>
      ))}

      <line x1="200" y1="85" x2="244" y2="85" stroke={C.muted} strokeWidth="1.5" markerEnd="url(#batch-arr)" />
      <text x="222" y="76" fontSize="10" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">pack</text>

      {/* JSON frame */}
      <g transform="translate(255, 32)">
        <rect width="430" height="100" rx="8" fill="#1b1f29" stroke={C.accent} strokeWidth="1.3" />
        <text x="14" y="22" fontSize="11" fontWeight="bold" fill={C.accent} fontFamily="system-ui, sans-serif">JSON · one frame</text>
        <text x="416" y="22" fontSize="10" fill={C.muted} textAnchor="end" fontFamily="system-ui, sans-serif">newline-delimited</text>
        <text x="14" y="46" fontSize="10.5" fill={C.text} fontFamily="monospace">{'{"id":7,"publish":{…}}'}<tspan fill={C.accent}>{' ⏎'}</tspan></text>
        <text x="14" y="66" fontSize="10.5" fill={C.text} fontFamily="monospace">{'{"id":8,"subscribe":{…}}'}<tspan fill={C.accent}>{' ⏎'}</tspan></text>
        <text x="14" y="86" fontSize="10.5" fill={C.text} fontFamily="monospace">{'{"id":9,"history":{…}}'}</text>
      </g>

      {/* Protobuf frame */}
      <g transform="translate(255, 152)">
        <rect width="430" height="100" rx="8" fill="#1b1f29" stroke={C.accent} strokeWidth="1.3" />
        <text x="14" y="22" fontSize="11" fontWeight="bold" fill={C.accent} fontFamily="system-ui, sans-serif">Protobuf · one frame</text>
        <text x="416" y="22" fontSize="10" fill={C.muted} textAnchor="end" fontFamily="system-ui, sans-serif">varint length-prefixed</text>
        <g fontFamily="monospace" fontSize="10.5">
          <rect x="14" y="38" width="26" height="22" rx="3" fill={C.accent} opacity="0.85" />
          <text x="27" y="53" fill={C.bg} textAnchor="middle" fontWeight="bold">12</text>
          <rect x="42" y="38" width="120" height="22" rx="3" fill={C.card} stroke={C.command} strokeWidth="1" />
          <text x="102" y="53" fill={C.text} textAnchor="middle">…cmd 7 bytes…</text>
          <rect x="166" y="38" width="26" height="22" rx="3" fill={C.accent} opacity="0.85" />
          <text x="179" y="53" fill={C.bg} textAnchor="middle" fontWeight="bold">15</text>
          <rect x="194" y="38" width="120" height="22" rx="3" fill={C.card} stroke={C.command} strokeWidth="1" />
          <text x="254" y="53" fill={C.text} textAnchor="middle">…cmd 8 bytes…</text>
          <rect x="318" y="38" width="26" height="22" rx="3" fill={C.accent} opacity="0.85" />
          <text x="331" y="53" fill={C.bg} textAnchor="middle" fontWeight="bold">11</text>
          <rect x="346" y="38" width="70" height="22" rx="3" fill={C.card} stroke={C.command} strokeWidth="1" />
          <text x="381" y="53" fill={C.text} textAnchor="middle">…cmd 9…</text>
        </g>
        <text x="27" y="80" fontSize="9" fill={C.accent} textAnchor="middle" fontFamily="system-ui, sans-serif">len</text>
        <text x="102" y="80" fontSize="9" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">payload</text>
      </g>

      <text x="470" y="276" fontSize="11" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        Replies travel back the same way — many in one frame.
      </text>
    </svg>
  );
}
