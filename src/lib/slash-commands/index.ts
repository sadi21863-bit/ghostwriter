export type SlashCommandId =
  | 'alt-draft' | 'story-health' | 'world-rule' | 'thread-ref'
  | 'check-continuity' | 'summarize' | 'sprint-mode' | 'export';

export interface SlashCommand {
  id: SlashCommandId;
  label: string;
  description: string;
  keywords: string[];
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'alt-draft',        label: 'Generate Alternate Draft', description: 'Create a parallel version without overwriting',       keywords: ['alternate', 'draft', 'rewrite', 'branch', 'version'] },
  { id: 'story-health',     label: 'Story Health',             description: 'Open the story health dashboard',                     keywords: ['health', 'threads', 'pacing', 'arcs', 'score'] },
  { id: 'world-rule',       label: 'Add AI Rule',              description: 'Add a rule the AI must follow for this project',      keywords: ['rule', 'law', 'constraint', 'world', 'magic', 'ai'] },
  { id: 'thread-ref',       label: 'Reference Plot Thread',    description: 'Link this chapter to an existing plot thread',        keywords: ['thread', 'plot', 'reference', 'track', 'connect'] },
  { id: 'check-continuity', label: 'Check Continuity',         description: 'Scan for consistency issues in the current chapter',  keywords: ['continuity', 'consistency', 'check', 'errors', 'fix'] },
  { id: 'summarize',        label: 'Summarize Selection',      description: 'AI-summarizes the selected text',                     keywords: ['summarize', 'summary', 'compress', 'shorten'] },
  { id: 'sprint-mode',      label: 'Sprint Mode',              description: 'Full-screen focused writing, no distractions',        keywords: ['sprint', 'focus', 'fullscreen', 'distraction-free'] },
  { id: 'export',           label: 'Export Project',           description: 'Export to DOCX, PDF, or Markdown',                    keywords: ['export', 'download', 'save', 'docx', 'pdf', 'file'] },
];
