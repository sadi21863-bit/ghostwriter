"use client";
import GhostWriterApp from "@/components/GhostWriterApp";
import { ErrorBoundary } from "@/components/ErrorBoundary";
export default function Editor({ params }: { params: { projectId: string } }) {
  return (
    <ErrorBoundary>
      <GhostWriterApp projectId={params.projectId} />
    </ErrorBoundary>
  );
}
