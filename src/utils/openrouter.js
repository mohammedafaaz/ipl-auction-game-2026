import { TEAM_SQUAD_MAP } from '../data/players.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callOpenRouter(apiKey, messages, maxTokens = 200) {
  const models = [
    'openai/gpt-oss-20b:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-3-12b-it:free',
    'meta-llama/llama-3.2-3b-instruct:free',
  ];

  let lastError;
  for (const model of models) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'IPL Mega Auction',
        },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.3, messages }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err.error?.message || `API error ${response.status}`;
        if (response.status === 429) await sleep(1500);
        lastError = new Error(msg);
        continue; // try next model
      }
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      if (!text.trim()) { lastError = new Error('Empty response'); continue; }
      return text;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('All models failed');
}

// Get player insight card
export async function getPlayerInsight(apiKey, player) {
  const prompt = `Write a 3-line IPL auction scouting report for ${player.name} (${player.role}, ${player.nationality}). Line 1: one key career stat or IPL achievement. Line 2: their T20 value and what they bring to a team. Line 3: a weakness or risk. Reply with exactly 3 lines of plain text, no numbering, no markdown.`;
  const text = await callOpenRouter(apiKey, [{ role: 'user', content: prompt }], 250);
  if (!text || !text.trim()) throw new Error('Empty response from model');
  return text.trim();
}

// Fetch latest IPL squad — one team at a time with delay to avoid 429
export async function fetchLatestSquads(apiKey, playerPool) {
  console.log('[fetchLatestSquads] called with key:', apiKey ? apiKey.slice(0, 12) + '...' : 'MISSING');

  const TEAM_NAMES = {
    csk: 'Chennai Super Kings', mi: 'Mumbai Indians', rcb: 'Royal Challengers Bengaluru',
    kkr: 'Kolkata Knight Riders', dc: 'Delhi Capitals', srh: 'Sunrisers Hyderabad',
    rr: 'Rajasthan Royals', pbks: 'Punjab Kings', lsg: 'Lucknow Super Giants', gt: 'Gujarat Titans',
  };

  const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const slugMap = {};
  const teamEntries = Object.entries(TEAM_SQUAD_MAP);

  for (let i = 0; i < teamEntries.length; i++) {
    const [teamId, slugs] = teamEntries[i];
    const teamPlayers = playerPool.filter(p => slugs.includes(p.id));

    if (teamPlayers.length === 0) { slugMap[teamId] = slugs; continue; }

    // Wait between calls to avoid rate limiting
    if (i > 0) await sleep(2000);

    const nameList = teamPlayers.map(p => p.name).join(', ');
    const prompt = `Which of these players are in ${TEAM_NAMES[teamId]}'s IPL 2025 squad? Players: ${nameList}. Reply ONLY with a JSON array of confirmed player names from the list above. No explanation.`;

    try {
      const text = await callOpenRouter(apiKey, [{ role: 'user', content: prompt }], 400);
      const cleaned = text.replace(/```json|```/gi, '').trim();
      const match = cleaned.match(/\[[\s\S]*?\]/);
      if (!match) { slugMap[teamId] = slugs; continue; }

      const confirmedNames = JSON.parse(match[0]);
      const nameToSlug = {};
      teamPlayers.forEach(p => { nameToSlug[normalize(p.name)] = p.id; });

      const confirmed = confirmedNames
        .map(n => nameToSlug[normalize(String(n))])
        .filter(Boolean);

      slugMap[teamId] = confirmed.length >= 2 ? confirmed : slugs;
      console.log(`[squads] ${teamId}: ${confirmed.length} players confirmed by AI`);
    } catch (e) {
      console.warn(`[squads] ${teamId} failed, using CSV:`, e.message);
      slugMap[teamId] = slugs;
    }
  }

  return slugMap;
}

// AI skip decision — which team buys the player when human passes
export async function getAISkipDecision(apiKey, player, currentBid, leadingTeamName, aiTeams) {
  const leadInfo = leadingTeamName
    ? `Current highest bid: ₹${currentBid}Cr by ${leadingTeamName}`
    : `No bids placed yet. Base price: ₹${currentBid}Cr`;

  const teamsInfo = aiTeams.map(t =>
    `- ${t.name} (id: ${t.id}): ₹${t.purse.toFixed(1)}Cr left, ${t.squadSize} players, needs: ${t.gaps.slice(0, 3).join(', ') || 'balanced squad'}`
  ).join('\n');

  const prompt = `IPL Auction simulation. The human player has passed on bidding for this player.

Player: ${player.name} | Role: ${player.role} | Origin: ${player.nationality} | Pool: ${player.pool}
${leadInfo}

AI Teams available to bid:
${teamsInfo}

Based on realistic IPL auction logic, decide which ONE team buys this player (considering purse, squad needs, player value).
Reply ONLY with valid JSON, no explanation, no markdown:
{"teamId": "TEAM_ID", "price": PRICE_IN_CRORES}
Or if no team should realistically buy this player:
{"teamId": null}`;

  try {
    const text = await callOpenRouter(apiKey, [{ role: 'user', content: prompt }], 80);
    const cleaned = text.replace(/```json|```/gi, '').trim();
    const match = cleaned.match(/\{[\s\S]*?\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (!parsed.teamId) return null;
    const validTeam = aiTeams.find(t => t.id === parsed.teamId);
    if (!validTeam) return null;
    const price = Math.max(currentBid, Math.round((parseFloat(parsed.price) || currentBid) * 100) / 100);
    return { teamId: parsed.teamId, price };
  } catch (e) {
    console.error('getAISkipDecision failed:', e.message);
    return null;
  }
}

// AI bidding decision
export async function getAIBidDecision(apiKey, teamName, player, currentBid, remainingPurse, squadGaps) {
  const prompt = `IPL auction. You are ${teamName} with ₹${remainingPurse}Cr left. Current bid on ${player.name} (${player.role}): ₹${currentBid}Cr. Squad gaps: ${squadGaps.join(', ')}. Reply with ONLY "BID" or "PASS".`;
  try {
    const text = await callOpenRouter(apiKey, [{ role: 'user', content: prompt }], 10);
    return text.trim().toUpperCase().startsWith('BID') ? 'BID' : 'PASS';
  } catch {
    return 'PASS';
  }
}
