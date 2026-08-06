<script lang="ts">
    import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
    import FolderTreeIcon from "@lucide/svelte/icons/folder-tree";

    import { Button } from "$lib/components/ui/button";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { Separator } from "$lib/components/ui/separator";
    import { documentHref, type DocumentTarget } from "$lib/document-links";
    import type { NavigationNode, Register } from "$lib/domain";
    import { addressListItems, addressRangeLabel } from "./address-list";

    interface Props {
        title: string;
        root: NavigationNode;
        selectedRegisterId: string;
        selectedFolderId: string;
        expanded: Set<string>;
        registersById: ReadonlyMap<string, Register>;
        showReservedGaps: boolean;
        navigationMode: "document" | "address";
        allNavigationExpanded: boolean;
        onToggle: (id: string) => void;
        onToggleAll: () => void;
        onNavigationModeChange: (mode: "document" | "address") => void;
        onNavigate: (event: MouseEvent, target: DocumentTarget) => void;
    }

    let {
        title,
        root,
        selectedRegisterId,
        selectedFolderId,
        expanded,
        registersById,
        showReservedGaps,
        navigationMode,
        allNavigationExpanded,
        onToggle,
        onToggleAll,
        onNavigationModeChange,
        onNavigate,
    }: Props = $props();
</script>

{#snippet navigationNode(node: NavigationNode, depth: number)}
    {#if node.kind === "register" && node.targetId}
        <Button
            href={documentHref({ kind: "register", registerId: node.targetId })}
            variant={selectedRegisterId === node.targetId ? "secondary" : "ghost"}
            size="sm"
            class="h-auto min-h-7 w-full justify-start gap-2 whitespace-normal py-1 pr-2 text-left font-normal"
            style={`padding-left: ${0.5 + depth * 0.85}rem`}
            aria-current={selectedRegisterId === node.targetId ? "page" : undefined}
            onclick={(event) =>
                onNavigate(event, { kind: "register", registerId: node.targetId || "" })}
        >
            <span class="min-w-0 flex-1 truncate">{node.label}</span>
            {#if node.address}
                <span class="font-mono text-[0.68rem] text-muted-foreground">{node.address}</span>
            {/if}
        </Button>
    {:else}
        <div
            class="flex min-h-7 w-full items-center pr-2"
            style={`padding-left: ${0.25 + depth * 0.85}rem`}
        >
            <Button
                variant="ghost"
                size="icon-xs"
                class="shrink-0"
                aria-label={`${expanded.has(node.id) ? "Collapse" : "Expand"} ${node.label}`}
                aria-expanded={expanded.has(node.id)}
                onclick={() => onToggle(node.id)}
            >
                <ChevronRightIcon
                    class={`size-3.5 transition-transform ${expanded.has(node.id) ? "rotate-90" : ""}`}
                />
            </Button>
            <Button
                href={documentHref({ kind: "folder", folderId: node.id })}
                variant={selectedFolderId === node.id ? "secondary" : "ghost"}
                size="sm"
                class="h-auto min-h-7 min-w-0 flex-1 justify-start gap-1.5 px-1.5 py-1 text-left font-medium"
                aria-current={selectedFolderId === node.id ? "page" : undefined}
                onclick={(event) => onNavigate(event, { kind: "folder", folderId: node.id })}
            >
                <span class="min-w-0 flex-1 truncate">{node.label}</span>
            </Button>
        </div>
        {#if expanded.has(node.id)}
            {#each addressListItems(node.children, registersById, showReservedGaps) as item (item.kind === "node" ? item.node.id : `${node.id}:gap:${item.low}:${item.high}`)}
                {#if item.kind === "node"}
                    {@render navigationNode(item.node, depth + 1)}
                {:else}
                    <div
                        class="mx-2 my-0.5 flex min-h-7 items-center gap-2 rounded-md border border-dashed border-muted-foreground/35 bg-muted/45 py-1 pr-2 text-xs text-muted-foreground"
                        style={`padding-left: ${0.5 + (depth + 1) * 0.85}rem`}
                        aria-label={`Reserved address range ${addressRangeLabel(item.low, item.high)}`}
                    >
                        <span class="min-w-0 flex-1 truncate font-medium italic">Reserved</span>
                        <span class="shrink-0 font-mono text-[0.68rem]">
                            {addressRangeLabel(item.low, item.high)}
                        </span>
                    </div>
                {/if}
            {/each}
        {/if}
    {/if}
{/snippet}

<div class="flex h-full min-h-0 flex-col">
    <div class="px-4 pb-3 pt-5">
        <h1 class="mt-1 line-clamp-2 text-lg font-semibold leading-tight tracking-tight">
            {title}
        </h1>
        <div class="mt-3 flex items-center gap-2">
            <Button variant="outline" size="sm" class="flex-1" onclick={onToggleAll}>
                {allNavigationExpanded ? "Collapse All" : "Expand All"}
            </Button>
            <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                        <Button
                            {...props}
                            variant="outline"
                            size="icon-sm"
                            aria-label="Change navigation order"
                            title="Change navigation order"
                        >
                            <FolderTreeIcon />
                        </Button>
                    {/snippet}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" class="w-44 bg-card text-card-foreground">
                    <DropdownMenu.Label>Navigation order</DropdownMenu.Label>
                    <DropdownMenu.Separator />
                    <DropdownMenu.RadioGroup
                        value={navigationMode}
                        onValueChange={(value) =>
                            onNavigationModeChange(value as "document" | "address")}
                    >
                        <DropdownMenu.RadioItem value="document">
                            Document groups
                        </DropdownMenu.RadioItem>
                        <DropdownMenu.RadioItem value="address">
                            Address order
                        </DropdownMenu.RadioItem>
                    </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
            </DropdownMenu.Root>
        </div>
    </div>
    <Separator />
    <ScrollArea class="min-h-0 flex-1 py-2">
        <nav class="px-2" aria-label="Register hierarchy">
            {@render navigationNode(root, 0)}
        </nav>
    </ScrollArea>
</div>
