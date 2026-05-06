import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TEAMS, PURSE_TOTAL, RETENTION_COSTS } from '../data/teams.js';
import { useApp } from '../AppContext.jsx';
import { assignRTMEligibility, initTeamState } from '../utils/gameLogic.js';
import { pickAIRetentions } from '../utils/aiAuction.js';
import { PLAYER_POOL } from '../data/players.js';
import TeamBadge from '../components/TeamBadge.jsx';
import { getTeamById } from '../data/teams.js';

export default function SoloSetup() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [savedAuction, setSavedAuction] = useState(null);

  useEffect(() => {
    // Check for saved auction in localStorage
    const saved = localStorage.getItem('soloAuctionInProgress');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setSavedAuction(data);
        setShowResumeDialog(true);
      } catch (e) {
        localStorage.removeItem('soloAuctionInProgress');
      }
    }
  }, []);

  const handleResume = () => {
    if (!savedAuction) return;
    
    // Restore to sessionStorage
    sessionStorage.setItem('soloMode', 'true');
    sessionStorage.setItem('soloTeamId', savedAuction.teamId);
    sessionStorage.setItem('soloPlayerPool', savedAuction.playerPool);
    sessionStorage.setItem('soloTeamStates', savedAuction.teamStates);
    
    setShowResumeDialog(false);
    
    // Navigate to appropriate page
    if (savedAuction.stage === 'retention') {
      navigate('/solo-retention');
    } else if (savedAuction.stage === 'auction') {
      navigate('/solo-auction');
    }
  };

  const handleStartNew = () => {
    localStorage.removeItem('soloAuctionInProgress');
    setShowResumeDialog(false);
    setSavedAuction(null);
  };

  const handleStart = async () => {
    if (!selectedTeam) { showToast('Select a team', 'error'); return; }
    setLoading(true);

    try {
      setLoadingMsg('Loading player pool...');
      const playerPool = PLAYER_POOL.map(p => ({ ...p }));

      setLoadingMsg('Setting up teams...');
      const playersWithMeta = playerPool.map((p, i) => ({ ...p, auctioned: false, poolOrder: i }));
      const rtmMap = assignRTMEligibility(TEAMS, playersWithMeta);

      const teamStates = {};
      for (const team of TEAMS) {
        const state = initTeamState(team.id);
        state.rtmPlayers = rtmMap[team.id] || [];

        if (team.id !== selectedTeam) {
          const eligible = playersWithMeta.filter(p => state.rtmPlayers.includes(p.id));
          const retained = pickAIRetentions(team.id, eligible, 2);
          let retentionIndex = 0;
          for (const p of retained) {
            const cost = RETENTION_COSTS[retentionIndex] || RETENTION_COSTS[RETENTION_COSTS.length - 1];
            state.purse = Math.max(0, Math.round((state.purse - cost) * 100) / 100);
            state.squad.push({ ...p, soldPrice: cost, source: 'retention' });
            state.retentions.push(p.id);
            retentionIndex++;
          }
        }
        teamStates[team.id] = state;
      }

      const retainedIds = new Set();
      Object.values(teamStates).forEach(ts => ts.retentions.forEach(id => retainedIds.add(id)));
      const availablePool = playersWithMeta.map(p => ({ ...p, auctioned: retainedIds.has(p.id) }));

      setLoadingMsg('Preparing auction...');

      sessionStorage.setItem('soloMode', 'true');
      sessionStorage.setItem('soloTeamId', selectedTeam);
      sessionStorage.setItem('soloPlayerPool', JSON.stringify(availablePool));
      sessionStorage.setItem('soloTeamStates', JSON.stringify(teamStates));

      // Save to localStorage for recovery
      localStorage.setItem('soloAuctionInProgress', JSON.stringify({
        teamId: selectedTeam,
        playerPool: JSON.stringify(availablePool),
        teamStates: JSON.stringify(teamStates),
        stage: 'retention',
        timestamp: Date.now(),
      }));

      navigate('/solo-retention');
    } catch (e) {
      showToast('Setup failed: ' + e.message, 'error');
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-bg-pattern" />
      <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <button className="btn-ghost" style={{ padding: '8px 8px' }} onClick={() => navigate('/')}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <div className="section-title" style={{ fontSize: 24 }}>Solo vs AI</div>
            <div className="section-subtitle">Pick your franchise and face 9 AI teams</div>
          </div>
        </div>

        <div style={{ marginBottom: 20, padding: '14px', background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.18)', borderRadius: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[`Purse: 120 Cr`, `Retention: up to 3 players`, `RTM: 2 cards`, `Max squad: 25`].map(item => (
              <span key={item} style={{ fontSize: 11, background: 'rgba(212,175,55,0.08)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.2)', padding: '3px 8px', borderRadius: 4, fontWeight: 600, letterSpacing: '0.06em' }}>
                {item}
              </span>
            ))}
          </div>
        </div>

        <label className="field-label" style={{ marginBottom: 12 }}>Select Your Franchise</label>

        <div className="team-grid" style={{ marginBottom: 28 }}>
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

        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{loadingMsg || 'Setting up...'}</div>
          </div>
        ) : (
          <button className="btn-primary" onClick={handleStart} disabled={!selectedTeam}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 3l10 5-10 5V3z" fill="currentColor"/>
            </svg>
            Start Auction
          </button>
        )}
      </div>

      {/* Resume Dialog */}
      {showResumeDialog && savedAuction && (() => {
        const team = getTeamById(savedAuction.teamId);
        const stageText = savedAuction.stage === 'retention' ? 'Retention Phase' : 'Auction Phase';
        return (
          <div className="overlay overlay-center" onClick={(e) => e.stopPropagation()}>
            <div className="modal modal-center" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                {team && <TeamBadge teamId={team.id} size={40} />}
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '0.06em', color: team?.color || 'var(--gold)', lineHeight: 1 }}>Auction In Progress</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{team?.short} · {stageText}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                You have an ongoing auction. Would you like to continue where you left off or start a new one?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn-primary" onClick={handleResume}>
                  ▶ Continue Auction
                </button>
                <button className="btn-ghost" style={{ justifyContent: 'center', color: 'var(--crimson-bright)', borderColor: 'rgba(192,57,43,0.3)' }} onClick={handleStartNew}>
                  🔄 Start New Auction
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
