import React, { useState } from 'react';

// Interactive: a client comes back having last seen offset 9 of epoch gWuY.
// Pick a scenario to see what the server finds, the two checks it runs
// (same epoch? no gap in history?), the recovered verdict, and which config
// option governs that outcome.

const C = {
  bg: '#17171b',
  client: '#5b8def',
  ok: '#5bef7b',
  bad: '#fe5e5e',
  epoch: '#f5c451',
  muted: '#888',
  text: '#ccc',
  slot: '#23242b',
};

const SCEN = {
  happy: {
    label: 'Happy path',
    epochOk: true, gapOk: true, recovered: true,
    streamEpoch: 'gWuY',
    strip: [{ t: 'had', off: 9 }, { t: 'rec', off: 10 }, { t: 'rec', off: 11 }, { t: 'rec', off: 12 }],
    explain: 'Same stream, and every publication the client missed (#10–#12) is still in history. Centrifugo replays them in order, deduplicated.',
    config: 'The gap fits within history_size and history_ttl.',
  },
  epoch: {
    label: 'Engine restarted',
    epochOk: false, gapOk: false, recovered: false,
    streamEpoch: 'k3Pp',
    strip: [{ t: 'new', off: 1 }, { t: 'new', off: 2 }, { t: 'new', off: 3 }],
    explain: 'The stream was lost and recreated (e.g. a Memory-engine node restart). Offsets reset and a fresh epoch marks it as a different stream, so the old position is meaningless.',
    config: 'Stream durability follows your engine — Memory loses it on restart, Redis follows Redis persistence.',
  },
  toomany: {
    label: 'Missed too many',
    epochOk: true, gapOk: false, recovered: false,
    streamEpoch: 'gWuY',
    strip: [{ t: 'cut' }, { t: 'new', off: 58 }, { t: 'new', off: 59 }, { t: 'new', off: 60 }],
    explain: 'The client missed more than the window holds, so the earliest missed publications are already gone. Rather than deliver a hole, Centrifugo reports failure.',
    config: 'Bounded by history_size and recovery_max_publication_limit (300 by default).',
  },
  expired: {
    label: 'Away too long',
    epochOk: true, gapOk: false, recovered: false,
    streamEpoch: 'gWuY',
    strip: [{ t: 'empty' }],
    explain: 'The epoch still matches (stream metadata outlives the data), but the publications themselves aged out. Nothing is left to replay.',
    config: 'Bounded by history_ttl; history_meta_ttl keeps the epoch/offset around.',
  },
};

const ORDER = ['happy', 'epoch', 'toomany', 'expired'];

function Cell({ x, item }) {
  const W = 60, H = 42, y = 41;
  if (item.t === 'empty') {
    return (
      <g>
        <rect x={x} y={y} width="250" height={H} rx="7" fill={C.slot} stroke={C.muted} strokeWidth="1" strokeDasharray="5,4" />
        <text x={x + 125} y={y + 26} fontSize="11" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">stream empty — nothing to replay</text>
      </g>
    );
  }
  if (item.t === 'cut') {
    return (
      <g>
        <rect x={x} y={y} width={W} height={H} rx="7" fill={C.slot} stroke={C.bad} strokeWidth="1.2" strokeDasharray="4,3" />
        <text x={x + W / 2} y={y + 19} fontSize="13" fill={C.bad} textAnchor="middle">✂</text>
        <text x={x + W / 2} y={y + 33} fontSize="8" fill={C.bad} textAnchor="middle" fontFamily="system-ui, sans-serif">evicted</text>
      </g>
    );
  }
  const color = item.t === 'had' ? C.client : item.t === 'rec' ? C.ok : C.muted;
  const opacity = item.t === 'had' ? 0.5 : 1;
  return (
    <g opacity={opacity}>
      <rect x={x} y={y} width={W} height={H} rx="7" fill={C.slot} stroke={color} strokeWidth={item.t === 'rec' ? 1.7 : 1.2} strokeDasharray={item.t === 'rec' ? '4,3' : 'none'} />
      <text x={x + W / 2} y={y + 20} fontSize="12" fill={color} textAnchor="middle" fontFamily="monospace" fontWeight="bold">#{item.off}</text>
      <text x={x + W / 2} y={y + 34} fontSize="8" fill={color} textAnchor="middle" fontFamily="system-ui, sans-serif">
        {item.t === 'had' ? 'had' : item.t === 'rec' ? 'replay' : 'new'}
      </text>
    </g>
  );
}

