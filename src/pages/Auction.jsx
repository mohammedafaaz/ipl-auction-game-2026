import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { database } from '../firebase.js';
import { ref, onValue, off, update, serverTimestamp, onDisconnect } from 'firebase/database';
import { TEAMS, POOLS, getNextBidAmount, formatCrore, getTeamById } from '../data/teams.js';
import { useApp } from '../AppContext.jsx';
import { canBid, canUseRTM, applyBidWin, applyRTM, sortPlayersByPool, sanitizeTeamStatesForFirebase, sanitizeTeamStateForFirebase } from '../utils/gameLogic.js';
import { shouldAIBid, getAIBidAmount, simulateBiddingWar } from '../utils/aiAuction.js';
import { getPlayerInsight } from '../utils/openrouter.js';
import { playBidSound, playGavelSound, playCrowdCheer, playFanfare, playUnsoldSound, playNewPlayerSound } from '../utils/sounds.js';

import PlayerCard from '../components/PlayerCard.jsx';
import BidTimer from '../components/BidTimer.jsx';
import PurseBar from '../components/PurseBar.jsx';
import TeamBadge from '../components/TeamBadge.jsx';
import SquadViewer from '../components/SquadViewer.jsx';
import PlayerPoolViewer from '../components/PlayerPoolViewer.jsx';
import RecentsPanel from '../components/RecentsPanel.jsx';
import AIInsightPanel from '../components/AIInsightPanel.jsx';

const TIMER_DURATION = 30000;
const BID_RESET_DURATION = 15000;

