export function isUuidV4(id: unknown): id is string {
  if (typeof id !== "string") return false;
  // RFC 4122 version 4 pattern
  const re = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  return re.test(id);
}
