import { describe, expect, test } from "bun:test";

import {
  documentHref,
  enumDomId,
  enumMemberDomId,
  fieldDomId,
  parseDocumentHash,
} from "../src/lib/document-links";

describe("document links", () => {
  test("builds and parses folder and register links", () => {
    expect(documentHref({ kind: "folder", folderId: "group:a/b" })).toBe("#folder=group%3Aa%2Fb");
    const href = documentHref({
      kind: "register",
      registerId: "register:a&b",
      fieldId: "field:x=y",
      enumName: "State Mode",
      memberName: "Ready#1",
    });
    expect(parseDocumentHash(href)).toEqual({
      kind: "register",
      registerId: "register:a&b",
      fieldId: "field:x=y",
      enumName: "State Mode",
      memberName: "Ready#1",
    });
  });

  test("rejects ambiguous and incomplete targets", () => {
    expect(parseDocumentHash("#folder=a&register=b")).toBeNull();
    expect(parseDocumentHash("#register=a&enum=mode")).toBeNull();
    expect(parseDocumentHash("#register=a&field=b&member=ready")).toBeNull();
  });

  test("creates stable DOM destination IDs", () => {
    expect(fieldDomId("field:a/b")).toBe("field-field%3Aa%2Fb");
    expect(enumDomId("field:a/b", "Mode A")).toBe("enum-field%3Aa%2Fb-Mode%20A");
    expect(enumMemberDomId("field:a/b", "Mode A", "Ready&Set")).toBe(
      "enum-member-field%3Aa%2Fb-Mode%20A-Ready%26Set",
    );
  });
});
