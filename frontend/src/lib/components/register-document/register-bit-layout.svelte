<script lang="ts">
    /* eslint-disable svelte/no-navigation-without-resolve -- Fragment links also run in the standalone build. */
    import type { Register } from "$lib/domain";
    import { documentHref, type DocumentTarget } from "$lib/document-links";

    import { bitGapLabel, bitLayoutItems, bitRange } from "./register-bits";

    interface Props {
        register: Register;
        showReservedGaps: boolean;
        onNavigate: (event: MouseEvent, target: DocumentTarget) => void;
    }

    let { register, showReservedGaps, onNavigate }: Props = $props();
</script>

<section aria-label="Bit layout">
    <div class="overflow-x-auto rounded-lg border bg-card p-3">
        <div
            class="grid min-w-[42rem] gap-px overflow-hidden rounded-md bg-border"
            style={`grid-template-columns: repeat(${Math.max(register.width, 1)}, minmax(0, 1fr))`}
        >
            {#each bitLayoutItems(register, showReservedGaps) as item, index (item.kind === "field" ? item.field.id : `gap:${item.low}:${item.high}`)}
                {#if item.kind === "field"}
                    <a
                        href={documentHref({
                            kind: "register",
                            registerId: register.id,
                            fieldId: item.field.id,
                        })}
                        class={`row-start-1 flex min-h-16 flex-col items-center justify-center overflow-hidden border-y px-1 text-center text-[0.65rem] leading-tight transition-colors hover:bg-muted ${index % 2 ? "border-border bg-muted/70" : "border-border bg-secondary"}`}
                        style={`grid-column: ${register.width - item.field.high} / ${register.width - item.field.low + 1}`}
                        title={`${item.field.name} ${bitRange(item.field)}`}
                        onclick={(event) =>
                            onNavigate(event, {
                                kind: "register",
                                registerId: register.id,
                                fieldId: item.field.id,
                            })}
                    >
                        <span class="block truncate font-medium">{item.field.name}</span>
                        <span class="mt-1 block font-mono text-muted-foreground">
                            {bitRange(item.field)}
                        </span>
                    </a>
                {:else}
                    <div
                        class="row-start-1 grid min-h-16 place-content-center overflow-hidden border-y border-dashed border-border bg-muted/25 px-1 text-center text-[0.65rem] leading-tight text-muted-foreground"
                        style={`grid-column: ${register.width - item.high} / ${register.width - item.low + 1}`}
                    >
                        <span class="font-medium">Reserved</span>
                        <span class="mt-1 font-mono">{bitGapLabel(item.low, item.high)}</span>
                    </div>
                {/if}
            {/each}
        </div>
    </div>
</section>
