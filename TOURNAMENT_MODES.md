# IPL Auction Game - Tournament Modes

## Three Completely Independent Tournament Modes

### Mode 1: Pre-Squad Tournament (Default Squads)
**File:** `PreSquadTournament.jsx`
**Route:** `/pre-squad-tournament/:id`
**Access:** Home page → Tournament button → Start new tournament

**Features:**
- Uses official 2026 IPL squads (predefined)
- ✅ **SIMULATE option available** for all matches
- ✅ **Parallel matches** - multiple matches can be played/simulated simultaneously
- User can play their team's matches manually via Hand Cricket
- All other matches can be instantly simulated
- Full tournament structure: fixtures, points table, playoffs
- No restrictions on match order

**Key Logic:**
```javascript
// Simulate button always available
<button onClick={() => handleSimulateMatch(m)}>⚡ Simulate</button>

// No sequential restrictions
const canPlayNext = true; // Any match can be played/simulated anytime
```

---

### Mode 2: Post-Auction Tournament (User's Custom Squad)
**File:** `PostAuctionTournament.jsx`
**Route:** `/post-auction-tournament`
**Access:** After completing auction → Final Squads page → "Start Tournament with Auction Squads" button

**Features:**
- Uses squads built by user during auction
- ✅ **SIMULATE option available** for all matches
- ✅ **Parallel matches** - multiple matches can be played/simulated simultaneously
- Identical logic to Mode 1, ONLY difference is squad source
- User can play their team's matches manually
- All other matches can be instantly simulated
- Full tournament structure: fixtures, points table, playoffs

**Key Logic:**
```javascript
// Same as Mode 1 - simulate always available
<button onClick={() => handleSimulateMatch(m)}>⚡ Simulate</button>

// Squad source is different
const teamStates = JSON.parse(sessionStorage.getItem('soloTeamStates'));
```

---

### Mode 3: Multiplayer Tournament (Room-Based)
**File:** `Tournament.jsx` (existing file, updated)
**Route:** `/tournament/:id`
**Access:** Multiplayer Tournament Setup page

**Features:**
- Room-based with multiple real players
- ❌ **NO SIMULATE option** - every match must be played manually
- ❌ **Sequential matches ONLY** - only ONE match at a time
- Matches proceed in queue order
- Real-time Firebase sync across all players
- Variable team count (2-10 teams)

**Key Logic:**
```javascript
// NO simulate button in multiplayer mode
// Only play button, disabled if not your match
<button onClick={() => handlePlayMatch(m)} disabled={!mine}>
  {mine ? '▶ Play Match' : '⏳ Waiting for match to start'}
</button>

// Sequential restriction enforced
const liveMatch = schedule.find(m => m.live);
const canPlayNext = !liveMatch && nextMatch; // Only if no match is live
```

---

## Critical Differences Summary

| Feature | Mode 1 (Pre-Squad) | Mode 2 (Post-Auction) | Mode 3 (Multiplayer) |
|---------|-------------------|----------------------|---------------------|
| Squad Source | Default 2026 squads | User auction squads | Default 2026 squads |
| Simulate Option | ✅ YES | ✅ YES | ❌ NO |
| Parallel Matches | ✅ YES | ✅ YES | ❌ NO (Sequential) |
| Match Order | Any order | Any order | Strict queue |
| Players | Solo | Solo | 2-10 real players |
| Firebase Sync | Optional | No | Required |

---

## Implementation Rules Followed

1. ✅ **No shared logic with condition flags** - Each mode has its own file
2. ✅ **Mode 1 & 2 are identical in behavior** - Only squad source differs
3. ✅ **Mode 3 is completely different** - No simulate, sequential only
4. ✅ **Clear UI distinction** - Different routes, different setup flows
5. ✅ **Independent state management** - Each mode uses different session storage keys

---

## User Flow

### Pre-Squad Tournament (Mode 1)
1. Home → Tournament button
2. Select team
3. Tournament page with simulate buttons
4. Play/simulate matches in any order

### Post-Auction Tournament (Mode 2)
1. Complete auction (solo mode)
2. Final Squads page
3. Click "Start Tournament with Auction Squads"
4. Tournament page with simulate buttons
5. Play/simulate matches in any order

### Multiplayer Tournament (Mode 3)
1. Home → Create multiplayer tournament
2. Select teams, create room
3. Players join room
4. Tournament page WITHOUT simulate
5. Matches proceed sequentially, one at a time
6. All players wait for current match to complete

---

## Files Modified/Created

**New Files:**
- `src/pages/PreSquadTournament.jsx` - Mode 1
- `src/pages/PostAuctionTournament.jsx` - Mode 2
- `src/pages/MultiplayerTournamentSetup.jsx` - Mode 3 setup

**Modified Files:**
- `src/pages/Tournament.jsx` - Updated to be Mode 3 (multiplayer only)
- `src/pages/TournamentSetup.jsx` - Routes to Mode 1
- `src/pages/FinalSquads.jsx` - Routes to Mode 2
- `src/pages/Home.jsx` - Updated tournament card description
- `src/App.jsx` - Added routes for all three modes

**No Changes Needed:**
- `src/utils/tournament.js` - Shared utility functions (simulate, schedule generation)
- `src/pages/HandCricket.jsx` - Works with all three modes
