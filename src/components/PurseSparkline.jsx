import React from 'react';
import { PURSE_TOTAL, formatCrore } from '../data/teams.js';

export default function PurseSparkline({ purseHistory = [], color = 'var(--gold)', width = 120, height = 36 }) {
  if (!purseHistory || purseHistory.length < 2) return null;

  const max = PURSE_TOTAL;
  const min = 0;
  const pts = purseHistory;
  const n = pts.length;

  const x = (i) => (i / (n - 1)) * width;
  const y = (v) => height - ((v - min) / (max - min)) * height;

  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const fill = `${d} L${width},${height} L0,${height} Z`;

  const latest = pts[pts.length - 1];
  const spent = PURSE_TOTAL - latest;
  const pct = Math.round((spent / PURSE_TOTAL) * 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        {/* Fill area */}
        <path d={fill} fill={color} fillOpacity={0.08} />
        {/* Line */}
        <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Latest dot */}
        <circle cx={x(n - 1)} cy={y(latest)} r="2.5" fill={color} />
      </svg>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color, fontWeight: 600 }}>{formatCrore(latest)}</div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{pct}% spent</div>
      </div>
    </div>
  );
}
