import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { database } from '../firebase.js';
import { ref, onValue, off, set } from 'firebase/database';
import { TEAMS, PURSE_TOTAL, formatCrore, getTeamById } from '../data/teams.js';
import { getRoleBadgeClass } from '../utils/gameLogic.js';
import { generateSchedule, buildPointsTable } from '../utils/tournament.js';
import TeamBadge from '../components/TeamBadge.jsx';
import PurseBar from '../components/PurseBar.jsx';

export default function FinalSquads() {
  const { code } = useParams();
  const navigate = useNavigate();

  const isSolo = sessionStorage.getItem('soloMode') === 'true';
  const soloTeamId = sessionStorage.getItem('soloTeamId');
  const playerId = sessionStorage.getItem('playerId');

  const [teamStates, setTeamStates] = useState({});
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [activeRole, setActiveRole] = useState('All');
  const [loading, setLoading] = useState(true);
  const [startingTournament, setStartingTournament] = useState(false);

  const handleStartTournament = async () => {
    setStartingTournament(true);
    // Only use teams that actually participated (joined the room or solo)
    const participatingTeamIds = isSolo
      ? TEAMS.map(t => t.id) // solo uses all 10
      : Object.values(JSON.parse(sessionStorage.getItem('roomPlayers') || '{}')).map(p => p.teamId).filter(Boolean);

    const teamIds = participatingTeamIds.length >= 2 ? participatingTeamIds : TEAMS.map(t => t.id);
    const schedule = generateSchedule(teamIds);
    const pointsTable = buildPointsTable(teamIds);
    const tournamentId = `tournament_${Date.now()}`;
    const resolvedMyTeamId = isSolo ? soloTeamId : selectedTeam;

    const tournamentData = {
      id: tournamentId,
      myTeamId: resolvedMyTeamId,
      mode: 'auction',
      teamStates,
      schedule,
      pointsTable,
      playoffs: null,
      status: 'group',
      createdAt: Date.now(),
    };

    // Save to sessionStorage and localStorage
    sessionStorage.setItem('tournamentId', tournamentId);
    sessionStorage.setItem('tournamentTeamId', resolvedMyTeamId);
    sessionStorage.setItem('tournamentData', JSON.stringify(tournamentData));
    sessionStorage.setItem('tournamentTeamStates', JSON.stringify(teamStates));
    localStorage.setItem('activeTournament', JSON.stringify({ tournamentId, myTeamId: resolvedMyTeamId }));
    localStorage.setItem('tournamentData', JSON.stringify(tournamentData));
    localStorage.setItem('tournamentTeamStates', JSON.stringify(teamStates));

    // Write to Firebase for multiplayer
    if (database) {
      try {
        await set(ref(database, `tournaments/${tournamentId}`), tournamentData);
        // Also update room with tournamentId so all players can navigate
        if (!isSolo && code) {
          await set(ref(database, `rooms/${code}/tournamentId`), tournamentId);
        }
      } catch (e) { console.warn('Firebase write failed:', e.message); }
    }

    setStartingTournament(false);
    navigate(`/post-auction-tournament`);
  };

  useEffect(() => {
    if (isSolo) {
      const states = JSON.parse(sessionStorage.getItem('soloTeamStates') || '{}');
      setTeamStates(states);
      setSelectedTeam(soloTeamId);
      setLoading(false);
      return;
    }
    if (!database || !code) return;
    const roomRef = ref(database, `rooms/${code}`);
    const unsub = onValue(roomRef, snap => {
      if (!snap.exists()) { navigate('/'); return; }
      const data = snap.val();
      setTeamStates(data.teamStates || {});
      const playerId = sessionStorage.getItem('playerId');
      const myTeamId = data.players?.[playerId]?.teamId;
      setSelectedTeam(myTeamId || TEAMS[0].id);
      setLoading(false);
    });
    return () => off(roomRef);
  }, [code, isSolo]);

  const currentState = teamStates[selectedTeam];
  const squad = currentState?.squad || [];
  const filtered = activeRole === 'All' ? squad : squad.filter(p => p.role === activeRole);
  const team = getTeamById(selectedTeam);
  const spent = PURSE_TOTAL - (currentState?.purse || PURSE_TOTAL);
  const overseas = squad.filter(p => p.isOverseas).length;

  const ROLES = ['All', 'Batter', 'WK-Batter', 'All-Rounder', 'Bowler'];

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  return (
    <div className="page">
      <div className="page-bg-pattern" />
      <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.3em', color: 'var(--text-muted)', marginBottom: 6 }}>AUCTION COMPLETE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, letterSpacing: '0.06em', color: 'var(--gold)', lineHeight: 1 }}>FINAL SQUADS</div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ height: 1, width: 40, background: 'var(--border-bright)' }} />
            <span style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>IPL 2026 Mega Auction</span>
            <div style={{ height: 1, width: 40, background: 'var(--border-bright)' }} />
          </div>
        </div>

        {/* Team selector */}
        <div style={{ overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
          <div style={{ display: 'flex', gap: 8, minWidth: 'max-content' }}>
            {TEAMS.map(t => {
              const state = teamStates[t.id];
              const isSelected = selectedTeam === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTeam(t.id); setActiveRole('All'); }}
                  style={{
                    flexShrink: 0, padding: '8px 14px', borderRadius: 8,
                    border: `1px solid ${isSelected ? t.color : 'var(--border)'}`,
                    background: isSelected ? `${t.color}15` : 'var(--bg-card)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'var(--transition)',
                  }}
                >
                  <TeamBadge teamId={t.id} size={24} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.06em', color: isSelected ? t.color : 'var(--text-secondary)', lineHeight: 1 }}>{t.short}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{state?.squad?.length || 0} players</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected team header */}
        {team && currentState && (
          <div style={{ marginBottom: 20, padding: '16px', background: 'var(--bg-card)', border: `1px solid ${team.color}33`, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <TeamBadge teamId={team.id} size={48} />
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.06em', color: team.color, lineHeight: 1 }}>{team.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{squad.length} players · {overseas} overseas · {formatCrore(spent)} spent</div>
              </div>
            </div>
            <PurseBar purse={currentState.purse} />

            {/* Role breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 14 }}>
              {['Batter', 'Bowler', 'All-Rounder', 'WK-Batter'].map(role => (
                <div key={role} className="stat-pill">
                  <div className="stat-pill-value">{squad.filter(p => p.role === role).length}</div>
                  <div className="stat-pill-label">{role === 'WK-Batter' ? 'WK' : role === 'All-Rounder' ? 'AR' : role.slice(0, 3)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Role filter */}
        <div className="tab-bar" style={{ marginBottom: 14 }}>
          {ROLES.map(r => (
            <button key={r} className={`tab-item ${activeRole === r ? 'active' : ''}`} onClick={() => setActiveRole(r)}>
              {r === 'All' ? `All (${squad.length})` : r === 'WK-Batter' ? 'WK' : r === 'All-Rounder' ? 'AR' : r.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Player list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No players in this category
            </div>
          ) : filtered.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-raised)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{i + 1}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                  <span className={`badge ${getRoleBadgeClass(p.role)}`}>{p.role}</span>
                  {p.isOverseas && <span className="badge badge-overseas">OS</span>}
                  {p.source === 'retention' && <span style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.08em', fontWeight: 600 }}>RETAINED</span>}
                  {p.source === 'rtm' && <span style={{ fontSize: 10, color: 'var(--purple)', letterSpacing: '0.08em', fontWeight: 600 }}>RTM</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gold)', fontWeight: 600 }}>{formatCrore(p.soldPrice)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Paid</div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(isSolo || code) && (
            <button
              className="btn-bid"
              onClick={handleStartTournament}
              disabled={startingTournament}
              style={{ background: 'rgba(155,89,182,0.15)', borderColor: 'rgba(155,89,182,0.3)', color: '#9B59B6', opacity: startingTournament ? 0.6 : 1 }}
            >
              {startingTournament ? <span className="spinner" style={{ width: 16, height: 16 }} /> : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
              )}
              {startingTournament ? 'Setting up...' : 'Start Tournament with Auction Squads'}
            </button>
          )}
          <button
            className="btn-primary"
            onClick={() => {
              if (isSolo) {
                sessionStorage.clear();
                navigate('/');
              } else {
                navigate('/');
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2l6 6-6 6M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
