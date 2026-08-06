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
    <div class="overflow-x-auto rounded-lg border bg-card p-3 text-card-foreground">
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
                        class={`row-start-1 flex min-h-20 flex-col items-center justify-center gap-1 overflow-hidden border-y border-border px-2 text-center text-xs leading-tight transition-colors hover:bg-accent hover:text-accent-foreground ${index % 2 ? "bg-muted/70 text-foreground" : "bg-secondary text-secondary-foreground"}`}
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
                        <span class="block font-mono font-medium">
                            {bitRange(item.field)}
                        </span>
                    </a>
                {:else}
                    <div
                        class="row-start-1 grid min-h-20 place-content-center gap-1 overflow-hidden border-y border-dashed border-border bg-muted/40 px-2 text-center text-xs leading-tight text-foreground"
                        style={`grid-column: ${register.width - item.high} / ${register.width - item.low + 1}`}
                    >
                        <span class="font-medium">Reserved</span>
                        <span class="font-mono font-medium text-muted-foreground">
                            {bitGapLabel(item.low, item.high)}
                        </span>
                    </div>
                {/if}
            {/each}
        </div>
    </div>
</section>
