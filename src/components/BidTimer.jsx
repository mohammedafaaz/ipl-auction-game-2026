import React, { useEffect, useRef, useState } from 'react';
import { getTeamById, formatCrore } from '../data/teams.js';

export default function BidTimer({ expiresAt, onExpire, paused = false, leadingTeam = null, currentBid = null }) {
  const [remaining, setRemaining] = useState(30);
  const [stampKey, setStampKey] = useState(0);
  const rafRef = useRef(null);
  const firedRef = useRef(false);
  const prevLeadingTeamRef = useRef(null);

  useEffect(() => {
    firedRef.current = false;

    const tick = () => {
      if (paused) { rafRef.current = requestAnimationFrame(tick); return; }
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      setRemaining(diff);

      if (diff <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire?.();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [expiresAt, paused, onExpire]);

  // Trigger stamp animation when leadingTeam changes
  useEffect(() => {
    if (leadingTeam && leadingTeam !== prevLeadingTeamRef.current) {
      setStampKey(prev => prev + 1);
      prevLeadingTeamRef.current = leadingTeam;
    }
  }, [leadingTeam]);

  const pct = Math.min(100, (remaining / 30) * 100);
  const isUrgent = remaining <= 10;
  const color = remaining > 15 ? 'var(--green)' : remaining > 8 ? 'var(--gold)' : 'var(--crimson-bright)';
  const team = leadingTeam ? getTeamById(leadingTeam) : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {/* Circular timer */}
      <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
        <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <circle
            cx="24" cy="24" r="20" fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 20}`}
            strokeDashoffset={`${2 * Math.PI * 20 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color,
          animation: isUrgent ? 'timerPulse 0.6s ease infinite' : 'none',
        }}>
          {remaining}
        </div>
      </div>

      {/* Team stamp + short name */}
      {team ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div key={stampKey} style={{ position: 'relative', width: 50, height: 50, flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'stampBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards', opacity: 0 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', border: `2px solid ${team.color}`, background: team.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 12px ${team.color}80, inset 0 0 8px ${team.color}40` }}>
                <img src={team.logo} alt={team.short} style={{ width: 34, height: 34, objectFit: 'contain', filter: `drop-shadow(0 0 4px ${team.color}80)` }} />
              </div>
            </div>
            <style>{`@keyframes stampBounce { 0% { transform: scale(0) rotate(-45deg); opacity: 1; } 50% { transform: scale(1.1) rotate(5deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 0.8; } }`}</style>
          </div>
          <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 16, letterSpacing: '0.06em', color: team.color }}>{team.short}</div>
        </div>
      ) : <div />}

      {/* Current bid price */}
      {team && currentBid !== null ? (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 3 }}>Current Bid</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>{formatCrore(currentBid)}</div>
        </div>
      ) : <div />}
    </div>
  );
}
