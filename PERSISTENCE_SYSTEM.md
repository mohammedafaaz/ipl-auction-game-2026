# Auction & Tournament Persistence - Recovery System

## Overview
Implemented localStorage-based recovery system to prevent data loss on page refresh or accidental exit.

---

## Solo Auction Persistence

### Storage Key
`soloAuctionInProgress`

### Data Structure
```json
{
  "teamId": "MI",
  "playerPool": "[...]",
  "teamStates": "{...}",
  "stage": "retention" | "auction",
  "timestamp": 1234567890
}
```

### Save Points
1. **SoloSetup.jsx** - Initial setup
2. **Retention.jsx** - After retention confirmation
3. **Auction.jsx** - Every 10 seconds during auction
4. **Auction.jsx** - Cleared on auction completion/end

### Recovery Flow
1. Home page checks for `soloAuctionInProgress`
2. Shows resume dialog with team info and stage
3. User can resume or start new
4. Resume: Restores sessionStorage and navigates to correct page

---

## Multiplayer Auction Persistence

### Storage Key
`multiplayerAuctionInProgress`

### Data Structure
```json
{
  "roomCode": "IPL-XXXX",
  "playerId": "player_123",
  "playerName": "John",
  "teamId": "CSK",
  "timestamp": 1234567890
}
```

### Save Points
1. **CreateRoom.jsx** - After room creation
2. **JoinRoom.jsx** - After joining room
3. **Auction.jsx** - Cleared on auction end (multiplayer uses Firebase)

### Recovery Flow
1. Home page checks for `multiplayerAuctionInProgress`
2. Shows resume dialog with room code and team
3. Checks if room still exists in Firebase
4. Navigates to appropriate page based on room status

---

## Pre-Squad Tournament Persistence

### Storage Key
`preSquadTournamentInProgress`

### Data Structure
```json
{
  "tournamentId": "tournament_123",
  "myTeamId": "RCB",
  "timestamp": 1234567890
}
```

### Save Points
1. **TournamentSetup.jsx** - Initial setup
2. **PreSquadTournament.jsx** - After each match (simulate/play)
3. Cleared on tournament completion

### Recovery Flow
1. Home page checks for saved tournament
2. Shows resume dialog (already implemented)
3. Restores from localStorage

---

## Post-Auction Tournament Persistence

Uses same mechanism as pre-squad but with different storage key:
`postAuctionTournamentData` (in sessionStorage)

---

## Multiplayer Tournament Persistence

**No localStorage needed** - Firebase is single source of truth
- Room data persists in Firebase
- Players can rejoin via room code
- Tournament state syncs automatically

---

## Implementation Status

### ✅ Completed
- Solo auction save/resume
- Multiplayer auction save/resume
- Pre-squad tournament save/resume
- Home page resume dialogs
- Visual indicators (gold dot) on home buttons
- Periodic saves during auction (10s interval)
- Clear on completion

### 🔄 Refresh Handling
All modes now handle page refresh:
- **Solo Auction**: Saves to localStorage every 10s
- **Multiplayer Auction**: Firebase handles persistence
- **Tournaments**: localStorage saves after each match

---

## User Experience

### Visual Indicators
- Gold pulsing dot on home page buttons when saved data exists
- Shows team badge and stage in resume dialogs

### Resume Dialogs
- Clear "Continue" vs "Start New" options
- Shows relevant info (team, stage, room code)
- Validates data before resuming

### Error Handling
- Checks if multiplayer room still exists
- Clears invalid localStorage data
- Graceful fallback to home page

---

## Testing Checklist

- [ ] Solo auction: Refresh during retention
- [ ] Solo auction: Refresh during auction
- [ ] Solo auction: Close tab and reopen
- [ ] Solo auction: Complete auction clears data
- [ ] Multiplayer: Refresh during lobby
- [ ] Multiplayer: Refresh during auction
- [ ] Multiplayer: Room no longer exists handling
- [ ] Tournament: Refresh during matches
- [ ] Tournament: Complete tournament clears data
- [ ] Home page: Shows correct resume dialogs
- [ ] Home page: Visual indicators appear
