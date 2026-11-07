// File/directory access: all groups can read everything
export function canReadFile(_filePath, _group) {
    return true;
}
export function canListDirectory(_dirPath, _group) {
    return true;
}
export function isVisitorRestricted(group) {
    if (!group)
        return true;
    return group === "visitor";
}
