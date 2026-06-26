export function resolveUserId(userRef: unknown): string | null {
  if (!userRef) return null;
  if (typeof userRef === 'object' && userRef !== null && '_id' in userRef) {
    return String((userRef as { _id: { toString(): string } })._id);
  }
  return String(userRef);
}