function Check({ label, ok }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 11px', borderRadius: '7px',
      border: `1px solid ${ok ? C.ok : C.bad}`, background: '#1b1d22', fontSize: '12.5px', color: ok ? C.ok : C.bad,
    }}>
      <span style={{ fontWeight: 'bold' }}>{ok ? '✓' : '✗'}</span> {label}
    </span>
  );
}

export default function RecoveryDecisionDiagram() {
  const [key, setKey] = useState('happy');
  const s = SCEN[key];

  return (
    <div style={{ margin: '1.2rem 0' }}>
      {/* scenario buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {ORDER.map((k) => (
          <button
            key={k}
            onClick={() => setKey(k)}
            style={{
              padding: '7px 13px', fontSize: '13px', cursor: 'pointer', borderRadius: '8px',
              border: `1px solid ${key === k ? (SCEN[k].recovered ? C.ok : C.bad) : '#2a2b33'}`,
              background: key === k ? (SCEN[k].recovered ? C.ok : C.bad) : 'transparent',
              color: key === k ? C.bg : C.text, fontWeight: key === k ? 'bold' : 'normal',
            }}
          >{SCEN[k].label}</button>
        ))}
      </div>

      <svg
        viewBox="0 0 720 112"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg }}
      >
        {/* client card */}
        <g transform="translate(16, 22)">
          <rect width="172" height="80" rx="10" fill="#1b1f29" stroke={C.client} strokeWidth="1.4" />
          <text x="14" y="22" fontSize="11.5" fontWeight="bold" fill={C.client} fontFamily="system-ui, sans-serif">client returns</text>
          <text x="14" y="45" fontSize="12" fill={C.text} fontFamily="monospace">last offset: 9</text>
          <text x="14" y="65" fontSize="12" fill={C.text} fontFamily="monospace">epoch: <tspan fill={C.epoch}>gWuY</tspan></text>
        </g>

        {/* stream label + epoch */}
        <text x="210" y="33" fontSize="11" fill={C.muted} fontFamily="system-ui, sans-serif">stream now:</text>
        <text x="704" y="33" fontSize="11" textAnchor="end" fontFamily="monospace"
          fill={s.epochOk ? C.epoch : C.bad}>
          epoch: {s.streamEpoch}{s.epochOk ? '' : ' ✗'}
        </text>

        {/* strip */}
        {s.strip.map((item, i) => (
          <Cell key={i} x={210 + i * 68} item={item} />
        ))}
      </svg>

      {/* checks */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
        <Check label="same epoch (stream intact)" ok={s.epochOk} />
        <Check label="no gap — all missed pubs in history" ok={s.gapOk} />
      </div>

      {/* verdict */}
      <div style={{
        marginTop: '10px', border: `1px solid ${s.recovered ? C.ok : C.bad}`, borderRadius: '10px',
        background: '#1b1c22', padding: '12px 14px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: s.recovered ? C.ok : C.bad, marginBottom: '6px', fontFamily: 'monospace' }}>
          recovered: {String(s.recovered)}
        </div>
        <div style={{ fontSize: '13.5px', color: C.text, lineHeight: 1.55, marginBottom: '6px' }}>{s.explain}</div>
        <div style={{ fontSize: '12.5px', color: C.muted }}>
          <span style={{ color: C.epoch, fontWeight: 'bold' }}>config · </span>{s.config}
        </div>
      </div>
    </div>
  );
}
