"use client";
import ProductionStudio from "@/components/ProductionStudio";

interface Props {
  project: any;
  segmindKey: string;
}

export function ProductionStudioPanel({ project, segmindKey }: Props) {
  return <ProductionStudio project={project} segmindKey={segmindKey} />;
}
