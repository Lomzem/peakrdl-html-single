export type DocumentTarget =
  | { kind: "folder"; folderId: string }
  | {
      kind: "register";
      registerId: string;
      fieldId?: string;
      enumName?: string;
      memberName?: string;
    };

export function documentHash(target: DocumentTarget): string {
  const parameters = new URLSearchParams();
  if (target.kind === "folder") {
    parameters.set("folder", target.folderId);
  } else {
    parameters.set("register", target.registerId);
    if (target.fieldId) parameters.set("field", target.fieldId);
    if (target.enumName) parameters.set("enum", target.enumName);
    if (target.memberName) parameters.set("member", target.memberName);
  }
  return parameters.toString();
}

export function documentHref(target: DocumentTarget): string {
  return `#${documentHash(target)}`;
}

export function parseDocumentHash(hash: string): DocumentTarget | null {
  const parameters = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const folderId = parameters.get("folder");
  const registerId = parameters.get("register");
  if (folderId && !registerId) return { kind: "folder", folderId };
  if (!registerId || folderId) return null;

  const fieldId = parameters.get("field") || undefined;
  const enumName = parameters.get("enum") || undefined;
  const memberName = parameters.get("member") || undefined;
  if ((enumName && !fieldId) || (memberName && !enumName)) return null;
  return { kind: "register", registerId, fieldId, enumName, memberName };
}

export function fieldDomId(fieldId: string): string {
  return `field-${encodeURIComponent(fieldId)}`;
}

export function enumDomId(fieldId: string, enumName: string): string {
  return `enum-${encodeURIComponent(fieldId)}-${encodeURIComponent(enumName)}`;
}

export function enumMemberDomId(fieldId: string, enumName: string, memberName: string): string {
  return `enum-member-${encodeURIComponent(fieldId)}-${encodeURIComponent(enumName)}-${encodeURIComponent(memberName)}`;
}

export function shouldHandleInApp(event: MouseEvent): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
