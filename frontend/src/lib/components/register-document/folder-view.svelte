<script lang="ts">
    import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
    import CpuIcon from "@lucide/svelte/icons/cpu";
    import FileStackIcon from "@lucide/svelte/icons/files";
    import FolderTreeIcon from "@lucide/svelte/icons/folder-tree";
    import HashIcon from "@lucide/svelte/icons/hash";

    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
    import type { NavigationNode, Register } from "$lib/domain";

    type FolderListItem =
        | { kind: "node"; node: NavigationNode }
        | { kind: "gap"; id: string; low: bigint; high: bigint };

    interface Props {
        folder: NavigationNode;
        registersById: ReadonlyMap<string, Register>;
        showReservedGaps: boolean;
        onSelectRegister: (id: string) => void;
        onSelectFolder: (node: NavigationNode) => void;
    }

    let { folder, registersById, showReservedGaps, onSelectRegister, onSelectFolder }: Props =
        $props();
    let items = $derived(folderListItems(folder));

    function hex(value: bigint): string {
        return `0x${value.toString(16)}`;
    }

    function addressGapLabel(low: bigint, high: bigint): string {
        return low === high ? hex(low) : `${hex(low)}-${hex(high)}`;
    }

    function folderListItems(node: NavigationNode): FolderListItem[] {
        if (!showReservedGaps) return node.children.map((child) => ({ kind: "node", node: child }));

        const items: FolderListItem[] = [];
        let previousEnd: bigint | null = null;
        for (const child of node.children) {
            const register = child.targetId ? registersById.get(child.targetId) : undefined;
            if (child.kind !== "register" || !register?.absoluteAddress) {
                items.push({ kind: "node", node: child });
                previousEnd = null;
                continue;
            }

            const address = BigInt(register.absoluteAddress);
            if (previousEnd !== null && address > previousEnd + 1n) {
                const low = previousEnd + 1n;
                items.push({
                    kind: "gap",
                    id: `gap:${low}:${address - 1n}`,
                    low,
                    high: address - 1n,
                });
            }
            items.push({ kind: "node", node: child });
            const byteWidth = BigInt(Math.max(1, Math.ceil(register.width / 8)));
            previousEnd = address + byteWidth - 1n;
        }
        return items;
    }
</script>

{#snippet kindIcon(node: NavigationNode)}
    {#if node.kind === "addrmap"}
        <CpuIcon class="size-3.5 text-primary" />
    {:else if node.kind === "regfile" || node.kind === "memory"}
        <FileStackIcon class="size-3.5 text-muted-foreground" />
    {:else if node.kind === "doc-group"}
        <FolderTreeIcon class="size-3.5 text-muted-foreground" />
    {:else}
        <HashIcon class="size-3.5 text-muted-foreground" />
    {/if}
{/snippet}

<section aria-labelledby="folder-title">
    {#if folder.address}<Badge variant="outline" class="font-mono">{folder.address}</Badge>{/if}
    <h2 id="folder-title" class="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        {folder.label}
    </h2>
    <p class="mt-2 break-all font-mono text-xs text-muted-foreground">
        {folder.identifier}
    </p>

    <Separator class="my-8" />

    {#if items.length}
        <div class="grid gap-3">
            {#each items as item (item.kind === "node" ? item.node.id : item.id)}
                {#if item.kind === "node"}
                    <button
                        class="group flex min-w-0 items-center gap-3 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onclick={() =>
                            item.node.kind === "register" && item.node.targetId
                                ? onSelectRegister(item.node.targetId)
                                : onSelectFolder(item.node)}
                    >
                        <span
                            class="grid size-9 shrink-0 place-items-center rounded-md bg-muted group-hover:bg-background/60"
                        >
                            {@render kindIcon(item.node)}
                        </span>
                        <span class="min-w-0 flex-1">
                            <span class="block truncate font-medium">{item.node.label}</span>
                            <span
                                class="mt-1 block truncate font-mono text-xs text-muted-foreground"
                            >
                                {item.node.kind === "register"
                                    ? item.node.address || item.node.identifier
                                    : `${item.node.children.length} items`}
                            </span>
                        </span>
                        <ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" />
                    </button>
                {:else}
                    <div
                        class="flex items-center justify-between rounded-lg border border-dashed bg-muted/25 px-4 py-3 text-sm text-muted-foreground"
                    >
                        <span>Reserved</span>
                        <code>@{addressGapLabel(item.low, item.high)}</code>
                    </div>
                {/if}
            {/each}
        </div>
    {:else}
        <div
            class="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground"
        >
            This folder is empty.
        </div>
    {/if}
</section>
