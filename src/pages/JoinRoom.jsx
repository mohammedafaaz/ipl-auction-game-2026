import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { database } from '../firebase.js';
import { ref, get, set, update } from 'firebase/database';
import { TEAMS } from '../data/teams.js';
import { useApp } from '../AppContext.jsx';

export default function JoinRoom() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useApp();

  const [roomCode, setRoomCode] = useState(searchParams.get('code') || '');
  const [playerName, setPlayerName] = useState('');
  const [step, setStep] = useState(1); // 1: enter code+name, 2: select team
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [joining, setJoining] = useState(false);

  const handleLookup = async () => {
    if (!roomCode.trim() || !playerName.trim()) { showToast('Fill in all fields', 'error'); return; }
    if (!database) { showToast('Firebase not configured', 'error'); return; }

    setLoading(true);
    try {
      const snap = await get(ref(database, `rooms/${roomCode.toUpperCase()}`));
      if (!snap.exists()) { showToast('Room not found', 'error'); setLoading(false); return; }
      const data = snap.val();
      if (data.status !== 'lobby') { showToast('This room has already started', 'error'); setLoading(false); return; }
      const playerCount = Object.keys(data.players || {}).length;
      if (playerCount >= 10) { showToast('Room is full (10 players)', 'error'); setLoading(false); return; }
      setRoomData(data);
      setStep(2);
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!selectedTeam) { showToast('Select a team', 'error'); return; }
    setJoining(true);
    try {
      const playerId = `player_${Date.now()}`;
      const updates = {};
      updates[`rooms/${roomCode}/players/${playerId}`] = {
        id: playerId, name: playerName.trim(), teamId: selectedTeam, isHost: false, joinedAt: Date.now(),
      };
      updates[`rooms/${roomCode}/takenTeams/${selectedTeam}`] = playerId;
      await update(ref(database), updates);
      sessionStorage.setItem('playerId', playerId);
      sessionStorage.setItem('roomCode', roomCode);
      navigate(`/lobby/${roomCode}`);
    } catch (e) {
      showToast('Failed to join: ' + e.message, 'error');
      setJoining(false);
    }
  };

  const takenTeams = roomData?.takenTeams || {};

  return (
    <div className="page">
      <div className="page-bg-pattern" />
      <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <button className="btn-ghost" style={{ padding: '8px 8px' }} onClick={() => step === 2 ? setStep(1) : navigate('/')}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <div className="section-title" style={{ fontSize: 24 }}>Join Room</div>
            <div className="section-subtitle">{step === 1 ? 'Enter room code to join' : 'Select your franchise'}</div>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {[1, 2].map(s => (
            <div key={s} style={{ height: 3, flex: 1, borderRadius: 2, background: step >= s ? 'var(--gold)' : 'var(--border)', transition: 'background 0.3s ease' }} />
          ))}
        </div>

        {step === 1 && (
          <div className="anim-slide">
            <div style={{ marginBottom: 16 }}>
              <label className="field-label">Room Code</label>
              <input
                className="input-field"
                placeholder="IPL-XXXX"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                maxLength={8}
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', fontSize: 18, textAlign: 'center' }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="field-label">Your Name</label>
              <input
                className="input-field"
                placeholder="Enter your name..."
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                maxLength={20}
              />
            </div>
            <button className="btn-primary" onClick={handleLookup} disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Looking up...' : 'Find Room'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="anim-slide">
            <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 4 }}>Joining Room</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--gold)', letterSpacing: '0.15em' }}>{roomCode}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {Object.keys(roomData?.players || {}).length} players already in room
              </div>
            </div>

            <label className="field-label" style={{ marginBottom: 10 }}>Select Your Franchise</label>
            <div className="team-grid" style={{ marginBottom: 24 }}>
              {TEAMS.map(team => {
                const isTaken = !!takenTeams[team.id];
                return (
                  <button
                    key={team.id}
                    className={`team-card ${selectedTeam === team.id ? 'selected' : ''} ${isTaken ? 'taken' : ''}`}
                    onClick={() => !isTaken && setSelectedTeam(selectedTeam === team.id ? null : team.id)}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: `1.5px solid ${team.color}55`, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <img src={team.logo} alt={team.short} style={{ width: 28, height: 28, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.05em', color: isTaken ? 'var(--text-muted)' : selectedTeam === team.id ? team.color : 'var(--text-primary)', lineHeight: 1 }}>{team.short}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button className="btn-primary" onClick={handleJoin} disabled={joining || !selectedTeam}>
              {joining ? <span className="spinner" /> : null}
              {joining ? 'Joining...' : 'Join Auction'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}