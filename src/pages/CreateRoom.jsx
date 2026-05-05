import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase.js';
import { ref, set, onValue, off } from 'firebase/database';
import { TEAMS } from '../data/teams.js';
import { generateRoomCode } from '../utils/gameLogic.js';
import { useApp } from '../AppContext.jsx';
import TeamBadge from '../components/TeamBadge.jsx';

export default function CreateRoom() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [playerName, setPlayerName] = useState('');
  const [roomCode] = useState(generateRoomCode);
  const [creating, setCreating] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  const handleCreate = async () => {
    if (!playerName.trim()) { showToast('Enter your name', 'error'); return; }
    if (!selectedTeam) { showToast('Select a team', 'error'); return; }
    if (!database) { showToast('Firebase not configured. Please set up Firebase in src/firebase.js', 'error'); return; }

    setCreating(true);
    try {
      const hostId = `host_${Date.now()}`;
      const roomData = {
        code: roomCode,
        hostId,
        status: 'lobby', // lobby | retention | auction | ended
        createdAt: Date.now(),
        players: {
          [hostId]: {
            id: hostId,
            name: playerName.trim(),
            teamId: selectedTeam,
            isHost: true,
            joinedAt: Date.now(),
          }
        },
        takenTeams: { [selectedTeam]: hostId },
        playerPool: null,
        teamStates: null,
        auction: null,
      };

      await set(ref(database, `rooms/${roomCode}`), roomData);
      sessionStorage.setItem('playerId', hostId);
      sessionStorage.setItem('roomCode', roomCode);
      navigate(`/lobby/${roomCode}`);
    } catch (e) {
      showToast('Failed to create room: ' + e.message, 'error');
      setCreating(false);
    }
  };

  return (
    <div className="page">
      <div className="page-bg-pattern" />
      <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <button className="btn-ghost" style={{ padding: '8px 8px' }} onClick={() => navigate('/')}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <div className="section-title" style={{ fontSize: 24 }}>Create Room</div>
            <div className="section-subtitle">Host a multiplayer auction</div>
          </div>
        </div>

        {/* Room code display */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 12, padding: 16, marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 8 }}>Your Room Code</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, letterSpacing: '0.15em', color: 'var(--gold)', lineHeight: 1 }}>{roomCode}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Share this with friends to join</div>
        </div>

        {/* Name input */}
        <div style={{ marginBottom: 20 }}>
          <label className="field-label">Your Name</label>
          <input
            className="input-field"
            placeholder="Enter your name..."
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            maxLength={20}
          />
        </div>

        {/* Team selection */}
        <div style={{ marginBottom: 28 }}>
          <label className="field-label">Select Your Franchise</label>
          <div className="team-grid">
            {TEAMS.map(team => (
              <button
                key={team.id}
                className={`team-card ${selectedTeam === team.id ? 'selected' : ''}`}
                onClick={() => setSelectedTeam(selectedTeam === team.id ? null : team.id)}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: `1.5px solid ${team.color}55`, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <img src={team.logo} alt={team.short} style={{ width: 28, height: 28, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.05em', color: selectedTeam === team.id ? team.color : 'var(--text-primary)', lineHeight: 1 }}>{team.short}</div>
                </div>
                {selectedTeam === team.id && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <circle cx="7" cy="7" r="6" fill="var(--gold)" fillOpacity="0.2" stroke="var(--gold)" strokeWidth="1.2"/>
                    <path d="M4.5 7l2 2 3-3" stroke="var(--gold)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleCreate}
          disabled={creating || !playerName.trim() || !selectedTeam}
        >
          {creating ? <span className="spinner" /> : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
          {creating ? 'Creating Room...' : 'Create Room'}
        </button>

        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          You will be taken to the lobby after creating
        </div>
      </div>
    </div>
  );
}