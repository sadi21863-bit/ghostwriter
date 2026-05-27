"use client";
import ProductionStudio from "@/components/ProductionStudio";

interface Props {
  project: any;
  higgsfieldKey: string;
}

export function ProductionStudioPanel({ project, higgsfieldKey }: Props) {
  return <ProductionStudio project={project} higgsfieldKey={higgsfieldKey} />;
}
