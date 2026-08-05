import { Data, Effect } from "effect";
import { Document } from "flexsearch";

import type { NavigationNode, Register, RegisterDocument, RegisterField } from "$lib/domain";

export type SearchKind = "group" | "structure" | "register" | "field" | "enum" | "enum-member";

export interface SearchRecord extends Record<string, string> {
  id: string;
  kind: SearchKind;
  label: string;
  context: string;
  targetId: string;
  fieldId: string;
  address: string;
  identifier: string;
  group: string;
  field: string;
  enum: string;
  description: string;
  text: string;
}

export class SearchIndexError extends Data.TaggedError("SearchIndexError")<{
  readonly cause: unknown;
}> {}

const fields = ["address", "identifier", "group", "field", "enum", "description", "text"];

function navigationRecords(node: NavigationNode, records: SearchRecord[]): void {
  const firstTarget = (candidate: NavigationNode): string =>
    candidate.targetId || candidate.children.map(firstTarget).find(Boolean) || "";
  if (node.kind !== "register") {
    records.push({
      id: `navigation:${node.id}`,
      kind: node.kind === "doc-group" ? "group" : "structure",
      label: node.label,
      context: node.identifier,
      targetId: firstTarget(node),
      fieldId: "",
      address: node.address || "",
      identifier: node.identifier,
      group: node.kind === "doc-group" ? node.identifier : "",
      field: "",
      enum: "",
      description: "",
      text: `${node.label} ${node.identifier}`
    });
  }
  for (const child of node.children) navigationRecords(child, records);
}

function fieldRecords(register: Register, field: RegisterField): SearchRecord[] {
  const common = {
    targetId: register.id,
    fieldId: field.id,
    address: register.absoluteAddressHex || "",
    identifier: `${register.path} ${field.identifier} ${field.path}`,
    group: register.groupPath.join(" "),
    field: `${field.name} ${field.identifier}`,
    description: field.description,
    context: `${register.name} · ${register.absoluteAddressHex || "No address"}`
  };
  const records: SearchRecord[] = [
    {
      ...common,
      id: `field:${field.id}`,
      kind: "field",
      label: field.name,
      enum: field.enum?.name || "",
      text: `${field.name} ${field.identifier} ${field.description}`
    }
  ];

  if (field.enum) {
    records.push({
      ...common,
      id: `enum:${field.id}`,
      kind: "enum",
      label: field.enum.name,
      enum: field.enum.name,
      text: `${field.enum.name} ${field.name}`
    });
    for (const member of field.enum.members) {
      records.push({
        ...common,
        id: `enum-member:${field.id}:${member.name}`,
        kind: "enum-member",
        label: member.name,
        enum: `${field.enum.name} ${member.name}`,
        description: member.description,
        text: `${member.name} ${member.displayName} ${member.value} ${member.hex} ${member.description}`
      });
    }
  }
  return records;
}

export function createSearchRecords(document: RegisterDocument): SearchRecord[] {
  const records: SearchRecord[] = [];
  navigationRecords(document.navigation, records);

  for (const register of document.registers) {
    records.push({
      id: `register:${register.id}`,
      kind: "register",
      label: register.name,
      context: `${register.path} · ${register.absoluteAddressHex || "No address"}`,
      targetId: register.id,
      fieldId: "",
      address: `${register.absoluteAddressHex || ""} ${register.absoluteAddress || ""}`,
      identifier: `${register.identifier} ${register.path}`,
      group: register.groupPath.join(" "),
      field: register.fields.map((field) => `${field.name} ${field.identifier}`).join(" "),
      enum: register.fields.map((field) => field.enum?.name || "").join(" "),
      description: register.description,
      text: `${register.name} ${register.identifier} ${register.description}`
    });
    for (const field of register.fields) records.push(...fieldRecords(register, field));
  }

  return records;
}

