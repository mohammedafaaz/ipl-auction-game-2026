import React, { useState, useEffect } from 'react';
import { getPlayerInsight } from '../utils/openrouter.js';
import { useApp } from '../AppContext.jsx';

export default function AIInsightPanel({ player, onReady }) {
  const { openRouterKey } = useApp();
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!player || !openRouterKey) { setInsight(''); setError(''); onReady?.(); return; }
    let cancelled = false;
    setLoading(true);
    setInsight('');
    setError('');

    getPlayerInsight(openRouterKey, player)
      .then(text => {
        if (!cancelled) {
          setInsight(text);
          setLoading(false);
          onReady?.();
        }
      })
      .catch(e => {
        if (!cancelled) {
          console.error('Scout report failed:', e.message);
          setError(e.message || 'AI insight unavailable');
          setLoading(false);
          onReady?.();
        }
      });

    return () => { cancelled = true; };
  }, [player?.id, openRouterKey]);

  if (!openRouterKey) return null;

  return (
    <div style={{ padding: '12px 14px', background: 'rgba(155,89,182,0.06)', border: '1px solid rgba(155,89,182,0.2)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="5" fill="rgba(155,89,182,0.2)" stroke="#9B59B6" strokeWidth="1"/>
          <path d="M6 3v3.5M6 8.5v.5" stroke="#9B59B6" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9B59B6' }}>AI Scout Report</span>
        {loading && <span className="spinner" style={{ width: 10, height: 10, marginLeft: 4 }} />}
      </div>

      {loading && !insight && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Analysing player...</div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{error}</div>
      )}

      {insight && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
          {insight}
        </div>
      )}
    </div>
  );
}
