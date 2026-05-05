import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { database } from '../firebase.js';
import { ref, update } from 'firebase/database';
import { getTeamById } from '../data/teams.js';
import { getPlayerRating, applyResultToTable, sortedTable, generatePlayoffs } from '../utils/tournament.js';
import { buildSquadTeamStates } from '../data/squadTeamStates.js';
import TeamBadge from '../components/TeamBadge.jsx';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const OVERS = 5;
const MAX_WICKETS = 10;

// ─────────────────────────────────────────────────────────────────────────────
// PlayerPickerModal — bottom-sheet overlay
// mode: 'batter' | 'bowler'
// usedBatterIndices: Set of XI indices already dismissed
// lastBowlerIdx: XI index who bowled the previous over (can't repeat)
// ─────────────────────────────────────────────────────────────────────────────
function PlayerPickerModal({ mode, xi, usedBatterIndices = new Set(), lastBowlerIdx = -1, onPick, title }) {
  // When bowling, only show bowlers and all-rounders
  const visibleXI = xi.map((p, i) => ({ p, i })).filter(({ p }) =>
    mode === 'bowler' ? (p.role === 'Bowler' || p.role === 'All-Rounder') : true
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '18px 18px 0 0',
        padding: '20px 16px 40px',
        maxHeight: '72vh',
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)',
        borderBottom: 'none',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 18px' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--gold)', marginBottom: 3, letterSpacing: '0.06em' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
          {mode === 'batter' ? 'Tap a player to send them in' : 'Only bowlers & all-rounders can bowl'}
        </div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visibleXI.map(({ p, i }) => {
            const isOut = mode === 'batter' && usedBatterIndices.has(i);
            const cantBowl = mode === 'bowler' && i === lastBowlerIdx;
            const disabled = isOut || cantBowl;
            return (
              <button key={i} disabled={disabled} onClick={() => !disabled && onPick(i)}
                style={{ padding: '11px 14px', background: disabled ? 'transparent' : 'var(--bg-card)', border: `1px solid ${disabled ? 'rgba(255,255,255,0.07)' : 'var(--border)'}`, borderRadius: 9, cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: disabled ? 0.35 : 1 }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, color: disabled ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {p.role}
                    {isOut && <span style={{ marginLeft: 6, color: 'var(--crimson-bright)' }}>• OUT</span>}
                    {cantBowl && <span style={{ marginLeft: 6 }}>• Bowled last over</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⭐ {getPlayerRating(p).toFixed(1)}</span>
                  {!disabled && (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <circle cx="9" cy="9" r="8" stroke="rgba(212,175,55,0.35)" strokeWidth="1.2" />
                      <path d="M6.5 9.5l2.5 2.5 3.5-4" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
          {visibleXI.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>No eligible bowlers available.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main HandCricket component
// ─────────────────────────────────────────────────────────────────────────────
export default function HandCricket() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();

  const team1Id = sessionStorage.getItem('currentMatchTeam1');
  const team2Id = sessionStorage.getItem('currentMatchTeam2');
  const myTeamId = sessionStorage.getItem('tournamentTeamId');

  const [screen, setScreen] = useState('toss');
  const [tossPhase, setTossPhase] = useState('coin');
  const [tossResult, setTossResult] = useState(null);
  const [userWonToss, setUserWonToss] = useState(false);
  const [tossAnimating, setTossAnimating] = useState(false);

  // batting/bowling team — mirror in refs so handleBall never reads stale closures
  const [battingTeamId, setBattingTeamIdState] = useState(null);
  const [bowlingTeamId, setBowlingTeamIdState] = useState(null);
  const battingTeamRef = useRef(null);
  const bowlingTeamRef = useRef(null);
  const setBattingTeamId = (id) => { battingTeamRef.current = id; setBattingTeamIdState(id); };
  const setBowlingTeamId = (id) => { bowlingTeamRef.current = id; setBowlingTeamIdState(id); };

  const [team1XI, setTeam1XI] = useState([]);
  const [team2XI, setTeam2XI] = useState([]);
  const [team1Squad, setTeam1Squad] = useState([]);
  const [team2Squad, setTeam2Squad] = useState([]);

  // Scores keyed by teamId
  const [scores, setScores] = useState({ [team1Id]: { runs: 0, wickets: 0 }, [team2Id]: { runs: 0, wickets: 0 } });
  const scoresRef = useRef({ [team1Id]: { runs: 0, wickets: 0 }, [team2Id]: { runs: 0, wickets: 0 } });

  // Player stats: { teamId: { xiIdx: { runs, balls, wickets, runsConceded, ballsBowled } } }
  const [playerStats, setPlayerStats] = useState({ [team1Id]: {}, [team2Id]: {} });
  const playerStatsRef = useRef({ [team1Id]: {}, [team2Id]: {} });
  // Full scorecard per inning: { 1: { batting: teamId, batters: [...], bowlers: [...] }, 2: {...} }
  const [scorecards, setScorecards] = useState({});
  const scorecardsRef = useRef({});

  // ── Active player indices into each team's XI ──
  // These are "slot" indices, not auto-incrementing counters.
  // User picks them; AI picks auto via helpers.
  const [activeBatterXIIdx, setActiveBatterXIIdx] = useState(0);
  const [activeBowlerXIIdx, setActiveBowlerXIIdx] = useState(0);
  const activeBatterRef = useRef(0);
  const activeBowlerRef = useRef(0);

  // Set of XI-indices that have been dismissed (batting side)
  const [dismissedBatters, setDismissedBatters] = useState(new Set());
  const dismissedRef = useRef(new Set());

  // XI-index of the bowler who bowled the *previous* over (can't repeat)
  const [lastBowlerXIIdx, setLastBowlerXIIdx] = useState(-1);
  const lastBowlerRef = useRef(-1);

  // ── Player-picker modal state ──
  // null | 'opener-bat' | 'opener-bowl'
  //      | 'wicket'      (after each wicket when user is batting)
  //      | 'new-over'    (after each over when user is bowling)
  //      | 'innings2-bat'| 'innings2-bowl'
  const [pendingPick, setPendingPick] = useState(null);

  const [inning, setInning] = useState(1);
  const inningRef = useRef(1);

  const [ballCount, setBallCount] = useState(0);
  const ballCountRef = useRef(0);

  const [lastUser, setLastUser] = useState(null);
  const [lastAI, setLastAI] = useState(null);
  const [lastOut, setLastOut] = useState(false);
  const [lastRuns, setLastRuns] = useState(0);
  const [matchResult, setMatchResult] = useState(null);

  const transitioning = useRef(false);

  // ── Load squads ──
  useEffect(() => {
    const raw = sessionStorage.getItem('tournamentTeamStates') || localStorage.getItem('tournamentTeamStates');
    const states = raw ? JSON.parse(raw) : null;
    const fallback = buildSquadTeamStates();
    const s1 = states?.[team1Id]?.squad || [];
    const s2 = states?.[team2Id]?.squad || [];
    setTeam1Squad(s1.length >= 11 ? s1 : fallback[team1Id]?.squad || []);
    setTeam2Squad(s2.length >= 11 ? s2 : fallback[team2Id]?.squad || []);
  }, [team1Id, team2Id]);

  const autoXI = (squad) =>
    [...squad].sort((a, b) => getPlayerRating(b) - getPlayerRating(a)).slice(0, 11);

  // ── AI helpers ──
  const aiPickBatter = (xi, dismissed) => {
    const roleOrder = { 'WK-Batter': 0, 'Batter': 1, 'All-Rounder': 2, 'Bowler': 3 };
    const eligible = xi
      .map((p, i) => ({ p, i }))
      .filter(({ i }) => !dismissed.has(i))
      .sort((a, b) => {
        const ro = (roleOrder[a.p.role] ?? 3) - (roleOrder[b.p.role] ?? 3);
        if (ro !== 0) return ro;
        return getPlayerRating(b.p) - getPlayerRating(a.p);
      });
    return eligible.length > 0 ? eligible[0].i : 0;
  };

  const aiPickBowler = (xi, lastIdx) => {
    // Only bowlers and all-rounders can bowl
    const eligible = xi
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => i !== lastIdx && (p.role === 'Bowler' || p.role === 'All-Rounder'));
    if (eligible.length === 0) {
      // Fallback: anyone except last bowler
      const fallback = xi.map((p, i) => ({ p, i })).filter(({ i }) => i !== lastIdx);
      if (fallback.length === 0) return 0;
      return fallback.sort((a, b) => getPlayerRating(b.p) - getPlayerRating(a.p))[0].i;
    }
    // Pick highest rated eligible bowler
    return eligible.sort((a, b) => getPlayerRating(b.p) - getPlayerRating(a.p))[0].i;
  };

  // ── Toss ──
  const handleCoinPick = useCallback((pick) => {
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = pick === result;
    setTossAnimating(true);
    setTimeout(() => {
      setTossAnimating(false);
      setTossResult(result);
      setUserWonToss(won);
      if (won) {
        setTossPhase('choice');
      } else {
        const aiChoice = Math.random() < 0.5 ? 'bat' : 'bowl';
        const aiTeam = myTeamId === team1Id ? team2Id : team1Id;
        const batting = aiChoice === 'bat' ? aiTeam : myTeamId;
        const bowling = batting === team1Id ? team2Id : team1Id;
        setBattingTeamId(batting);
        setBowlingTeamId(bowling);
        setTimeout(() => setScreen('xi-picker'), 1800);
      }
    }, 2500);
  }, [team1Id, team2Id, myTeamId]);

  const handleTossChoice = useCallback((choice) => {
    const batting = choice === 'bat' ? myTeamId : (myTeamId === team1Id ? team2Id : team1Id);
    const bowling = batting === team1Id ? team2Id : team1Id;
    setBattingTeamId(batting);
    setBowlingTeamId(bowling);
    setScreen('xi-picker');
  }, [team1Id, team2Id, myTeamId]);

  // ── XI selected → show first player picker ──
  const handleStartMatch = useCallback((myXI) => {
    const xi1 = myTeamId === team1Id ? myXI : autoXI(team1Squad);
    const xi2 = myTeamId === team1Id ? autoXI(team2Squad) : myXI;
    setTeam1XI(xi1);
    setTeam2XI(xi2);

    ballCountRef.current = 0; setBallCount(0);
    dismissedRef.current = new Set(); setDismissedBatters(new Set());
    lastBowlerRef.current = -1; setLastBowlerXIIdx(-1);

    const batting = battingTeamRef.current;
    const isMyBatting = batting === myTeamId;

    if (isMyBatting) {
      // User bats first: AI auto-picks bowler (index 0), user picks opener batter
      activeBowlerRef.current = 0; setActiveBowlerXIIdx(0);
      setPendingPick('opener-bat');
    } else {
      // User bowls first: AI auto-picks opener batter (index 0), user picks opening bowler
      activeBatterRef.current = 0; setActiveBatterXIIdx(0);
      setPendingPick('opener-bowl');
    }
    setScreen('live');
  }, [myTeamId, team1Id, team1Squad, team2Squad]);

  // ── Player chosen from picker ──
  const handlePickPlayer = useCallback((xiIdx) => {
    const pick = pendingPick;
    setPendingPick(null);

    if (pick === 'opener-bat' || pick === 'innings2-bat' || pick === 'wicket') {
      activeBatterRef.current = xiIdx;
      setActiveBatterXIIdx(xiIdx);
    } else {
      // bowler picks: rotate lastBowler first
      const prev = activeBowlerRef.current;
      lastBowlerRef.current = prev; setLastBowlerXIIdx(prev);
      activeBowlerRef.current = xiIdx; setActiveBowlerXIIdx(xiIdx);
    }
  }, [pendingPick]);

  // ── finishMatch ──
  const finishMatch = useCallback((finalScores, balls2 = OVERS * 6, wicketsRemaining = 0, chaseWin = false) => {
    const t1Runs = finalScores[team1Id]?.runs ?? 0;
    const t2Runs = finalScores[team2Id]?.runs ?? 0;
    const t1Wkts = finalScores[team1Id]?.wickets ?? 0;
    const t2Wkts = finalScores[team2Id]?.wickets ?? 0;
    const winner = t1Runs > t2Runs ? team1Id : t2Runs > t1Runs ? team2Id : null;
    const finalPlayerStats = playerStatsRef.current;
    const result = { winner, score1: t1Runs, wickets1: t1Wkts, overs1: OVERS, balls1: OVERS * 6, score2: t2Runs, wickets2: t2Wkts, overs2: OVERS, balls2, chaseWin, wicketsRemaining, playerStats: finalPlayerStats };

    setMatchResult(result);
    setScreen('result');

    const matchId = sessionStorage.getItem('currentMatchId');
    const idx = parseInt(matchId, 10);
    const isPlayoff = matchId?.startsWith('playoff_');
    const playoffStage = isPlayoff ? matchId.replace('playoff_', '') : null;
    const raw = sessionStorage.getItem('tournamentData');
    if (raw) {
      const data = JSON.parse(raw);
      if (!isNaN(idx) && data.schedule) {
        // Group stage match
        data.schedule[idx] = { ...data.schedule[idx], status: 'completed', result };
        if (data.pointsTable) data.pointsTable = applyResultToTable(data.pointsTable, result, team1Id, team2Id);
        const pending = (data.schedule || []).filter(m => m.status === 'pending');
        if (pending.length === 0 && data.status === 'group') {
          data.status = 'playoffs';
          const top4 = sortedTable(data.pointsTable).slice(0, 4).map(t => t.teamId);
          data.playoffs = generatePlayoffs(top4);
        }
      } else if (isPlayoff && data.playoffs) {
        // Playoff match
        const winner = result.winner || team1Id;
        const loser = winner === team1Id ? team2Id : team1Id;
        data.playoffs[playoffStage] = { ...data.playoffs[playoffStage], status: 'completed', result };
        if (playoffStage === 'q1') { data.playoffs.q2 = { ...data.playoffs.q2, team2: loser, status: 'pending' }; data.playoffs.final = { ...data.playoffs.final, team1: winner, status: 'pending' }; }
        else if (playoffStage === 'elim') { data.playoffs.q2 = { ...data.playoffs.q2, team1: winner, status: 'pending' }; }
        else if (playoffStage === 'q2') { data.playoffs.final = { ...data.playoffs.final, team2: winner, status: 'pending' }; }
        else if (playoffStage === 'final') { data.status = 'completed'; data.champion = winner; }
      }
      sessionStorage.setItem('tournamentData', JSON.stringify(data));
      if (tournamentId && database) {
        const updates = {};
        if (!isNaN(idx)) {
          updates[`tournaments/${tournamentId}/schedule/${idx}/status`] = 'completed';
          updates[`tournaments/${tournamentId}/schedule/${idx}/result`] = result;
          if (data.pointsTable) updates[`tournaments/${tournamentId}/pointsTable`] = data.pointsTable;
          if (data.status === 'playoffs') { updates[`tournaments/${tournamentId}/status`] = 'playoffs'; updates[`tournaments/${tournamentId}/playoffs`] = data.playoffs; }
        } else if (isPlayoff) {
          updates[`tournaments/${tournamentId}/playoffs`] = data.playoffs;
          if (data.status === 'completed') { updates[`tournaments/${tournamentId}/status`] = 'completed'; updates[`tournaments/${tournamentId}/champion`] = data.champion; }
        }
        update(ref(database), updates).catch(e => console.warn('Firebase update failed:', e.message));
      }
    }
  }, [team1Id, team2Id, tournamentId]);

  // ── handleBall ──
  const handleBall = useCallback((num) => {
    if (transitioning.current || pendingPick) return;

    const aiPick = Math.floor(Math.random() * 6) + 1;
    const isOut = num === aiPick;

    const currentBatting = battingTeamRef.current;
    const currentBowling = bowlingTeamRef.current;
    const currentInning = inningRef.current;
    const currentBall = ballCountRef.current;
    const currentBatterIdx = activeBatterRef.current;
    const currentBowlerIdx = activeBowlerRef.current;

    const battingXI = currentBatting === team1Id ? team1XI : team2XI;
    const bowlingXI = currentBowling === team1Id ? team1XI : team2XI;
    const batter = battingXI[Math.min(currentBatterIdx, battingXI.length - 1)];
    const bowler = bowlingXI[Math.min(currentBowlerIdx, bowlingXI.length - 1)];

    const isMyBatting = currentBatting === myTeamId;
    const battingNum = isMyBatting ? num : aiPick;

    let scored = 0;
    if (!isOut && batter && bowler) {
      const diff = (getPlayerRating(batter) || 5) - (getPlayerRating(bowler) || 5);
      scored = Math.max(0, Math.round(battingNum * (1 + diff / 20)));
    }

    setLastUser(num);
    setLastAI(aiPick);
    setLastOut(isOut);
    setLastRuns(scored);

    const newBall = currentBall + 1;
    ballCountRef.current = newBall;
    setBallCount(newBall);

    // Update dismissed set if out
    let newDismissed = dismissedRef.current;
    if (isOut) {
      newDismissed = new Set(dismissedRef.current);
      newDismissed.add(currentBatterIdx);
      dismissedRef.current = newDismissed;
      setDismissedBatters(new Set(newDismissed));
    }

    // Update scores
    const prevScores = scoresRef.current;
    const newRuns = (prevScores[currentBatting]?.runs ?? 0) + (isOut ? 0 : scored);
    const newWkts = (prevScores[currentBatting]?.wickets ?? 0) + (isOut ? 1 : 0);
    const updatedScores = { ...prevScores, [currentBatting]: { runs: newRuns, wickets: newWkts } };
    scoresRef.current = updatedScores;
    setScores({ ...updatedScores });

    // Update player stats
    const prevStats = playerStatsRef.current;
    const batStats = prevStats[currentBatting]?.[currentBatterIdx] ?? { runs: 0, balls: 0, out: false };
    const bowlStats = prevStats[currentBowling]?.[currentBowlerIdx] ?? { wickets: 0, runsConceded: 0, balls: 0 };
    const newBatStats = { ...batStats, runs: batStats.runs + (isOut ? 0 : scored), balls: batStats.balls + 1, out: isOut ? true : batStats.out };
    const newBowlStats = { ...bowlStats, wickets: bowlStats.wickets + (isOut ? 1 : 0), runsConceded: bowlStats.runsConceded + (isOut ? 0 : scored), balls: bowlStats.balls + 1 };
    const updatedStats = {
      ...prevStats,
      [currentBatting]: { ...prevStats[currentBatting], [currentBatterIdx]: newBatStats },
      [currentBowling]: { ...prevStats[currentBowling], [currentBowlerIdx]: newBowlStats },
    };
    playerStatsRef.current = updatedStats;
    setPlayerStats({ ...updatedStats });

    // Inning-end checks
    const oversCompleted = Math.floor(newBall / 6);
    const inningOver = newWkts >= MAX_WICKETS || oversCompleted >= OVERS;
    const targetScore = currentInning === 2 ? (scoresRef.current[currentBowling]?.runs ?? 0) : null;
    const targetReached = currentInning === 2 && !isOut && targetScore !== null && newRuns > targetScore;

    if (targetReached || inningOver) {
      transitioning.current = true;

      if (currentInning === 1) {
        // Swap teams for inning 2
        const newBatting = currentBatting === team1Id ? team2Id : team1Id;
        const newBowling = newBatting === team1Id ? team2Id : team1Id;
        const newBattingXI = newBatting === team1Id ? team1XI : team2XI;
        const newBowlingXI = newBowling === team1Id ? team1XI : team2XI;

        setTimeout(() => {
          inningRef.current = 2; setInning(2);
          ballCountRef.current = 0; setBallCount(0);
          dismissedRef.current = new Set(); setDismissedBatters(new Set());
          lastBowlerRef.current = -1; setLastBowlerXIIdx(-1);
          setBattingTeamId(newBatting);
          setBowlingTeamId(newBowling);
          transitioning.current = false;

          if (newBatting === myTeamId) {
            // User bats inning 2: AI picks opening bowler, user picks opener batter
            const aiBowler = aiPickBowler(newBowlingXI, -1);
            activeBowlerRef.current = aiBowler; setActiveBowlerXIIdx(aiBowler);
            setPendingPick('innings2-bat');
          } else {
            // User bowls inning 2: AI picks opener batter, user picks opening bowler
            const aiBatter = aiPickBatter(newBattingXI, new Set());
            activeBatterRef.current = aiBatter; setActiveBatterXIIdx(aiBatter);
            setPendingPick('innings2-bowl');
          }
        }, 800);
      } else {
        const wicketsRemaining = MAX_WICKETS - newWkts;
        setTimeout(() => {
          finishMatch(updatedScores, newBall, wicketsRemaining, targetReached);
          transitioning.current = false;
        }, 800);
      }
      return;
    }

    // ── Mid-inning player changes ──
    const overJustEnded = newBall % 6 === 0;

    if (isOut) {
      if (isMyBatting && newWkts < MAX_WICKETS) {
        // User is batting — show picker to choose next batter
        setTimeout(() => setPendingPick('wicket'), 400);
      } else if (!isMyBatting) {
        // AI is batting — auto-pick next batter
        const aiBatter = aiPickBatter(battingXI, newDismissed);
        activeBatterRef.current = aiBatter; setActiveBatterXIIdx(aiBatter);
      }
    }

    if (overJustEnded) {
      if (!isMyBatting) {
        // User is bowling — show picker to choose bowler for next over
        // Slight delay if a wicket just fell so animations don't clash
        setTimeout(() => setPendingPick('new-over'), isOut ? 650 : 200);
      } else {
        // AI is bowling — auto-rotate bowler
        const prevBowler = activeBowlerRef.current;
        const aiBowler = aiPickBowler(bowlingXI, prevBowler);
        lastBowlerRef.current = prevBowler; setLastBowlerXIIdx(prevBowler);
        activeBowlerRef.current = aiBowler; setActiveBowlerXIIdx(aiBowler);
      }
    }
  }, [pendingPick, team1Id, team1XI, team2XI, myTeamId, finishMatch]);

  // ─────────────────────────────────────────────────────────────────────────
  // TOSS SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'toss') {
    const aiTeam = getTeamById(myTeamId === team1Id ? team2Id : team1Id);
    return (
      <div className="page">
        <div className="page-bg-pattern" />
        <div className="container" style={{ paddingTop: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Hand Cricket</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, color: 'var(--gold)', marginBottom: 24 }}>
            {getTeamById(team1Id)?.short} vs {getTeamById(team2Id)?.short}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 36 }}>
            <TeamBadge teamId={team1Id} size={56} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--text-muted)', alignSelf: 'center' }}>vs</div>
            <TeamBadge teamId={team2Id} size={56} />
          </div>

          {tossPhase === 'coin' && !tossResult && !tossAnimating && (
            <>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>Call the toss!</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {['heads', 'tails'].map(side => (
                  <button key={side} onClick={() => handleCoinPick(side)}
                    style={{ padding: '16px 32px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 10, color: 'var(--gold)', fontWeight: 700, fontSize: 16, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {side === 'heads' ? '🪙 Heads' : '🔄 Tails'}
                  </button>
                ))}
              </div>
            </>
          )}

          {tossAnimating && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <DotLottieReact src="https://lottie.host/1b88cbc7-ebe1-4708-88db-eb3b88de3739/5AZxxWTzGv.lottie" autoplay style={{ width: 200, height: 200 }} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Flipping coin...</div>
            </div>
          )}

          {tossResult && !userWonToss && (
            <>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{tossResult === 'heads' ? '🪙' : '🔄'}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--crimson-bright)', marginBottom: 8 }}>It's {tossResult.toUpperCase()}!</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>You lost the toss.</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {aiTeam?.short} chose to {battingTeamRef.current && battingTeamRef.current !== myTeamId ? 'bat' : 'bowl'} first.
              </div>
              <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)' }}>Taking you to XI selection...</div>
            </>
          )}

          {tossResult && userWonToss && tossPhase === 'choice' && (
            <>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{tossResult === 'heads' ? '🪙' : '🔄'}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--green)', marginBottom: 8 }}>It's {tossResult.toUpperCase()}!</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>You won the toss! Choose to bat or bowl.</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={() => handleTossChoice('bat')} style={{ padding: '14px 28px', background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: 10, color: 'var(--green)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>🏏 Bat First</button>
                <button onClick={() => handleTossChoice('bowl')} style={{ padding: '14px 28px', background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)', borderRadius: 10, color: 'var(--crimson-bright)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>🎯 Bowl First</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // XI PICKER SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'xi-picker') {
    return <XIPickerScreen myTeamId={myTeamId} team1Id={team1Id} team2Id={team2Id} team1Squad={team1Squad} team2Squad={team2Squad} onStart={handleStartMatch} />;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIVE MATCH SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'live') {
    const currentBatting = battingTeamId;
    const currentBowling = bowlingTeamId;
    const battingXI = currentBatting === team1Id ? team1XI : team2XI;
    const bowlingXI = currentBowling === team1Id ? team1XI : team2XI;

    const currentBatter = battingXI[activeBatterXIIdx] ?? battingXI[0];
    const currentBowler = bowlingXI[activeBowlerXIIdx] ?? bowlingXI[0];

    const isMyBatting = currentBatting === myTeamId;
    const oversDisplay = Math.floor(ballCount / 6);
    const ballsDisplay = ballCount % 6;
    const target = inning === 2 ? (scores[currentBowling]?.runs ?? 0) + 1 : null;

    // The XI the user picks FROM: always user's own XI
    const userOwnXI = myTeamId === team1Id ? team1XI : team2XI;

    const pickerMode = (pendingPick === 'opener-bat' || pendingPick === 'innings2-bat' || pendingPick === 'wicket')
      ? 'batter' : 'bowler';

    const pickerTitle =
      pendingPick === 'opener-bat'    ? '🏏 Choose Your Opener' :
      pendingPick === 'innings2-bat'  ? '🏏 Choose Inning 2 Opener' :
      pendingPick === 'wicket'        ? '🏏 Wicket! Choose Next Batter' :
      pendingPick === 'opener-bowl'   ? '🎯 Choose Opening Bowler' :
      pendingPick === 'innings2-bowl' ? '🎯 Choose Inning 2 Bowler' :
      pendingPick === 'new-over'      ? `🎯 Over ${oversDisplay} Done — New Bowler` : '';

    return (
      <div className="page">
        <div className="page-bg-pattern" />
        <div className="container" style={{ paddingTop: 16, paddingBottom: 32 }}>

          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
            Inning {inning} • Over {oversDisplay}.{ballsDisplay} / {OVERS}.0
          </div>

          {/* Scorecards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { teamId: team1Id, runs: scores[team1Id]?.runs ?? 0, wickets: scores[team1Id]?.wickets ?? 0 },
              { teamId: team2Id, runs: scores[team2Id]?.runs ?? 0, wickets: scores[team2Id]?.wickets ?? 0 },
            ].map(({ teamId, runs, wickets }) => {
              const t = getTeamById(teamId);
              const isBatting = currentBatting === teamId;
              return (
                <div key={teamId} style={{ padding: '12px', background: 'var(--bg-card)', border: `1px solid ${isBatting ? t?.color + '40' : 'var(--border)'}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{t?.short} · {isBatting ? 'Batting' : 'Bowling'}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: isBatting ? 'var(--gold)' : 'var(--text-secondary)' }}>{runs}/{wickets}</div>
                </div>
              );
            })}
          </div>

          {target && (
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--gold)', marginBottom: 12 }}>
              Target: {target} • Need {Math.max(0, target - (scores[currentBatting]?.runs ?? 0))} from {(OVERS - oversDisplay) * 6 - ballsDisplay} balls
            </div>
          )}

          {/* Current batter & bowler cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Batter</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentBatter?.name || '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{currentBatter?.role || ''}</div>
              {(() => { const s = playerStats[currentBatting]?.[activeBatterXIIdx]; return s ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)', marginTop: 3 }}>{s.runs} <span style={{ color: 'var(--text-muted)' }}>({s.balls}b)</span></div> : null; })()}
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Bowler</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentBowler?.name || '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{currentBowler?.role || ''}</div>
              {(() => { const s = playerStats[currentBowling]?.[activeBowlerXIIdx]; return s ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--crimson-bright)', marginTop: 3 }}>{s.wickets}w {s.runsConceded}r <span style={{ color: 'var(--text-muted)' }}>({Math.floor(s.balls/6)}.{s.balls%6}ov)</span></div> : null; })()}
            </div>
          </div>

          {/* Last ball result */}
          {lastUser !== null && !pendingPick && (
            <div style={{ marginBottom: 14, padding: '12px 16px', background: lastOut ? 'rgba(192,57,43,0.1)' : 'rgba(46,204,113,0.08)', border: `1px solid ${lastOut ? 'rgba(192,57,43,0.3)' : 'rgba(46,204,113,0.25)'}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{isMyBatting ? 'YOUR SHOT' : 'YOUR DELIVERY'}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: 'var(--green)' }}>{lastUser}</div>
                </div>
                <div style={{ fontSize: 16, color: 'var(--text-muted)' }}>vs</div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{isMyBatting ? 'AI DELIVERY' : 'AI SHOT'}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: lastOut ? 'var(--crimson-bright)' : 'var(--text-primary)' }}>{lastAI}</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  {lastOut
                    ? <div style={{ color: 'var(--crimson-bright)', fontWeight: 700, fontSize: 16 }}>OUT!</div>
                    : <div style={{ color: 'var(--green)', fontWeight: 700, fontSize: 20 }}>+{lastRuns}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Number pad — dimmed while picker open */}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: pendingPick ? 0.25 : 1, transition: 'opacity 0.2s' }}>
            {isMyBatting ? 'Pick a number to bat' : 'Pick a number to bowl'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, opacity: pendingPick ? 0.2 : 1, pointerEvents: pendingPick ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button key={n} onClick={() => handleBall(n)}
                style={{ padding: '18px', background: isMyBatting ? 'rgba(46,204,113,0.1)' : 'rgba(192,57,43,0.08)', border: `1px solid ${isMyBatting ? 'rgba(46,204,113,0.3)' : 'rgba(192,57,43,0.25)'}`, borderRadius: 10, color: isMyBatting ? 'var(--green)' : 'var(--crimson-bright)', fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, cursor: 'pointer' }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Player picker modal — overlaid on the live screen */}
        {pendingPick && (
          <PlayerPickerModal
            mode={pickerMode}
            xi={userOwnXI}
            usedBatterIndices={dismissedBatters}
            lastBowlerIdx={lastBowlerXIIdx}
            onPick={handlePickPlayer}
            title={pickerTitle}
          />
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESULT SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'result' && matchResult) {
    const isWin = matchResult.winner === myTeamId;
    const isTie = !matchResult.winner;
    const winnerTeamId = matchResult.winner;

    let resultText;
    if (isTie) {
      resultText = "It's a tie!";
    } else if (matchResult.chaseWin) {
      const wkts = matchResult.wicketsRemaining ?? 0;
      resultText = `${getTeamById(winnerTeamId)?.short} won by ${wkts} wicket${wkts !== 1 ? 's' : ''}`;
    } else {
      const margin = Math.abs(matchResult.score1 - matchResult.score2);
      resultText = `${getTeamById(winnerTeamId)?.short} won by ${margin} run${margin !== 1 ? 's' : ''}`;
    }

    return (
      <div className="page" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="page-bg-pattern" />
        {isWin && <ConfettiOverlay />}
        <div className="container" style={{ paddingTop: 32, paddingBottom: 48, position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div className={isWin ? 'sold-stamp' : 'unsold-stamp'} style={{ fontSize: 48, marginBottom: 8 }}>
            {isTie ? 'TIE' : isWin ? 'WIN! 🏆' : 'LOSS'}
          </div>
          {isWin && (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--gold)', letterSpacing: '0.1em', marginBottom: 20 }}>
              CONGRATULATIONS!
            </div>
          )}
          <div style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, maxWidth: 400, margin: '0 auto 24px', textAlign: 'left' }}>
            {[team1Id, team2Id].map((teamId, ti) => {
              const t = getTeamById(teamId);
              const xi = teamId === team1Id ? team1XI : team2XI;
              const runs = ti === 0 ? matchResult.score1 : matchResult.score2;
              const wickets = ti === 0 ? matchResult.wickets1 : matchResult.wickets2;
              const overs = ti === 0 ? OVERS : (matchResult.balls2 != null ? `${Math.floor(matchResult.balls2/6)}.${matchResult.balls2%6}` : OVERS);
              const stats = matchResult.playerStats?.[teamId] || {};
              const bowlingStats = matchResult.playerStats;
              // Find the opposing team's bowlers (they bowled against this team)
              const oppTeamId = teamId === team1Id ? team2Id : team1Id;
              const oppXI = teamId === team1Id ? team2XI : team1XI;
              const oppStats = bowlingStats?.[oppTeamId] || {};

              return (
                <div key={teamId}>
                  {ti > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />}
                  {/* Team header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <TeamBadge teamId={teamId} size={24} />
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: matchResult.winner === teamId ? t?.color : 'var(--text-secondary)' }}>{t?.short}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: matchResult.winner === teamId ? 'var(--gold)' : 'var(--text-muted)' }}>{runs}/{wickets} ({overs} Ov)</span>
                  </div>

                  {/* Batting scorecard */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 40px', gap: 4, padding: '4px 6px', marginBottom: 4 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Batter</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>R</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>B</div>
                    </div>
                    {xi.map((p, i) => {
                      const s = stats[i];
                      if (!s) return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 40px 40px', gap: 4, padding: '5px 6px', borderRadius: 4, marginBottom: 2, opacity: 0.4 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.name}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>—</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>—</div>
                        </div>
                      );
                      return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 40px 40px', gap: 4, padding: '5px 6px', background: s.out ? 'transparent' : 'rgba(46,204,113,0.05)', borderRadius: 4, marginBottom: 2 }}>
                          <div>
                            <div style={{ fontSize: 11, color: s.out ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: s.out ? 400 : 600 }}>{p.name}</div>
                            {s.out && <div style={{ fontSize: 9, color: 'var(--crimson-bright)' }}>out</div>}
                            {!s.out && <div style={{ fontSize: 9, color: 'var(--green)' }}>not out</div>}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)', textAlign: 'center', fontWeight: 600 }}>{s.runs}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>{s.balls}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bowling scorecard — only bowlers/all-rounders who actually bowled */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 30px 30px 50px', gap: 4, padding: '4px 6px', marginBottom: 4 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Bowler</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>W</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>R</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>Ov</div>
                    </div>
                    {oppXI.map((p, i) => {
                      const s = oppStats[i];
                      // Only show if they actually bowled AND are a bowler/all-rounder
                      if (!s || s.balls === 0) return null;
                      if (p.role !== 'Bowler' && p.role !== 'All-Rounder') return null;
                      return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 30px 30px 50px', gap: 4, padding: '5px 6px', borderRadius: 4, marginBottom: 2 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>{p.name}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--crimson-bright)', textAlign: 'center', fontWeight: 600 }}>{s.wickets}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>{s.runsConceded}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>{Math.floor(s.balls/6)}.{s.balls%6}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 13, fontWeight: 600, textAlign: 'center', color: isTie ? 'var(--text-muted)' : isWin ? 'var(--green)' : 'var(--crimson-bright)' }}>
              {resultText}
            </div>
          </div>
          <button onClick={() => {
            sessionStorage.removeItem('currentMatchId');
            sessionStorage.removeItem('currentMatchTeam1');
            sessionStorage.removeItem('currentMatchTeam2');
            navigate(tournamentId ? `/tournament/${tournamentId}` : '/');
          }} className="btn-primary" style={{ maxWidth: 280, margin: '0 auto' }}>
            Back to Tournament
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFETTI
// ─────────────────────────────────────────────────────────────────────────────
function ConfettiOverlay() {
  const canvasRef = React.useRef(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const COLORS = ['#D4AF37', '#2ECC71', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6'];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * -canvas.height,
      r: Math.random() * 7 + 4, color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx: (Math.random() - 0.5) * 3, vy: Math.random() * 4 + 2,
      rot: Math.random() * 360, rSpeed: (Math.random() - 0.5) * 6,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        ctx.restore();
        p.x += p.vx; p.y += p.vy; p.rot += p.rSpeed;
        if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    const stop = setTimeout(() => cancelAnimationFrame(raf), 4000);
    return () => { cancelAnimationFrame(raf); clearTimeout(stop); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// XI PICKER SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function XIPickerScreen({ myTeamId, team1Id, team2Id, team1Squad, team2Squad, onStart }) {
  const mySquad = myTeamId === team1Id ? team1Squad : team2Squad;
  const myTeam = getTeamById(myTeamId);
  const [sel, setSel] = useState([]);

  const toggle = (idx) => {
    if (sel.includes(idx)) setSel(sel.filter(i => i !== idx));
    else if (sel.length < 11) setSel([...sel, idx]);
  };

  return (
    <div className="page">
      <div className="page-bg-pattern" />
      <div className="container" style={{ paddingTop: 20, paddingBottom: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--gold)', marginBottom: 4 }}>Select Your XI</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ color: myTeam?.color }}>{myTeam?.short}</span> — pick 11 players
            <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', color: sel.length === 11 ? 'var(--green)' : 'var(--gold)' }}>{sel.length}/11</span>
          </div>
        </div>
        <div style={{ maxHeight: '65vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {mySquad.map((p, i) => (
            <button key={i} onClick={() => toggle(i)}
              style={{ padding: '10px 12px', background: sel.includes(i) ? 'rgba(46,204,113,0.12)' : 'var(--bg-card)', border: `1px solid ${sel.includes(i) ? 'rgba(46,204,113,0.35)' : 'var(--border)'}`, borderRadius: 8, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: sel.includes(i) ? 600 : 400 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{p.role}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⭐ {getPlayerRating(p).toFixed(1)}</span>
                {sel.includes(i) && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" fill="rgba(46,204,113,0.2)" stroke="var(--green)" strokeWidth="1.2" />
                    <path d="M4.5 7l2 2 3-3" stroke="var(--green)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
        <button onClick={() => onStart(sel.map(i => mySquad[i]))} disabled={sel.length !== 11} className="btn-primary" style={{ opacity: sel.length === 11 ? 1 : 0.4 }}>
          Start Match
        </button>
      </div>
    </div>
  );
}