import React, { useState } from 'react';
import { Card, Slider, Stat, Stats } from './redisviz/controls';
import { C, tint } from './redisviz/theme';

// Why pipelining wins. Redis runs a single PUBLISH/SUBSCRIBE in microseconds;
// the cost that dominates is the network round trip (RTT). Doing commands one
// by one means K full round trips. Pipelining streams them out back-to-back so
// one round trip carries them all: total ~= RTT + K*exec instead of K*RTT.
//
// The packet animation is pure CSS. Every dot shares one CYCLE-long animation
// and the same two keyframes (rv-pipe-cmd / rv-pipe-reply); only the per-dot
// animation-delay (computed from K and RTT) differs. Equal durations make the
// delays a constant phase offset, so the whole picture loops in lockstep with
// no JS timers — safe under SSR. prefers-reduced-motion freezes a clear frame.

const EXEC = 0.005; // per-command server work, ms (~5µs) — tiny next to RTT
const FLUSH = 0.1; // rueidis MaxFlushDelay, ms (~100µs) — marks a batch end

// Wall-clock pacing of the loop (seconds). The one-by-one lane always takes
// ACTIVE seconds; the pipelined lane finishes proportionally sooner, so the
// gap you see is exactly the speedup.
const ACTIVE = 13.2;
const PAUSE = 3.2;
const CYCLE = ACTIVE + PAUSE;

function fmtTime(ms) {
  if (ms >= 10) return `${ms.toFixed(1)} ms`;
  if (ms >= 1) return `${ms.toFixed(2)} ms`;
  return `${Math.round(ms * 1000)} µs`;
}

