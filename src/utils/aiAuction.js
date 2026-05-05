import { getNextBidAmount, PURSE_TOTAL } from '../data/teams.js';
import { canBid, getSquadGaps } from './gameLogic.js';

// Heuristic AI bid decision (used when no API key or as fallback)
export function shouldAIBid(teamState, player, currentBid, bluffActive = false) {
  if (!canBid(teamState, getNextBidAmount(currentBid))) return false;

  const purseRatio = teamState.purse / PURSE_TOTAL;
  const squadSize = teamState.squad.length;
  const gaps = getSquadGaps(teamState.squad);
  const needsRole = gaps.some(g => g.includes(player.role?.toLowerCase()) ||
                                    (player.role === 'WK-Batter' && g.includes('wicketkeeper')));
  const overseasCount = teamState.squad.filter(p => p.isOverseas).length;

  if (player.isOverseas && overseasCount >= 8) return false;

  const bidRatio = currentBid / (player.basePrice || 1);

  // Per-pool realistic max multipliers based on actual IPL 2025 auction data
  // Each team gets a slight variance via teamSeed so they don't all drop at the same price
  const teamSeed = teamState.id ? (teamState.id.charCodeAt(0) % 10) / 10 : 0.5; // 0.0–0.9
  const pool = player.pool;

  let baseMax;
  if (pool === 'marquee')           baseMax = 8  + teamSeed * 5;   // 8–13x  (e.g. Kohli 2→18Cr)
  else if (pool === 'capped_batters' ||
           pool === 'capped_bowlers' ||
           pool === 'capped_allrounders') baseMax = 3 + teamSeed * 5; // 3–8x   (e.g. Axar 2→16Cr)
  else if (pool === 'overseas')     baseMax = 2  + teamSeed * 4;   // 2–6x   (e.g. Starc 2→11Cr)
  else if (pool === 'uncapped')     baseMax = 2  + teamSeed * 8;   // 2–10x  (high variance)
  else                              baseMax = 1  + teamSeed * 2;   // 1–3x   (emerging)

  // Role need raises the ceiling by up to 20%
  const maxMultiplier = needsRole ? baseMax * 1.2 : baseMax;

  // Hard stop — team won't go beyond their ceiling
  if (bidRatio >= maxMultiplier) return false;

  // Base probability — teams are selective
  let bidProb = 0.25;

  if (needsRole) bidProb += 0.2;
  if (pool === 'marquee') bidProb += 0.1;

  // Purse conservation
  if (purseRatio < 0.4) bidProb -= 0.1;
  if (purseRatio < 0.25) bidProb -= 0.15;
  if (purseRatio < 0.15) bidProb -= 0.25;

  // Continuous drop as bid approaches the team's ceiling
  const inflationPct = bidRatio / maxMultiplier; // 0→1
  bidProb -= inflationPct * 0.25;

  // Squad size penalty
  if (squadSize > 18) bidProb -= 0.1;
  if (squadSize > 22) bidProb -= 0.2;

  // Bluff penalty — human is pretending not to be interested
  if (bluffActive) bidProb -= 0.35;

  bidProb += (Math.random() - 0.5) * 0.15;

  return Math.random() < Math.max(0, Math.min(0.85, bidProb));
}

// Simulate AI team retention choices
export function pickAIRetentions(teamId, players, count = 3) {
  // Prioritize marquee > capped > role balance
  const sorted = [...players].sort((a, b) => {
    const poolPriority = { marquee: 5, capped_batters: 4, capped_bowlers: 4, capped_allrounders: 4, overseas: 3, uncapped: 2, emerging: 1 };
    return (poolPriority[b.pool] || 0) - (poolPriority[a.pool] || 0);
  });

  const retained = [];
  const roles = { Batter: 0, Bowler: 0, 'All-Rounder': 0, 'WK-Batter': 0 };

  for (const p of sorted) {
    if (retained.length >= count) break;
    // Ensure balance
    const roleCount = roles[p.role] || 0;
    if (roleCount < 2) {
      retained.push(p);
      roles[p.role] = (roles[p.role] || 0) + 1;
    }
  }

  // Fill remaining slots if needed
  for (const p of sorted) {
    if (retained.length >= count) break;
    if (!retained.find(r => r.id === p.id)) {
      retained.push(p);
    }
  }

  return retained.slice(0, count);
}

// Get AI bid amount - AI always bids at next increment
export function getAIBidAmount(currentBid) {
  return getNextBidAmount(currentBid);
}

// Simulate a full bidding war between AI teams and return { winner, finalBid, history }
// startingBid: current bid to start from (base price or live bid)
// existingLeader: teamId that already holds the bid, or null
// excludeTeamId: human player's team — excluded from simulation
export function simulateBiddingWar(teamStates, player, startingBid, existingLeader, excludeTeamId) {
  const teamIds = Object.keys(teamStates).filter(id => id !== excludeTeamId);

  // Snapshot purses so we don't mutate real state
  const purses = {};
  teamIds.forEach(id => { purses[id] = teamStates[id].purse; });

  let bid = startingBid;
  let leader = existingLeader || null;
  const history = [];
  const MAX_ROUNDS = 40;
  let rounds = 0;

  while (rounds++ < MAX_ROUNDS) {
    // Shuffle order each round for variety
    const shuffled = [...teamIds].sort(() => Math.random() - 0.5);
    let anyBid = false;

    for (const teamId of shuffled) {
      if (teamId === leader) continue;
      const state = teamStates[teamId];
      if (!state) continue;
      const nextBid = getNextBidAmount(bid);
      if (purses[teamId] < nextBid) continue;
      if (!shouldAIBid({ ...state, purse: purses[teamId] }, player, bid)) continue;

      bid = nextBid;
      leader = teamId;
      history.push({ teamId, amount: bid, ts: Date.now() });
      anyBid = true;
      break; // one bid per round, then re-evaluate all teams
    }

    if (!anyBid) break; // nobody raised — auction settled
  }

  return { winner: leader, finalBid: bid, history };
}