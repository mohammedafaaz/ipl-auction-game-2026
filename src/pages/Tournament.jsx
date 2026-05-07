import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { database } from '../firebase.js';
import { ref, onValue, off, update } from 'firebase/database';
import { getTeamById } from '../data/teams.js';
import { sortedTable, applyResultToTable, generatePlayoffs } from '../utils/tournament.js';
import TeamBadge from '../components/TeamBadge.jsx';

// MODE 3: Multiplayer Tournament (Room-based, NO simulate, sequential matches only)
export default function Tournament() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [tab, setTab] = useState('schedule');
  const [notification, setNotification] = useState(null); // { message, type }
  const notifTimerRef = useRef(null);

  const myTeamId = sessionStorage.getItem('tournamentTeamId');
  const playerId = sessionStorage.getItem('playerId');

  const showNotif = useCallback((message, type = 'info') => {
    clearTimeout(notifTimerRef.current);
    setNotification({ message, type });
    notifTimerRef.current = setTimeout(() => setNotification(null), 4000);
  }, []);

  useEffect(() => {
    // MULTIPLAYER: Always load from Firebase, no local fallback
    if (!database || !id) {
      navigate('/');
      return;
    }
    
    const r = ref(database, `tournaments/${id}`);
    const unsub = onValue(r, snap => {
      if (!snap.exists()) {
        navigate('/');
        return;
      }
      const data = snap.val();
      if (data.schedule && !Array.isArray(data.schedule)) data.schedule = Object.values(data.schedule);
      
      setTournament(prev => {
        // Detect newly completed match to show notification
        if (prev && data.schedule) {
          const prevCompleted = (prev.schedule || []).filter(m => m.status === 'completed').length;
          const newCompleted = data.schedule.filter(m => m.status === 'completed').length;
          if (newCompleted > prevCompleted) {
            const newMatch = data.schedule.find(m =>
              m.status === 'completed' &&
              !(prev.schedule || []).find(pm => pm.id === m.id && pm.status === 'completed')
            );
            if (newMatch?.result) {
              const winner = getTeamById(newMatch.result.winner);
              showNotif(`${winner?.short || 'Team'} won Match ${newMatch.matchNo}!`, 'success');
            }
          }
          // Detect playoff advancement
          if (data.status === 'playoffs' && prev.status === 'group') {
            showNotif('Group stage complete! Playoffs unlocked 🏆', 'success');
            setTab('playoffs');
          }
          if (data.status === 'completed' && prev.status !== 'completed') {
            showNotif(`${getTeamById(data.champion)?.short} are IPL 2026 Champions! 🏆`, 'success');
          }
        }
        return data;
      });
    });
    return () => { off(r); clearTimeout(notifTimerRef.current); };
  }, [id, showNotif, navigate]);

  // Navigate to hand cricket for a group match
  const handlePlayMatch = useCallback((match) => {
    if (!match.team1 || !match.team2) return;
    sessionStorage.setItem('currentMatchId', String(match.matchNo - 1));
    sessionStorage.setItem('currentMatchTeam1', match.team1);
    sessionStorage.setItem('currentMatchTeam2', match.team2);
    sessionStorage.removeItem('playoffStage');
    navigate(`/hand-cricket/${id}`);
  }, [id, navigate]);

  // Navigate to hand cricket for a playoff match
  const handlePlayPlayoff = useCallback((stage, match) => {
    if (!match.team1 || !match.team2) return;
    sessionStorage.setItem('currentMatchId', `playoff_${stage}`);
    sessionStorage.setItem('currentMatchTeam1', match.team1);
    sessionStorage.setItem('currentMatchTeam2', match.team2);
    sessionStorage.setItem('playoffStage', stage);
    navigate(`/hand-cricket/${id}`);
  }, [id, navigate]);

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

  // MULTIPLAYER MODE: Only ONE match at a time, NO simulation
  const liveMatch = schedule.find(m => m.live);
  const nextMatch = pending[0] || null;
  const canPlayNext = !liveMatch && nextMatch;

  // Playoff availability
  const playoffAvailable = (key) => {
    if (!playoffs) return false;
    const m = playoffs[key];
    if (!m || m.status !== 'pending' || !m.team1 || !m.team2) return false;
    if (key === 'q1' || key === 'elim') return true;
    if (key === 'q2') return playoffs.q1?.status === 'completed' && playoffs.elim?.status === 'completed';
    if (key === 'final') return playoffs.q2?.status === 'completed';
    return false;
  };

  const livePlayoff = playoffs && ['q1', 'elim', 'q2', 'final'].find(k => playoffs[k]?.live);
  const canPlayPlayoff = (key) => !livePlayoff && playoffAvailable(key);

  // Qualify count — top N based on team count
  const qualifyCount = participatingTeamIds.length <= 4 ? 2 : participatingTeamIds.length <= 6 ? 3 : 4;

  return (
    <div className="page">
      <div className="page-bg-pattern" />

      {/* Live notification banner */}
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

        {/* Header */}
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

        {/* Tabs */}
        <div className="tab-bar" style={{ marginBottom: 16 }}>
          {[['schedule', 'Schedule'], ['table', 'Points Table'], ['playoffs', 'Playoffs']].map(([val, label]) => (
            <button key={val} className={`tab-item ${tab === val ? 'active' : ''}`} onClick={() => setTab(val)}>{label}</button>
          ))}
        </div>

        {/* ── SCHEDULE ── */}
        {tab === 'schedule' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Live match banner */}
            {liveMatch && (
              <div style={{ padding: '10px 14px', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="dot-live" style={{ background: 'var(--crimson-bright)' }} />
                <span style={{ fontSize: 12, color: 'var(--crimson-bright)', fontWeight: 600 }}>
                  Match in progress: {getTeamById(liveMatch.team1)?.short} vs {getTeamById(liveMatch.team2)?.short}
                </span>
              </div>
            )}

            {pending.length > 0 && (
              <>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Upcoming ({pending.length})
                </div>
                {pending.map((m, idx) => {
                  const t1 = getTeamById(m.team1);
                  const t2 = getTeamById(m.team2);
                  const mine = isMyMatch(m);
                  const isNext = idx === 0 && canPlayNext;
                  const isLocked = idx > 0 || !!liveMatch;

                  return (
                    <div key={m.id} style={{
                      padding: '12px 14px', background: 'var(--bg-card)',
                      border: `1px solid ${isNext && mine ? 'rgba(212,175,55,0.35)' : 'var(--border)'}`,
                      borderRadius: 10, opacity: isLocked ? 0.45 : 1,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isNext ? 10 : 0 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: 20 }}>M{m.matchNo}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                          <TeamBadge teamId={m.team1} size={26} />
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: t1?.color }}>{t1?.short}</span>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>VS</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: t2?.color }}>{t2?.short}</span>
                          <TeamBadge teamId={m.team2} size={26} />
                        </div>
                        {isLocked && (
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                            <rect x="3" y="6" width="8" height="7" rx="1.5" stroke="var(--text-muted)" strokeWidth="1.2"/>
                            <path d="M5 6V4a2 2 0 0 1 4 0v2" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round"/>
                          </svg>
                        )}
                      </div>

                      {isNext && (
                        <button className="btn-primary" style={{ padding: '8px', fontSize: 12 }} onClick={() => handlePlayMatch(m)} disabled={!mine}>
                          {mine ? '▶ Play Match' : '⏳ Waiting for match to start'}
                        </button>
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

            {pending.length === 0 && completed.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                No matches scheduled
              </div>
            )}
          </div>
        )}

        {/* ── POINTS TABLE ── */}
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

        {/* ── PLAYOFFS ── */}
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
                  const available = canPlayPlayoff(key);

                  return (
                    <div key={key} style={{
                      padding: '14px', background: 'var(--bg-card)',
                      border: `1px solid ${key === 'final' ? 'rgba(212,175,55,0.4)' : 'var(--border)'}`,
                      borderRadius: 12, opacity: isPending && !available ? 0.45 : 1,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.06em', color: key === 'final' ? 'var(--gold)' : 'var(--text-primary)' }}>{label}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{desc}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isPending && available ? 10 : 0 }}>
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

                      {isPending && available && (
                        <button className="btn-primary" style={{ padding: '8px', fontSize: 12 }} onClick={() => handlePlayPlayoff(key, m)} disabled={!mine}>
                          {mine ? `▶ Play ${label}` : '⏳ Waiting for match to start'}
                        </button>
                      )}
                      {isPending && !available && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                            <rect x="3" y="6" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                            <path d="M5 6V4a2 2 0 0 1 4 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                          </svg>
                          Complete previous stage to unlock
                        </div>
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
