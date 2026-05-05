import React from 'react';
import { getRoleBadgeClass } from '../utils/gameLogic.js';
import { formatCrore } from '../data/teams.js';

export default function PlayerCard({ player, compact = false }) {
  if (!player) return null;

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.name}</div>
          <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
            <span className={`badge ${getRoleBadgeClass(player.role)}`}>{player.role}</span>
            {player.isOverseas && <span className="badge badge-overseas">OS</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gold)' }}>{formatCrore(player.basePrice)}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>BASE</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 14, padding: '20px 18px', position: 'relative', overflow: 'hidden' }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '80%', height: 60, background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.08), transparent 70%)', pointerEvents: 'none' }} />

      {/* Pool chip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span className="pool-chip">{player.pool?.replace(/_/g, ' ')}</span>
        {player.isOverseas && <span className="badge badge-overseas">Overseas</span>}
      </div>

      {/* Player name + base price on same row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '0.04em', color: 'var(--text-primary)', lineHeight: 1, flex: 1, minWidth: 0 }}>
          {player.name}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, paddingTop: 4 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--text-secondary)', fontWeight: 600 }}>{formatCrore(player.basePrice)}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>Base</div>
        </div>
      </div>

      {/* Role + nationality */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <span className={`badge ${getRoleBadgeClass(player.role)}`}>{player.role}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{player.nationality}</span>
        {player.isCapped && <span style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.08em', fontWeight: 600 }}>CAPPED</span>}
      </div>

      {/* Stats */}
      {player.stats && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, borderLeft: '2px solid var(--gold-dim)' }}>
          {player.stats}
        </div>
      )}
    </div>
  );
}
