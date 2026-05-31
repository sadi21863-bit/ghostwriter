'use client';
import { Command } from 'cmdk';
import { useEffect } from 'react';
import { SLASH_COMMANDS, type SlashCommandId } from '@/lib/slash-commands';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (id: SlashCommandId) => void;
}

export function SlashCommandPalette({ open, onClose, onSelect }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#18181B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, width: 480, maxHeight: 400, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        <Command>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <Command.Input
              autoFocus
              placeholder="Type a command..."
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#F2F2F3', padding: '4px 0' }}
            />
          </div>
          <Command.List style={{ maxHeight: 340, overflowY: 'auto', padding: '4px 0' }}>
            <Command.Empty style={{ padding: '12px 16px', fontSize: 13, color: '#9898A6' }}>
              No commands found.
            </Command.Empty>
            {SLASH_COMMANDS.map(cmd => (
              <Command.Item
                key={cmd.id}
                value={`${cmd.label} ${cmd.keywords.join(' ')}`}
                onSelect={() => { onSelect(cmd.id); onClose(); }}
                style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}
              >
                <span style={{ fontWeight: 500, color: '#F2F2F3' }}>{cmd.label}</span>
                <span style={{ fontSize: 11, color: '#9898A6' }}>{cmd.description}</span>
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
