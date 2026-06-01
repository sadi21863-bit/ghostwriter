// Server-side only — call from API route handlers, never from components
export async function track(
  userId: string | null,
  event: string,
  properties?: Record<string, string | number | boolean>
) {
  if (process.env.NODE_ENV !== 'production') return;
  try {
    const { db } = await import('@/db');
    const { platformEvents } = await import('@/db/schema');
    await db.insert(platformEvents).values({
      userId: userId ?? undefined,
      event,
      properties: properties ?? {},
    });
  } catch {
    // Analytics must never break the main flow
  }
}
