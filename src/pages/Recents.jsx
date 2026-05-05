import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeamById, formatCrore } from '../data/teams.js';
import { getRoleBadgeClass } from '../utils/gameLogic.js';
import TeamBadge from '../components/TeamBadge.jsx';

export default function Recents() {
  const navigate = useNavigate();
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'sold' | 'unsold'

  const recentPlayers = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('soloRecents') || '[]');
    } catch {
      return [];
    }
  }, []);

  const filtered = filter === 'all' ? recentPlayers : recentPlayers.filter(e => e.result === filter);

  const totalSold = recentPlayers.filter(e => e.result === 'sold').length;
  const totalUnsold = recentPlayers.filter(e => e.result === 'unsold').length;
  const totalSpent = recentPlayers
    .filter(e => e.result === 'sold')
    .reduce((sum, e) => sum + (e.price || 0), 0);

  return (
    <div className="page">
      <div className="page-bg-pattern" />
      <div className="container" style={{ paddingTop: 20, paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            className="btn-ghost"
            style={{ padding: '8px 8px', flexShrink: 0 }}
            onClick={() => navigate(-1)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.06em', color: 'var(--text-primary)', lineHeight: 1 }}>Recent Sales</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{recentPlayers.length} player{recentPlayers.length !== 1 ? 's' : ''} auctioned</div>
          </div>
        </div>

        {/* Stats row */}
        {recentPlayers.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
            <div className="stat-pill">
              <div className="stat-pill-value" style={{ color: 'var(--gold)' }}>{totalSold}</div>
              <div className="stat-pill-label">Sold</div>
            </div>
            <div className="stat-pill">
              <div className="stat-pill-value" style={{ color: 'var(--text-muted)' }}>{totalUnsold}</div>
              <div className="stat-pill-label">Unsold</div>
            </div>
            <div className="stat-pill">
              <div className="stat-pill-value" style={{ color: 'var(--green)', fontSize: 13 }}>{formatCrore(Math.round(totalSpent * 100) / 100)}</div>
              <div className="stat-pill-label">Spent</div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        {recentPlayers.length > 0 && (
          <div className="tab-bar" style={{ marginBottom: 16 }}>
            {[['all', 'All'], ['sold', 'Sold'], ['unsold', 'Unsold']].map(([val, label]) => (
              <button key={val} className={`tab-item ${filter === val ? 'active' : ''}`} onClick={() => setFilter(val)}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {recentPlayers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏏</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.06em', marginBottom: 6 }}>No auctions yet</div>
            <div style={{ fontSize: 13 }}>Players will appear here as they are sold or go unsold.</div>
          </div>
        )}

        {/* Player list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((entry, i) => {
            const t = entry.teamId ? getTeamById(entry.teamId) : null;
            const isExpanded = expandedIdx === i;
            return (
              <div
                key={i}
                style={{ background: 'var(--bg-card)', border: `1px solid ${isExpanded ? 'var(--border-bright)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.18s ease' }}
              >
                {/* Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                  {/* Color bar */}
                  <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: entry.result === 'sold' ? (t?.color || 'var(--gold)') : 'rgba(90,85,69,0.5)', flexShrink: 0 }} />

                  {/* Player info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.player.name}
                      </span>
                      <span className={`badge ${getRoleBadgeClass(entry.player.role)}`} style={{ flexShrink: 0 }}>
                        {entry.player.role}
                      </span>
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

                  {/* Bid history toggle */}
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

                {/* Expanded bid history */}
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
                              <span style={{ fontSize: 12, color: isWinningBid ? 'var(--gold)' : 'var(--text-secondary)' }}>
                                {bt?.short || b.teamId}
                              </span>
                              {isWinningBid && entry.result === 'sold' && (
                                <span style={{ fontSize: 10, background: 'rgba(212,175,55,0.12)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.25)', padding: '1px 5px', borderRadius: 3, letterSpacing: '0.08em', fontWeight: 700 }}>
                                  WON
                                </span>
                              )}
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: isWinningBid ? 'var(--gold)' : 'var(--text-muted)' }}>
                              {formatCrore(b.amount)}
                            </span>
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
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>
              No {filter} players yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
