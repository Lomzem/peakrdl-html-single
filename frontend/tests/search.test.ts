import { describe, expect, test } from "bun:test";

import type { RegisterDocument } from "../src/lib/domain";
import { createSearchRecords, SearchService } from "../src/lib/search";

const document: RegisterDocument = {
  formatVersion: 1,
  title: "Sample map",
  description: "",
  rootPath: "sample",
  metadata: [],
  navigation: {
    id: "addrmap:sample",
    kind: "addrmap",
    label: "Sample map",
    identifier: "sample",
    address: "0x0",
    children: [],
  },
  registers: [
    {
      id: "register:sample.control",
      identifier: "control",
      path: "sample.control",
      name: "Control",
      description: "Controls the sample block.",
      absoluteAddress: "36",
      absoluteAddressHex: "0x24",
      addressOffset: "36",
      addressOffsetHex: "0x24",
      width: 32,
      softwareAccess: "rw",
      hardwareAccess: "r",
      groupPath: ["Configuration", "General"],
      arrayDimensions: [],
      arrayStride: null,
      arrayStrideHex: null,
      fields: [
        {
          id: "field:sample.control.mode",
          registerId: "register:sample.control",
          identifier: "mode",
          path: "sample.control.mode",
          name: "Operating Mode",
          description: "Selects operation.",
          low: 0,
          high: 1,
          width: 2,
          softwareAccess: "rw",
          hardwareAccess: "r",
          reset: { value: "0", hex: "0x0", enumMember: "IDLE" },
          enum: {
            name: "mode_e",
            members: [
              {
                name: "IDLE",
                displayName: "Idle",
                value: "0",
                hex: "0x0",
                description: "No operation",
              },
              {
                name: "ACTIVE",
                displayName: "Active",
                value: "1",
                hex: "0x1",
                description: "Normal operation",
              },
            ],
          },
        },
      ],
    },
  ],
};

describe("search records", () => {
  const records = createSearchRecords(document);
  const service = new SearchService(records);

  test("finds exact hexadecimal and decimal addresses", () => {
    expect(service.search("0x24")[0]?.targetId).toBe("register:sample.control");
    expect(service.search("36")[0]?.targetId).toBe("register:sample.control");
  });

  test("finds documentation groups, fields, and enum members", () => {
    expect(service.search("Configuration")[0]?.targetId).toBe("register:sample.control");
    expect(service.search("Operating Mode")[0]?.kind).toBe("field");
    expect(service.search("ACTIVE")[0]?.kind).toBe("enum-member");
  });

  test("preserves exact folder, enum, and enum-member link targets", () => {
    expect(records.find((record) => record.kind === "structure")?.folderId).toBe("addrmap:sample");
    expect(records.find((record) => record.kind === "enum")?.enumName).toBe("mode_e");
    expect(records.find((record) => record.id.endsWith(":ACTIVE"))).toMatchObject({
      targetId: "register:sample.control",
      fieldId: "field:sample.control.mode",
      enumName: "mode_e",
      memberName: "ACTIVE",
    });
  });
});
