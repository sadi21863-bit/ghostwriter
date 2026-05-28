export interface Project { id: string; name: string; format: string; skillLevel: "beginner" | "expert"; genres: string[]; notes: string; characters: Character[]; locations: Location[]; plotThreads: PlotThread[]; chapters: Chapter[]; referenceWorks: ReferenceWork[]; }

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
