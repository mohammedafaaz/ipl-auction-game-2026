import React, { useState } from 'react';
import { getTeamById, formatCrore } from '../data/teams.js';
import { getRoleBadgeClass } from '../utils/gameLogic.js';
import TeamBadge from './TeamBadge.jsx';

export default function RecentsPanel({ recentPlayers, onClose }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? recentPlayers : recentPlayers.filter(e => e.result === filter);
  const totalSold = recentPlayers.filter(e => e.result === 'sold').length;
  const totalUnsold = recentPlayers.filter(e => e.result === 'unsold').length;
  const totalSpent = recentPlayers.filter(e => e.result === 'sold').reduce((s, e) => s + (e.price || 0), 0);

  return (
    <div className="overlay overlay-center" onClick={onClose}>
      <div className="modal modal-center" style={{ maxWidth: 480, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.06em', color: 'var(--text-primary)', lineHeight: 1 }}>Recent Sales</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{recentPlayers.length} player{recentPlayers.length !== 1 ? 's' : ''} auctioned</div>
          </div>
          <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: 13 }} onClick={onClose}>✕</button>
        </div>

        {/* Stats */}
        {recentPlayers.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12, flexShrink: 0 }}>
            <div className="stat-pill"><div className="stat-pill-value" style={{ color: 'var(--gold)' }}>{totalSold}</div><div className="stat-pill-label">Sold</div></div>
            <div className="stat-pill"><div className="stat-pill-value" style={{ color: 'var(--text-muted)' }}>{totalUnsold}</div><div className="stat-pill-label">Unsold</div></div>
            <div className="stat-pill"><div className="stat-pill-value" style={{ color: 'var(--green)', fontSize: 13 }}>{formatCrore(Math.round(totalSpent * 100) / 100)}</div><div className="stat-pill-label">Spent</div></div>
          </div>
        )}

        {/* Filter tabs */}
        {recentPlayers.length > 0 && (
          <div className="tab-bar" style={{ marginBottom: 12, flexShrink: 0 }}>
            {[['all', 'All'], ['sold', 'Sold'], ['unsold', 'Unsold']].map(([val, label]) => (
              <button key={val} className={`tab-item ${filter === val ? 'active' : ''}`} onClick={() => setFilter(val)}>{label}</button>
            ))}
          </div>
        )}

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recentPlayers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏏</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '0.06em', marginBottom: 4 }}>No auctions yet</div>
              <div style={{ fontSize: 12 }}>Players will appear here as they are sold or go unsold.</div>
            </div>
          )}

          {filtered.map((entry, i) => {
            const t = entry.teamId ? getTeamById(entry.teamId) : null;
            const isExpanded = expandedIdx === i;
            return (
              <div key={i} style={{ background: 'var(--bg-card)', border: `1px solid ${isExpanded ? 'var(--border-bright)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                  <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: entry.result === 'sold' ? (t?.color || 'var(--gold)') : 'rgba(90,85,69,0.5)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.player.name}</span>
                      <span className={`badge ${getRoleBadgeClass(entry.player.role)}`} style={{ flexShrink: 0 }}>{entry.player.role}</span>
                    </div>
                    {entry.result === 'sold' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TeamBadge teamId={entry.teamId} size={16} />
                        <span style={{ fontSize: 11, color: t?.color || 'var(--gold)', fontWeight: 600 }}>{t?.short}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)' }}>{formatCrore(entry.price)}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Unsold</span>
                    )}
                  </div>
                  {entry.bidHistory.length > 0 && (
                    <button
                      className="btn-ghost"
                      style={{ padding: '5px 10px', fontSize: 11, letterSpacing: '0.08em', flexShrink: 0, color: isExpanded ? 'var(--gold)' : 'var(--text-muted)', borderColor: isExpanded ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)' }}
                      onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    >
                      {isExpanded ? 'Hide' : 'Bid History'}
                    </button>
                  )}
                </div>
                {isExpanded && entry.bidHistory.length > 0 && (
                  <div style={{ padding: '0 12px 12px 12px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', margin: '10px 0 8px' }}>
                      Bid History ({entry.bidHistory.length} bid{entry.bidHistory.length !== 1 ? 's' : ''})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[...entry.bidHistory].reverse().map((b, bi) => {
                        const bt = getTeamById(b.teamId);
                        const isWinningBid = bi === entry.bidHistory.length - 1;
                        return (
                          <div key={bi} className={`bid-entry ${isWinningBid ? 'winning' : ''}`}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <TeamBadge teamId={b.teamId} size={18} />
                              <span style={{ fontSize: 12, color: isWinningBid ? 'var(--gold)' : 'var(--text-secondary)' }}>{bt?.short || b.teamId}</span>
                              {isWinningBid && entry.result === 'sold' && (
                                <span style={{ fontSize: 10, background: 'rgba(212,175,55,0.12)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.25)', padding: '1px 5px', borderRadius: 3, letterSpacing: '0.08em', fontWeight: 700 }}>WON</span>
                              )}
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: isWinningBid ? 'var(--gold)' : 'var(--text-muted)' }}>{formatCrore(b.amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && recentPlayers.length > 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>No {filter} players yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
