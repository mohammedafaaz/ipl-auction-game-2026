import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { database } from '../firebase.js';
import { ref, onValue, off, update } from 'firebase/database';
import { TEAMS, getTeamById } from '../data/teams.js';
import { sortedTable, simulateMatch, applyResultToTable, generatePlayoffs } from '../utils/tournament.js';
import TeamBadge from '../components/TeamBadge.jsx';

export default function Tournament() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [tab, setTab] = useState('table'); // table | schedule | playoffs
  const [simulating, setSimulating] = useState(null); // matchId being simulated

  const myTeamId = sessionStorage.getItem('tournamentTeamId');

  useEffect(() => {
    const localData = sessionStorage.getItem('tournamentData');
    if (localData) {
      const data = JSON.parse(localData);
      if (data.schedule && !Array.isArray(data.schedule)) data.schedule = Object.values(data.schedule);
      setTournament(data);
    }
    if (!database || !id) return;
    const r = ref(database, `tournaments/${id}`);
    const unsub = onValue(r, snap => {
      if (!snap.exists()) return;
      const data = snap.val();
      if (data.schedule && !Array.isArray(data.schedule)) data.schedule = Object.values(data.schedule);
      setTournament(data);
      sessionStorage.setItem('tournamentData', JSON.stringify(data));
      localStorage.setItem('tournamentData', JSON.stringify(data));
    }, err => {
      console.warn('Firebase read failed:', err.message);
    });
    return () => off(r);
  }, [id]);

  const handlePlayMatch = useCallback((match) => {
    sessionStorage.setItem('currentMatchId', String(match.matchNo - 1)); // store array index
    sessionStorage.setItem('currentMatchTeam1', match.team1);
    sessionStorage.setItem('currentMatchTeam2', match.team2);
    navigate(`/hand-cricket/${id}`);
  }, [id, navigate]);

  const handleSimulateMatch = useCallback(async (match) => {
    if (!tournament) return;
    setSimulating(match.id);
    await new Promise(r => setTimeout(r, 600));

    const result = simulateMatch(match.team1, match.team2, tournament.teamStates);
    let newTable = applyResultToTable(tournament.pointsTable, result, match.team1, match.team2);

    // Update only the specific match in Firebase using its index as key
    const schedule = tournament.schedule;
    const matchIndex = schedule.findIndex(m => m.id === match.id);
    const updatedMatch = { ...match, status: 'completed', result };

    const newSchedule = schedule.map(m => m.id === match.id ? updatedMatch : m);
    const pendingAfter = newSchedule.filter(m => m.status === 'pending');

    let newStatus = tournament.status;
    let playoffs = tournament.playoffs || null;

    if (pendingAfter.length === 0 && tournament.status === 'group') {
      newStatus = 'playoffs';
      const top4 = sortedTable(newTable).slice(0, 4).map(t => t.teamId);
      playoffs = generatePlayoffs(top4);
    }

    // Write match update by index path to avoid overwriting whole array
    const updates = {};
    updates[`tournaments/${id}/schedule/${matchIndex}`] = updatedMatch;
    updates[`tournaments/${id}/pointsTable`] = newTable;
    updates[`tournaments/${id}/status`] = newStatus;
    if (playoffs) updates[`tournaments/${id}/playoffs`] = playoffs;

    // Update local state immediately
    const newTournament = {
      ...tournament,
      schedule: newSchedule,
      pointsTable: newTable,
      status: newStatus,
      playoffs: playoffs || tournament.playoffs,
    };
    setTournament(newTournament);
    sessionStorage.setItem('tournamentData', JSON.stringify(newTournament));
    localStorage.setItem('tournamentData', JSON.stringify(newTournament));

    // Try Firebase
    if (database) update(ref(database), updates).catch(e => console.warn('Firebase update failed:', e.message));
    setSimulating(null);
  }, [tournament, id]);

  const handlePlayoffMatch = useCallback((stage, match) => {
    sessionStorage.setItem('currentMatchId', `playoff_${stage}`);
    sessionStorage.setItem('currentMatchTeam1', match.team1);
    sessionStorage.setItem('currentMatchTeam2', match.team2);
    sessionStorage.setItem('playoffStage', stage);
    navigate(`/hand-cricket/${id}`);
  }, [id, navigate]);

  const handleSimulatePlayoff = useCallback(async (stage, match) => {
    if (!tournament) return;
    setSimulating(`playoff_${stage}`);
    await new Promise(r => setTimeout(r, 600));

    const result = simulateMatch(match.team1, match.team2, tournament.teamStates);
    const winner = result.winner || match.team1;
    const loser = winner === match.team1 ? match.team2 : match.team1;

    const playoffs = { ...tournament.playoffs };
    playoffs[stage] = { ...match, status: 'completed', result };

    const updates = {};

    if (stage === 'q1') {
      playoffs.q2 = { ...(playoffs.q2 || {}), team2: loser, status: 'pending' };
      playoffs.final = { ...(playoffs.final || {}), team1: winner, status: 'pending' };
    } else if (stage === 'elim') {
      playoffs.q2 = { ...(playoffs.q2 || {}), team1: winner, status: 'pending' };
    } else if (stage === 'q2') {
      playoffs.final = { ...(playoffs.final || {}), team2: winner, status: 'pending' };
    } else if (stage === 'final') {
      updates[`tournaments/${id}/status`] = 'completed';
      updates[`tournaments/${id}/champion`] = winner;
    }

    updates[`tournaments/${id}/playoffs`] = playoffs;

    // Update local state immediately
    const newTournament = { ...tournament, playoffs, ...('status' in updates[`tournaments/${id}`] ? {} : {}), ...(updates[`tournaments/${id}/status`] ? { status: updates[`tournaments/${id}/status`] } : {}), ...(updates[`tournaments/${id}/champion`] ? { champion: updates[`tournaments/${id}/champion`] } : {}) };
    const merged = { ...tournament, playoffs };
    if (stage === 'final') { merged.status = 'completed'; merged.champion = winner; }
    setTournament(merged);
    sessionStorage.setItem('tournamentData', JSON.stringify(merged));

    if (database) update(ref(database), updates).catch(e => console.warn('Firebase update failed:', e.message));
    setSimulating(null);
  }, [tournament, id]);

  if (!tournament) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  const table = sortedTable(tournament.pointsTable);
  const schedule = tournament.schedule || [];
  const completed = schedule.filter(m => m.status === 'completed');
  const pending = schedule.filter(m => m.status === 'pending');
  const playoffs = tournament.playoffs;

  const isMyMatch = (m) => m.team1 === myTeamId || m.team2 === myTeamId;

  return (
    <div className="page">
      <div className="page-bg-pattern" />
      <div className="container" style={{ paddingTop: 16, paddingBottom: 48 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {myTeamId && <TeamBadge teamId={myTeamId} size={32} />}
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '0.06em', color: getTeamById(myTeamId)?.color || 'var(--gold)' }}>
                IPL 2026
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{completed.length}/{schedule.length} matches played</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {tournament.status === 'completed' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8 }}>
                <TeamBadge teamId={tournament.champion} size={20} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--gold)', letterSpacing: '0.06em' }}>CHAMPIONS</span>
              </div>
            )}
            <button title="Home" className="btn-ghost" style={{ padding: '6px 8px' }} onClick={() => navigate('/')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6.5L8 2l6 4.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5z"/>
                <path d="M6 15V9h4v6"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-bar" style={{ marginBottom: 16 }}>
          {[['table', 'Points Table'], ['schedule', 'Schedule'], ['playoffs', 'Playoffs']].map(([val, label]) => (
            <button key={val} className={`tab-item ${tab === val ? 'active' : ''}`} onClick={() => setTab(val)}>{label}</button>
          ))}
        </div>

        {/* ── POINTS TABLE ── */}
        {tab === 'table' && (
          <div>
            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 32px 32px 32px 32px 48px 56px', gap: 4, padding: '6px 10px', marginBottom: 4 }}>
              {['#', 'Team', 'M', 'W', 'L', 'T', 'Pts', 'NRR'].map(h => (
                <div key={h} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', textAlign: h === 'Team' ? 'left' : 'center' }}>{h}</div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {table.map((row, i) => {
                const team = getTeamById(row.teamId);
                const isMe = row.teamId === myTeamId;
                const isTop4 = i < 4;
                return (
                  <div key={row.teamId} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 32px 32px 32px 32px 48px 56px', gap: 4, padding: '10px 10px', background: isMe ? `${team?.color}15` : 'var(--bg-card)', border: `1px solid ${isMe ? team?.color + '40' : 'var(--border)'}`, borderRadius: 8, alignItems: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: isTop4 ? 'var(--gold)' : 'var(--text-muted)', textAlign: 'center' }}>{i + 1}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TeamBadge teamId={row.teamId} size={20} />
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.04em', color: isMe ? team?.color : 'var(--text-primary)' }}>{team?.short}</span>
                      {tournament.status !== 'group' && isTop4 && <span style={{ fontSize: 8, background: 'rgba(212,175,55,0.15)', color: 'var(--gold)', padding: '1px 4px', borderRadius: 3, letterSpacing: '0.08em' }}>Q</span>}
                    </div>
                    {[row.played, row.won, row.lost, row.tied].map((v, j) => (
                      <div key={j} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>{v}</div>
                    ))}
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--gold)', textAlign: 'center' }}>{row.points}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: row.nrr >= 0 ? 'var(--green)' : 'var(--crimson-bright)', textAlign: 'center' }}>{row.nrr >= 0 ? '+' : ''}{row.nrr.toFixed(3)}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>Q = Qualified for playoffs</div>
          </div>
        )}

        {/* ── SCHEDULE ── */}
        {tab === 'schedule' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Pending matches first */}
            {pending.length > 0 && (
              <>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 4 }}>Upcoming ({pending.length})</div>
                {pending.map((m, idx) => {
                  const t1 = getTeamById(m.team1);
                  const t2 = getTeamById(m.team2);
                  const mine = isMyMatch(m);
                  const isNext = idx === 0; // only first pending match is unlocked
                  return (
                    <div key={m.id} style={{ padding: '12px 14px', background: 'var(--bg-card)', border: `1px solid ${isNext && mine ? 'rgba(212,175,55,0.3)' : 'var(--border)'}`, borderRadius: 10, opacity: isNext ? 1 : 0.45 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isNext ? 10 : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                          <TeamBadge teamId={m.team1} size={28} />
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: t1?.color }}>{t1?.short}</span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>VS</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: t2?.color }}>{t2?.short}</span>
                          <TeamBadge teamId={m.team2} size={28} />
                        </div>
                        {!isNext && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginLeft: 8 }}>
                            <rect x="3" y="6" width="8" height="7" rx="1.5" stroke="var(--text-muted)" strokeWidth="1.2"/>
                            <path d="M5 6V4a2 2 0 0 1 4 0v2" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round"/>
                          </svg>
                        )}
                      </div>
                      {isNext && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          {mine ? (
                            <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: 12 }} onClick={() => handlePlayMatch(m)}>
                              ▶ Play Match
                            </button>
                          ) : (
                            <button className="btn-ghost" style={{ flex: 1, padding: '8px', fontSize: 12, justifyContent: 'center' }} onClick={() => handleSimulateMatch(m)} disabled={simulating === m.id}>
                              {simulating === m.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '⚡ Simulate'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Completed matches */}
            {completed.length > 0 && (
              <>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginTop: 8, marginBottom: 4 }}>Results ({completed.length})</div>
                {[...completed].reverse().map(m => {
                  const t1 = getTeamById(m.team1);
                  const t2 = getTeamById(m.team2);
                  const r = m.result;
                  return (
                    <div key={m.id} style={{ padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, opacity: 0.85 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
                          <TeamBadge teamId={m.team1} size={22} />
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: r?.winner === m.team1 ? t1?.color : 'var(--text-muted)' }}>{t1?.short}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', marginLeft: 4 }}>{r?.score1}/{r?.wickets1}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({r?.overs1})</span>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>vs</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({r?.overs2})</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', marginRight: 4 }}>{r?.score2}/{r?.wickets2}</span>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: r?.winner === m.team2 ? t2?.color : 'var(--text-muted)' }}>{t2?.short}</span>
                          <TeamBadge teamId={m.team2} size={22} />
                        </div>
                      </div>
                      {r?.winner && (
                        <div style={{ fontSize: 10, color: 'var(--gold)', textAlign: 'center', marginTop: 4 }}>
                          {getTeamById(r.winner)?.short} won
                        </div>
                      )}
                      {!r?.winner && <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>Tie</div>}
                    </div>
                  );
                })}
              </>
            )}
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
                  { key: 'q1', label: 'Qualifier 1', desc: 'Winner → Final' },
                  { key: 'elim', label: 'Eliminator', desc: 'Winner → Q2' },
                  { key: 'q2', label: 'Qualifier 2', desc: 'Winner → Final' },
                  { key: 'final', label: '🏆 Final', desc: 'IPL 2026 Champion' },
                ].map(({ key, label, desc }) => {
                  const m = playoffs[key];
                  if (!m || (!m.team1 && !m.team2)) return null;
                  const t1 = m.team1 ? getTeamById(m.team1) : null;
                  const t2 = m.team2 ? getTeamById(m.team2) : null;
                  const mine = m.team1 === myTeamId || m.team2 === myTeamId;
                  const pending = m.status === 'pending' && m.team1 && m.team2;
                  const isAvailable = pending && (() => {
                    // Q1 and Elim are always available first
                    if (key === 'q1' || key === 'elim') return playoffs.q1?.status === 'pending' || playoffs.elim?.status === 'pending' ? true : false;
                    if (key === 'q2') return playoffs.q1?.status === 'completed' && playoffs.elim?.status === 'completed';
                    if (key === 'final') return playoffs.q2?.status === 'completed';
                    return false;
                  })();
                  return (
                    <div key={key} style={{ padding: '14px', background: 'var(--bg-card)', border: `1px solid ${key === 'final' ? 'rgba(212,175,55,0.4)' : 'var(--border)'}`, borderRadius: 12, opacity: pending && !isAvailable ? 0.45 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.06em', color: key === 'final' ? 'var(--gold)' : 'var(--text-primary)' }}>{label}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{desc}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: pending ? 10 : 0 }}>
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
                          {key === 'final' && tournament.champion && ' 🏆'}
                        </div>
                      )}
                      {pending && isAvailable && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          {mine ? (
                            <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: 12 }} onClick={() => handlePlayoffMatch(key, m)}>▶ Play</button>
                          ) : (
                            <button className="btn-ghost" style={{ flex: 1, padding: '8px', fontSize: 12, justifyContent: 'center' }} onClick={() => handleSimulatePlayoff(key, m)} disabled={simulating === `playoff_${key}`}>
                              {simulating === `playoff_${key}` ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '⚡ Simulate'}
                            </button>
                          )}
                        </div>
                      )}
                      {pending && !isAvailable && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
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
