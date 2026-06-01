export type UserGroup = "admin" | "visitor";

// File/directory access: all groups can read everything
export function canReadFile(_filePath: string, _group: UserGroup | undefined): boolean {
  return true;
}

export function canListDirectory(_dirPath: string, _group: UserGroup | undefined): boolean {
  return true;
}

export function isVisitorRestricted(group: UserGroup | undefined): boolean {
  if (!group) return true;
  return group === "visitor";
}