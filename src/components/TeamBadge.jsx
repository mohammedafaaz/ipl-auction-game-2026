import React, { useState } from 'react';
import { getTeamById } from '../data/teams.js';

export default function TeamBadge({ teamId, size = 36, showName = false, showFull = false }) {
  const team = getTeamById(teamId);
  const [imgError, setImgError] = useState(false);

  if (!team) return null;

  const s = size;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: showName ? 10 : 0 }}>
      <div style={{ width: s, height: s, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `1.5px solid ${team.color}33`, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!imgError ? (
          <img
            src={team.logo}
            alt={team.short}
            style={{ width: s - 4, height: s - 4, objectFit: 'contain' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: s * 0.35, color: team.color, letterSpacing: '0.05em' }}>
            {team.short}
          </span>
        )}
      </div>
      {showName && (
        <div>
          <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 16, letterSpacing: '0.06em', color: team.color, lineHeight: 1 }}>
            {showFull ? team.name : team.short}
          </div>
          {showFull && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{team.city}</div>}
        </div>
      )}
    </div>
  );
}