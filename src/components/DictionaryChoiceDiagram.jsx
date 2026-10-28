import React from 'react';

// Which dictionary a connection is served at connect: the first profile that
// applies decides, and anything without a trained dictionary to give falls
// back to the structure dictionary.

const C = {
  bg: '#17171b',
  command: '#5b8def',
  reply: '#5bef7b',
  accent: '#f5c451',
  muted: '#888',
  text: '#ccc',
  card: '#23242b',
};

const FONT = 'system-ui, sans-serif';

const QUESTIONS = [
  { title: 'Did your backend set a profile?', sub: 'profile claim in the token, or in the connect proxy result' },
  { title: 'Did the client declare a profile?', sub: 'only one that exists and is client-declarable counts' },
  { title: 'Is there a default profile?', sub: 'nominated in the admin UI' },
];

export default function DictionaryChoiceDiagram() {
  const qx = 20;
  const qw = 320;
  const qh = 52;
  const ys = [44, 124, 204];
  const px = 430;
  const pw = 270;
  return (
    <svg
      viewBox="0 0 720 360"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="dict-choice-arr" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <polygon points="0 0, 10 4, 0 8" fill={C.muted} />
        </marker>
        <marker id="dict-choice-arr-yes" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <polygon points="0 0, 10 4, 0 8" fill={C.reply} />
        </marker>
      </defs>

      <text x={qx + qw / 2} y="28" fontSize="12" fontWeight="bold" fill={C.command} textAnchor="middle" fontFamily={FONT}>At connect, in this order</text>

      {QUESTIONS.map((q, i) => (
        <g key={i}>
          <rect x={qx} y={ys[i]} width={qw} height={qh} rx="7" fill={C.card} stroke={C.command} strokeWidth="1.2" />
          <text x={qx + 14} y={ys[i] + 21} fontSize="12" fill={C.text} fontFamily={FONT}>{q.title}</text>
          <text x={qx + 14} y={ys[i] + 39} fontSize="10" fill={C.muted} fontFamily={FONT}>{q.sub}</text>
          <line x1={qx + qw + 4} y1={ys[i] + qh / 2} x2={px - 4} y2={ys[i] + qh / 2} stroke={C.reply} strokeWidth="1.5" markerEnd="url(#dict-choice-arr-yes)" />
          <text x={(qx + qw + px) / 2} y={ys[i] + qh / 2 - 7} fontSize="10" fill={C.reply} textAnchor="middle" fontFamily={FONT}>yes</text>
          <line x1={qx + 40} y1={ys[i] + qh + 2} x2={qx + 40} y2={ys[i] + 80 - 4} stroke={C.muted} strokeWidth="1.4" markerEnd="url(#dict-choice-arr)" />
          <text x={qx + 50} y={ys[i] + qh + 18} fontSize="10" fill={C.muted} fontFamily={FONT}>no</text>
        </g>
      ))}

      {/* fallback */}
      <rect x={qx} y="284" width={qw} height="44" rx="7" fill="#1b1f29" stroke={C.accent} strokeWidth="1.3" />
      <text x={qx + 14} y="303" fontSize="12" fontWeight="bold" fill={C.accent} fontFamily={FONT}>structure dictionary</text>
      <text x={qx + 14} y="320" fontSize="10" fill={C.muted} fontFamily={FONT}>Centrifugo's own protocol, none of your data</text>

      {/* the chosen profile */}
      <rect x={px} y="44" width={pw} height="212" rx="8" fill="#1b1f29" stroke={C.reply} strokeWidth="1.3" />
      <text x={px + 16} y="70" fontSize="12" fontWeight="bold" fill={C.reply} fontFamily={FONT}>that profile's active version</text>
      <text x={px + 16} y="96" fontSize="10.5" fill={C.text} fontFamily={FONT}>a dictionary trained on that profile's</text>
      <text x={px + 16} y="114" fontSize="10.5" fill={C.text} fontFamily={FONT}>traffic, activated by an operator</text>
      <text x={px + 16} y="146" fontSize="10.5" fill={C.text} fontFamily={FONT}>every version holds two: one for JSON</text>
      <text x={px + 16} y="164" fontSize="10.5" fill={C.text} fontFamily={FONT}>connections, one for Protobuf</text>
      <line x1={px + 16} y1="190" x2={px + pw - 16} y2="190" stroke="#2c2f3a" />
      <text x={px + 16} y="212" fontSize="10" fill={C.muted} fontFamily={FONT}>no active version yet, or left out of a</text>
      <text x={px + 16} y="228" fontSize="10" fill={C.muted} fontFamily={FONT}>staged rollout: the structure dictionary</text>
      <path d={`M ${px + pw / 2} 258 L ${px + pw / 2} 306 L ${qx + qw + 6} 306`} fill="none" stroke={C.muted} strokeWidth="1.4" strokeDasharray="4 3" markerEnd="url(#dict-choice-arr)" />

      <text x="360" y="350" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily={FONT}>
        Protobuf connections never get the structure dictionary: where it would apply, they keep permessage-deflate, if on.
      </text>
    </svg>
  );
}