function normalizeAddress(value: string): string | null {
  const input = value.trim().toLowerCase().replaceAll("_", "");
  if (/^0x[0-9a-f]+$/.test(input)) return BigInt(input).toString();
  if (/^[0-9a-f]+h$/.test(input)) return BigInt(`0x${input.slice(0, -1)}`).toString();
  if (/^[0-9]+$/.test(input)) return BigInt(input).toString();
  return null;
}

function fuzzyScore(candidate: string, query: string): number | null {
  const haystack = candidate.toLowerCase();
  const needle = query.toLowerCase().replace(/\s+/g, "");
  if (!needle) return null;

  let score = haystack.length * 0.05;
  let previous = -1;
  for (const character of needle) {
    const index = haystack.indexOf(character, previous + 1);
    if (index === -1) return null;

    const gap = index - previous - 1;
    score += gap * 2;
    if (index === previous + 1) score -= 6;
    if (index === 0 || /[\s._\-/:\[\]()]/.test(haystack[index - 1] || "")) score -= 8;
    previous = index;
  }

  const compact = haystack.replace(/[^\p{L}\p{N}]+/gu, "");
  if (compact === needle) score -= 800;
  else if (haystack === query.toLowerCase()) score -= 1000;
  else if (haystack.startsWith(query.toLowerCase())) score -= 300;
  return score;
}

export class SearchService {
  readonly records: ReadonlyMap<string, SearchRecord>;
  readonly index: Document;

  constructor(records: ReadonlyArray<SearchRecord>) {
    this.records = new Map(records.map((record) => [record.id, record]));
    this.index = new Document({
      document: {
        id: "id",
        index: fields,
        store: false
      },
      tokenize: "forward"
    });
    for (const record of records) this.index.add(record);
  }

  search(query: string, limit = 30): SearchRecord[] {
    const normalized = normalizeAddress(query);
    const normalizedQuery = query.trim().toLowerCase();
    const groups = this.index.search(query, { limit: this.records.size, suggest: true }) as Array<{
      field: string;
      result: Array<string | number>;
    }>;
    const scores = new Map<string, number>();

    groups.forEach((group, fieldIndex) => {
      group.result.forEach((id, resultIndex) => {
        const key = String(id);
        const score = 1000 + fieldIndex * this.records.size + resultIndex;
        scores.set(key, Math.min(scores.get(key) ?? Number.POSITIVE_INFINITY, score));
      });
    });

    for (const record of this.records.values()) {
      if (!record.targetId) continue;
      const candidates: Array<[string, number]> = [
        [record.label, 0],
        [record.address, 2],
        [record.field, 4],
        [record.enum, 4],
        [record.identifier, 6],
        [record.group, 8],
        [record.context, 10],
        [record.text, 12],
        [record.description, 14]
      ];
      for (const [candidate, priority] of candidates) {
        if (!candidate) continue;
        const match = fuzzyScore(candidate, normalizedQuery);
        if (match !== null) {
          scores.set(
            record.id,
            Math.min(scores.get(record.id) ?? Number.POSITIVE_INFINITY, match + priority)
          );
        }
      }
      if (normalized !== null && record.kind === "register") {
        const numeric = record.address.split(" ").at(-1);
        if (numeric === normalized) scores.set(record.id, -2000);
      }
    }

    return [...scores]
      .map(([id, score]) => ({ record: this.records.get(id), score }))
      .filter((entry): entry is { record: SearchRecord; score: number } => Boolean(entry.record?.targetId))
      .sort((left, right) => left.score - right.score || left.record.label.localeCompare(right.record.label))
      .slice(0, limit)
      .map((entry) => entry.record);
  }
}

export function makeSearchService(
  document: RegisterDocument
): Effect.Effect<SearchService, SearchIndexError> {
  return Effect.try({
    try: () => new SearchService(createSearchRecords(document)),
    catch: (cause) => new SearchIndexError({ cause })
  });
}
