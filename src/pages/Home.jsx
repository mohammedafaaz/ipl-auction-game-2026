import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeamById } from '../data/teams.js';
import TeamBadge from '../components/TeamBadge.jsx';
import { database } from '../firebase.js';
import { ref, get } from 'firebase/database';

export default function Home() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openRouterKey') || '');
  const [showKey, setShowKey] = useState(false);
  const [showTournamentDialog, setShowTournamentDialog] = useState(false);
  const [showSoloAuctionDialog, setShowSoloAuctionDialog] = useState(false);
  const [showMultiplayerAuctionDialog, setShowMultiplayerAuctionDialog] = useState(false);
  const [savedSoloAuction, setSavedSoloAuction] = useState(null);
  const [savedMultiplayerAuction, setSavedMultiplayerAuction] = useState(null);

  useEffect(() => {
    const soloSaved = localStorage.getItem('soloAuctionInProgress');
    if (soloSaved) {
      try {
        setSavedSoloAuction(JSON.parse(soloSaved));
      } catch (e) {
        localStorage.removeItem('soloAuctionInProgress');
      }
    }
    const multiSaved = localStorage.getItem('multiplayerAuctionInProgress');
    if (multiSaved) {
      try {
        setSavedMultiplayerAuction(JSON.parse(multiSaved));
      } catch (e) {
        localStorage.removeItem('multiplayerAuctionInProgress');
      }
    }
  }, []);

  const savedTournament = (() => {
    try { return JSON.parse(localStorage.getItem('activeTournament') || 'null'); } catch { return null; }
  })();
  const savedTournamentData = (() => {
    try { return JSON.parse(localStorage.getItem('tournamentData') || 'null'); } catch { return null; }
  })();
  const hasSavedTournament = savedTournament && savedTournamentData && savedTournamentData.status !== 'completed';

  const handleSoloClick = () => savedSoloAuction ? setShowSoloAuctionDialog(true) : navigate('/solo');

  const handleResumeSoloAuction = () => {
    if (!savedSoloAuction) return;
    sessionStorage.setItem('soloMode', 'true');
    sessionStorage.setItem('soloTeamId', savedSoloAuction.teamId);
    sessionStorage.setItem('soloPlayerPool', savedSoloAuction.playerPool);
    sessionStorage.setItem('soloTeamStates', savedSoloAuction.teamStates);
    setShowSoloAuctionDialog(false);
    navigate(savedSoloAuction.stage === 'retention' ? '/solo-retention' : '/solo-auction');
  };

  const handleStartNewSoloAuction = () => {
    localStorage.removeItem('soloAuctionInProgress');
    setShowSoloAuctionDialog(false);
    setSavedSoloAuction(null);
    navigate('/solo');
  };

  const handleResumeMultiplayerAuction = async () => {
    if (!savedMultiplayerAuction || !database) return;
    try {
      const snap = await get(ref(database, `rooms/${savedMultiplayerAuction.roomCode}`));
      if (!snap.exists()) {
        localStorage.removeItem('multiplayerAuctionInProgress');
        setShowMultiplayerAuctionDialog(false);
        alert('Room no longer exists');
        return;
      }
      const roomData = snap.val();
      sessionStorage.setItem('playerId', savedMultiplayerAuction.playerId);
      sessionStorage.setItem('roomCode', savedMultiplayerAuction.roomCode);
      setShowMultiplayerAuctionDialog(false);
      const routes = { lobby: '/lobby/', retention: '/retention/', auction: '/auction/', ended: '/final/' };
      navigate((routes[roomData.status] || '/') + savedMultiplayerAuction.roomCode);
    } catch (e) {
      alert('Failed to rejoin: ' + e.message);
    }
  };

  const handleStartNewMultiplayerAuction = () => {
    localStorage.removeItem('multiplayerAuctionInProgress');
    setShowMultiplayerAuctionDialog(false);
    setSavedMultiplayerAuction(null);
  };

  const handleTournamentClick = () => {
    if (hasSavedTournament) {
      setShowTournamentDialog(true);
    } else {
      navigate('/tournament-setup');
    }
  };

  const handleResumeTournament = () => {
    const data = JSON.parse(localStorage.getItem('tournamentData'));
    const states = localStorage.getItem('tournamentTeamStates');
    sessionStorage.setItem('tournamentId', savedTournament.tournamentId);
    sessionStorage.setItem('tournamentTeamId', savedTournament.myTeamId);
    sessionStorage.setItem('tournamentData', JSON.stringify(data));
    if (states) sessionStorage.setItem('tournamentTeamStates', states);
    setShowTournamentDialog(false);
    navigate(`/pre-squad-tournament/${savedTournament.tournamentId}`);
  };

  const handleRestartTournament = () => {
    localStorage.removeItem('activeTournament');
    localStorage.removeItem('tournamentData');
    localStorage.removeItem('tournamentTeamStates');
    setShowTournamentDialog(false);
    navigate('/tournament-setup');
  };

  const handleKeyChange = (val) => {
    setApiKey(val);
    if (val.trim()) {
      localStorage.setItem('openRouterKey', val.trim());
      sessionStorage.setItem('openRouterKey', val.trim());
    } else {
      localStorage.removeItem('openRouterKey');
      sessionStorage.removeItem('openRouterKey');
    }
  };

  return (
    <div className="page">
      <div className="page-bg-pattern" />

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }} className="anim-scale">
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <img src="/IPL_LOGO.png" alt="IPL Logo" style={{ width: 80, height: 80, objectFit: 'contain', filter: 'drop-shadow(0 0 16px rgba(212,175,55,0.3))' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.35em', color: 'var(--gold-dim)', marginBottom: 6, textTransform: 'uppercase' }}>TATA</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 44, letterSpacing: '0.06em', lineHeight: 1, color: 'var(--text-primary)', marginBottom: 2 }}>IPL MEGA AUCTION</h1>
          <div style={{ marginTop: 10, fontSize: 10, letterSpacing: '0.18em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>2026 Edition</div>
        </div>

        {/* Main Content */}
        <div style={{ width: '100%', maxWidth: 420 }} className="anim-slide">

          {/* Section: Auction Modes */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1l1.5 4.5h4.5l-3.5 2.5 1.5 4.5L7 10l-3.5 2.5 1.5-4.5-3.5-2.5h4.5L7 1z" stroke="var(--gold)" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
              Auction Modes
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              
              {/* Multiplayer */}
              <div style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 12, position: 'relative' }}>
                {savedMultiplayerAuction && (
                  <div style={{ position: 'absolute', top: 10, right: 10, width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 8px var(--gold)', animation: 'pulse 2s infinite' }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <circle cx="6" cy="6" r="2.5" stroke="#D4AF37" strokeWidth="1.3"/>
                      <circle cx="12" cy="6" r="2.5" stroke="#D4AF37" strokeWidth="1.3"/>
                      <path d="M2 15c0-2.5 2-4 4-4M16 15c0-2.5-2-4-4-4M6 11c.8 2.5 4.2 2.5 5 0" stroke="#D4AF37" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: '0.05em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: 3 }}>Multiplayer Auction</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>2-10 players • Live sync</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => savedMultiplayerAuction ? setShowMultiplayerAuctionDialog(true) : navigate('/create')} className="btn-ghost" style={{ flex: 1, padding: '8px', fontSize: 12, justifyContent: 'center', background: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.25)', color: 'var(--gold)' }}>
                    + Create
                  </button>
                  <button onClick={() => navigate('/join')} className="btn-ghost" style={{ flex: 1, padding: '8px', fontSize: 12, justifyContent: 'center', background: 'rgba(46,204,113,0.06)', borderColor: 'rgba(46,204,113,0.2)', color: 'var(--green)' }}>
                    → Join
                  </button>
                </div>
              </div>

              {/* Solo vs AI */}
              <button onClick={handleSoloClick} style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'var(--transition)', position: 'relative' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--crimson-bright)'; e.currentTarget.style.transform = 'translateY(-1px)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                {savedSoloAuction && (
                  <div style={{ position: 'absolute', top: 10, right: 10, width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 8px var(--gold)', animation: 'pulse 2s infinite' }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="#E74C3C" strokeWidth="1.3"/>
                      <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="#E74C3C" strokeWidth="1.3" opacity="0.4"/>
                      <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="#E74C3C" strokeWidth="1.3" opacity="0.4"/>
                      <rect x="10" y="10" width="6" height="6" rx="1.5" stroke="#E74C3C" strokeWidth="1.3" opacity="0.4"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: '0.05em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: 3 }}>Solo vs AI</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>10 teams • AI powered</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3l4 4-4 4" stroke="var(--crimson-bright)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </button>
            </div>
          </div>

          {/* Section: Tournament */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9B59B6', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1l1.5 4.5h4.5l-3.5 2.5 1.5 4.5L7 10l-3.5 2.5 1.5-4.5-3.5-2.5h4.5L7 1z" stroke="#9B59B6" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
              Tournament Mode
            </div>

            <button onClick={handleTournamentClick} style={{ width: '100%', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'var(--transition)', position: 'relative' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#9B59B6'; e.currentTarget.style.transform = 'translateY(-1px)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              {hasSavedTournament && (
                <div style={{ position: 'absolute', top: 10, right: 10, width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 8px var(--gold)', animation: 'pulse 2s infinite' }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(155,89,182,0.1)', border: '1px solid rgba(155,89,182,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6l2-6z" stroke="#9B59B6" strokeWidth="1.3"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: '0.05em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: 3 }}>Hand Cricket Tournament</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Play • Simulate • Playoffs</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 3l4 4-4 4" stroke="#9B59B6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
          </div>

          {/* Section: AI Features */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M7 4v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              AI Features (Optional)
            </div>

            <div style={{ padding: '14px', background: 'var(--bg-card)', border: `1px solid ${apiKey ? 'rgba(155,89,182,0.3)' : 'var(--border)'}`, borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9B59B6' }}>OpenRouter API Key</span>
                {apiKey && <span style={{ fontSize: 10, color: 'var(--green)', marginLeft: 'auto', fontWeight: 600 }}>✓ Active</span>}
              </div>
              <div style={{ position: 'relative' }}>
                <input className="input-field" type={showKey ? 'text' : 'password'} placeholder="sk-or-v1-..." value={apiKey} onChange={e => handleKeyChange(e.target.value)} autoComplete="off" style={{ fontSize: 11, padding: '9px 32px 9px 10px' }} />
                <button onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                    {showKey ? <><path d="M1 7S3 3 7 3s6 4 6 4-2 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.5"/><path d="M2 2l10 10"/></> : <><path d="M1 7S3 3 7 3s6 4 6 4-2 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.5"/></>}
                  </svg>
                </button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                {apiKey ? 'Enables AI player insights during auction' : 'Get AI-powered player insights'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showTournamentDialog && (() => {
        const data = savedTournamentData;
        const myTeam = getTeamById(savedTournament.myTeamId);
        const completed = (data.schedule || []).filter(m => m.status === 'completed').length;
        const total = (data.schedule || []).length;
        return (
          <div className="overlay overlay-center" onClick={() => setShowTournamentDialog(false)}>
            <div className="modal modal-center" style={{ maxWidth: 340 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                {myTeam && <TeamBadge teamId={myTeam.id} size={40} />}
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '0.06em', color: myTeam?.color || 'var(--gold)', lineHeight: 1 }}>Active Tournament</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{myTeam?.short} · {completed}/{total} matches</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                Continue your tournament or start fresh?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn-primary" onClick={handleResumeTournament}>▶ Continue</button>
                <button className="btn-ghost" style={{ justifyContent: 'center', color: 'var(--crimson-bright)', borderColor: 'rgba(192,57,43,0.3)' }} onClick={handleRestartTournament}>🔄 Start New</button>
              </div>
            </div>
          </div>
        );
      })()}

      {showSoloAuctionDialog && savedSoloAuction && (() => {
        const team = getTeamById(savedSoloAuction.teamId);
        return (
          <div className="overlay overlay-center" onClick={() => setShowSoloAuctionDialog(false)}>
            <div className="modal modal-center" style={{ maxWidth: 340 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                {team && <TeamBadge teamId={team.id} size={40} />}
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '0.06em', color: team?.color || 'var(--gold)', lineHeight: 1 }}>Auction In Progress</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{team?.short} · {savedSoloAuction.stage === 'retention' ? 'Retention' : 'Auction'}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                Continue your auction or start fresh?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn-primary" onClick={handleResumeSoloAuction}>▶ Continue</button>
                <button className="btn-ghost" style={{ justifyContent: 'center', color: 'var(--crimson-bright)', borderColor: 'rgba(192,57,43,0.3)' }} onClick={handleStartNewSoloAuction}>🔄 Start New</button>
              </div>
            </div>
          </div>
        );
      })()}

      {showMultiplayerAuctionDialog && savedMultiplayerAuction && (() => {
        const team = getTeamById(savedMultiplayerAuction.teamId);
        return (
          <div className="overlay overlay-center" onClick={() => setShowMultiplayerAuctionDialog(false)}>
            <div className="modal modal-center" style={{ maxWidth: 340 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                {team && <TeamBadge teamId={team.id} size={40} />}
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '0.06em', color: team?.color || 'var(--gold)', lineHeight: 1 }}>Room In Progress</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{savedMultiplayerAuction.roomCode} · {team?.short}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                Rejoin your room or start fresh?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn-primary" onClick={handleResumeMultiplayerAuction}>▶ Rejoin</button>
                <button className="btn-ghost" style={{ justifyContent: 'center', color: 'var(--crimson-bright)', borderColor: 'rgba(192,57,43,0.3)' }} onClick={handleStartNewMultiplayerAuction}>🔄 Start New</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
