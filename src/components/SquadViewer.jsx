import React, { useState } from 'react';
import { getRoleBadgeClass } from '../utils/gameLogic.js';
import { formatCrore, PURSE_TOTAL, getTeamById } from '../data/teams.js';
import TeamBadge from './TeamBadge.jsx';
import PurseBar from './PurseBar.jsx';
import PurseSparkline from './PurseSparkline.jsx';

const ROLES = ['All', 'Batter', 'Bowler', 'WK-Batter', 'All-Rounder'];

export default function SquadViewer({ teamState, onClose, allTeams = false, allTeamStates = {}, onFinishAuction = null }) {
  const [activeRole, setActiveRole] = useState('All');
  const [selectedTeam, setSelectedTeam] = useState(teamState?.id || null);

  const currentState = allTeams ? allTeamStates[selectedTeam] : teamState;
  const squad = currentState?.squad || [];
  const filtered = activeRole === 'All' ? squad : squad.filter(p => p.role === activeRole);

  const roleCounts = ROLES.slice(1).reduce((acc, r) => {
    acc[r] = squad.filter(p => p.role === r).length;
    return acc;
  }, {});

  const overseas = squad.filter(p => p.isOverseas).length;
  const spent = PURSE_TOTAL - (currentState?.purse || PURSE_TOTAL);
  const team = getTeamById(selectedTeam);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxHeight: '90vh', borderRadius: '14px 14px 0 0' }} onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 20px' }} />

        {/* Team selector if allTeams mode */}
        {allTeams && (
          <div style={{ marginBottom: 16, overflowX: 'auto', display: 'flex', gap: 8, paddingBottom: 4 }}>
            {Object.keys(allTeamStates).map(tid => (
              <button
                key={tid}
                onClick={() => setSelectedTeam(tid)}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 6, border: `1px solid ${selectedTeam === tid ? 'var(--gold)' : 'var(--border)'}`,
                  background: selectedTeam === tid ? 'rgba(212,175,55,0.1)' : 'var(--bg-raised)',
                  cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.06em',
                  color: selectedTeam === tid ? 'var(--gold)' : 'var(--text-secondary)',
                }}
              >
                {getTeamById(tid)?.short || tid.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {team && <TeamBadge teamId={team.id} size={40} />}
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.06em', color: team?.color || 'var(--gold)', lineHeight: 1 }}>
              {team?.short || 'Squad'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{squad.length} players · {overseas} overseas</div>
          </div>
          <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Close
          </button>
        </div>

        {/* Purse + Sparkline */}
        {currentState && (
          <div style={{ marginBottom: 16 }}>
            <PurseBar purse={currentState.purse} />
            {currentState.purseHistory?.length > 1 && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 8 }}>Purse Burn Rate</div>
                <PurseSparkline purseHistory={currentState.purseHistory} color={team?.color || 'var(--gold)'} width={200} height={40} />
              </div>
            )}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {Object.entries(roleCounts).map(([role, count]) => (
            <div key={role} className="stat-pill">
              <div className="stat-pill-value">{count}</div>
              <div className="stat-pill-label">{role === 'WK-Batter' ? 'WK' : role === 'All-Rounder' ? 'AR' : role.slice(0, 3)}</div>
            </div>
          ))}
        </div>

        {/* Role filter tabs */}
        <div className="tab-bar" style={{ marginBottom: 14 }}>
          {ROLES.map(r => (
            <button key={r} className={`tab-item ${activeRole === r ? 'active' : ''}`} onClick={() => setActiveRole(r)}>
              {r === 'All' ? `All (${squad.length})` : r === 'WK-Batter' ? 'WK' : r === 'All-Rounder' ? 'AR' : r.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Player list */}
        <div className="scroll-panel" style={{ maxHeight: 320, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No players in this category yet
            </div>
          ) : filtered.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                  <span className={`badge ${getRoleBadgeClass(p.role)}`}>{p.role}</span>
                  {p.isOverseas && <span className="badge badge-overseas">OS</span>}
                  {p.source === 'retention' && <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>RETAINED</span>}
                  {p.source === 'rtm' && <span style={{ fontSize: 10, color: 'var(--purple)', letterSpacing: '0.08em' }}>RTM</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gold)', fontWeight: 600 }}>{formatCrore(p.soldPrice)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Paid</div>
              </div>
            </div>
          ))}
        </div>

        {/* Total spent */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total Spent</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--crimson-bright)', fontWeight: 700 }}>{formatCrore(spent)}</span>
        </div>

        {/* Finish Auction button — shown when my squad has ≥18 players */}
        {onFinishAuction && (
          <button
            className="btn-primary"
            style={{ marginTop: 14, background: 'var(--green)', color: '#000' }}
            onClick={onFinishAuction}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Finish Auction ({squad.length}/18 min)
          </button>
        )}
      </div>
    </div>
  );
}
