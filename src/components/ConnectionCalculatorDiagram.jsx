import React, { useState } from 'react';
import { Card, Slider, Stat, Stats, fmt } from './redisviz/controls';
import { C } from './redisviz/theme';

// Interactive connection-count calculator. Mirrors the post's arithmetic:
// per-partition fan-out = nodes × partitions, node-grouped = nodes × redisNodes.
// Both share a pipeline-connection multiplier. The reduction factor is exactly
// partitions / redisNodes, which is why grouping by node is the lever that
// bites at fleet scale.

const MAXCLIENTS = 10000; // Redis default `maxclients`, used as a comfort gauge.

function perNodeColor(perNode) {
  if (perNode > MAXCLIENTS * 0.8) return C.hot; // crowding the default ceiling
  if (perNode > MAXCLIENTS * 0.2) return C.amber; // getting warm
  return C.green;
}

export default function ConnectionCalculatorDiagram() {
  const [nodes, setNodes] = useState(200);
  const [partitions, setPartitions] = useState(128);
  const [redisNodes, setRedisNodes] = useState(6);
  const [pipe, setPipe] = useState(1);

  const ppTotal = nodes * partitions * pipe;
  const ngTotal = nodes * redisNodes * pipe;
  const ppPerNode = ppTotal / redisNodes;
  const ngPerNode = ngTotal / redisNodes;
  const reduction = partitions / redisNodes;

  // node-grouped bar width as a fraction of the per-partition bar
  const ngFrac = ngTotal / ppTotal;

  const Bar = ({ name, color, total, frac, perNode }) => {
    const pct = Math.max(frac * 100, 1.2);
    const labelInside = pct > 38;
    return (
      <div className="rv-bar-row">
        <span className="rv-bar-name" style={{ color }}>{name}</span>
        <div className="rv-bar-track">
          <div className="rv-bar-fill" style={{ width: `${pct}%`, background: color }} />
          <span
            className="rv-bar-value"
            style={{
              left: labelInside ? `calc(${pct}% - 8px)` : `calc(${pct}% + 8px)`,
              transform: labelInside ? 'translate(-100%, -50%)' : 'translateY(-50%)',
              color: labelInside ? '#11140f' : color,
            }}
          >
            {fmt(total)} conns
          </span>
        </div>
      </div>
    );
  };

  return (
    <Card
      title="Connections into the cluster: per-partition vs node-grouped"
      subtitle="A connection per partition multiplies by every subscriber node. Grouping subscriptions by the Redis node that owns the slots collapses that count."
    >
      <div className="rv-controls">
        <Slider label="Subscriber nodes" value={nodes} min={10} max={400} step={10}
          onChange={setNodes} accent={C.blue} format={fmt} />
        <Slider label="Partitions" value={partitions} min={64} max={1024} step={64}
          onChange={setPartitions} accent={C.hot} format={fmt} />
        <Slider label="Redis nodes (cluster)" value={redisNodes} min={3} max={24} step={1}
          onChange={setRedisNodes} accent={C.amber} />
        <Slider label="Pipeline conns / target" value={pipe} min={1} max={4} step={1}
          onChange={setPipe} accent={C.green} />
      </div>

      <div className="rv-bars">
        <Bar name="Per-partition" color={C.hot} total={ppTotal} frac={1} perNode={ppPerNode} />
        <Bar name="Node-grouped" color={C.green} total={ngTotal} frac={ngFrac} perNode={ngPerNode} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 14px' }}>
        <span className="rv-reduce">
          <b>{reduction >= 10 ? Math.round(reduction) : reduction.toFixed(1)}×</b>
          fewer connections
        </span>
      </div>

      <Stats>
        <Stat
          label="Per-partition · per Redis node"
          value={fmt(ppPerNode)}
          color={perNodeColor(ppPerNode)}
          sub={ppPerNode > MAXCLIENTS ? `over Redis maxclients (${fmt(MAXCLIENTS)})` : `vs maxclients ${fmt(MAXCLIENTS)}`}
        />
        <Stat
          label="Node-grouped · per Redis node"
          value={fmt(ngPerNode)}
          color={perNodeColor(ngPerNode)}
          sub={`= subscriber nodes × pipeline conns`}
        />
      </Stats>

      <div className="rv-caption">
        <span className="rv-formula">
          <span className="rv-chip" style={{ color: C.hot }}>{fmt(nodes)} nodes</span>
          <span className="rv-eq">×</span>
          <span className="rv-chip" style={{ color: C.hot }}>{fmt(partitions)} partitions</span>
          {pipe > 1 && <><span className="rv-eq">×</span><span className="rv-chip">{pipe} pipe</span></>}
          <span className="rv-eq">=</span>
          <span className="rv-chip" style={{ color: C.hot }}>{fmt(ppTotal)}</span>
          <span className="rv-eq" style={{ margin: '0 6px' }}>→ group by node →</span>
          <span className="rv-chip" style={{ color: C.green }}>{fmt(nodes)} × {redisNodes}{pipe > 1 ? ` × ${pipe}` : ''} = {fmt(ngTotal)}</span>
        </span>
        <div style={{ marginTop: 8 }}>
          Node-grouped connections don't depend on the partition count — drag <b style={{ color: C.hot }}>Partitions</b> and only
          the red bar moves. That's what lets the partition count rise for finer slot balance without adding any connections.
        </div>
      </div>
    </Card>
  );
}
