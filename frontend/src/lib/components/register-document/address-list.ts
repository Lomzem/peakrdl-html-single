import type { NavigationNode, Register } from "$lib/domain";

export type AddressListItem =
  { kind: "node"; node: NavigationNode } | { kind: "gap"; low: bigint; high: bigint };

export function addressRangeLabel(low: bigint, high: bigint): string {
  const hex = (value: bigint) => `0x${value.toString(16)}`;
  return low === high ? hex(low) : `${hex(low)}-${hex(high)}`;
}

export function addressListItems(
  children: ReadonlyArray<NavigationNode>,
  registersById: ReadonlyMap<string, Register>,
  showReservedGaps: boolean,
): AddressListItem[] {
  if (!showReservedGaps) return children.map((node) => ({ kind: "node", node }));

  const items: AddressListItem[] = [];
  let previousEnd: bigint | null = null;
  for (const node of children) {
    const register = node.targetId ? registersById.get(node.targetId) : undefined;
    if (node.kind !== "register" || register?.absoluteAddress === null || !register) {
      items.push({ kind: "node", node });
      previousEnd = null;
      continue;
    }

    let address: bigint;
    try {
      address = BigInt(register.absoluteAddress);
    } catch {
      items.push({ kind: "node", node });
      previousEnd = null;
      continue;
    }

    if (previousEnd !== null && address > previousEnd + 1n) {
      items.push({ kind: "gap", low: previousEnd + 1n, high: address - 1n });
    }
    items.push({ kind: "node", node });

    const byteWidth = BigInt(Math.max(1, Math.ceil(register.width / 8)));
    const end = address + byteWidth - 1n;
    previousEnd = previousEnd === null || end > previousEnd ? end : previousEnd;
  }
  return items;
}