export default function PipeliningLatencyDiagram() {
  const [k, setK] = useState(8);
  const [rtt, setRtt] = useState(1.0);

  const oneByOne = k * (rtt + EXEC); // ~ K * RTT
  const pipelined = rtt + k * EXEC + FLUSH; // ~ one RTT
  const speedup = oneByOne / pipelined;

  // ---- wall-clock timing for the animation (derived from K and RTT) ----
  const pairWall = ACTIVE / k; // wall seconds for one round trip
  const halfWall = pairWall / 2; // one network leg
  const wallScale = ACTIVE / (k * rtt); // seconds per model-ms
  const flushWall = FLUSH * wallScale;
  const burstGap = Math.min(pairWall * 0.06, 0.05); // visual spacing of a burst
  const P = (halfWall / CYCLE) * 100; // % of the cycle spent travelling

  // One-by-one: command i, then its reply, then command i+1 ...
  const oboPackets = [];
  for (let i = 0; i < k; i++) {
    oboPackets.push({ type: 'cmd', delay: i * pairWall, restLeft: '34%', restOp: i === 0 ? 1 : 0 });
    oboPackets.push({ type: 'reply', delay: i * pairWall + halfWall, restLeft: '64%', restOp: i === 0 ? 1 : 0 });
  }

  // Pipelined: all commands stream out together, replies stream back ~1 RTT later.
  const pipePackets = [];
  const spread = k > 1 ? 84 / (k - 1) : 0;
  for (let i = 0; i < k; i++) {
    pipePackets.push({ type: 'cmd', delay: i * burstGap, restLeft: `${8 + i * spread}%`, restOp: 1 });
    pipePackets.push({ type: 'reply', delay: pairWall + flushWall + i * burstGap, restLeft: `${8 + i * spread}%`, restOp: 0 });
  }

  const Lane = ({ accent, title, sub, trips, tripColor, packets }) => (
    <div className="rv-pipe-lane">
      <div className="rv-pipe-lane-head">
        <span className="rv-pipe-lane-title" style={{ color: accent }}>{title}</span>
        <span className="rv-pipe-trips" style={{ color: tripColor, borderColor: tint(tripColor, 0.45), background: tint(tripColor, 0.1) }}>{trips}</span>
      </div>
      <div className="rv-pipe-track">
        <div className="rv-pipe-wire">
          <div className="rv-pipe-rail cmd" />
          <div className="rv-pipe-rail reply" />
          {/* endpoints are slim bars at the very ends of the wire, so a packet
              emerges from the client and merges into redis — no stray circle */}
          <span className="rv-pipe-endbar" style={{ left: '0%', background: C.blue }} />
          <span className="rv-pipe-endbar" style={{ left: '100%', background: C.amber }} />
          <span className="rv-pipe-endlabel client" style={{ color: C.blue }}>client</span>
          <span className="rv-pipe-endlabel redis" style={{ color: C.amber }}>redis</span>
          {packets.map((p, i) => (
            <span
              key={i}
              className={`rv-pipe-dot ${p.type}`}
              style={{
                animationName: p.type === 'cmd' ? 'rv-pipe-cmd' : 'rv-pipe-reply',
                animationDuration: `${CYCLE}s`,
                animationDelay: `${p.delay.toFixed(3)}s`,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
                background: p.type === 'cmd' ? accent : tint(accent, 0.5),
                boxShadow: p.type === 'cmd' ? `0 0 7px ${tint(accent, 0.55)}` : 'none',
                border: p.type === 'reply' ? `1px solid ${tint(accent, 0.7)}` : 'none',
                '--rest-left': p.restLeft,
                '--rest-op': p.restOp,
              }}
            />
          ))}
        </div>
      </div>
      <div className="rv-pipe-lane-sub">{sub}</div>
    </div>
  );

  const greenFrac = Math.max((pipelined / oneByOne) * 100, 1.4);
  const greenInside = greenFrac > 30;

  return (
    <Card
      title="Why pipelining wins: one round-trip vs many"
      subtitle="Redis runs each PUBLISH/SUBSCRIBE in microseconds. The cost that dominates is the network round trip — so sending commands one at a time means you mostly wait."
    >
      <style>{`
        /* Packet stays fully opaque for the whole leg so it reaches the far
           end visible; it only blinks out once it has arrived (after P%). */
        @keyframes rv-pipe-cmd {
          0%   { left: 0%;   opacity: 1; }
          ${P.toFixed(3)}%  { left: 100%; opacity: 1; }
          ${(P + 0.01).toFixed(3)}% { left: 100%; opacity: 0; }
          100% { left: 100%; opacity: 0; }
        }
        @keyframes rv-pipe-reply {
          0%   { left: 100%; opacity: 1; }
          ${P.toFixed(3)}%  { left: 0%; opacity: 1; }
          ${(P + 0.01).toFixed(3)}% { left: 0%; opacity: 0; }
          100% { left: 0%; opacity: 0; }
        }
        .rv-pipe-lane { margin: 2px 0 4px; }
        .rv-pipe-lane + .rv-pipe-lane { margin-top: 14px; }
        .rv-pipe-lane-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
        .rv-pipe-lane-title { font-size: 12.5px; font-weight: 650; }
        .rv-pipe-lane-sub { margin-top: 16px; font-size: 11.5px; color: ${C.muted}; line-height: 1.5; }
        .rv-pipe-trips { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; border: 1px solid; white-space: nowrap; }
        .rv-pipe-track { position: relative; padding: 4px 8px 18px; }
        .rv-pipe-wire { position: relative; height: 50px; margin: 0 14px; }
        .rv-pipe-rail { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed ${C.border}; }
        .rv-pipe-rail.cmd { top: 34%; }
        .rv-pipe-rail.reply { top: 66%; }
        .rv-pipe-endbar { position: absolute; top: 50%; width: 3px; height: 36px; border-radius: 2px; transform: translate(-50%, -50%); }
        .rv-pipe-endlabel { position: absolute; top: calc(100% + 5px); font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; white-space: nowrap; transform: translateX(-50%); }
        .rv-pipe-endlabel.client { left: 0; }
        .rv-pipe-endlabel.redis { left: 100%; }
        .rv-pipe-dot { position: absolute; left: 0; opacity: 0; transform: translate(-50%, -50%); will-change: left, opacity; }
        .rv-pipe-dot.cmd { width: 11px; height: 11px; border-radius: 50%; top: 34%; }
        .rv-pipe-dot.reply { width: 9px; height: 9px; border-radius: 3px; top: 66%; }
        @media (prefers-reduced-motion: reduce) {
          .rv-pipe-dot { animation: none !important; left: var(--rest-left, 50%) !important; opacity: var(--rest-op, 1) !important; }
        }
      `}</style>

      <div className="rv-controls">
        <Slider label="Commands (K)" value={k} min={2} max={32} step={1}
          onChange={setK} accent={C.hot} />
        <Slider label="Round-trip time (RTT)" value={rtt} min={0.2} max={10} step={0.1}
          onChange={setRtt} accent={C.amber} format={(v) => `${v.toFixed(1)} ms`} />
      </div>

      <Lane
        accent={C.hot}
        title="One by one"
        trips={`${k} round trips`}
        tripColor={C.hot}
        sub="Send a command, wait for the reply, then send the next. Almost all the time is spent waiting on the wire."
        packets={oboPackets}
      />
      <Lane
        accent={C.green}
        title="Pipelined"
        trips="1 round trip"
        tripColor={C.green}
        sub="All commands stream out back-to-back; replies come back together about one round trip later."
        packets={pipePackets}
      />

      <div className="rv-bars" style={{ marginTop: 18 }}>
        <div className="rv-bar-row">
          <span className="rv-bar-name" style={{ color: C.hot }}>One by one</span>
          <div className="rv-bar-track">
            <div className="rv-bar-fill" style={{ width: '100%', background: C.hot }} />
            <span className="rv-bar-value" style={{ left: 'calc(100% - 8px)', transform: 'translate(-100%, -50%)', color: '#11140f' }}>{fmtTime(oneByOne)}</span>
          </div>
        </div>
        <div className="rv-bar-row">
          <span className="rv-bar-name" style={{ color: C.green }}>Pipelined</span>
          <div className="rv-bar-track">
            <div className="rv-bar-fill" style={{ width: `${greenFrac}%`, background: C.green }} />
            <span
              className="rv-bar-value"
              style={{
                left: greenInside ? `calc(${greenFrac}% - 8px)` : `calc(${greenFrac}% + 8px)`,
                transform: greenInside ? 'translate(-100%, -50%)' : 'translateY(-50%)',
                color: greenInside ? '#11140f' : C.green,
              }}
            >{fmtTime(pipelined)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 14px' }}>
        <span className="rv-reduce">
          <b>{speedup >= 10 ? Math.round(speedup) : speedup.toFixed(1)}×</b>
          faster on the wire
        </span>
      </div>

      <Stats>
        <Stat label="One by one" value={fmtTime(oneByOne)} color={C.hot} sub="≈ K × RTT" />
        <Stat label="Pipelined" value={fmtTime(pipelined)} color={C.green} sub="≈ 1 RTT + K × exec" />
        <Stat label="Speedup" value={`${speedup >= 10 ? Math.round(speedup) : speedup.toFixed(1)}×`} color={C.green} sub="fewer round trips paid" />
      </Stats>

      <div className="rv-caption">
        The <span className="rv-mono">rueidis</span> Go client batches commands issued close together: they leave in one write, with a small flush
        delay (<span className="rv-mono">MaxFlushDelay</span>, ~100µs) marking where a batch ends. One round trip then carries many commands, which also
        cuts CPU on both the client and the Redis side. Server work per command (~5µs here) stays tiny next to the RTT — that gap is the whole point.
      </div>
    </Card>
  );
}
