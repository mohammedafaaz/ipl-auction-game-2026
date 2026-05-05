import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { database } from '../firebase.js';
import { ref, onValue, off, update } from 'firebase/database';
import { RETENTION_COSTS, MAX_RETENTIONS, formatCrore, getTeamById } from '../data/teams.js';
import { useApp } from '../AppContext.jsx';
import { applyRetention, initTeamState } from '../utils/gameLogic.js';
import TeamBadge from '../components/TeamBadge.jsx';
import PurseBar from '../components/PurseBar.jsx';

export default function Retention() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { showToast } = useApp();

  const isSolo = sessionStorage.getItem('soloMode') === 'true';
  const soloTeamId = sessionStorage.getItem('soloTeamId');

  const [room, setRoom] = useState(null);
  const [teamState, setTeamState] = useState(null);
  const [playerPool, setPlayerPool] = useState([]);
  const [selected, setSelected] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const playerId = sessionStorage.getItem('playerId');

  // Solo mode setup
  useEffect(() => {
    if (!isSolo) return;
    const pool = JSON.parse(sessionStorage.getItem('soloPlayerPool') || '[]');
    const states = JSON.parse(sessionStorage.getItem('soloTeamStates') || '{}');
    setPlayerPool(pool);
    setTeamState(states[soloTeamId] || initTeamState(soloTeamId));
  }, [isSolo, soloTeamId]);

  // Multiplayer mode setup
  useEffect(() => {
    if (isSolo || !database || !code) return;
    const roomRef = ref(database, `rooms/${code}`);
    const unsub = onValue(roomRef, snap => {
      if (!snap.exists()) { navigate('/'); return; }
      const data = snap.val();
      setRoom(data);
      setPlayerPool(data.playerPool || []);
      const myTeamId = data.players?.[playerId]?.teamId;
      if (myTeamId && data.teamStates?.[myTeamId]) {
        setTeamState(data.teamStates[myTeamId]);
      }
      if (data.status === 'auction') navigate(`/auction/${code}`);

      // Host auto-advances to auction once all human players confirmed
      const players = Object.values(data.players || {});
      const myPlayer = data.players?.[playerId];
      if (myPlayer?.isHost && data.retentionDone) {
        const allDone = players.every(p => data.retentionDone[p.id]);
        if (allDone) {
          update(ref(database, `rooms/${code}`), { status: 'auction' });
        }
      }
    });
    return () => off(roomRef);
  }, [code, isSolo]);

  const myTeamId = isSolo ? soloTeamId : room?.players?.[playerId]?.teamId;
  const team = getTeamById(myTeamId);
  const eligiblePlayers = playerPool.filter(p => teamState?.rtmPlayers?.includes(p.id) && !p.auctioned);

  const toggleSelect = (player) => {
    if (confirmed) return;
    if (selected.find(s => s.id === player.id)) {
      setSelected(prev => prev.filter(s => s.id !== player.id));
    } else {
      if (selected.length >= MAX_RETENTIONS) { showToast(`Max ${MAX_RETENTIONS} retentions allowed`, 'error'); return; }
      const cost = RETENTION_COSTS[selected.length];
      if (teamState.purse < cost) { showToast('Not enough purse for this retention', 'error'); return; }
      setSelected(prev => [...prev, player]);
    }
  };

  const retentionCost = selected.reduce((sum, _, i) => sum + (RETENTION_COSTS[i] || 0), 0);
  const purseAfter = (teamState?.purse || 0) - retentionCost;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      if (isSolo) {
        const states = JSON.parse(sessionStorage.getItem('soloTeamStates') || '{}');
        let state = states[soloTeamId];
        selected.forEach((p, i) => { state = applyRetention(state, p, i); });
        states[soloTeamId] = state;

        // Mark retained players as auctioned in pool
        const retainedIds = new Set(selected.map(p => p.id));
        const updatedPool = playerPool.map(p => retainedIds.has(p.id) ? { ...p, auctioned: true } : p);

        sessionStorage.setItem('soloTeamStates', JSON.stringify(states));
        sessionStorage.setItem('soloPlayerPool', JSON.stringify(updatedPool));
        setConfirmed(true);
        showToast('Retentions confirmed!', 'success');
        setTimeout(() => navigate('/solo-auction'), 1200);
      } else {
        const myTeamId = room?.players?.[playerId]?.teamId;
        const updates = {};
        let state = { ...room.teamStates[myTeamId] };
        selected.forEach((p, i) => { state = applyRetention(state, p, i); });
        updates[`rooms/${code}/teamStates/${myTeamId}`] = state;
        updates[`rooms/${code}/retentionDone/${playerId}`] = true;

        // Mark retained players
        const retainedIds = new Set(selected.map(p => p.id));
        const updatedPool = playerPool.map(p => retainedIds.has(p.id) ? { ...p, auctioned: true } : p);
        updates[`rooms/${code}/playerPool`] = updatedPool;

        await update(ref(database), updates);
        setConfirmed(true);
        showToast('Retentions confirmed!', 'success');
      }
    } catch (e) {
      showToast('Failed to confirm: ' + e.message, 'error');
    }
    setConfirming(false);
  };

  if (!teamState) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  return (
    <div className="page">
      <div className="page-bg-pattern" />
      <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          {team && <TeamBadge teamId={team.id} size={40} />}
          <div>
            <div className="section-title" style={{ fontSize: 22, color: team?.color }}>{team?.short}</div>
            <div className="section-subtitle">Retention Phase — pick up to {MAX_RETENTIONS} players</div>
          </div>
        </div>

        {/* Purse */}
        <div style={{ marginBottom: 20, padding: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <PurseBar purse={purseAfter} />
          {retentionCost > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--crimson-bright)' }}>
              Retention cost: {formatCrore(retentionCost)} deducted
            </div>
          )}
        </div>

        {/* Retention slots */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10 }}>
            Retention Slots
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {RETENTION_COSTS.map((cost, i) => (
              <div key={i} style={{ flex: 1, padding: '10px 8px', background: selected[i] ? 'rgba(212,175,55,0.08)' : 'var(--bg-card)', border: `1px solid ${selected[i] ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Slot {i + 1}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--crimson-bright)', marginBottom: 4 }}>-{formatCrore(cost)}</div>
                {selected[i] ? (
                  <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected[i].name.split(' ')[0]}</div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Empty</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Eligible players */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10 }}>
            Eligible Players ({eligiblePlayers.length})
          </div>

          {eligiblePlayers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No players eligible for retention
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {eligiblePlayers.map(p => {
                const isSelected = !!selected.find(s => s.id === p.id);
                const slotIndex = selected.findIndex(s => s.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleSelect(p)}
                    disabled={confirmed}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      background: isSelected ? 'rgba(212,175,55,0.06)' : 'var(--bg-card)',
                      border: `1px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                      borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'var(--transition)',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: isSelected ? 'var(--gold)' : 'var(--text-primary)' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.role} · {p.nationality}</div>
                    </div>
                    {isSelected && (
                      <div style={{ fontSize: 11, color: 'var(--crimson-bright)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        -{formatCrore(RETENTION_COSTS[slotIndex])}
                      </div>
                    )}
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`, background: isSelected ? 'rgba(212,175,55,0.2)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isSelected && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-4" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {confirmed ? (
          <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.25)', borderRadius: 10 }}>
            <div style={{ fontSize: 14, color: 'var(--green)', fontWeight: 600 }}>✓ Retentions confirmed! Proceeding to auction...</div>
          </div>
        ) : (
          <button className="btn-primary" onClick={handleConfirm} disabled={confirming}>
            {confirming ? <span className="spinner" /> : null}
            {confirming ? 'Confirming...' : `Confirm Retentions (${selected.length}/${MAX_RETENTIONS})`}
          </button>
        )}

        <div style={{ marginTop: 10, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          You can proceed with 0 retentions
        </div>
      </div>
    </div>
  );
}
