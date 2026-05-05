import React from 'react';
import { PURSE_TOTAL, formatCrore } from '../data/teams.js';

export default function PurseBar({ purse, teamId, compact = false }) {
  const pct = Math.max(0, (purse / PURSE_TOTAL) * 100);
  const color = pct > 50 ? 'var(--green)' : pct > 25 ? 'var(--gold)' : 'var(--crimson-bright)';

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color, minWidth: 48, textAlign: 'right' }}>
          {formatCrore(purse)}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 600 }}>Purse Remaining</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color, fontWeight: 600 }}>{formatCrore(purse)}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s ease', boxShadow: `0 0 8px ${color}66` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>0</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatCrore(PURSE_TOTAL)}</span>
      </div>
    </div>
  );
}