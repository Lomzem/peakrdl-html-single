<script lang="ts">
    import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

    import { Button } from "$lib/components/ui/button";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { Separator } from "$lib/components/ui/separator";
    import type { NavigationNode } from "$lib/domain";

    interface Props {
        title: string;
        root: NavigationNode;
        selectedRegisterId: string;
        selectedFolderId: string;
        expanded: Set<string>;
        onToggle: (id: string) => void;
        onSelectRegister: (id: string) => void;
        onSelectFolder: (node: NavigationNode) => void;
    }

    let {
        title,
        root,
        selectedRegisterId,
        selectedFolderId,
        expanded,
        onToggle,
        onSelectRegister,
        onSelectFolder,
    }: Props = $props();
</script>

{#snippet navigationNode(node: NavigationNode, depth: number)}
    {#if node.kind === "register" && node.targetId}
        <Button
            variant={selectedRegisterId === node.targetId ? "secondary" : "ghost"}
            size="sm"
            class="h-auto min-h-7 w-full justify-start gap-2 whitespace-normal py-1 pr-2 text-left font-normal"
            style={`padding-left: ${0.5 + depth * 0.85}rem`}
            aria-current={selectedRegisterId === node.targetId ? "page" : undefined}
            onclick={() => onSelectRegister(node.targetId || "")}
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
                variant={selectedFolderId === node.id ? "secondary" : "ghost"}
                size="sm"
                class="h-auto min-h-7 min-w-0 flex-1 justify-start gap-1.5 px-1.5 py-1 text-left font-medium"
                aria-current={selectedFolderId === node.id ? "page" : undefined}
                onclick={() => onSelectFolder(node)}
            >
                <span class="min-w-0 flex-1 truncate">{node.label}</span>
            </Button>
        </div>
        {#if expanded.has(node.id)}
            {#each node.children as child (child.id)}
                {@render navigationNode(child, depth + 1)}
            {/each}
        {/if}
    {/if}
{/snippet}

<div class="flex h-full min-h-0 flex-col">
    <div class="px-4 pb-3 pt-5">
        <h1 class="mt-1 line-clamp-2 text-lg font-semibold leading-tight tracking-tight">
            {title}
        </h1>
    </div>
    <Separator />
    <ScrollArea class="min-h-0 flex-1 py-2">
        <nav class="px-2" aria-label="Register hierarchy">
            {@render navigationNode(root, 0)}
        </nav>
    </ScrollArea>
</div>
