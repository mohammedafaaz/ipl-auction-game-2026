import { TEAMS } from '../data/teams.js';

// ── Player strength rating (1–10) ─────────────────────────────────────────────
export function getPlayerRating(player) {
  if (!player) return 5;
  const poolBase = {
    marquee: 9, capped_batters: 7, capped_bowlers: 7, capped_allrounders: 7,
    overseas: 6, uncapped: 4, emerging: 3, clearance: 2, squad: 5,
  };
  const base = poolBase[player.pool] || 5;
  const price = parseFloat(player.soldPrice || player.basePrice || 0);
  const priceBoost = isNaN(price) ? 0 : Math.min(2, price / 10);
  return Math.min(10, Math.round((base + priceBoost) * 10) / 10);
}

// ── Team strength from squad ──────────────────────────────────────────────────
export function getTeamStrength(squad) {
  if (!squad || squad.length === 0) return { batting: 5, bowling: 5, overall: 5 };
  const batters = squad.filter(p => p.role === 'Batter' || p.role === 'WK-Batter');
  const bowlers = squad.filter(p => p.role === 'Bowler');
  const ars = squad.filter(p => p.role === 'All-Rounder');
  const avg = arr => arr.length ? arr.reduce((s, p) => s + getPlayerRating(p), 0) / arr.length : 5;
  const batting = (avg(batters) * 0.6 + avg(ars) * 0.4);
  const bowling = (avg(bowlers) * 0.6 + avg(ars) * 0.4);
  return { batting, bowling, overall: (batting + bowling) / 2 };
}

// ── Generate round-robin schedule for only the participating teams ──────────
export function generateSchedule(teamIds) {
  const matches = [];
  let id = 1;
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      matches.push({
        id: id++,
        team1: teamIds[i],
        team2: teamIds[j],
        status: 'pending',
        result: null,
        live: false, // true when match is currently being played
      });
    }
  }
  for (let i = matches.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [matches[i], matches[j]] = [matches[j], matches[i]];
  }
  return matches.map((m, i) => ({ ...m, matchNo: i + 1 }));
}

// ── Simulate a single AI vs AI match ─────────────────────────────────────────
export function simulateMatch(team1Id, team2Id, teamStates) {
  const s1 = getTeamStrength(teamStates[team1Id]?.squad || []);
  const s2 = getTeamStrength(teamStates[team2Id]?.squad || []);
  const OVERS = 5;
  const MAX_WICKETS = 10;

  function simulateInnings(battingStr, bowlingStr) {
    let runs = 0, wickets = 0, balls = 0;
    const totalBalls = OVERS * 6;
    while (balls < totalBalls && wickets < MAX_WICKETS) {
      const r = Math.random();
      const wicketChance = 0.08 - (battingStr - bowlingStr) * 0.005;
      if (r < Math.max(0.03, Math.min(0.15, wicketChance))) {
        wickets++;
      } else {
        const maxRun = Math.min(6, Math.round(battingStr * 0.8));
        runs += Math.floor(Math.random() * maxRun) + (battingStr > 6 ? 1 : 0);
      }
      balls++;
    }
    const oversPlayed = Math.floor(balls / 6) + (balls % 6) / 10;
    return { runs, wickets, overs: parseFloat(oversPlayed.toFixed(1)), balls };
  }

  const inn1 = simulateInnings(s1.batting, s2.bowling);
  const inn2 = simulateInnings(s2.batting, s1.bowling);

  let winner = null;
  if (inn2.runs > inn1.runs) winner = team2Id;
  else if (inn1.runs > inn2.runs) winner = team1Id;
  // tie → no winner

  return {
    winner,
    score1: inn1.runs, wickets1: inn1.wickets, overs1: inn1.overs, balls1: inn1.balls,
    score2: inn2.runs, wickets2: inn2.wickets, overs2: inn2.overs, balls2: inn2.balls,
  };
}

