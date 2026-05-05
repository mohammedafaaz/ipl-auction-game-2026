import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { database } from '../firebase.js';
import { ref, onValue, off, update } from 'firebase/database';
import { TEAMS, getTeamById } from '../data/teams.js';
import { useApp } from '../AppContext.jsx';
import TeamBadge from '../components/TeamBadge.jsx';
import { assignRTMEligibility, initTeamState } from '../utils/gameLogic.js';
import { POOLS } from '../data/teams.js';
import { PLAYER_POOL } from '../data/players.js';

export default function Lobby() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  const playerId = sessionStorage.getItem('playerId');
  const myPlayer = room?.players?.[playerId];
  const isHost = myPlayer?.isHost;

  useEffect(() => {
    if (!database) {
      showToast('Firebase not configured', 'error');
      navigate('/');
      return;
    }
    const roomRef = ref(database, `rooms/${code}`);
    const unsub = onValue(roomRef, snap => {
      if (!snap.exists()) { showToast('Room not found', 'error'); navigate('/'); return; }
      const data = snap.val();
      setRoom(data);
      setLoading(false);
      // Store players for tournament team selection
      sessionStorage.setItem('roomPlayers', JSON.stringify(data.players || {}));
      if (data.status === 'retention') navigate(`/retention/${code}`);
      if (data.status === 'auction') navigate(`/auction/${code}`);
    });
    return () => off(roomRef);
  }, [code]);

  const copyCode = () => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleStart = async () => {
    if (!isHost) return;
    const players = Object.values(room?.players || {});
    if (players.length < 2) { showToast('Need at least 2 players', 'error'); return; }

    setStarting(true);
    try {
      const playerPool = PLAYER_POOL.map(p => ({ ...p }));
      const playersWithMeta = playerPool.map((p, i) => ({ ...p, auctioned: false, poolOrder: i }));
      const rtmMap = assignRTMEligibility(TEAMS, playersWithMeta);

      // Init team states
      const teamStates = {};
      TEAMS.forEach(t => {
        const state = initTeamState(t.id);
        state.rtmPlayers = rtmMap[t.id] || [];
        teamStates[t.id] = state;
      });

      await update(ref(database, `rooms/${code}`), {
        status: 'retention',
        playerPool: playersWithMeta,
        teamStates,
        rtmMap,
        auction: {
          currentBid: 0,
          leadingTeam: null,
          bidHistory: [],
          timerExpiry: Date.now() + 30000,
          phase: 'bidding',
          soldInfo: null,
        },
      });
    } catch (e) {
      showToast('Failed to start: ' + e.message, 'error');
      setStarting(false);
    }
  };

  const players = Object.values(room?.players || {});
  const takenTeams = room?.takenTeams || {};

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  return (
    <div className="page">
      <div className="page-bg-pattern" />
      <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }} className="anim-scale">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.3em', color: 'var(--text-muted)', marginBottom: 6 }}>AUCTION LOBBY</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <div className="dot-live" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, letterSpacing: '0.15em', color: 'var(--gold)' }}>{code}</span>
            <button
              onClick={copyCode}
              style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: copied ? 'var(--green)' : 'var(--gold)', fontSize: 11 }}
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M2 10V3a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              )}
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{players.length}/10 players joined</div>
        </div>

        {/* Players in room */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 12 }}>Players in Room</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {players.map(p => {
              const team = getTeamById(p.teamId);
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-card)', border: `1px solid ${p.id === playerId ? 'rgba(212,175,55,0.3)' : 'var(--border)'}`, borderRadius: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${team?.color || '#333'}1A`, border: `1.5px solid ${team?.color || '#333'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: team?.color || 'var(--text-muted)', letterSpacing: '0.04em' }}>
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: p.id === playerId ? 'var(--gold)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {p.name}
                      {p.isHost && <span style={{ fontSize: 9, background: 'rgba(212,175,55,0.15)', color: 'var(--gold)', padding: '1px 5px', borderRadius: 3, letterSpacing: '0.1em', fontWeight: 700 }}>HOST</span>}
                      {p.id === playerId && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>(you)</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{team?.name || 'Unknown'}</div>
                  </div>
                  {team && (
                    <TeamBadge teamId={team.id} size={32} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Available teams */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10 }}>
            Available Teams ({TEAMS.filter(t => !takenTeams[t.id]).length} remaining)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TEAMS.filter(t => !takenTeams[t.id]).map(team => (
              <span key={team.id} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                {team.short}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            Remaining teams will be AI-controlled
          </div>
        </div>

        {/* Info */}
        <div style={{ marginBottom: 24, padding: '14px', background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Starting the auction will begin the <strong style={{ color: 'var(--gold)' }}>Retention Phase</strong> — each team selects up to 3 players to retain before bidding begins.
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {['Retention cost: 16Cr / 12Cr / 8Cr per slot', 'Total purse: 120Cr (retention costs deducted)', 'RTM cards: 2 per team', 'Timer: 30s base, resets to 15s on new bid'].map(item => (
              <div key={item} style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="6" cy="6" r="5" fill="rgba(212,175,55,0.15)"/>
                  <path d="M3.5 6l2 2 3-3" stroke="var(--gold)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {item}
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button className="btn-primary" onClick={handleStart} disabled={starting || players.length < 2}>
            {starting ? <span className="spinner" /> : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 3l10 5-10 5V3z" fill="currentColor"/>
              </svg>
            )}
            {starting ? 'Starting...' : 'Start Auction'}
          </button>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div className="spinner" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Waiting for host to start...</div>
          </div>
        )}
      </div>
    </div>
  );
}