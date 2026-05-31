export interface Project { id: string; name: string; format: string; skillLevel: "beginner" | "expert"; genres: string[]; notes: string; characters: Character[]; locations: Location[]; plotThreads: PlotThread[]; chapters: Chapter[]; referenceWorks: ReferenceWork[]; characterRelationships?: any[]; storyMemories?: any[]; aiRules?: any[]; }

export interface Character {
  id: string; projectId: string; name: string; role: string; age: string;
  appearance: string; personality: string; thinkingStyle: string; behavior: string;
  habits: string; fears: string; desires: string; speechPattern: string;
  backstory: string; arc: string; portraitUrl: string; sortOrder: number;
  alwaysInContext: boolean;
  linkedLocationIds: string[];
  linkedPlotThreadIds: string[];
  voiceProfile?: string;
  voiceId?: string;
}

export interface Location {
  id: string; projectId: string; name: string; description: string;
  atmosphere: string; history: string; sensoryDetails: string; sortOrder: number;
  alwaysInContext: boolean;
  linkedCharacterIds: string[];
}

export interface PlotThread {
  id: string; projectId: string; name: string; description: string;
  status: string; stakes: string; connections: string; sortOrder: number;
  alwaysInContext: boolean;
}

export interface Chapter {
  id: string; projectId: string; title: string; content: string; summary: string;
  tags: string[]; chapterType: string; sortOrder: number; wordCount: number;
  createdAt: string; updatedAt: string;
}

export interface ReferenceWork { id: string; projectId: string; title: string; attributes: Record<string, string>; }

export type KnowledgeState =
  | 'KNOWS' | 'BELIEVES' | 'SUSPECTS'
  | 'IGNORANT' | 'FALSELY_BELIEVES' | 'ACTIVELY_HIDING';

export interface KnowledgeEntry {
  state: KnowledgeState;
  entityType: 'character' | 'location' | 'plotThread';
  entityName: string;
  belief?: string;
  notes?: string;
}

export type KnowledgeMap = Record<string, KnowledgeEntry>;

export type IntelligenceType =
  | 'logical' | 'linguistic' | 'spatial' | 'kinesthetic'
  | 'interpersonal' | 'intrapersonal' | 'practical';

export interface IntelligenceProfile {
  dominant: IntelligenceType[];
  weak: IntelligenceType[];
}

export interface ProjectAIRule {
  id: string;
  text: string;
  source: 'user' | 'genre';
}

export type AltDraftGoal =
  | 'tighter-prose' | 'more-emotional' | 'stronger-suspense'
  | 'continuity-repair' | 'clearer-prose' | 'sharper-dialogue';

export interface AlternateDraft {
  id: string;
  goal: AltDraftGoal;
  content: string;
  wordCount: number;
  intent: string;
  createdAt: string;
}

export interface WorkPacketPrinciple {
  principle: string;
  example: string;
  applicableTo: string[];
}
