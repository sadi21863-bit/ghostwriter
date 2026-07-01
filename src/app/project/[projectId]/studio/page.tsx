import StudioShell from "@/components/StudioShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default async function Studio({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <ErrorBoundary>
      <StudioShell projectId={projectId} />
    </ErrorBoundary>
  );
}
