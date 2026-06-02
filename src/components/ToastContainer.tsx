'use client';
import { useState, useEffect } from 'react';
import { toastEmitter, type Toast } from '@/lib/toast';

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return toastEmitter.subscribe(t => {
      setToasts(prev => [...prev.slice(-4), t]);
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, t.duration ?? 5000);
    });
  }, []);

  if (!toasts.length) return null;

  const colors: Record<Toast['type'], { bg: string; border: string; icon: string }> = {
    error:   { bg: '#1c0a0a', border: '#f87171', icon: '✕' },
    warning: { bg: '#1c1407', border: '#facc15', icon: '⚠' },
    success: { bg: '#0a1c0a', border: '#4ade80', icon: '✓' },
    info:    { bg: 'var(--color-bg-elevated)', border: 'var(--color-border-default)', icon: 'ℹ' },
  };

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9000, maxWidth: 380,
    }}>
      {toasts.map(t => {
        const c = colors[t.type];
        return (
          <div key={t.id} style={{
            background: c.bg, border: `1px solid ${c.border}`,
            borderRadius: 8, padding: '12px 16px',
            display: 'flex', gap: 10, alignItems: 'flex-start',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            animation: 'slideInRight 0.2s ease',
          }}>
            <span style={{ color: c.border, fontSize: 13, flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, color: '#f2f2f3', lineHeight: 1.5 }}>
                {t.message}
              </span>
              {t.action && (
                <button onClick={t.action.onClick} style={{
                  display: 'block', marginTop: 6, fontSize: 12,
                  color: c.border, background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, textDecoration: 'underline',
                }}>
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              style={{ background: 'none', border: 'none', color: '#5c5c6b',
                       cursor: 'pointer', fontSize: 14, flexShrink: 0, lineHeight: 1 }}
            >×</button>
          </div>
        );
      })}
    </div>
  );
}
