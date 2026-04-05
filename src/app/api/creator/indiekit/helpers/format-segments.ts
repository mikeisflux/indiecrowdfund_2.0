export function formatSegments(segments: { id: string; name: string; type: string; criteria: unknown; backerCount: number; createdAt: Date }[]) {
  return segments.map((segment) => ({
    id: segment.id,
    name: segment.name,
    type: segment.type.toLowerCase(),
    criteria: segment.criteria ? JSON.stringify(segment.criteria) : "",
    backerCount: segment.backerCount,
    createdAt: segment.createdAt.toLocaleDateString(),
  }));
}
