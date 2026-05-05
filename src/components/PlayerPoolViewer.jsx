import React, { useState } from 'react';
import { getRoleBadgeClass } from '../utils/gameLogic.js';
import { formatCrore, POOLS } from '../data/teams.js';

export default function PlayerPoolViewer({ players, onClose }) {
  const [activePool, setActivePool] = useState('marquee');
  const [search, setSearch] = useState('');

  const poolPlayers = players.filter(p => {
    if (p.auctioned) return false;
    if (activePool !== 'all' && p.pool !== activePool) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const poolCounts = POOLS.reduce((acc, pool) => {
    acc[pool.id] = players.filter(p => p.pool === pool.id && !p.auctioned).length;
    return acc;
  }, {});

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxHeight: '90vh', borderRadius: '14px 14px 0 0' }} onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 20px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.06em', lineHeight: 1 }}>Player Pool</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{players.filter(p => !p.auctioned).length} players remaining</div>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Search */}
        <input
          className="input-field"
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        {/* Pool tabs - horizontal scroll */}
        <div style={{ overflowX: 'auto', marginBottom: 14, paddingBottom: 4 }}>
          <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
            {POOLS.map(pool => (
              <button
                key={pool.id}
                onClick={() => setActivePool(pool.id)}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                  border: `1px solid ${activePool === pool.id ? 'var(--gold)' : 'var(--border)'}`,
                  background: activePool === pool.id ? 'rgba(212,175,55,0.1)' : 'var(--bg-raised)',
                  color: activePool === pool.id ? 'var(--gold)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {pool.label.replace('Players', '').replace('Indian ', '').replace('Capped ', '').trim()} ({poolCounts[pool.id] || 0})
              </button>
            ))}
          </div>
        </div>

        {/* Pool description */}
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(212,175,55,0.04)', borderRadius: 8, border: '1px solid rgba(212,175,55,0.12)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {POOLS.find(p => p.id === activePool)?.label} — {poolPlayers.length} available
          </div>
        </div>

        {/* Player list */}
        <div className="scroll-panel" style={{ maxHeight: 350, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {poolPlayers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {search ? 'No players match your search' : 'All players in this pool have been auctioned'}
            </div>
          ) : poolPlayers.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                  <span className={`badge ${getRoleBadgeClass(p.role)}`}>{p.role}</span>
                  {p.isOverseas && <span className="badge badge-overseas">Overseas</span>}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{p.nationality}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gold)' }}>{formatCrore(p.basePrice)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>BASE</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}