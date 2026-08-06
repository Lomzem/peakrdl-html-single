<script lang="ts">
    import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
    import CpuIcon from "@lucide/svelte/icons/cpu";
    import FileStackIcon from "@lucide/svelte/icons/files";
    import FolderTreeIcon from "@lucide/svelte/icons/folder-tree";
    import HashIcon from "@lucide/svelte/icons/hash";

    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
    import type { NavigationNode, Register } from "$lib/domain";
    import { addressListItems, addressRangeLabel } from "./address-list";

    interface Props {
        folder: NavigationNode;
        breadcrumbs: ReadonlyArray<NavigationNode>;
        registersById: ReadonlyMap<string, Register>;
        showReservedGaps: boolean;
        onSelectRegister: (id: string) => void;
        onSelectFolder: (node: NavigationNode) => void;
    }

    let {
        folder,
        breadcrumbs,
        registersById,
        showReservedGaps,
        onSelectRegister,
        onSelectFolder,
    }: Props = $props();
    let items = $derived(addressListItems(folder.children, registersById, showReservedGaps));
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
    {#if breadcrumbs.length}
        <div class="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <FolderTreeIcon class="mr-1 size-3.5" />
            {#each breadcrumbs as ancestor, index (ancestor.id)}
                {#if index}<ChevronRightIcon class="size-3" />{/if}
                <button
                    type="button"
                    class="rounded-sm px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onclick={() => onSelectFolder(ancestor)}
                >
                    {ancestor.label}
                </button>
            {/each}
        </div>
    {/if}

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
            {#each items as item (item.kind === "node" ? item.node.id : `gap:${item.low}:${item.high}`)}
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
                        <code>@{addressRangeLabel(item.low, item.high)}</code>
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
