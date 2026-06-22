"use client";
import ComicStudio from "@/components/ComicStudio";

interface Props {
  project: any;
  segmindKey: string;
  onOpenStudio: () => void;
}

export function ComicStudioPanel({ project, segmindKey, onOpenStudio }: Props) {
  return <ComicStudio project={project} segmindKey={segmindKey} onOpenStudio={onOpenStudio} />;
}
