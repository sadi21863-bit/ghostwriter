"use client";
import ComicStudio from "@/components/ComicStudio";

interface Props {
  project: any;
  higgsfieldKey: string;
  onOpenStudio: () => void;
}

export function ComicStudioPanel({ project, higgsfieldKey, onOpenStudio }: Props) {
  return <ComicStudio project={project} higgsfieldKey={higgsfieldKey} onOpenStudio={onOpenStudio} />;
}
