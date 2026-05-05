import { TEAMS, PURSE_TOTAL, RETENTION_COSTS, MAX_RTM_CARDS, getNextBidAmount } from '../data/teams.js';
import { buildSquadMap } from '../data/squads2026.js';

export function initTeamState(teamId) {
  return {
    id: teamId,
    purse: PURSE_TOTAL,
    squad: [],
    retentions: [],
    rtmCards: MAX_RTM_CARDS,
    rtmPlayers: [],
    purseHistory: [PURSE_TOTAL],
  };
}

export function applyRetention(teamState, player, slotIndex) {
  const cost = RETENTION_COSTS[slotIndex] || RETENTION_COSTS[RETENTION_COSTS.length - 1];
  const newPurse = Math.max(0, teamState.purse - cost);
  return {
    ...teamState,
    purse: newPurse,
    squad: [...teamState.squad, { ...player, soldPrice: cost, source: 'retention' }],
    retentions: [...teamState.retentions, player.id],
    rtmPlayers: [...teamState.rtmPlayers],
    purseHistory: [...(teamState.purseHistory || [PURSE_TOTAL]), newPurse],
  };
}

export function applyBidWin(teamState, player, soldPrice) {
  const newPurse = Math.round((teamState.purse - soldPrice) * 100) / 100;
  return {
    ...teamState,
    purse: newPurse,
    squad: [...teamState.squad, { ...player, soldPrice, source: 'auction' }],
    purseHistory: [...(teamState.purseHistory || [PURSE_TOTAL]), newPurse],
  };
}

export function applyRTM(teamState, player, matchPrice) {
  const newPurse = Math.round((teamState.purse - matchPrice) * 100) / 100;
  return {
    ...teamState,
    purse: newPurse,
    squad: [...teamState.squad, { ...player, soldPrice: matchPrice, source: 'rtm' }],
    rtmCards: teamState.rtmCards - 1,
    purseHistory: [...(teamState.purseHistory || [PURSE_TOTAL]), newPurse],
  };
}

export function getSquadGaps(squad) {
  const roles = { Batter: 0, Bowler: 0, 'All-Rounder': 0, 'WK-Batter': 0 };
  const overseas = squad.filter(p => p.isOverseas).length;
  squad.forEach(p => { if (roles[p.role] !== undefined) roles[p.role]++; });

  const gaps = [];
  if (roles.Batter < 3) gaps.push('needs batters');
  if (roles.Bowler < 3) gaps.push('needs bowlers');
  if (roles['WK-Batter'] < 1) gaps.push('needs wicketkeeper');
  if (roles['All-Rounder'] < 2) gaps.push('needs all-rounders');
  if (overseas < 4) gaps.push('can take overseas players');
  if (squad.length < 15) gaps.push(`needs ${15 - squad.length} more players`);
  return gaps;
}

export function canBid(teamState, amount) {
  return teamState.purse >= amount && teamState.squad.length < 25;
}

export function canUseRTM(teamState, playerId) {
  return teamState.rtmCards > 0 && teamState.rtmPlayers.includes(playerId);
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'IPL-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function assignRTMEligibility(teams, players, aiSquadMap = null) {
  const playerIdSet = new Set(players.map(p => p.id));
  const squadMap2026 = buildSquadMap(players);
  const source = aiSquadMap || squadMap2026;
  const result = {};
  teams.forEach(t => {
    result[t.id] = (source[t.id] || []).filter(id => playerIdSet.has(id));
  });
  return result;
}

export function sortPlayersByPool(players, pools) {
  const poolOrder = {};
  pools.forEach(p => { poolOrder[p.id] = p.order; });
  return [...players].sort((a, b) => {
    const po = (poolOrder[a.pool] || 99) - (poolOrder[b.pool] || 99);
    if (po !== 0) return po;
    return b.basePrice - a.basePrice;
  });
}

// Build clearance pool — unsold players at 50% base price, min 0.2 Cr
export function buildClearancePool(playerPool) {
  return playerPool
    .filter(p => p.auctioned && !p.sold)
    .map(p => ({
      ...p,
      auctioned: false,
      basePrice: Math.max(0.2, Math.round(p.basePrice * 0.5 * 100) / 100),
      pool: 'clearance',
      isClearance: true,
    }));
}

export function getRoleColor(role) {
  const map = {
    'Batter': '#3498DB',
    'Bowler': '#E74C3C',
    'All-Rounder': '#2ECC71',
    'WK-Batter': '#E67E22',
  };
  return map[role] || '#A09880';
}

export function getRoleBadgeClass(role) {
  const map = {
    'Batter': 'badge-batter',
    'Bowler': 'badge-bowler',
    'All-Rounder': 'badge-allrounder',
    'WK-Batter': 'badge-wk',
  };
  return map[role] || 'badge-batter';
}

// Sanitize squad players for Firebase storage — prevents circular references
// Only stores essential fields instead of full player objects
export function sanitizeSquadPlayer(player) {
  if (!player || typeof player !== 'object') return player;
  return {
    id: player.id,
    name: player.name,
    role: player.role,
    nationality: player.nationality,
    basePrice: player.basePrice,
    isOverseas: player.isOverseas,
    isCapped: player.isCapped,
    pool: player.pool,
    soldPrice: player.soldPrice,
    source: player.source || 'auction',
  };
}

// Sanitize entire team state for Firebase storage
export function sanitizeTeamStateForFirebase(teamState) {
  if (!teamState) return teamState;
  return {
    id: teamState.id,
    purse: teamState.purse,
    squad: Array.isArray(teamState.squad) 
      ? teamState.squad.map(p => sanitizeSquadPlayer(p))
      : [],
    retentions: Array.isArray(teamState.retentions) ? teamState.retentions : [],
    rtmCards: teamState.rtmCards,
    rtmPlayers: Array.isArray(teamState.rtmPlayers) ? teamState.rtmPlayers : [],
    purseHistory: Array.isArray(teamState.purseHistory) ? teamState.purseHistory : [],
  };
}

// Sanitize all team states before Firebase update
export function sanitizeTeamStatesForFirebase(teamStates) {
  if (!teamStates || typeof teamStates !== 'object') return teamStates;
  const result = {};
  for (const [teamId, state] of Object.entries(teamStates)) {
    result[teamId] = sanitizeTeamStateForFirebase(state);
  }
  return result;
}
