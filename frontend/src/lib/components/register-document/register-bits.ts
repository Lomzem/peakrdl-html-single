import type { Register, RegisterField } from "$lib/domain";

export type BitLayoutItem =
  { kind: "field"; field: RegisterField } | { kind: "gap"; low: number; high: number };

export function bitRange(field: Pick<RegisterField, "high" | "low">): string {
  if (field.high === field.low) return `[${field.high}]`;
  return `[${field.high}:${field.low}]`;
}

export function bitGapLabel(low: number, high: number): string {
  if (high === low) return `[${high}]`;
  return `[${high}:${low}]`;
}

export function bitLayoutMinWidthRem(registerWidth: number): number {
  const width = Math.max(registerWidth, 1);
  const indexDigits = String(width - 1).length;
  const singleBitRangeCharacters = indexDigits + 2;
  const monoCharacterWidthRem = 0.45;
  const horizontalPaddingRem = 0.8;
  const rangeBufferRem = 0.1;
  const gridGapRem = 0.0625;
  const columnWidth =
    singleBitRangeCharacters * monoCharacterWidthRem + horizontalPaddingRem + rangeBufferRem;
  return width * columnWidth + (width - 1) * gridGapRem;
}

export function usesCompactBitLabel(width: number): boolean {
  return width <= 2;
}

export function valueMask(width: number): bigint {
  return width > 0 ? (1n << BigInt(width)) - 1n : 0n;
}

export function resetRegisterValue(register: Register): bigint {
  let value = 0n;
  for (const field of register.fields) {
    if (!field.reset) continue;
    value |= (BigInt(field.reset.value) & valueMask(field.width)) << BigInt(field.low);
  }
  return value & valueMask(register.width);
}

export function bitLayoutItems(register: Register, showReservedGaps: boolean): BitLayoutItem[] {
  const fields = [...register.fields].sort(
    (left, right) => right.high - left.high || right.low - left.low,
  );
  if (!showReservedGaps) return fields.map((field) => ({ kind: "field", field }));

  const items: BitLayoutItem[] = [];
  let nextHigh = register.width - 1;
  for (const field of fields) {
    if (field.high < nextHigh) {
      items.push({ kind: "gap", low: field.high + 1, high: nextHigh });
    }
    items.push({ kind: "field", field });
    nextHigh = Math.min(nextHigh, field.low - 1);
  }
  if (nextHigh >= 0) items.push({ kind: "gap", low: 0, high: nextHigh });
  return items;
}
