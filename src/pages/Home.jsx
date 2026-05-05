import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeamById } from '../data/teams.js';
import TeamBadge from '../components/TeamBadge.jsx';

export default function Home() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openRouterKey') || '');
  const [showKey, setShowKey] = useState(false);
  const [showTournamentDialog, setShowTournamentDialog] = useState(false);

  // Check for saved tournament
  const savedTournament = (() => {
    try { return JSON.parse(localStorage.getItem('activeTournament') || 'null'); } catch { return null; }
  })();
  const savedTournamentData = (() => {
    try { return JSON.parse(localStorage.getItem('tournamentData') || 'null'); } catch { return null; }
  })();
  const hasSavedTournament = savedTournament && savedTournamentData && savedTournamentData.status !== 'completed';

  const handleTournamentClick = () => {
    if (hasSavedTournament) {
      setShowTournamentDialog(true);
    } else {
      navigate('/tournament-setup');
    }
  };

  const handleResumeTournament = () => {
    // Restore to sessionStorage
    const data = JSON.parse(localStorage.getItem('tournamentData'));
    const states = localStorage.getItem('tournamentTeamStates');
    sessionStorage.setItem('tournamentId', savedTournament.tournamentId);
    sessionStorage.setItem('tournamentTeamId', savedTournament.myTeamId);
    sessionStorage.setItem('tournamentData', JSON.stringify(data));
    if (states) sessionStorage.setItem('tournamentTeamStates', states);
    setShowTournamentDialog(false);
    navigate(`/tournament/${savedTournament.tournamentId}`);
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

      {/* Hero content */}
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        
        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: 48 }} className="anim-scale">
          {/* IPL Bat/Ball icon SVG */}
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
            <img
              src="/IPL_LOGO.png"
              alt="IPL Logo"
              style={{ width: 90, height: 90, objectFit: 'contain', filter: 'drop-shadow(0 0 18px rgba(212,175,55,0.35))' }}
            />
          </div>

          <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.4em', color: 'var(--gold-dim)', marginBottom: 8, textTransform: 'uppercase' }}>
            TATA
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 52, letterSpacing: '0.06em', lineHeight: 0.9, color: 'var(--text-primary)', marginBottom: 4 }}>
            IPL MEGA
          </h1>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 52, letterSpacing: '0.06em', lineHeight: 0.9, color: 'var(--gold)' }}>
            AUCTION
          </h1>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ height: 1, width: 40, background: 'var(--border-bright)' }} />
            <span style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>2026 Edition</span>
            <div style={{ height: 1, width: 40, background: 'var(--border-bright)' }} />
          </div>
        </div>

        {/* Mode selection */}
        <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 14 }} className="anim-slide">
          
          {/* Multiplayer card */}
          <div
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
              borderRadius: 14, padding: '20px 20px', position: 'relative', overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: 'radial-gradient(circle at center, rgba(212,175,55,0.08), transparent 70%)', borderRadius: '0 14px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <circle cx="8" cy="8" r="3" stroke="#D4AF37" strokeWidth="1.5"/>
                  <circle cx="14" cy="8" r="3" stroke="#D4AF37" strokeWidth="1.5"/>
                  <path d="M2 18c0-3 2.5-5 6-5M20 18c0-3-2.5-5-6-5M8 13c1 3 5 3 6 0" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.06em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: 4 }}>Multiplayer</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Create a room with up to 10 players. Each person picks a franchise and bids live against each other.</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 10, background: 'rgba(212,175,55,0.1)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.2)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.08em', fontWeight: 700 }}>2–10 PLAYERS</span>
                  <span style={{ fontSize: 10, background: 'rgba(46,204,113,0.1)', color: 'var(--green)', border: '1px solid rgba(46,204,113,0.2)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.08em', fontWeight: 700 }}>LIVE SYNC</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => navigate('/create')}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: '0.06em', color: 'var(--gold)', transition: 'var(--transition)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.12)'; }}
              >
                + Create Room
              </button>
              <button
                onClick={() => navigate('/join')}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.25)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: '0.06em', color: 'var(--green)', transition: 'var(--transition)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(46,204,113,0.18)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(46,204,113,0.08)'; }}
              >
                → Join Room
              </button>
            </div>
          </div>

          {/* vs AI card */}
          <button
            onClick={() => navigate('/solo')}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '20px 20px', cursor: 'pointer',
              textAlign: 'left', transition: 'var(--transition)', position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--crimson-bright)'; e.currentTarget.style.background = 'rgba(192,57,43,0.04)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: 'radial-gradient(circle at center, rgba(192,57,43,0.06), transparent 70%)', borderRadius: '0 14px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="3" y="3" width="7" height="7" rx="2" stroke="#E74C3C" strokeWidth="1.5"/>
                  <rect x="12" y="3" width="7" height="7" rx="2" stroke="#E74C3C" strokeWidth="1.5" opacity="0.5"/>
                  <rect x="3" y="12" width="7" height="7" rx="2" stroke="#E74C3C" strokeWidth="1.5" opacity="0.5"/>
                  <rect x="12" y="12" width="7" height="7" rx="2" stroke="#E74C3C" strokeWidth="1.5" opacity="0.5"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.06em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: 4 }}>Solo vs AI</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Pick your franchise and go head-to-head against 9 AI-controlled teams in a full Mega Auction.</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 10, background: 'rgba(192,57,43,0.1)', color: 'var(--crimson-bright)', border: '1px solid rgba(192,57,43,0.2)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.08em', fontWeight: 700 }}>10 TEAMS</span>
                  <span style={{ fontSize: 10, background: 'rgba(155,89,182,0.1)', color: '#9B59B6', border: '1px solid rgba(155,89,182,0.2)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.08em', fontWeight: 700 }}>AI POWERED</span>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 4 }}>
                <path d="M6 4l4 4-4 4" stroke="var(--crimson-bright)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>

          {/* Tournament card */}
          <button
            onClick={handleTournamentClick}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '20px 20px', cursor: 'pointer',
              textAlign: 'left', transition: 'var(--transition)', position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#9B59B6'; e.currentTarget.style.background = 'rgba(155,89,182,0.04)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: 'radial-gradient(circle at center, rgba(155,89,182,0.08), transparent 70%)', borderRadius: '0 14px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(155,89,182,0.1)', border: '1px solid rgba(155,89,182,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M11 2l2.5 7.5H21l-6 5 2.5 7.5L11 17l-6 4.5 2.5-7.5-6-5h7.5L11 2z" stroke="#9B59B6" strokeWidth="1.5"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.06em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: 4 }}>Tournament</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Play full Hand Cricket tournament (5 overs, 2 innings) with official 2026 squads against other teams.</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 10, background: 'rgba(155,89,182,0.1)', color: '#9B59B6', border: '1px solid rgba(155,89,182,0.2)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.08em', fontWeight: 700 }}>10 TEAMS</span>
                  <span style={{ fontSize: 10, background: 'rgba(46,204,113,0.1)', color: 'var(--green)', border: '1px solid rgba(46,204,113,0.2)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.08em', fontWeight: 700 }}>HAND CRICKET</span>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 4 }}>
                <path d="M6 4l4 4-4 4" stroke="#9B59B6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>
        </div>

        {/* OpenRouter API Key */}
        <div style={{ width: '100%', maxWidth: 380, marginTop: 20 }} className="anim-slide">
          <div style={{ padding: '14px 16px', background: 'var(--bg-card)', border: `1px solid ${apiKey ? 'rgba(155,89,182,0.35)' : 'var(--border)'}`, borderRadius: 12, transition: 'var(--transition)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="5.5" stroke="#9B59B6" strokeWidth="1.2"/>
                <path d="M6.5 3.5v3.5M6.5 9v.5" stroke="#9B59B6" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9B59B6' }}>AI Features</span>
              {apiKey && <span style={{ fontSize: 10, color: 'var(--green)', marginLeft: 'auto', fontWeight: 600 }}>✓ Active</span>}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                className="input-field"
                type={showKey ? 'text' : 'password'}
                placeholder="OpenRouter API key (sk-or-v1-...)"
                value={apiKey}
                onChange={e => handleKeyChange(e.target.value)}
                autoComplete="off"
                style={{ fontSize: 12, padding: '10px 36px 10px 12px' }}
              />
              <button
                onClick={() => setShowKey(s => !s)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
              >
                {showKey ? (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                    <path d="M1 7.5S3.5 3 7.5 3s6.5 4.5 6.5 4.5S13 12 7.5 12 1 7.5 1 7.5z"/>
                    <circle cx="7.5" cy="7.5" r="1.5"/>
                    <path d="M2 2l11 11"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                    <path d="M1 7.5S3.5 3 7.5 3s6.5 4.5 6.5 4.5S13 12 7.5 12 1 7.5 1 7.5z"/>
                    <circle cx="7.5" cy="7.5" r="1.5"/>
                  </svg>
                )}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 7, lineHeight: 1.5 }}>
              {apiKey ? 'Enables AI player insights during auction.' : 'Optional — enables AI player insights.'}
            </div>
          </div>
        </div>

      </div>

      {/* Tournament resume dialog */}
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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{myTeam?.short} · {completed}/{total} matches played</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                You have an ongoing tournament. Would you like to continue where you left off or start a new one?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn-primary" onClick={handleResumeTournament}>
                  ▶ Continue Tournament
                </button>
                <button className="btn-ghost" style={{ justifyContent: 'center', color: 'var(--crimson-bright)', borderColor: 'rgba(192,57,43,0.3)' }} onClick={handleRestartTournament}>
                  🔄 Start New Tournament
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}