import React, { useState } from 'react';
import { Card, Slider, Toggle, fmt } from './redisviz/controls';
import { C } from './redisviz/theme';
import { TOTAL_SLOTS } from './redisviz/redisMath';

// Resubscribe-storm command counter. On reconnect a subscriber node replays all
// its subscriptions. This mirrors the centrifuge implementation: channels are
// grouped by partition, each partition's channels are chunked to
// redisSubscribeBatchLimit (512) and one SSUBSCRIBE is sent per chunk
// (redis_sharded_subscribe.go). So commands to a Redis node =
// sum over owned partitions of ceil(channelsInPartition / 512).
//
// Partitions concentrate a node's channels into a handful of slots, so a
// reconnecting node fires ~(partitions per node) commands at each Redis node.
// Without partitions the same channels scatter across the ~2731 raw slots that
// node owns, needing far more commands. The bars show that gap at the chosen
// load. (Only if one subscriber node held millions of channels would every
// partition overflow the 512-batch and the two counts converge — far beyond
// any realistic per-node load, so we keep the slider in the realistic range.)

const BATCH = 512;
const PARTITION_OPTS = [128, 256, 512, 1024];

// SSUBSCRIBE commands to one Redis node to resubscribe `ch` channels spread
// over `groups` slots, batched at BATCH channels per command (even spread).
function commands(ch, groups) {
  if (ch <= 0) return 0;
  if (ch <= groups) return Math.round(ch); // each channel its own slot → 1 cmd
  return groups * Math.ceil(ch / groups / BATCH);
}

// log slider helpers — realistic range: 1k .. 2M channels held per subscriber node
const LO = 3, HI = 6.3; // log10  (10^6.3 ≈ 2M)
const toCh = (val) => Math.round(Math.pow(10, LO + (val / 1000) * (HI - LO)));
const toT = (ch) => ((Math.log10(ch) - LO) / (HI - LO)) * 1000;

function fmtCh(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k';
  return String(n);
}

export default function ResubscribeStormDiagram() {
  const [t, setT] = useState(Math.round(toT(20000)));
  const [partitions, setPartitions] = useState(128);
  const [redisNodes, setRedisNodes] = useState(6);

  const chPerSub = toCh(t);
  const chPerRedis = chPerSub / redisNodes; // channels on one Redis node
  const groupsP = Math.round(partitions / redisNodes);
  const groupsSlots = Math.round(TOTAL_SLOTS / redisNodes);

  const partCmds = commands(chPerRedis, groupsP);
  const rawCmds = commands(chPerRedis, groupsSlots);
  const ratio = rawCmds / Math.max(partCmds, 1);
  const partFrac = Math.max((partCmds / Math.max(rawCmds, 1)) * 100, 1.4);

  const Bar = ({ name, sub, color, value, frac }) => {
    const pct = Math.max(frac, 1.4);
    const inside = pct > 40;
    return (
      <div className="rv-bar-row">
        <span className="rv-bar-name" style={{ color }}>
          {name}
          <span style={{ display: 'block', fontSize: 9.5, color: C.muted, fontWeight: 400 }}>{sub}</span>
        </span>
        <div className="rv-bar-track">
          <div className="rv-bar-fill" style={{ width: `${pct}%`, background: color }} />
          <span className="rv-bar-value" style={{
            left: inside ? `calc(${pct}% - 8px)` : `calc(${pct}% + 8px)`,
            transform: inside ? 'translate(-100%, -50%)' : 'translateY(-50%)',
            color: inside ? '#11140f' : color,
          }}>{fmt(value)} cmds</span>
        </div>
      </div>
    );
  };

  return (
    <Card
      title="Reconnect storm: SSUBSCRIBE commands per Redis node"
      subtitle="When a node reconnects it replays every subscription. Channels are resubscribed per partition, batched 512 at a time — so partitions turn a node's whole subscription set into a handful of fat commands instead of thousands."
      right={
        <Toggle
          options={PARTITION_OPTS.map((p) => ({ value: p, label: `${p}` }))}
          value={partitions}
          onChange={setPartitions}
          accent={C.green}
        />
      }
    >
      <div className="rv-controls">
        <Slider label="Channels per subscriber node" value={t} min={0} max={1000} step={1}
          onChange={setT} accent={C.blue} format={() => fmtCh(chPerSub)} />
        <Slider label="Redis cluster nodes" value={redisNodes} min={3} max={24} step={1}
          onChange={setRedisNodes} accent={C.amber} />
      </div>

      {/* commands a reconnecting node sends to ONE Redis node at this load */}
      <div className="rv-bars">
        <Bar name="Raw slots" sub={`channels scatter over ~${fmt(groupsSlots)} slots`} color={C.hot} value={rawCmds} frac={100} />
        <Bar name="Partitioned" sub={`channels land on ~${groupsP} partition-slots`} color={C.green} value={partCmds} frac={partFrac} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 4px' }}>
        <span className="rv-reduce">
          <b>{ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}×</b>
          {ratio < 1.4 ? 'commands (few channels per node)' : 'fewer SSUBSCRIBE commands'}
        </span>
      </div>

      <div className="rv-caption">
        On reconnect the node groups its channels by partition and sends one <span className="rv-mono">SSUBSCRIBE</span> per partition (chunked at
        {' '}{BATCH}). A node owns ~{groupsP} partitions, so a reconnect is on the order of ~{groupsP} commands per Redis node — climbing only once a
        single partition holds more than {BATCH} channels. Drop partitions and those channels scatter across the ~{fmt(groupsSlots)} raw slots the node
        owns, so the same resubscribe needs many times more commands. Across a whole fleet reconnecting at once, every command lands on each Redis node,
        times every subscriber node — so keeping the count low matters most exactly when the cluster is busy recovering.
      </div>
    </Card>
  );
}
