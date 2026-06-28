// Reusable interactive controls shared by the Redis Pub/Sub scaling widgets.
// Pure (no window access) so they render fine under Docusaurus SSR.
import React from 'react';
import './redisviz.css';

export function Card({ title, subtitle, right, children, style }) {
  return (
    <div className="rv-card" style={style}>
      {(title || right) && (
        <div className="rv-head">
          <div>
            {title && <div className="rv-title">{title}</div>}
            {subtitle && <div className="rv-subtitle">{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, accent = '#5bef7b', format }) {
  const shown = format ? format(value) : value;
  return (
    <div className="rv-control" style={{ '--rv-accent': accent }}>
      <div className="rv-control-head">
        <span className="rv-control-label">{label}</span>
        <span className="rv-control-value" style={{ color: accent }}>{shown}</span>
      </div>
      <input
        className="rv-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--rv-accent': accent }}
      />
    </div>
  );
}

export function Toggle({ options, value, onChange, accent = '#5bef7b' }) {
  return (
    <div className="rv-toggle" style={{ '--rv-accent': accent }}>
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const lbl = typeof opt === 'string' ? opt : opt.label;
        return (
          <button
            key={val}
            type="button"
            className="rv-toggle-btn"
            data-active={value === val}
            onClick={() => onChange(val)}
          >
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

export function Stat({ label, value, sub, color = 'var(--rv-text)' }) {
  return (
    <div className="rv-stat">
      <div className="rv-stat-label">{label}</div>
      <div className="rv-stat-value" style={{ color }}>{value}</div>
      {sub && <div className="rv-stat-sub">{sub}</div>}
    </div>
  );
}

export function Stats({ children }) {
  return <div className="rv-stats">{children}</div>;
}

// Format an integer with thousands separators without locale surprises.
export function fmt(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
