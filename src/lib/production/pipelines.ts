// Declarative production pipelines — the media analog of src/lib/ai/pipelines.ts
// (text pipelines). Each pipeline is a sequence of stages; paid stages must be
// preceded by an Editor checkpoint (QA-before-spend). capabilityId links a stage
// to the capability registry (src/lib/capabilities/registry.ts).
export type ProductionStageRole = "director" | "writer" | "editor";
export type ProductionOutput = "trailer" | "comic" | "animatic" | "audio";

export interface ProductionStage {
  id: string;
  label: string;
  role: ProductionStageRole;
  capabilityId?: string;
  /** Requires the Editor approve-gate to be satisfied before the next paid stage runs. */
  checkpoint?: boolean;
  /** Spends real money — preflight estimate + the hard gate apply. */
  paid?: boolean;
}

export interface ProductionPipeline {
  id: string;
  name: string;
  output: ProductionOutput;
  formats: string[];
  stages: ProductionStage[];
}

export const PRODUCTION_PIPELINES: ProductionPipeline[] = [
  {
    id: "book_trailer", name: "Book Trailer", output: "trailer",
    formats: ["Novel", "Screenplay", "Web Series"],
    stages: [
      { id: "plan",     label: "Plan shots",        role: "director", capabilityId: "generate_package" },
      { id: "review",   label: "Editor review",     role: "editor",   capabilityId: "editor_review", checkpoint: true },
      { id: "generate", label: "Generate + stitch", role: "writer",   capabilityId: "production_video", paid: true },
      { id: "package",  label: "Package",           role: "director" },
    ],
  },
  {
    id: "comic_page", name: "Comic Page", output: "comic",
    formats: ["Novel", "Screenplay", "Web Series"],
    stages: [
      { id: "plan",     label: "Plan panels",   role: "director", capabilityId: "generate_package" },
      { id: "review",   label: "Editor review", role: "editor",   capabilityId: "editor_review", checkpoint: true },
      { id: "generate", label: "Generate art",  role: "director", capabilityId: "comic_generate", paid: true },
      { id: "letter",   label: "Letter",        role: "editor" },
      { id: "export",   label: "Export",        role: "director" },
    ],
  },
];

export const getProductionPipelines = (format: string): ProductionPipeline[] =>
  PRODUCTION_PIPELINES.filter(p => p.formats.includes(format));
