import { Either, Schema } from "effect";

export interface EnumMember {
  readonly name: string;
  readonly displayName: string;
  readonly value: string;
  readonly hex: string;
  readonly description: string;
}

export interface FieldEnum {
  readonly name: string;
  readonly members: ReadonlyArray<EnumMember>;
}

export interface RegisterField {
  readonly id: string;
  readonly registerId: string;
  readonly identifier: string;
  readonly path: string;
  readonly name: string;
  readonly description: string;
  readonly low: number;
  readonly high: number;
  readonly width: number;
  readonly softwareAccess: string;
  readonly hardwareAccess: string;
  readonly reset: Readonly<{ value: string; hex: string; enumMember?: string }> | null;
  readonly enum: FieldEnum | null;
}

export interface Register {
  readonly id: string;
  readonly identifier: string;
  readonly path: string;
  readonly name: string;
  readonly description: string;
  readonly absoluteAddress: string | null;
  readonly absoluteAddressHex: string | null;
  readonly addressOffset: string | null;
  readonly addressOffsetHex: string | null;
  readonly width: number;
  readonly softwareAccess: string;
  readonly hardwareAccess: string;
  readonly groupPath: ReadonlyArray<string>;
  readonly arrayDimensions: ReadonlyArray<number>;
  readonly arrayStride: string | null;
  readonly arrayStrideHex: string | null;
  readonly fields: ReadonlyArray<RegisterField>;
}

export type NavigationKind = "addrmap" | "regfile" | "memory" | "doc-group" | "register";

export interface NavigationNode {
  readonly id: string;
  readonly kind: NavigationKind;
  readonly label: string;
  readonly identifier: string;
  readonly address: string | null;
  readonly targetId?: string;
  readonly children: ReadonlyArray<NavigationNode>;
}

export interface RegisterDocument {
  readonly formatVersion: 1;
  readonly title: string;
  readonly description: string;
  readonly rootPath: string;
  readonly navigation: NavigationNode;
  readonly registers: ReadonlyArray<Register>;
}

const ValueSchema = Schema.Struct({
  value: Schema.String,
  hex: Schema.String,
  enumMember: Schema.optional(Schema.String)
});

const EnumMemberSchema = Schema.Struct({
  name: Schema.String,
  displayName: Schema.String,
  value: Schema.String,
  hex: Schema.String,
  description: Schema.String
});

const FieldEnumSchema = Schema.Struct({
  name: Schema.String,
  members: Schema.Array(EnumMemberSchema)
});

const RegisterFieldSchema = Schema.Struct({
  id: Schema.String,
  registerId: Schema.String,
  identifier: Schema.String,
  path: Schema.String,
  name: Schema.String,
  description: Schema.String,
  low: Schema.Number,
  high: Schema.Number,
  width: Schema.Number,
  softwareAccess: Schema.String,
  hardwareAccess: Schema.String,
  reset: Schema.NullOr(ValueSchema),
  enum: Schema.NullOr(FieldEnumSchema)
});

const RegisterSchema = Schema.Struct({
  id: Schema.String,
  identifier: Schema.String,
  path: Schema.String,
  name: Schema.String,
  description: Schema.String,
  absoluteAddress: Schema.NullOr(Schema.String),
  absoluteAddressHex: Schema.NullOr(Schema.String),
  addressOffset: Schema.NullOr(Schema.String),
  addressOffsetHex: Schema.NullOr(Schema.String),
  width: Schema.Number,
  softwareAccess: Schema.String,
  hardwareAccess: Schema.String,
  groupPath: Schema.Array(Schema.String),
  arrayDimensions: Schema.Array(Schema.Number),
  arrayStride: Schema.NullOr(Schema.String),
  arrayStrideHex: Schema.NullOr(Schema.String),
  fields: Schema.Array(RegisterFieldSchema)
});

const NavigationNodeSchema: Schema.Schema<NavigationNode> = Schema.suspend(() =>
  Schema.Struct({
    id: Schema.String,
    kind: Schema.Literal("addrmap", "regfile", "memory", "doc-group", "register"),
    label: Schema.String,
    identifier: Schema.String,
    address: Schema.NullOr(Schema.String),
    targetId: Schema.optional(Schema.String),
    children: Schema.Array(NavigationNodeSchema)
  })
);

export const RegisterDocumentSchema: Schema.Schema<RegisterDocument> = Schema.Struct({
  formatVersion: Schema.Literal(1),
  title: Schema.String,
  description: Schema.String,
  rootPath: Schema.String,
  navigation: NavigationNodeSchema,
  registers: Schema.Array(RegisterSchema)
});

function assertDocumentInvariants(registerDocument: RegisterDocument): RegisterDocument {
  const ids = new Set<string>();
  const registerIds = new Set(registerDocument.registers.map((register) => register.id));
  const addId = (id: string) => {
    if (!id || ids.has(id)) throw new Error(`Duplicate or empty model ID: ${id || "<empty>"}`);
    ids.add(id);
  };
  const visitNavigation = (node: NavigationNode) => {
    addId(node.id);
    if (node.targetId && !registerIds.has(node.targetId)) {
      throw new Error(`Navigation target does not exist: ${node.targetId}`);
    }
    node.children.forEach(visitNavigation);
  };

  visitNavigation(registerDocument.navigation);
  for (const register of registerDocument.registers) {
    addId(register.id);
    if (!Number.isInteger(register.width) || register.width <= 0) {
      throw new Error(`Register width is invalid: ${register.id}`);
    }
    for (const field of register.fields) {
      addId(field.id);
      if (
        field.registerId !== register.id ||
        !Number.isInteger(field.low) ||
        !Number.isInteger(field.high) ||
        field.low < 0 ||
        field.high < field.low ||
        field.high >= register.width
      ) {
        throw new Error(`Field range is invalid: ${field.id}`);
      }
    }
  }
  return registerDocument;
}

export function decodeRegisterDocument(value: unknown): RegisterDocument {
  return Either.match(
    Schema.decodeUnknownEither(RegisterDocumentSchema)(value, { onExcessProperty: "error" }),
    {
      onLeft: (error) => {
        throw new Error(`Embedded register document is invalid: ${String(error)}`);
      },
      onRight: assertDocumentInvariants
    }
  );
}

const emptyDocument: RegisterDocument = {
  formatVersion: 1,
  title: "Register documentation",
  description: "Build the document with PeakRDL to view register data.",
  rootPath: "root",
  navigation: {
    id: "addrmap:root",
    kind: "addrmap",
    label: "Register map",
    identifier: "root",
    address: "0x0",
    children: []
  },
  registers: []
};

export function readEmbeddedDocument(): RegisterDocument {
  const element = document.getElementById("peakrdl-document");
  if (!element) {
    throw new Error("Embedded register document is missing");
  }

  const value: unknown = JSON.parse(element.textContent || "null");
  if (typeof value === "object" && value !== null && "marker" in value) {
    return emptyDocument;
  }

  return decodeRegisterDocument(value);
}
