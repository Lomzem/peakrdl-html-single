import { describe, expect, test } from "bun:test";

import { bitGapLabel, bitRange } from "../src/lib/components/register-document/register-bits";

describe("field bit range", () => {
  test("formats multi-bit fields as [MSB:LSB]", () => {
    expect(bitRange({ high: 15, low: 8 })).toBe("[15:8]");
  });

  test("keeps both bounds for single-bit fields", () => {
    expect(bitRange({ high: 3, low: 3 })).toBe("[3:3]");
  });
});

describe("reserved bit range", () => {
  test("formats multi-bit ranges as [MSB:LSB]", () => {
    expect(bitGapLabel(8, 15)).toBe("[15:8]");
  });

  test("keeps both bounds for single-bit ranges", () => {
    expect(bitGapLabel(3, 3)).toBe("[3:3]");
  });
});
