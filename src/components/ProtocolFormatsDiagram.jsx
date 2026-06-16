import React from 'react';

// The same logical message in both wire formats: readable JSON vs compact
// Protobuf bytes. Shows that the two are interchangeable in meaning — you trade
// debuggability for size. Bytes are colour-grouped to hint at the field layout.

const C = {
  bg: '#17171b',
  json: '#5b8def',
  pb: '#5bef7b',
  id: '#f5c451',
  muted: '#888',
  text: '#ccc',
};

// Protobuf encoding of: Command{ id:2, subscribe:{ channel:"chat:42" } }
//   08 02            -> field 1 (id) = 2
//   2a 09            -> field 5 (subscribe), length 9
//     0a 07          -> field 1 (channel), length 7
//       63 68 61 74 3a 34 32  -> "chat:42"
const BYTES = [
  { hex: '08', g: 'id' }, { hex: '02', g: 'id' },
  { hex: '2a', g: 'wrap' }, { hex: '09', g: 'wrap' },
  { hex: '0a', g: 'wrap' }, { hex: '07', g: 'wrap' },
  { hex: '63', g: 'ch' }, { hex: '68', g: 'ch' }, { hex: '61', g: 'ch' }, { hex: '74', g: 'ch' },
  { hex: '3a', g: 'ch' }, { hex: '34', g: 'ch' }, { hex: '32', g: 'ch' },
];
const GROUP_COLOR = { id: C.id, wrap: C.muted, ch: C.pb };
const CELL = 21;

function SizeBadge({ x, label, color }) {
  return (
    <g>
      <rect x={x} y={150} width="110" height="26" rx="13" fill="#1b1d22" stroke={color} strokeWidth="1.2" />
      <text x={x + 55} y={167} fontSize="11.5" fill={color} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{label}</text>
    </g>
  );
}

export default function ProtocolFormatsDiagram() {
  const pbStartX = 388;
  return (
    <svg
      viewBox="0 0 720 210"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <text x="360" y="26" fontSize="13" fontWeight="bold" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">
        One message — “subscribe to <tspan fontFamily="monospace" fill={C.id}>chat:42</tspan>” — two encodings
      </text>

      {/* JSON panel */}
      <g transform="translate(20, 48)">
        <rect width="330" height="78" rx="10" fill="#1b1f29" stroke={C.json} strokeWidth="1.4" />
        <text x="16" y="24" fontSize="12.5" fontWeight="bold" fill={C.json} fontFamily="system-ui, sans-serif">JSON</text>
        <text x="314" y="24" fontSize="10.5" fill={C.muted} textAnchor="end" fontFamily="system-ui, sans-serif">text · readable · convenient</text>
        <text x="16" y="58" fontSize="10.5" fill={C.text} fontFamily="monospace">{'{"id":2,"subscribe":{"channel":"chat:42"}}'}</text>
      </g>
      <SizeBadge x={20} label="42 bytes" color={C.json} />

      {/* Protobuf panel */}
      <g transform="translate(370, 48)">
        <rect width="330" height="78" rx="10" fill="#1a221b" stroke={C.pb} strokeWidth="1.4" />
        <text x="16" y="24" fontSize="12.5" fontWeight="bold" fill={C.pb} fontFamily="system-ui, sans-serif">Protobuf</text>
        <text x="314" y="24" fontSize="10.5" fill={C.muted} textAnchor="end" fontFamily="system-ui, sans-serif">binary · compact · fast</text>
      </g>
      {/* hex cells (drawn in root coords for clarity) */}
      {BYTES.map((b, i) => {
        const x = pbStartX + i * CELL;
        return (
          <g key={i}>
            <rect x={x} y={96} width={CELL - 3} height="22" rx="3" fill="#23242b" stroke={GROUP_COLOR[b.g]} strokeWidth="1" />
            <text x={x + (CELL - 3) / 2} y={111} fontSize="9.5" fill={GROUP_COLOR[b.g]} textAnchor="middle" fontFamily="monospace">{b.hex}</text>
          </g>
        );
      })}
      <SizeBadge x={370} label="13 bytes" color={C.pb} />

      {/* legend for the byte groups */}
      <g fontFamily="system-ui, sans-serif" fontSize="10">
        <rect x={488} y={154} width="10" height="10" rx="2" fill={C.id} />
        <text x={502} y={163} fill={C.muted}>id</text>
        <rect x={528} y={154} width="10" height="10" rx="2" fill={C.muted} />
        <text x={542} y={163} fill={C.muted}>field tags / length</text>
        <rect x={648} y={154} width="10" height="10" rx="2" fill={C.pb} />
        <text x={662} y={163} fill={C.muted}>“chat:42”</text>
      </g>

      <text x="360" y="198" fontSize="11" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        Identical meaning — JSON is simply more convenient, Protobuf is more compact on the wire.
      </text>
    </svg>
  );
}
