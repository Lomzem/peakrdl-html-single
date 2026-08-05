<script lang="ts">
    import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
    import FolderTreeIcon from "@lucide/svelte/icons/folder-tree";

    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
    import type { NavigationNode, Register } from "$lib/domain";
    import { renderMarkdown } from "$lib/markdown";

    import { bitGapLabel, bitLayoutItems } from "./register-bits";
    import type { RegisterCalculatorState } from "./calculator-state.svelte";
    import RegisterBitLayout from "./register-bit-layout.svelte";
    import RegisterCalculator from "./register-calculator.svelte";
    import RegisterFieldCard from "./register-field-card.svelte";

    interface Props {
        register: Register;
        breadcrumbs: ReadonlyArray<NavigationNode>;
        showReservedGaps: boolean;
        calculator: RegisterCalculatorState;
        onSelectFolder: (node: NavigationNode) => void;
    }

    let { register, breadcrumbs, showReservedGaps, calculator, onSelectFolder }: Props = $props();
    let copiedAddress = $state("");

    async function copyAddress(address: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(address);
        } catch {
            const input = document.createElement("textarea");
            input.value = address;
            input.style.position = "fixed";
            input.style.opacity = "0";
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            input.remove();
        }
        copiedAddress = address;
        window.setTimeout(() => {
            if (copiedAddress === address) copiedAddress = "";
        }, 1200);
    }
</script>

<section aria-labelledby="register-title">
    {#if breadcrumbs.length}
        <div class="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <FolderTreeIcon class="mr-1 size-3.5" />
            {#each breadcrumbs as group, index (group.id)}
                {#if index}<ChevronRightIcon class="size-3" />{/if}
                <button
                    type="button"
                    class="rounded-sm px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onclick={() => onSelectFolder(group)}
                >
                    {group.label}
                </button>
            {/each}
        </div>
    {/if}

    <div class="min-w-0">
        <div class="mb-2 flex flex-wrap items-center gap-2">
            {#if register.absoluteAddressHex}
                <button
                    type="button"
                    class="group rounded-full outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Copy address ${register.absoluteAddressHex}`}
                    title={copiedAddress === register.absoluteAddressHex
                        ? "Copied"
                        : "Copy address"}
                    onclick={() => copyAddress(register.absoluteAddressHex || "")}
                >
                    <Badge class="cursor-copy font-mono text-sm">
                        {#if copiedAddress === register.absoluteAddressHex}
                            <span class="select-none">Copied</span>
                        {:else}
                            <span class="select-none" aria-hidden="true">@</span><span
                                >{register.absoluteAddressHex}</span
                            >
                        {/if}
                    </Badge>
                </button>
            {/if}
        </div>
        <h2 id="register-title" class="text-3xl font-semibold tracking-tight md:text-4xl">
            {register.name}
        </h2>
        <p class="mt-2 break-all font-mono text-xs text-muted-foreground">
            {register.identifier}
        </p>
    </div>

    {#if register.description}
        <div class="markdown mt-4 max-w-4xl text-sm md:text-base">
            {@html renderMarkdown(register.description)}
        </div>
    {/if}

    <Separator class="my-5" />
    <RegisterBitLayout {register} {showReservedGaps} />

    <div class="mt-5">
        <RegisterCalculator {register} {showReservedGaps} {calculator} />
    </div>

    <div class="mt-5 space-y-4">
        {#each bitLayoutItems(register, showReservedGaps) as item (item.kind === "field" ? item.field.id : `gap:${item.low}:${item.high}`)}
            {#if item.kind === "field"}
                <RegisterFieldCard field={item.field} />
            {:else}
                <div
                    class="flex items-center justify-between rounded-lg border border-dashed bg-muted/25 px-4 py-3 text-sm text-muted-foreground"
                >
                    <span class="font-medium">Reserved</span>
                    <code>[{bitGapLabel(item.low, item.high)}]</code>
                </div>
            {/if}
        {/each}
    </div>
</section>
