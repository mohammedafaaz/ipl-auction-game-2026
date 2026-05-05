import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase.js';
import { ref, set } from 'firebase/database';
import { TEAMS } from '../data/teams.js';
import { useApp } from '../AppContext.jsx';
import { generateSchedule, buildPointsTable } from '../utils/tournament.js';
import { buildSquadTeamStates } from '../data/squadTeamStates.js';
import TeamBadge from '../components/TeamBadge.jsx';

export default function TournamentSetup() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!selectedTeam) { showToast('Select your team', 'error'); return; }
    if (!database) { showToast('Firebase not configured', 'error'); return; }
    setLoading(true);

    try {
      const teamStates = buildSquadTeamStates();
      const teamIds = TEAMS.map(t => t.id);
      const schedule = generateSchedule(teamIds);
      const pointsTable = buildPointsTable(teamIds);
      const tournamentId = `tournament_${Date.now()}`;

      const tournamentData = {
        id: tournamentId,
        myTeamId: selectedTeam,
        mode: 'squad', // squad-based (no auction)
        teamStates,
        schedule,
        pointsTable,
        playoffs: null,
        status: 'group', // group | playoffs | completed
        createdAt: Date.now(),
      };

      // Store squads in sessionStorage for each team
      TEAMS.forEach(team => {
        const teamState = teamStates[team.id];
        if (teamState && teamState.squad) {
          sessionStorage.setItem(`squad_${team.id}`, JSON.stringify(teamState.squad));
        }
      });

      // Try to save to Firebase, but don't fail if permissions denied
      if (database) {
        try {
          await set(ref(database, `tournaments/${tournamentId}`), tournamentData);
        } catch (firebaseError) {
          console.warn('Firebase write failed, using local mode:', firebaseError.message);
          // Continue with local session storage
        }
      }

      sessionStorage.setItem('tournamentId', tournamentId);
      sessionStorage.setItem('tournamentTeamId', selectedTeam);
      sessionStorage.setItem('tournamentData', JSON.stringify(tournamentData));
      sessionStorage.setItem('tournamentTeamStates', JSON.stringify(teamStates));
      // Persist to localStorage so user can resume after leaving
      localStorage.setItem('activeTournament', JSON.stringify({ tournamentId, myTeamId: selectedTeam }));
      localStorage.setItem('tournamentData', JSON.stringify(tournamentData));
      localStorage.setItem('tournamentTeamStates', JSON.stringify(teamStates));
      navigate(`/tournament/${tournamentId}`);
    } catch (e) {
      showToast('Failed to start tournament: ' + e.message, 'error');
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
            <div className="section-title" style={{ fontSize: 24 }}>IPL Tournament</div>
            <div className="section-subtitle">Play with official 2026 squads — no auction needed</div>
          </div>
        </div>

        {/* Info banner */}
        <div style={{ marginBottom: 24, padding: '14px', background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.18)', borderRadius: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['45 matches', 'Round-robin', 'Top 4 playoffs', 'Hand Cricket', 'Points table + NRR'].map(item => (
              <span key={item} style={{ fontSize: 11, background: 'rgba(212,175,55,0.08)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.2)', padding: '3px 8px', borderRadius: 4, fontWeight: 600, letterSpacing: '0.06em' }}>
                {item}
              </span>
            ))}
          </div>
        </div>

        <label className="field-label" style={{ marginBottom: 12 }}>Select Your Franchise</label>

        <div className="team-grid" style={{ marginBottom: 32 }}>
          {TEAMS.map(team => (
            <button
              key={team.id}
              className={`team-card ${selectedTeam === team.id ? 'selected' : ''}`}
              onClick={() => setSelectedTeam(selectedTeam === team.id ? null : team.id)}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: `1.5px solid ${team.color}55`, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src={team.logo} alt={team.short} style={{ width: 28, height: 28, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.05em', color: selectedTeam === team.id ? team.color : 'var(--text-primary)', lineHeight: 1 }}>{team.short}</div>
              {selectedTeam === team.id && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                  <circle cx="7" cy="7" r="6" fill="var(--gold)" fillOpacity="0.2" stroke="var(--gold)" strokeWidth="1.2"/>
                  <path d="M4.5 7l2 2 3-3" stroke="var(--gold)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Generating schedule...</div>
          </div>
        ) : (
          <button className="btn-primary" onClick={handleStart} disabled={!selectedTeam}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 3l10 5-10 5V3z" fill="currentColor"/>
            </svg>
            Start Tournament
          </button>
        )}
      </div>
    </div>
  );
}
