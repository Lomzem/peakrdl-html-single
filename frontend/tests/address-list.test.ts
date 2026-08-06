import { describe, expect, test } from "bun:test";

import {
  addressListItems,
  addressRangeLabel,
} from "../src/lib/components/register-document/address-list";
import type { NavigationNode, Register } from "../src/lib/domain";

function register(id: string, address: string | null, width = 32): Register {
  return {
    id,
    identifier: id,
    path: id,
    name: id,
    description: "",
    absoluteAddress: address,
    absoluteAddressHex: address === null ? null : `0x${BigInt(address).toString(16)}`,
    addressOffset: null,
    addressOffsetHex: null,
    width,
    softwareAccess: "rw",
    hardwareAccess: "r",
    groupPath: [],
    arrayDimensions: [],
    arrayStride: null,
    arrayStrideHex: null,
    fields: [],
  };
}

function node(id: string): NavigationNode {
  return {
    id: `navigation:${id}`,
    kind: "register",
    label: id,
    identifier: id,
    address: null,
    targetId: id,
    children: [],
  };
}

describe("address list items", () => {
  test("inserts an inclusive reserved range between registers", () => {
    const registers = new Map([
      ["first", register("first", "0")],
      ["second", register("second", "8")],
    ]);

    expect(addressListItems([node("first"), node("second")], registers, true)).toEqual([
      { kind: "node", node: node("first") },
      { kind: "gap", low: 4n, high: 7n },
      { kind: "node", node: node("second") },
    ]);
    expect(addressRangeLabel(4n, 7n)).toBe("0x4-0x7");
  });

  test("does not insert gaps when they are hidden or registers overlap", () => {
    const children = [node("wide"), node("overlap"), node("next")];
    const registers = new Map([
      ["wide", register("wide", "0", 64)],
      ["overlap", register("overlap", "4", 32)],
      ["next", register("next", "8")],
    ]);

    expect(addressListItems(children, registers, true)).toHaveLength(3);
    expect(addressListItems(children, registers, false)).toEqual(
      children.map((item) => ({ kind: "node", node: item })),
    );
  });

  test("uses one address for a single-byte gap", () => {
    expect(addressRangeLabel(4n, 4n)).toBe("0x4");
  });
});
