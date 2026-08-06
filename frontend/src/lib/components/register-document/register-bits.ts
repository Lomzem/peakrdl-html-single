import type { Register, RegisterField } from "$lib/domain";

export type BitLayoutItem =
  { kind: "field"; field: RegisterField } | { kind: "gap"; low: number; high: number };

export function bitRange(field: Pick<RegisterField, "high" | "low">): string {
  return `[${field.high}:${field.low}]`;
}

export function bitGapLabel(low: number, high: number): string {
  return `[${high}:${low}]`;
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
