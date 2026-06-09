import GhostWriterApp from "@/components/GhostWriterApp";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default async function Editor({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <ErrorBoundary>
      <GhostWriterApp projectId={projectId} />
    </ErrorBoundary>
  );
}
