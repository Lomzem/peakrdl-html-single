<script lang="ts">
    /* eslint-disable svelte/no-navigation-without-resolve -- Fragment links also run in the standalone build. */
    import CalculatorIcon from "@lucide/svelte/icons/calculator";

    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent, CardHeader } from "$lib/components/ui/card";
    import { Input } from "$lib/components/ui/input";
    import * as Select from "$lib/components/ui/select";
    import { documentHref, type DocumentTarget } from "$lib/document-links";
    import type { Register } from "$lib/domain";

    import type { RegisterCalculatorState, ValueMode } from "./calculator-state.svelte";
    import { bitGapLabel, bitLayoutItems, bitRange } from "./register-bits";

    interface Props {
        register: Register;
        showReservedGaps: boolean;
        calculator: RegisterCalculatorState;
        onNavigate: (event: MouseEvent, target: DocumentTarget) => void;
    }

    let { register, showReservedGaps, calculator, onNavigate }: Props = $props();
</script>

<Card class="gap-0 overflow-hidden py-0">
    <CardHeader class="border-b bg-muted/25 p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 class="flex items-center gap-2 text-xl font-semibold tracking-tight">
                <CalculatorIcon class="size-5 text-primary" />
                Register Calculator
            </h3>
            <div class="flex flex-wrap items-center gap-2">
                <div
                    class="flex rounded-lg border bg-background p-0.5"
                    aria-label="Value display mode"
                >
                    {#each ["binary", "decimal", "hex", "enum"] as mode (mode)}
                        <Button
                            variant={calculator.valueMode === mode ? "secondary" : "ghost"}
                            size="sm"
                            class="capitalize"
                            aria-pressed={calculator.valueMode === mode}
                            onclick={() => calculator.setValueMode(mode as ValueMode, register)}
                        >
                            {mode}
                        </Button>
                    {/each}
                </div>
                <Button variant="outline" size="sm" onclick={() => calculator.reset(register)}>
                    Reset
                </Button>
            </div>
        </div>
    </CardHeader>

    <CardContent class="p-4">
        <div class="overflow-hidden rounded-lg border">
            {#each bitLayoutItems(register, showReservedGaps) as item (item.kind === "field" ? item.field.id : `editor-gap:${item.low}:${item.high}`)}
                {#if item.kind === "gap"}
                    <div
                        class="flex items-center justify-between border-b border-dashed bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground last:border-b-0"
                    >
                        <span>Reserved</span>
                        <code>[{bitGapLabel(item.low, item.high)}]</code>
                    </div>
                {:else}
                    <div
                        class="grid gap-3 border-b px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(10rem,1fr)_minmax(10rem,16rem)] sm:items-start"
                    >
                        <div class="min-w-0">
                            <div class="flex min-w-0 items-center gap-2">
                                <a
                                    href={documentHref({
                                        kind: "register",
                                        registerId: register.id,
                                        fieldId: item.field.id,
                                    })}
                                    class="min-w-0 truncate text-left text-sm font-medium hover:underline"
                                    onclick={(event) =>
                                        onNavigate(event, {
                                            kind: "register",
                                            registerId: register.id,
                                            fieldId: item.field.id,
                                        })}
                                >
                                    {item.field.name}
                                </a>
                                <code class="shrink-0 text-xs text-muted-foreground">
                                    [{bitRange(item.field)}]
                                </code>
                            </div>
                            <p class="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                                {calculator.fieldResetLabel(item.field)}
                            </p>
                        </div>
                        <div class="grid gap-1">
                            <div class="flex min-w-0 items-center gap-2">
                                {#if calculator.valueMode === "enum" && item.field.enum}
                                    {@const value = calculator.fieldValue(register, item.field)}
                                    {@const member = calculator.matchingEnumMember(
                                        item.field,
                                        value,
                                    )}
                                    <Select.Root
                                        type="single"
                                        value={value.toString()}
                                        onValueChange={(selected) =>
                                            calculator.updateFieldValue(
                                                register,
                                                item.field,
                                                BigInt(selected),
                                            )}
                                    >
                                        <Select.Trigger
                                            class="min-w-0 flex-1 bg-background font-mono"
                                        >
                                            {member?.displayName ||
                                                `Unknown (${calculator.formatNumericValue(value, item.field.width, "hex")})`}
                                        </Select.Trigger>
                                        <Select.Content class="bg-card text-card-foreground">
                                            {#each item.field.enum.members as option (option.name)}
                                                <Select.Item value={option.value}>
                                                    {option.displayName}
                                                </Select.Item>
                                            {/each}
                                        </Select.Content>
                                    </Select.Root>
                                {:else}
                                    <Input
                                        value={calculator.fieldEditorValue(register, item.field)}
                                        class="min-w-0 flex-1 font-mono"
                                        aria-invalid={Boolean(
                                            calculator.fieldErrors[item.field.id],
                                        )}
                                        oninput={(event) =>
                                            calculator.updateFieldDraft(
                                                register,
                                                item.field,
                                                (event.currentTarget as HTMLInputElement).value,
                                            )}
                                    />
                                {/if}
                            </div>
                            {#if calculator.fieldErrors[item.field.id]}
                                <p class="text-xs text-destructive">
                                    {calculator.fieldErrors[item.field.id]}
                                </p>
                            {/if}
                        </div>
                    </div>
                {/if}
            {/each}
        </div>

        <div class="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label class="grid gap-1.5">
                <span class="text-sm font-medium">Encoded register value</span>
                <Input
                    value={calculator.encodedDraft}
                    class="font-mono"
                    aria-invalid={Boolean(calculator.encodedError)}
                    oninput={(event) =>
                        calculator.updateEncodedValue(
                            register,
                            (event.currentTarget as HTMLInputElement).value,
                        )}
                />
            </label>
            <Button variant="outline" onclick={() => calculator.copyEncodedValue(register)}>
                {calculator.copiedEncodedValue ? "Copied" : "Copy"}
            </Button>
        </div>
        {#if calculator.encodedError}
            <p class="mt-1.5 text-xs text-destructive">{calculator.encodedError}</p>
        {/if}
    </CardContent>
</Card>