// ── Build initial points table ────────────────────────────────────────────────
export function buildPointsTable(teamIds) {
  return teamIds.reduce((acc, id) => {
    acc[id] = { teamId: id, played: 0, won: 0, lost: 0, tied: 0, points: 0, nrr: 0, runsFor: 0, oversFor: 0, runsAgainst: 0, oversAgainst: 0 };
    return acc;
  }, {});
}

// ── Apply match result to points table ───────────────────────────────────────
export function applyResultToTable(table, result, team1Id, team2Id) {
  const t1 = { ...table[team1Id] };
  const t2 = { ...table[team2Id] };

  t1.played++; t2.played++;
  t1.runsFor += result.score1; t1.oversFor += result.balls1 / 6;
  t1.runsAgainst += result.score2; t1.oversAgainst += result.balls2 / 6;
  t2.runsFor += result.score2; t2.oversFor += result.balls2 / 6;
  t2.runsAgainst += result.score1; t2.oversAgainst += result.balls1 / 6;

  if (result.winner === team1Id) { t1.won++; t1.points += 2; t2.lost++; }
  else if (result.winner === team2Id) { t2.won++; t2.points += 2; t1.lost++; }
  else { t1.tied++; t1.points += 1; t2.tied++; t2.points += 1; }

  t1.nrr = t1.oversFor > 0 && t1.oversAgainst > 0
    ? parseFloat(((t1.runsFor / t1.oversFor) - (t1.runsAgainst / t1.oversAgainst)).toFixed(3)) : 0;
  t2.nrr = t2.oversFor > 0 && t2.oversAgainst > 0
    ? parseFloat(((t2.runsFor / t2.oversFor) - (t2.runsAgainst / t2.oversAgainst)).toFixed(3)) : 0;

  return { ...table, [team1Id]: t1, [team2Id]: t2 };
}

// ── Sort points table ─────────────────────────────────────────────────────────
export function sortedTable(table) {
  return Object.values(table).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.nrr - a.nrr;
  });
}

// ── Generate playoff bracket from top 4 ──────────────────────────────────────
export function generatePlayoffs(top4) {
  return {
    q1: { team1: top4[0], team2: top4[1], status: 'pending', result: null },       // 1st vs 2nd → winner to Final
    elim: { team1: top4[2], team2: top4[3], status: 'pending', result: null },     // 3rd vs 4th → winner to Q2
    q2: { team1: null, team2: null, status: 'pending', result: null },             // Q1 loser vs Elim winner → winner to Final
    final: { team1: null, team2: null, status: 'pending', result: null },          // Q1 winner vs Q2 winner
  };
}

// ── Auto-select best XI from squad ───────────────────────────────────────────
export function autoSelectXI(squad) {
  const sorted = [...squad].sort((a, b) => getPlayerRating(b) - getPlayerRating(a));
  // Ensure role balance: min 3 batters, 3 bowlers, 1 WK
  const wk = sorted.filter(p => p.role === 'WK-Batter').slice(0, 1);
  const bat = sorted.filter(p => p.role === 'Batter').slice(0, 4);
  const bowl = sorted.filter(p => p.role === 'Bowler').slice(0, 3);
  const ar = sorted.filter(p => p.role === 'All-Rounder').slice(0, 3);
  const xi = [...wk, ...bat, ...bowl, ...ar];
  // Fill remaining slots with highest rated remaining players
  const used = new Set(xi.map(p => p.id));
  for (const p of sorted) {
    if (xi.length >= 11) break;
    if (!used.has(p.id)) { xi.push(p); used.add(p.id); }
  }
  return xi.slice(0, 11);
}

// ── Hand Cricket: simulate AI ball pick ──────────────────────────────────────
export function getAIHandPick(bowlingStrength) {
  // AI slightly biases toward numbers that statistically get wickets
  const weights = [0.18, 0.18, 0.17, 0.17, 0.15, 0.15];
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i];
    if (r < cum) return i + 1;
  }
  return 6;
}

// ── Format overs (e.g. 4.3 = 4 overs 3 balls) ───────────────────────────────
export function formatOvers(balls) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}
