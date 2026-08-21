import { describe, expect, test } from "bun:test";

import {
  bitGapLabel,
  bitLayoutMinWidthRem,
  bitRange,
  usesCompactBitLabel,
} from "../src/lib/components/register-document/register-bits";

describe("field bit range", () => {
  test("formats multi-bit fields as [MSB:LSB]", () => {
    expect(bitRange({ high: 15, low: 8 })).toBe("[15:8]");
  });

  test("uses the conventional concise form for single-bit fields", () => {
    expect(bitRange({ high: 3, low: 3 })).toBe("[3]");
  });
});

describe("reserved bit range", () => {
  test("formats multi-bit ranges as [MSB:LSB]", () => {
    expect(bitGapLabel(8, 15)).toBe("[15:8]");
  });

  test("uses the conventional concise form for single-bit ranges", () => {
    expect(bitGapLabel(3, 3)).toBe("[3]");
  });
});

describe("bit-layout minimum width", () => {
  test("scales with register width and bit-index digit count", () => {
    expect(bitLayoutMinWidthRem(32)).toBeCloseTo(88.3375);
    expect(bitLayoutMinWidthRem(128)).toBeCloseTo(411.1375);
    expect(bitLayoutMinWidthRem(128)).toBeGreaterThan(bitLayoutMinWidthRem(32) * 3);
  });
});

describe("bit-layout field labels", () => {
  test("uses one compact typography step for one-bit and two-bit spans", () => {
    expect(usesCompactBitLabel(1)).toBe(true);
    expect(usesCompactBitLabel(2)).toBe(true);
    expect(usesCompactBitLabel(3)).toBe(false);
  });
});
