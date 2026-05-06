import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase.js';
import { ref, set } from 'firebase/database';
import { TEAMS } from '../data/teams.js';
import { useApp } from '../AppContext.jsx';
import { generateSchedule, buildPointsTable } from '../utils/tournament.js';
import { buildSquadTeamStates } from '../data/squadTeamStates.js';
import TeamBadge from '../components/TeamBadge.jsx';

export default function MultiplayerTournamentSetup() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleToggleTeam = (teamId) => {
    setSelectedTeams(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const handleCreate = async () => {
    if (selectedTeams.length < 2) {
      showToast('Select at least 2 teams', 'error');
      return;
    }
    if (!roomCode.trim()) {
      showToast('Enter a room code', 'error');
      return;
    }
    if (!database) {
      showToast('Firebase not configured', 'error');
      return;
    }

    setLoading(true);

    try {
      const teamStates = buildSquadTeamStates();
      const schedule = generateSchedule(selectedTeams);
      const pointsTable = buildPointsTable(selectedTeams);
      const tournamentId = `mp_tournament_${Date.now()}`;

      const tournamentData = {
        id: tournamentId,
        mode: 'multiplayer',
        roomCode: roomCode.trim().toUpperCase(),
        teamStates,
        schedule,
        pointsTable,
        playoffs: null,
        status: 'group',
        createdAt: Date.now(),
        players: {},
      };

      await set(ref(database, `tournaments/${tournamentId}`), tournamentData);

      sessionStorage.setItem('tournamentId', tournamentId);
      sessionStorage.setItem('multiplayerTournament', 'true');
      navigate(`/tournament/${tournamentId}`);
    } catch (e) {
      showToast('Failed to create tournament: ' + e.message, 'error');
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-bg-pattern" />
      <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button className="btn-ghost" style={{ padding: '8px 8px' }} onClick={() => navigate('/')}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <div className="section-title" style={{ fontSize: 24 }}>Multiplayer Tournament</div>
            <div className="section-subtitle">Create a room-based tournament with friends</div>
          </div>
        </div>

        <div style={{ marginBottom: 24, padding: '14px', background: 'rgba(46,204,113,0.05)', border: '1px solid rgba(46,204,113,0.18)', borderRadius: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Sequential matches', 'No simulation', 'Real-time sync', 'Hand Cricket'].map(item => (
              <span key={item} style={{ fontSize: 11, background: 'rgba(46,204,113,0.08)', color: 'var(--green)', border: '1px solid rgba(46,204,113,0.2)', padding: '3px 8px', borderRadius: 4, fontWeight: 600, letterSpacing: '0.06em' }}>
                {item}
              </span>
            ))}
          </div>
        </div>

        <label className="field-label" style={{ marginBottom: 12 }}>Room Code</label>
        <input
          className="input-field"
          type="text"
          placeholder="Enter room code (e.g., IPL2026)"
          value={roomCode}
          onChange={e => setRoomCode(e.target.value.toUpperCase())}
          style={{ marginBottom: 24 }}
        />

        <label className="field-label" style={{ marginBottom: 12 }}>Select Teams ({selectedTeams.length} selected)</label>

        <div className="team-grid" style={{ marginBottom: 32 }}>
          {TEAMS.map(team => {
            const isSelected = selectedTeams.includes(team.id);
            return (
              <button
                key={team.id}
                className={`team-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleToggleTeam(team.id)}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: `1.5px solid ${team.color}55`, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <img src={team.logo} alt={team.short} style={{ width: 28, height: 28, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.05em', color: isSelected ? team.color : 'var(--text-primary)', lineHeight: 1 }}>{team.short}</div>
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <circle cx="7" cy="7" r="6" fill="var(--gold)" fillOpacity="0.2" stroke="var(--gold)" strokeWidth="1.2"/>
                    <path d="M4.5 7l2 2 3-3" stroke="var(--gold)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Creating tournament...</div>
          </div>
        ) : (
          <button className="btn-primary" onClick={handleCreate} disabled={selectedTeams.length < 2 || !roomCode.trim()}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 3l10 5-10 5V3z" fill="currentColor"/>
            </svg>
            Create Multiplayer Tournament
          </button>
        )}
      </div>
    </div>
  );
}
