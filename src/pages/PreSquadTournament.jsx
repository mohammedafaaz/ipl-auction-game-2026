import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getTeamById } from '../data/teams.js';
import { sortedTable, applyResultToTable, generatePlayoffs, simulateMatch } from '../utils/tournament.js';
import TeamBadge from '../components/TeamBadge.jsx';

// MODE 1: Pre-Squad Tournament (Default squads, simulate option, parallel matches)
export default function PreSquadTournament() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [tournament, setTournament] = useState(null);
  const [tab, setTab] = useState('schedule');
  const [notification, setNotification] = useState(null);
  const notifTimerRef = useRef(null);

  const myTeamId = sessionStorage.getItem('tournamentTeamId');

  const showNotif = useCallback((message, type = 'info') => {
    clearTimeout(notifTimerRef.current);
    setNotification({ message, type });
    notifTimerRef.current = setTimeout(() => setNotification(null), 4000);
  }, []);

  useEffect(() => {
    const loadTournament = () => {
      // Force clear state first to ensure fresh load
      setTournament(null);
      
      const local = sessionStorage.getItem('tournamentData');
      if (local) {
        const d = JSON.parse(local);
        if (d.schedule && !Array.isArray(d.schedule)) d.schedule = Object.values(d.schedule);
        setTournament(d);
      }
    };
    
    // Small delay to ensure navigation completes
    const timer = setTimeout(loadTournament, 50);
    return () => clearTimeout(timer);
  }, [id, location.key]);

  const handlePlayMatch = useCallback((match) => {
    if (!match.team1 || !match.team2) return;
    sessionStorage.setItem('currentMatchId', String(match.matchNo - 1));
    sessionStorage.setItem('currentMatchTeam1', match.team1);
    sessionStorage.setItem('currentMatchTeam2', match.team2);
    sessionStorage.removeItem('playoffStage');
    navigate(`/hand-cricket/${id}`);
  }, [id, navigate]);

  const handleSimulateMatch = useCallback((match) => {
    const teamStates = JSON.parse(sessionStorage.getItem('tournamentTeamStates') || '{}');
    const result = simulateMatch(match.team1, match.team2, teamStates);
    
    const updatedSchedule = tournament.schedule.map(m =>
      m.id === match.id ? { ...m, status: 'completed', result } : m
    );
    
    const updatedTable = applyResultToTable(tournament.pointsTable, result, match.team1, match.team2);
    
    const updatedTournament = {
      ...tournament,
      schedule: updatedSchedule,
      pointsTable: updatedTable,
    };

    // Check if group stage complete
    const allComplete = updatedSchedule.every(m => m.status === 'completed');
    if (allComplete && tournament.status === 'group') {
      const sorted = sortedTable(updatedTable);
      const top4 = sorted.slice(0, 4).map(r => r.teamId);
      updatedTournament.playoffs = generatePlayoffs(top4);
      updatedTournament.status = 'playoffs';
      showNotif('Group stage complete! Playoffs unlocked 🏆', 'success');
      setTab('playoffs');
    }

    setTournament(updatedTournament);
    sessionStorage.setItem('tournamentData', JSON.stringify(updatedTournament));
    localStorage.setItem('tournamentData', JSON.stringify(updatedTournament));
    
    const winner = getTeamById(result.winner);
    showNotif(`${winner?.short || 'Team'} won Match ${match.matchNo}!`, 'success');
  }, [tournament, showNotif]);

  const handlePlayPlayoff = useCallback((stage, match) => {
    if (!match.team1 || !match.team2) return;
    sessionStorage.setItem('currentMatchId', `playoff_${stage}`);
    sessionStorage.setItem('currentMatchTeam1', match.team1);
    sessionStorage.setItem('currentMatchTeam2', match.team2);
    sessionStorage.setItem('playoffStage', stage);
    navigate(`/hand-cricket/${id}`);
  }, [id, navigate]);

  const handleSimulatePlayoff = useCallback((stage, match) => {
    const teamStates = JSON.parse(sessionStorage.getItem('tournamentTeamStates') || '{}');
    let result = simulateMatch(match.team1, match.team2, teamStates);
    
    // PLAYOFF TIE HANDLING: If tie, rematch until there's a winner
    let attempts = 0;
    while (!result.winner && attempts < 10) {
      result = simulateMatch(match.team1, match.team2, teamStates);
      attempts++;
    }
    // Fallback: if still tied after 10 attempts, pick random winner
    if (!result.winner) {
      result.winner = Math.random() < 0.5 ? match.team1 : match.team2;
    }
    
    const updatedPlayoffs = { ...tournament.playoffs };
    updatedPlayoffs[stage] = { ...match, status: 'completed', result };

    // Advance winners based on correct IPL playoff structure
    if (stage === 'q1') {
      // Q1: 1st vs 2nd
      // Winner goes to Final
      // Loser goes to Q2
      updatedPlayoffs.final.team1 = result.winner;
      updatedPlayoffs.q2.team1 = result.winner === match.team1 ? match.team2 : match.team1;
    } else if (stage === 'elim') {
      // Eliminator: 3rd vs 4th
      // Winner goes to Q2
      updatedPlayoffs.q2.team2 = result.winner;
    } else if (stage === 'q2') {
      // Q2: Q1 loser vs Elim winner
      // Winner goes to Final
      updatedPlayoffs.final.team2 = result.winner;
    } else if (stage === 'final') {
      // Final: Q1 winner vs Q2 winner
      const updatedTournament = {
        ...tournament,
        playoffs: updatedPlayoffs,
        status: 'completed',
        champion: result.winner,
      };
      setTournament(updatedTournament);
      sessionStorage.setItem('tournamentData', JSON.stringify(updatedTournament));
      localStorage.setItem('tournamentData', JSON.stringify(updatedTournament));
      showNotif(`${getTeamById(result.winner)?.short} are IPL 2026 Champions! 🏆`, 'success');
      return;
    }

    const updatedTournament = { ...tournament, playoffs: updatedPlayoffs };
    setTournament(updatedTournament);
    sessionStorage.setItem('tournamentData', JSON.stringify(updatedTournament));
    localStorage.setItem('tournamentData', JSON.stringify(updatedTournament));
    
    const winner = getTeamById(result.winner);
    showNotif(`${winner?.short || 'Team'} won ${stage.toUpperCase()}!`, 'success');
  }, [tournament, showNotif]);

  if (!tournament) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  const participatingTeamIds = Object.keys(tournament.pointsTable || {});
  const table = sortedTable(tournament.pointsTable || {});
  const schedule = tournament.schedule || [];
  const completed = schedule.filter(m => m.status === 'completed');
  const pending = schedule.filter(m => m.status === 'pending');
  const playoffs = tournament.playoffs;
  const isMyMatch = m => m.team1 === myTeamId || m.team2 === myTeamId;

  // Find next unlocked match index - only first pending match is unlocked
  const nextUnlockedIndex = 0;
  const canPlayUserMatch = pending.length > 0 && isMyMatch(pending[0]);

  const qualifyCount = 4;

  return (
    <div className="page">
      <div className="page-bg-pattern" />

      {notification && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, padding: '10px 20px', borderRadius: 10,
          background: notification.type === 'success' ? 'rgba(46,204,113,0.15)' : 'rgba(212,175,55,0.12)',
          border: `1px solid ${notification.type === 'success' ? 'rgba(46,204,113,0.4)' : 'rgba(212,175,55,0.3)'}`,
          color: notification.type === 'success' ? 'var(--green)' : 'var(--gold)',
          fontSize: 13, fontWeight: 600, boxShadow: 'var(--shadow)',
          animation: 'slideUp 0.25s ease',
          maxWidth: 340, textAlign: 'center',
        }}>
          {notification.message}
        </div>
      )}

      <div className="container" style={{ paddingTop: 16, paddingBottom: 48 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {myTeamId && <TeamBadge teamId={myTeamId} size={32} />}
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '0.06em', color: getTeamById(myTeamId)?.color || 'var(--gold)' }}>
                IPL 2026
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {completed.length}/{schedule.length} matches · {participatingTeamIds.length} teams
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {tournament.status === 'completed' && tournament.champion && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8 }}>
                <TeamBadge teamId={tournament.champion} size={20} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--gold)', letterSpacing: '0.06em' }}>CHAMPIONS 🏆</span>
              </div>
            )}
            <button className="btn-ghost" style={{ padding: '6px 8px' }} onClick={() => navigate('/')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6.5L8 2l6 4.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5z"/>
                <path d="M6 15V9h4v6"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="tab-bar" style={{ marginBottom: 16 }}>
          {[['schedule', 'Schedule'], ['table', 'Points Table'], ['playoffs', 'Playoffs']].map(([val, label]) => (
            <button key={val} className={`tab-item ${tab === val ? 'active' : ''}`} onClick={() => setTab(val)}>{label}</button>
          ))}
        </div>

        {tab === 'schedule' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {pending.length > 0 && (
              <>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Upcoming ({pending.length})
                </div>
                {pending.map((m, idx) => {
                  const t1 = getTeamById(m.team1);
                  const t2 = getTeamById(m.team2);
                  const mine = isMyMatch(m);
                  const isUnlocked = idx === nextUnlockedIndex;
                  const canSimulate = !mine && isUnlocked;
                  const canPlay = mine && isUnlocked;

                  return (
                    <div key={m.id} style={{
                      padding: '12px 14px', background: 'var(--bg-card)',
                      border: `1px solid ${mine && isUnlocked ? 'rgba(212,175,55,0.35)' : 'var(--border)'}`,
                      borderRadius: 10,
                      opacity: isUnlocked ? 1 : 0.4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: 20 }}>M{m.matchNo}</span>
                        {!isUnlocked && (
                          <span style={{ fontSize: 9, background: 'rgba(128,128,128,0.2)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>🔒 LOCKED</span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                          <TeamBadge teamId={m.team1} size={26} />
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: t1?.color }}>{t1?.short}</span>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>VS</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: t2?.color }}>{t2?.short}</span>
                          <TeamBadge teamId={m.team2} size={26} />
                        </div>
                      </div>

                      {isUnlocked && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          {mine ? (
                            <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: 12 }} onClick={() => handlePlayMatch(m)}>
                              ▶ Play Match
                            </button>
                          ) : (
                            <button className="btn-ghost" style={{ flex: 1, padding: '8px 12px', fontSize: 12, justifyContent: 'center' }} onClick={() => handleSimulateMatch(m)}>
                              ⚡ Simulate
                            </button>
                          )}
                        </div>
                      )}
                      {!isUnlocked && (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
                          Complete previous match to unlock
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {completed.length > 0 && (
              <>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginTop: 8, marginBottom: 4 }}>
                  Results ({completed.length})
                </div>
                {[...completed].reverse().map(m => {
                  const t1 = getTeamById(m.team1);
                  const t2 = getTeamById(m.team2);
                  const r = m.result;
                  return (
                    <div key={m.id} style={{ padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: 20 }}>M{m.matchNo}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
                          <TeamBadge teamId={m.team1} size={20} />
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: r?.winner === m.team1 ? t1?.color : 'var(--text-muted)' }}>{t1?.short}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', marginLeft: 2 }}>{r?.score1}/{r?.wickets1}</span>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>({r?.overs1})</span>
                        </div>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>vs</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>({r?.overs2})</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', marginRight: 2 }}>{r?.score2}/{r?.wickets2}</span>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: r?.winner === m.team2 ? t2?.color : 'var(--text-muted)' }}>{t2?.short}</span>
                          <TeamBadge teamId={m.team2} size={20} />
                        </div>
                      </div>
                      <div style={{ fontSize: 10, textAlign: 'center', marginTop: 4, color: r?.winner ? 'var(--gold)' : 'var(--text-muted)' }}>
                        {r?.winner ? `${getTeamById(r.winner)?.short} won` : 'Tie'}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {tab === 'table' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 28px 28px 28px 28px 40px 52px', gap: 4, padding: '6px 10px', marginBottom: 4 }}>
              {['#', 'Team', 'M', 'W', 'L', 'T', 'Pts', 'NRR'].map(h => (
                <div key={h} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', textAlign: h === 'Team' ? 'left' : 'center' }}>{h}</div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {table.map((row, i) => {
                const team = getTeamById(row.teamId);
                const isMe = row.teamId === myTeamId;
                const qualifies = i < qualifyCount;
                return (
                  <div key={row.teamId} style={{
                    display: 'grid', gridTemplateColumns: '24px 1fr 28px 28px 28px 28px 40px 52px',
                    gap: 4, padding: '10px 10px', alignItems: 'center',
                    background: isMe ? `${team?.color}15` : 'var(--bg-card)',
                    border: `1px solid ${isMe ? (team?.color + '40') : qualifies ? 'rgba(212,175,55,0.15)' : 'var(--border)'}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: qualifies ? 'var(--gold)' : 'var(--text-muted)', textAlign: 'center' }}>{i + 1}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TeamBadge teamId={row.teamId} size={20} />
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.04em', color: isMe ? team?.color : 'var(--text-primary)' }}>{team?.short}</span>
                      {tournament.status !== 'group' && qualifies && (
                        <span style={{ fontSize: 8, background: 'rgba(212,175,55,0.15)', color: 'var(--gold)', padding: '1px 4px', borderRadius: 3 }}>Q</span>
                      )}
                    </div>
                    {[row.played, row.won, row.lost, row.tied].map((v, j) => (
                      <div key={j} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>{v}</div>
                    ))}
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--gold)', textAlign: 'center' }}>{row.points}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: row.nrr >= 0 ? 'var(--green)' : 'var(--crimson-bright)', textAlign: 'center' }}>
                      {row.nrr >= 0 ? '+' : ''}{row.nrr.toFixed(3)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
              Top {qualifyCount} qualify for playoffs
            </div>
          </div>
        )}

        {tab === 'playoffs' && (
          <div>
            {tournament.status === 'group' ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🏆</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.06em', marginBottom: 6 }}>Playoffs Locked</div>
                <div style={{ fontSize: 13 }}>Complete all group stage matches to unlock playoffs.</div>
                <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)' }}>{pending.length} matches remaining</div>
              </div>
            ) : playoffs ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { key: 'q1', label: 'Qualifier 1', desc: '1st vs 2nd' },
                  { key: 'elim', label: 'Eliminator', desc: '3rd vs 4th' },
                  { key: 'q2', label: 'Qualifier 2', desc: 'Q1 Loser vs Elim Winner' },
                  { key: 'final', label: '🏆 Final', desc: 'Q1 Winner vs Q2 Winner' },
                ].map(({ key, label, desc }) => {
                  const m = playoffs[key];
                  if (!m) return null;
                  const t1 = m.team1 ? getTeamById(m.team1) : null;
                  const t2 = m.team2 ? getTeamById(m.team2) : null;
                  const mine = m.team1 === myTeamId || m.team2 === myTeamId;
                  const isPending = m.status === 'pending' && m.team1 && m.team2;

                  const playoffOrder = ['q1', 'elim', 'q2', 'final'];
                  const currentIndex = playoffOrder.indexOf(key);
                  const allPreviousComplete = currentIndex === 0 || playoffOrder.slice(0, currentIndex).every(k => playoffs[k]?.status === 'completed');
                  const isUnlocked = allPreviousComplete && isPending;
                  const canPlay = mine && isUnlocked;
                  const canSimulate = !mine && isUnlocked;

                  return (
                    <div key={key} style={{
                      padding: '14px', background: 'var(--bg-card)',
                      border: `1px solid ${key === 'final' ? 'rgba(212,175,55,0.4)' : 'var(--border)'}`,
                      borderRadius: 12,
                      opacity: (!isUnlocked && isPending) ? 0.4 : 1,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.06em', color: key === 'final' ? 'var(--gold)' : 'var(--text-primary)' }}>{label}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{desc}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isPending ? 10 : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                          {t1 ? <><TeamBadge teamId={m.team1} size={26} /><span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: m.result?.winner === m.team1 ? t1.color : 'var(--text-primary)' }}>{t1.short}</span></> : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>TBD</span>}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>VS</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
                          {t2 ? <><span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: m.result?.winner === m.team2 ? t2.color : 'var(--text-primary)' }}>{t2.short}</span><TeamBadge teamId={m.team2} size={26} /></> : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>TBD</span>}
                        </div>
                      </div>

                      {m.result && (
                        <div style={{ fontSize: 11, color: 'var(--gold)', textAlign: 'center', marginTop: 4 }}>
                          {m.result.winner ? `${getTeamById(m.result.winner)?.short} won` : 'Tie'}
                          {key === 'final' && tournament.champion ? ' 🏆' : ''}
                        </div>
                      )}

                      {isPending && (
                        <>
                          {isUnlocked ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                              {mine ? (
                                <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: 12 }} onClick={() => handlePlayPlayoff(key, m)}>
                                  ▶ Play {label}
                                </button>
                              ) : (
                                <button className="btn-ghost" style={{ flex: 1, padding: '8px 12px', fontSize: 12, justifyContent: 'center' }} onClick={() => handleSimulatePlayoff(key, m)}>
                                  ⚡ Simulate
                                </button>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
                              🔒 Complete previous playoff matches first
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