export default function Auction() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { showToast } = useApp();

  const isSolo = sessionStorage.getItem('soloMode') === 'true';
  const soloTeamId = sessionStorage.getItem('soloTeamId');
  const playerId = sessionStorage.getItem('playerId');
  const openRouterKey = import.meta.env.VITE_OPENROUTER_KEY || '';

  const [playerPool, setPlayerPool] = useState([]);
  const [teamStates, setTeamStates] = useState({});
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [leadingTeam, setLeadingTeam] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [timerExpiry, setTimerExpiry] = useState(Date.now() + TIMER_DURATION);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [phase, setPhase] = useState('bidding');
  const [soldInfo, setSoldInfo] = useState(null);
  const [showSquad, setShowSquad] = useState(false);
  const [showPool, setShowPool] = useState(false);
  const [showAllSquads, setShowAllSquads] = useState(false);
  const [showRecents, setShowRecents] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showSquadFullModal, setShowSquadFullModal] = useState(false);
  const [recentPlayers, setRecentPlayers] = useState([]);
  const [skipLoading, setSkipLoading] = useState(false);
  const [myTeamId, setMyTeamId] = useState(isSolo ? soloTeamId : null);
  const [room, setRoom] = useState(null);
  const [skippedTeams, setSkippedTeams] = useState(new Set());
  const [scoutReady, setScoutReady] = useState(false);
  const [bluffActive, setBluffActive] = useState(false);
  const [bluffUsed, setBluffUsed] = useState(false);

  const aiTimerRef = useRef(null);
  const squadFullShownRef = useRef(false);
  const bidHistoryRef = useRef([]);
  const pauseStartRef = useRef(null);

  const myTeamState = teamStates[myTeamId];
  const squadFull = (myTeamState?.squad?.length ?? 0) >= 25;
  const squadReady = isSolo && (myTeamState?.squad?.length ?? 0) >= 18;

  const handleFinishAuction = useCallback(() => {
    if (!isSolo) return;
    clearTimeout(aiTimerRef.current);

    // Clear localStorage on completion
    localStorage.removeItem('soloAuctionInProgress');

    // Fill any AI team below 18 with random unsold players
    const unsold = playerPool.filter(p => !p.auctioned);
    const shuffled = [...unsold].sort(() => Math.random() - 0.5);
    let fillPool = [...shuffled];
    const newStates = { ...teamStates };

    for (const team of TEAMS) {
      if (team.id === myTeamId) continue;
      const state = newStates[team.id];
      if (!state) continue;
      let needed = 18 - state.squad.length;
      while (needed > 0 && fillPool.length > 0) {
        const p = fillPool.shift();
        newStates[team.id] = {
          ...newStates[team.id],
          squad: [...newStates[team.id].squad, { ...p, soldPrice: p.basePrice, source: 'auction' }],
        };
        needed--;
      }
    }

    sessionStorage.setItem('soloTeamStates', JSON.stringify(newStates));
    sessionStorage.setItem('soloPlayerPool', JSON.stringify(playerPool.map(p => ({ ...p, auctioned: true }))));
    navigate('/solo-final');
  }, [isSolo, playerPool, teamStates, myTeamId, navigate]);

  const resetForPlayer = useCallback((player) => {
    if (!player) { setPhase('ended'); return; }
    setCurrentPlayer(player);
    setCurrentBid(player.basePrice);
    setLeadingTeam(null);
    setBidHistory([]);
    setTimerExpiry(Date.now() + TIMER_DURATION);
    setPhase('bidding');
    setSoldInfo(null);
    setScoutReady(!openRouterKey);
    setBluffActive(false);
    playNewPlayerSound();
  }, [openRouterKey]);

  // ── MUST be declared before handleRTM / handleTimerExpire ──
  const advanceToNext = useCallback((states, pool) => {
    const remaining = sortPlayersByPool(pool.filter(p => !p.auctioned), POOLS);

    if (remaining.length === 0) {
      setPhase('ended');
      if (isSolo) {
        navigate('/solo-final');
      } else if (database) {
        update(ref(database, `rooms/${code}`), { status: 'ended', teamStates: sanitizeTeamStatesForFirebase(states) });
        navigate(`/final/${code}`);
      }
      return;
    }

    setSkippedTeams(new Set());
    resetForPlayer(remaining[0]);

    // In multiplayer, next player is set by handleTimerExpire, not here
    // This prevents duplicate writes and ensures atomic transitions
    if (isSolo) {
      // Solo mode - update local state only
      return;
    }
  }, [isSolo, code, navigate, resetForPlayer]);

  // Save auction progress to localStorage periodically (solo mode)
  useEffect(() => {
    if (!isSolo) return;
    
    const saveProgress = () => {
      const pool = sessionStorage.getItem('soloPlayerPool');
      const states = sessionStorage.getItem('soloTeamStates');
      
      if (pool && states) {
        localStorage.setItem('soloAuctionInProgress', JSON.stringify({
          teamId: soloTeamId,
          playerPool: pool,
          teamStates: states,
          stage: 'auction',
          timestamp: Date.now(),
        }));
      }
    };

    // Save every 10 seconds
    const interval = setInterval(saveProgress, 10000);
    return () => clearInterval(interval);
  }, [isSolo, soloTeamId]);

  // Sync pausedRef so AI timeout callback can read it without stale closure
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // When resuming, push timerExpiry forward by however long we were paused
  useEffect(() => {
    if (paused) {
      pauseStartRef.current = Date.now();
      clearTimeout(aiTimerRef.current);
    } else if (pauseStartRef.current) {
      const elapsed = Date.now() - pauseStartRef.current;
      setTimerExpiry(prev => prev + elapsed);
      pauseStartRef.current = null;
    }
  }, [paused]);

  // Keep bidHistoryRef in sync
  useEffect(() => { bidHistoryRef.current = bidHistory; }, [bidHistory]);

  // Persist recents to sessionStorage so the Recents page can read them
  useEffect(() => {
    sessionStorage.setItem('soloRecents', JSON.stringify(recentPlayers));
  }, [recentPlayers]);

  // Record a completed player auction result into the recents list
  const recordRecent = useCallback((player, result, teamId, price, history) => {
    setRecentPlayers(prev => [
      { player, result, teamId, price, bidHistory: history || [], ts: Date.now() },
      ...prev.slice(0, 29),
    ]);
  }, []);

  // Squad-full detection
  useEffect(() => {
    if (squadFull && !squadFullShownRef.current) {
      squadFullShownRef.current = true;
      setShowSquadFullModal(true);
    }
  }, [squadFull]);

  // Load solo state
  useEffect(() => {
    if (!isSolo) return;
    const pool = JSON.parse(sessionStorage.getItem('soloPlayerPool') || '[]');
    const states = JSON.parse(sessionStorage.getItem('soloTeamStates') || '{}');
    const sorted = sortPlayersByPool(pool.filter(p => !p.auctioned), POOLS);
    setPlayerPool(pool);
    setTeamStates(states);
    resetForPlayer(sorted[0]);
  }, [isSolo, resetForPlayer]);

  const lastSyncRef = useRef({ auctionedIds: null, currentPlayerId: null });
  const isHostRef = useRef(false);
  const timerExpireProcessingRef = useRef(false);

  // Sync server time offset on mount
  useEffect(() => {
    if (isSolo || !database) return;
    const offsetRef = ref(database, '.info/serverTimeOffset');
    const unsub = onValue(offsetRef, snap => {
      setServerTimeOffset(snap.val() || 0);
    });
    return () => off(offsetRef);
  }, [isSolo]);

  // Load multiplayer state
  useEffect(() => {
    if (isSolo || !database || !code) return;
    const roomRef = ref(database, `rooms/${code}`);
    const unsub = onValue(roomRef, snap => {
      if (!snap.exists()) { navigate('/'); return; }
      const data = snap.val();
      const tid = data.players?.[playerId]?.teamId;
      const isHost = data.players?.[playerId]?.isHost;
      isHostRef.current = isHost;
      setMyTeamId(tid);
      
      // Reconstruct playerPool from base pool + auctionedIds
      const auctionedIds = new Set(data.auctionedIds || []);
      const basePool = data.playerPool || [];
      const pool = basePool.length > 0
        ? basePool.map(p => ({ ...p, auctioned: auctionedIds.has(p.id) }))
        : [];
      const states = data.teamStates || {};
      
      // Only update if data actually changed
      const auctionedStr = JSON.stringify([...auctionedIds].sort());
      if (lastSyncRef.current.auctionedIds !== auctionedStr) {
        lastSyncRef.current.auctionedIds = auctionedStr;
        setPlayerPool(pool);
      }
      setTeamStates(states);
      setRoom(data);

      if (data.auction) {
        const a = data.auction;
        setCurrentBid(a.currentBid || 0);
        setLeadingTeam(a.leadingTeam || null);
        setBidHistory(a.bidHistory || []);
        
        // Sync timer with server time
        if (a.timerExpiry) {
          setTimerExpiry(a.timerExpiry);
        }
        setPhase(a.phase || 'bidding');
        setSoldInfo(a.soldInfo || null);
        
        // Sync current player from Firebase
        if (a.currentPlayerId && a.currentPlayerId !== lastSyncRef.current.currentPlayerId) {
          lastSyncRef.current.currentPlayerId = a.currentPlayerId;
          const p = pool.find(pl => pl.id === a.currentPlayerId);
          if (p) {
            setCurrentPlayer(p);
            setScoutReady(!openRouterKey);
          }
        } else if (!a.currentPlayerId && !currentPlayer && pool.length > 0) {
          // Initialize first player if auction state is empty
          const sorted = sortPlayersByPool(pool.filter(p => !p.auctioned), POOLS);
          if (sorted.length > 0 && isHost) {
            // Host initializes the auction
            const firstPlayer = sorted[0];
            const serverTime = Date.now() + serverTimeOffset;
            update(ref(database, `rooms/${code}/auction`), {
              currentPlayerId: firstPlayer.id,
              currentBid: firstPlayer.basePrice,
              leadingTeam: null,
              bidHistory: [],
              timerExpiry: serverTime + TIMER_DURATION,
              phase: 'bidding',
              soldInfo: null,
            });
          }
        }
      } else if (isHost && pool.length > 0) {
        // Initialize auction state if it doesn't exist
        const sorted = sortPlayersByPool(pool.filter(p => !p.auctioned), POOLS);
        if (sorted.length > 0) {
          const firstPlayer = sorted[0];
          const serverTime = Date.now() + serverTimeOffset;
          update(ref(database, `rooms/${code}/auction`), {
            currentPlayerId: firstPlayer.id,
            currentBid: firstPlayer.basePrice,
            leadingTeam: null,
            bidHistory: [],
            timerExpiry: serverTime + TIMER_DURATION,
            phase: 'bidding',
            soldInfo: null,
          });
        }
      }

      if (data.status === 'ended') navigate(`/final/${code}`);
    });
    return () => off(roomRef);
  }, [code, isSolo, serverTimeOffset]);

  // AI bidding loop (solo mode) — blocked until scout report is ready
  useEffect(() => {
    if (!isSolo || phase !== 'bidding' || !currentPlayer || !scoutReady) return;
    clearTimeout(aiTimerRef.current);

    const runAIRound = async () => {
      if (phase !== 'bidding' || pausedRef.current) return;
      const nextBid = getNextBidAmount(currentBid);
      const biddingTeams = TEAMS.filter(t => t.id !== myTeamId);

      // Only one AI team bids per round — pick the first willing team
      let bidPlaced = false;
      for (const team of biddingTeams) {
        const state = teamStates[team.id];
        if (!state) continue;
        if (leadingTeam === team.id) continue;

        const shouldBid = shouldAIBid(state, currentPlayer, currentBid, bluffActive);

        if (shouldBid && canBid(state, nextBid)) {
          setCurrentBid(nextBid);
          setLeadingTeam(team.id);
          setBidHistory(prev => [{ teamId: team.id, amount: nextBid, ts: Date.now() }, ...prev.slice(0, 9)]);
          setTimerExpiry(Date.now() + BID_RESET_DURATION);
          playBidSound();
          bidPlaced = true;
          break;
        }
      }

      // Only schedule another round if a bid was placed (avoids runaway chain)
      if (bidPlaced) return;
    };

    if (!paused) aiTimerRef.current = setTimeout(runAIRound, 1200 + Math.random() * 1800);
    return () => clearTimeout(aiTimerRef.current);
  }, [isSolo, phase, currentBid, leadingTeam, currentPlayer?.id, teamStates, scoutReady, bluffActive]);

  const handleBid = useCallback(() => {
    if (!myTeamState || phase !== 'bidding') return;
    const nextBid = getNextBidAmount(currentBid);
    if (!canBid(myTeamState, nextBid)) { showToast('Not enough purse!', 'error'); return; }
    if (leadingTeam === myTeamId) { showToast('You are already the highest bidder', 'info'); return; }

    playBidSound();

    if (!isSolo && database) {
      const serverTime = Date.now() + serverTimeOffset;
      const newExpiry = serverTime + BID_RESET_DURATION;
      const newHistory = [{ teamId: myTeamId, amount: nextBid, ts: serverTime }, ...bidHistory.slice(0, 9)];
      update(ref(database, `rooms/${code}/auction`), {
        currentBid: nextBid,
        leadingTeam: myTeamId,
        bidHistory: newHistory,
        timerExpiry: newExpiry,
        phase: 'bidding',
      });
    } else {
      setCurrentBid(nextBid);
      setLeadingTeam(myTeamId);
      setBidHistory(prev => [{ teamId: myTeamId, amount: nextBid, ts: Date.now() }, ...prev.slice(0, 9)]);
      setTimerExpiry(Date.now() + BID_RESET_DURATION);
    }
  }, [myTeamState, phase, currentBid, leadingTeam, myTeamId, isSolo, bidHistory, showToast, code]);

  const handleSkip = useCallback(async () => {
    if (phase !== 'bidding' || !currentPlayer || !myTeamId) return;

    if (isSolo) {
      clearTimeout(aiTimerRef.current);
      setSkipLoading(true);

      let winner = null;
      let finalBid = currentBid;

      // Heuristic — simulate full bidding war
      try {
        const result = simulateBiddingWar(
          teamStates,
          currentPlayer,
          currentBid,
          leadingTeam && leadingTeam !== myTeamId ? leadingTeam : null,
          myTeamId
        );
        if (result.winner) {
          winner = result.winner;
          finalBid = result.finalBid;
          const capturedNow = bidHistoryRef.current;
          bidHistoryRef.current = [...result.history.slice().reverse(), ...capturedNow].slice(0, 10);
        }
      } catch (e) {
        console.error('Heuristic AI skip decision failed, defaulting to UNSOLD', e);
      }

      setSkipLoading(false);

      const capturedHistory = bidHistoryRef.current;

      if (winner) {
        const winnerState = teamStates[winner];
        if (!winnerState || !canBid(winnerState, finalBid)) {
          // Winner can't actually afford it — UNSOLD
          recordRecent(currentPlayer, 'unsold', null, null, capturedHistory);
          setPhase('unsold');
          setTimeout(() => {
            const updatedPool = playerPool.map(p => p.id === currentPlayer.id ? { ...p, auctioned: true } : p);
            setPlayerPool(updatedPool);
            sessionStorage.setItem('soloPlayerPool', JSON.stringify(updatedPool));
            advanceToNext(teamStates, updatedPool);
          }, 2000);
          return;
        }

        const newBidHistory = [{ teamId: winner, amount: finalBid, ts: Date.now() }, ...capturedHistory.slice(0, 9)];
        playGavelSound();
        if (winner === myTeamId) playFanfare();
        else playCrowdCheer();
        setSoldInfo({ teamId: winner, price: finalBid });
        setCurrentBid(finalBid);
        setLeadingTeam(winner);
        setBidHistory(newBidHistory);
        setPhase('sold');

        const newState = applyBidWin(teamStates[winner], currentPlayer, finalBid);
        const newStates = { ...teamStates, [winner]: newState };
        setTeamStates(newStates);

        const updatedPool = playerPool.map(p => p.id === currentPlayer.id ? { ...p, auctioned: true } : p);
        setPlayerPool(updatedPool);
        sessionStorage.setItem('soloTeamStates', JSON.stringify(newStates));
        sessionStorage.setItem('soloPlayerPool', JSON.stringify(updatedPool));

        recordRecent(currentPlayer, 'sold', winner, finalBid, newBidHistory);

        const canRTMNow = myTeamState && canUseRTM(myTeamState, currentPlayer.id) && canBid(myTeamState, finalBid);
        setTimeout(() => advanceToNext(newStates, updatedPool), canRTMNow ? 8000 : 2500);
      } else {
        // No AI interest — UNSOLD
        playUnsoldSound();
        recordRecent(currentPlayer, 'unsold', null, null, capturedHistory);
        setPhase('unsold');
        setTimeout(() => {
          const updatedPool = playerPool.map(p => p.id === currentPlayer.id ? { ...p, auctioned: true } : p);
          setPlayerPool(updatedPool);
          sessionStorage.setItem('soloPlayerPool', JSON.stringify(updatedPool));
          advanceToNext(teamStates, updatedPool);
        }, 2000);
      }
    } else {
      // Multiplayer skip - just mark this team as skipped
      if (!database) return;
      const newSkipped = new Set(skippedTeams);
      newSkipped.add(myTeamId);
      setSkippedTeams(newSkipped);
      showToast('You have skipped this player', 'info');

      // Get all human player team IDs
      const humanTeamIds = Object.values(room?.players || {}).map(p => p.teamId).filter(Boolean);
      const allHumansSkipped = humanTeamIds.every(tid => newSkipped.has(tid));

      // If all humans skipped AND no one has bid yet, trigger timer expiry immediately
      if (allHumansSkipped && !leadingTeam) {
        // Force timer to expire now
        const serverTime = Date.now() + serverTimeOffset;
        await update(ref(database, `rooms/${code}/auction`), {
          timerExpiry: serverTime - 1000, // Set to past time to trigger immediate expiry
        });
      }
    }
  }, [phase, currentPlayer, playerPool, teamStates, isSolo, myTeamId, myTeamState, skippedTeams, leadingTeam, currentBid, recordRecent, advanceToNext, code, room, showToast, serverTimeOffset]);

  const handleRTM = useCallback(() => {
    if (!myTeamState || !currentPlayer || phase !== 'sold') return;
    if (!canUseRTM(myTeamState, currentPlayer.id)) { showToast('Cannot use RTM on this player', 'error'); return; }
    if (soldInfo?.teamId === myTeamId) return;

    const matchPrice = soldInfo?.price || currentBid;
    if (!canBid(myTeamState, matchPrice)) { showToast('Not enough purse to RTM', 'error'); return; }

    const newState = applyRTM(myTeamState, currentPlayer, matchPrice);
    const newStates = { ...teamStates, [myTeamId]: newState };
    setTeamStates(newStates);

    const updatedPool = playerPool.map(p => p.id === currentPlayer.id ? { ...p, auctioned: true } : p);
    setPlayerPool(updatedPool);

    if (isSolo) {
      sessionStorage.setItem('soloTeamStates', JSON.stringify(newStates));
      sessionStorage.setItem('soloPlayerPool', JSON.stringify(updatedPool));
    } else if (database) {
      // Update only the specific team state to prevent stack overflow
      update(ref(database, `rooms/${code}/teamStates/${myTeamId}`), 
        sanitizeTeamStateForFirebase(newState)
      );
    }

    showToast(`RTM used! ${currentPlayer.name} retained for ${formatCrore(matchPrice)}`, 'success');
    recordRecent(currentPlayer, 'sold', myTeamId, matchPrice, bidHistoryRef.current);
    advanceToNext(newStates, updatedPool);
  }, [myTeamState, currentPlayer, phase, soldInfo, teamStates, playerPool, isSolo, myTeamId, currentBid, showToast, recordRecent, advanceToNext, code]);

  const isHost = !isSolo && room?.players?.[playerId]?.isHost;

  const handleTimerExpire = useCallback(() => {
    if (phase !== 'bidding') return;
    
    // CRITICAL: Prevent multiple users from writing simultaneously
    if (!isSolo && timerExpireProcessingRef.current) return;
    timerExpireProcessingRef.current = true;
    
    clearTimeout(aiTimerRef.current);

    const capturedHistory = bidHistoryRef.current;

    if (!leadingTeam) {
      // No bids - mark as UNSOLD
      playUnsoldSound();
      recordRecent(currentPlayer, 'unsold', null, null, capturedHistory);
      
      if (!isSolo && database) {
        // Mark player as auctioned and advance to next
        const updatedPool = playerPool.map(p => p.id === currentPlayer?.id ? { ...p, auctioned: true } : p);
        const newAuctionedIds = updatedPool.filter(p => p.auctioned).map(p => p.id);
        const remaining = sortPlayersByPool(updatedPool.filter(p => !p.auctioned), POOLS);
        
        const serverTime = Date.now() + serverTimeOffset;
        
        // Single atomic update to prevent race conditions
        update(ref(database, `rooms/${code}/auction`), {
          phase: 'unsold',
          currentPlayerId: remaining.length > 0 ? remaining[0].id : null,
          currentBid: remaining.length > 0 ? remaining[0].basePrice : 0,
          leadingTeam: null,
          bidHistory: [],
          timerExpiry: remaining.length > 0 ? serverTime + TIMER_DURATION + 2000 : serverTime,
          soldInfo: null,
        }).then(() => {
          // Update auctionedIds after auction state is updated
          return update(ref(database, `rooms/${code}`), {
            auctionedIds: newAuctionedIds,
          });
        }).then(() => {
          if (remaining.length > 0) {
            // Transition back to bidding after 2 seconds
            setTimeout(() => {
              update(ref(database, `rooms/${code}/auction`), { phase: 'bidding' });
              timerExpireProcessingRef.current = false;
            }, 2000);
          } else {
            // Auction complete
            update(ref(database, `rooms/${code}`), { status: 'ended' });
            timerExpireProcessingRef.current = false;
          }
        }).catch(err => {
          console.error('Timer expire update failed:', err);
          timerExpireProcessingRef.current = false;
        });
      } else {
        setPhase('unsold');
        setTimeout(() => {
          const updatedPool = playerPool.map(p => p.id === currentPlayer?.id ? { ...p, auctioned: true } : p);
          setPlayerPool(updatedPool);
          sessionStorage.setItem('soloPlayerPool', JSON.stringify(updatedPool));
          advanceToNext(teamStates, updatedPool);
          timerExpireProcessingRef.current = false;
        }, 2000);
      }
    } else {
      // Player SOLD to highest bidder
      const winner = leadingTeam;
      const price = currentBid;
      playGavelSound();
      if (winner === myTeamId) playFanfare();
      else playCrowdCheer();

      const newState = applyBidWin(teamStates[winner], currentPlayer, price);
      const newStates = { ...teamStates, [winner]: newState };
      setTeamStates(newStates);

      const updatedPool = playerPool.map(p => p.id === currentPlayer.id ? { ...p, auctioned: true } : p);
      setPlayerPool(updatedPool);

      if (isSolo) {
        sessionStorage.setItem('soloTeamStates', JSON.stringify(newStates));
        sessionStorage.setItem('soloPlayerPool', JSON.stringify(updatedPool));
        setSoldInfo({ teamId: winner, price });
        setPhase('sold');
        timerExpireProcessingRef.current = false;
      } else if (database) {
        const newAuctionedIds = updatedPool.filter(p => p.auctioned).map(p => p.id);
        const remaining = sortPlayersByPool(updatedPool.filter(p => !p.auctioned), POOLS);
        const serverTime = Date.now() + serverTimeOffset;
        
        // Check if winner can use RTM
        const canRTM = Object.values(room?.players || {}).some(p => {
          const pTeamId = p.teamId;
          if (pTeamId === winner) return false;
          const pState = newStates[pTeamId];
          return pState && canUseRTM(pState, currentPlayer.id) && canBid(pState, price);
        });
        
        const delayTime = canRTM ? 8000 : 2500;
        
        // Sequential updates with promises to prevent stack overflow
        update(ref(database, `rooms/${code}/auction`), {
          phase: 'sold',
          soldInfo: { teamId: winner, price },
          currentBid: price,
          leadingTeam: winner,
        }).then(() => {
          // Update winning team state
          return update(ref(database, `rooms/${code}/teamStates/${winner}`), 
            sanitizeTeamStateForFirebase(newState)
          );
        }).then(() => {
          // Update auctionedIds
          return update(ref(database, `rooms/${code}`), {
            auctionedIds: newAuctionedIds,
          });
        }).then(() => {
          // Set up next player after delay
          if (remaining.length > 0) {
            setTimeout(() => {
              update(ref(database, `rooms/${code}/auction`), {
                currentPlayerId: remaining[0].id,
                currentBid: remaining[0].basePrice,
                leadingTeam: null,
                bidHistory: [],
                timerExpiry: serverTime + TIMER_DURATION + delayTime,
                phase: 'bidding',
                soldInfo: null,
              }).then(() => {
                timerExpireProcessingRef.current = false;
              });
            }, delayTime);
          } else {
            // Auction complete
            setTimeout(() => {
              update(ref(database, `rooms/${code}`), { status: 'ended' }).then(() => {
                timerExpireProcessingRef.current = false;
              });
            }, delayTime);
          }
        }).catch(err => {
          console.error('Timer expire update failed:', err);
          timerExpireProcessingRef.current = false;
        });
      } else {
        setSoldInfo({ teamId: winner, price });
        setPhase('sold');
        timerExpireProcessingRef.current = false;
      }

      recordRecent(currentPlayer, 'sold', winner, price, capturedHistory);
      const canRTM = winner !== myTeamId && myTeamState && canUseRTM(myTeamState, currentPlayer.id) && canBid(myTeamState, price);
      if (isSolo) {
        setTimeout(() => advanceToNext(newStates, updatedPool), canRTM ? 8000 : 2500);
      }
    }
  }, [phase, leadingTeam, currentBid, currentPlayer, teamStates, playerPool, isSolo, myTeamState, myTeamId, recordRecent, advanceToNext, code, serverTimeOffset, room]);

  const handleEndAuction = useCallback(() => {
    clearTimeout(aiTimerRef.current);
    
    // Clear localStorage
    if (isSolo) {
      localStorage.removeItem('soloAuctionInProgress');
    }
    
    if (isSolo) {
      sessionStorage.clear();
      navigate('/');
    } else if (database) {
      update(ref(database, `rooms/${code}`), { status: 'ended' });
      navigate('/');
    }
  }, [isSolo, code, navigate]);

  const canRTMNow = phase === 'sold' && soldInfo && soldInfo.teamId !== myTeamId
    && myTeamState && canUseRTM(myTeamState, currentPlayer?.id)
    && canBid(myTeamState, soldInfo.price);

  const nextBidAmount = currentPlayer ? getNextBidAmount(currentBid) : 0;
  const canHumanBid = myTeamState && phase === 'bidding' && !skippedTeams.has(myTeamId) && leadingTeam !== myTeamId && canBid(myTeamState, nextBidAmount) && (isSolo ? scoutReady : true);
  const hasSkipped = skippedTeams.has(myTeamId);
  const auctionedCount = playerPool.filter(p => p.auctioned).length;
  const totalCount = playerPool.length;

  return (
    <div className="page">
      <div className="page-bg-pattern" />
      <div className="container" style={{ paddingTop: 16, paddingBottom: 40 }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {myTeamId && <TeamBadge teamId={myTeamId} size={32} />}
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: '0.06em', color: getTeamById(myTeamId)?.color || 'var(--gold)' }}>
                {getTeamById(myTeamId)?.short}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{auctionedCount}/{totalCount} auctioned</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {isSolo && phase === 'bidding' && (
              <button
                title={paused ? 'Resume' : 'Pause'}
                className="btn-ghost"
                style={{ padding: '6px 8px', color: paused ? 'var(--green)' : 'var(--text-muted)' }}
                onClick={() => { setPaused(p => !p); clearTimeout(aiTimerRef.current); }}
              >
                {paused ? (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M3 2.5l10 5-10 5V2.5z"/></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="2" y="2" width="4" height="11" rx="1"/><rect x="9" y="2" width="4" height="11" rx="1"/></svg>
                )}
              </button>
            )}
            {/* Pool */}
            <button title="Player Pool" className="btn-ghost" style={{ padding: '6px 8px' }} onClick={() => setShowPool(true)}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="7.5" cy="7.5" r="5.5"/>
                <path d="M7.5 4v3.5l2 2"/>
              </svg>
            </button>
            {/* All Squads */}
            <button title="All Squads" className="btn-ghost" style={{ padding: '6px 8px' }} onClick={() => setShowAllSquads(true)}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 11c0-2 1.5-3 3-3s3 1 3 3"/>
                <circle cx="4" cy="5" r="2"/>
                <path d="M8 11c0-2 1.5-3 3-3s3 1 3 3"/>
                <circle cx="11" cy="5" r="2"/>
              </svg>
            </button>
            {/* My Squad */}
            <button title="My Squad" className="btn-ghost" style={{ padding: '6px 8px' }} onClick={() => setShowSquad(true)}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7.5" cy="5" r="2.5"/>
                <path d="M2 13c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/>
              </svg>
            </button>
            {/* Recents */}
            <button
              title="Recent Sales"
              className="btn-ghost"
              style={{ padding: '6px 8px', position: 'relative' }}
              onClick={() => setShowRecents(true)}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1.5 7.5A6 6 0 1 0 3 3.5"/>
                <path d="M1.5 1v3h3"/>
                <path d="M7.5 4.5v3.5l2 1.5"/>
              </svg>
              {recentPlayers.length > 0 && (
                <span style={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)' }} />
              )}
            </button>
            {/* End */}
            {(isSolo || isHost) && (
              <button
                title="End Auction"
                className="btn-ghost"
                style={{ padding: '6px 8px', color: 'var(--crimson-bright)', borderColor: 'rgba(192,57,43,0.3)' }}
                onClick={() => setShowEndConfirm(true)}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3l9 9M12 3l-9 9"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Purse bar */}
        {myTeamState && (
          <div style={{ marginBottom: 16 }}>
            <PurseBar purse={myTeamState.purse} compact />
          </div>
        )}

{phase === 'ended' ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div className="sold-stamp">AUCTION COMPLETE</div>
            <div style={{ marginTop: 16, fontSize: 14, color: 'var(--text-secondary)' }}>All players have been auctioned</div>
            <button className="btn-primary" style={{ marginTop: 24 }} onClick={() => navigate(isSolo ? '/solo-final' : `/final/${code}`)}>
              View Final Squads
            </button>
          </div>
        ) : !currentPlayer ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
          </div>
        ) : (
          <>
            {/* Player card */}
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <PlayerCard player={currentPlayer} />

              {phase === 'sold' && soldInfo && (() => {
                const isMyWin = soldInfo.teamId === myTeamId;
                const COLORS = ['#D4AF37','#F5E170','#2ECC71','#E74C3C','#9B59B6','#3498DB','#fff'];
                const pieces = isMyWin ? Array.from({ length: 36 }, (_, i) => ({
                  id: i,
                  color: COLORS[i % COLORS.length],
                  left: `${Math.random() * 100}%`,
                  delay: `${Math.random() * 0.6}s`,
                  duration: `${1.4 + Math.random() * 1.2}s`,
                  size: `${6 + Math.random() * 6}px`,
                  shape: Math.random() > 0.5 ? '50%' : '2px',
                })) : [];

                return (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,7,0.82)', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' }}>
                    {/* Confetti */}
                    {pieces.map(p => (
                      <div key={p.id} className="confetti-piece" style={{ left: p.left, top: 0, width: p.size, height: p.size, background: p.color, borderRadius: p.shape, animationDuration: p.duration, animationDelay: p.delay }} />
                    ))}
                    {isMyWin ? (
                      <>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 38, letterSpacing: '0.08em', color: 'var(--gold)', textAlign: 'center', animation: 'congratsPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both', textShadow: '0 0 40px rgba(212,175,55,0.8)', lineHeight: 1 }}>CONGRATULATIONS!</div>
                        <div className="sold-stamp" style={{ fontSize: 48 }}>SIGNED!</div>
                      </>
                    ) : (
                      <div className="sold-stamp">SOLD!</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <TeamBadge teamId={soldInfo.teamId} size={32} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--gold)' }}>{formatCrore(soldInfo.price)}</span>
                    </div>
                  </div>
                );
              })()}
              {phase === 'unsold' && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,7,0.75)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="unsold-stamp">UNSOLD</div>
                </div>
              )}
            </div>

            {/* AI Scout Report — solo only */}
            {phase === 'bidding' && isSolo && (
              <div style={{ marginBottom: 16 }}>
                <AIInsightPanel player={currentPlayer} onReady={() => {
                  setScoutReady(true);
                  setTimerExpiry(Date.now() + TIMER_DURATION);
                }} />
              </div>
            )}

            {/* Timer — in multiplayer always show, in solo wait for scout */}
            {phase === 'bidding' && (scoutReady || !isSolo) && (
              <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <BidTimer expiresAt={timerExpiry} onExpire={handleTimerExpire} leadingTeam={leadingTeam} paused={paused} currentBid={currentBid} serverTimeOffset={serverTimeOffset} />
              </div>
            )}

            {/* Action buttons — above bid history */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {phase === 'bidding' && !squadFull && (
                <div style={{ display: 'flex', gap: 10 }}>
                  {isSolo && (
                    <button
                      title="Bluff — makes AI teams think you're not interested this round"
                      className="btn-ghost"
                      onClick={() => {
                        if (bluffUsed) return;
                        setBluffActive(true);
                        setBluffUsed(true);
                        showToast('Bluff activated! AI teams are less likely to bid.', 'info');
                        setTimeout(() => setBluffActive(false), 12000);
                      }}
                      disabled={bluffUsed || !scoutReady}
                      style={{ padding: '8px 10px', fontSize: 11, letterSpacing: '0.08em', color: bluffActive ? 'var(--purple)' : bluffUsed ? 'var(--text-muted)' : '#9B59B6', borderColor: bluffActive ? 'rgba(155,89,182,0.5)' : bluffUsed ? 'rgba(255,255,255,0.05)' : 'rgba(155,89,182,0.3)', opacity: bluffUsed && !bluffActive ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                        <path d="M6.5 1.5C4 1.5 2 3.5 2 6s2 4.5 4.5 4.5S11 8.5 11 6 9 1.5 6.5 1.5z"/>
                        <path d="M4.5 5.5c0-.5.5-1 1-1h1.5M6.5 8v.5"/>
                      </svg>
                      {bluffActive ? 'BLUFFING' : bluffUsed ? 'USED' : 'BLUFF'}
                    </button>
                  )}
                  <button
                    className="btn-ghost"
                    onClick={handleSkip}
                    disabled={(!isSolo && !scoutReady ? false : !scoutReady) || hasSkipped || skipLoading}
                    style={{ padding: '8px 14px', fontSize: 12, letterSpacing: '0.1em', color: 'var(--text-muted)', borderColor: (hasSkipped || skipLoading) ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)', opacity: (hasSkipped || skipLoading) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {skipLoading ? (
                      <><span className="spinner" style={{ width: 12, height: 12 }} />AI</>
                    ) : hasSkipped ? '✓ SKIPPED' : 'SKIP'}
                  </button>
                  <button className="btn-bid" onClick={handleBid} disabled={!canHumanBid} style={{ flex: 1, opacity: hasSkipped ? 0.5 : 1 }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    BID {formatCrore(nextBidAmount)}
                  </button>
                </div>
              )}
              {phase === 'bidding' && squadFull && (
                <div style={{ textAlign: 'center', padding: '8px 12px', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  👁 Squad full — watching auction
                </div>
              )}
              {canRTMNow && (
                <button className="btn-rtm" onClick={handleRTM}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M2 4v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  USE RTM — Match {formatCrore(soldInfo?.price)} ({myTeamState?.rtmCards} left)
                </button>
              )}
              {phase === 'bidding' && leadingTeam && leadingTeam !== myTeamId && (
                <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  Leading: <span style={{ color: getTeamById(leadingTeam)?.color || 'var(--gold)' }}>{getTeamById(leadingTeam)?.short}</span> at {formatCrore(currentBid)}
                </div>
              )}
              {phase === 'bidding' && leadingTeam === myTeamId && (
                <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--green)' }}>
                  ✓ You are the highest bidder at {formatCrore(currentBid)}
                </div>
              )}
            </div>

            {bidHistory.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 8 }}>Bid History</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {bidHistory.slice(0, 5).map((b, i) => {
                    const t = getTeamById(b.teamId);
                    return (
                      <div key={i} className={`bid-entry ${i === 0 ? 'winning' : ''}`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <TeamBadge teamId={b.teamId} size={20} />
                          <span style={{ fontSize: 13, color: i === 0 ? 'var(--gold)' : 'var(--text-secondary)' }}>{t?.short || b.teamId}</span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: i === 0 ? 'var(--gold)' : 'var(--text-muted)' }}>{formatCrore(b.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showSquad && myTeamState && (
        <SquadViewer teamState={myTeamState} onClose={() => setShowSquad(false)} onFinishAuction={squadReady && isSolo ? handleFinishAuction : null} />
      )}
      {showAllSquads && (
        <SquadViewer teamState={myTeamState} allTeams allTeamStates={teamStates} onClose={() => setShowAllSquads(false)} />
      )}
      {showPool && (
        <PlayerPoolViewer players={playerPool} onClose={() => setShowPool(false)} />
      )}
      {showRecents && (
        <RecentsPanel recentPlayers={recentPlayers} onClose={() => setShowRecents(false)} />
      )}

      {/* Squad Full Modal */}
      {showSquadFullModal && (
        <div className="overlay overlay-center">
          <div className="modal modal-center" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--gold)', marginBottom: 10 }}>Squad Complete</div>
              <div className="sold-stamp" style={{ fontSize: 28, marginBottom: 12 }}>25 PLAYERS</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Your squad is full! You can no longer bid.
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Would you like to end and view your squad, or watch the rest of the auction?
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn-ghost"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setShowSquadFullModal(false)}
              >
                👁 Watch Auction
              </button>
              <button
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowSquadFullModal(false);
                  if (isSolo) {
                    sessionStorage.setItem('soloTeamStates', JSON.stringify(teamStates));
                    navigate('/solo-final');
                  } else {
                    navigate(`/final/${code}`);
                  }
                }}
              >
                🏏 View My Squad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Auction Confirm Dialog */}
      {showEndConfirm && (
        <div className="overlay overlay-center" onClick={() => setShowEndConfirm(false)}>
          <div className="modal modal-center" style={{ maxWidth: 340 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v5M8 11v1" stroke="var(--crimson-bright)" strokeWidth="1.8" strokeLinecap="round"/>
                  <circle cx="8" cy="8" r="6.5" stroke="var(--crimson-bright)" strokeWidth="1.3"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '0.06em', color: 'var(--text-primary)', lineHeight: 1 }}>End Auction?</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  {isSolo ? 'Progress will not be saved.' : 'This will end the auction for all players.'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                className="btn-ghost"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setShowEndConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                style={{ flex: 1 }}
                onClick={handleEndAuction}
              >
                End Auction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
