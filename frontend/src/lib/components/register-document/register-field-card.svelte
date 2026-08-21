<script lang="ts">
    /* eslint-disable svelte/no-navigation-without-resolve -- Fragment links also run in the standalone build. */
    import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
    import ChevronUpIcon from "@lucide/svelte/icons/chevron-up";

    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent, CardHeader } from "$lib/components/ui/card";
    import * as Collapsible from "$lib/components/ui/collapsible";
    import {
        Table,
        TableBody,
        TableCell,
        TableHead,
        TableHeader,
        TableRow,
    } from "$lib/components/ui/table";
    import {
        documentHref,
        enumDomId,
        enumMemberDomId,
        fieldDomId,
        type DocumentTarget,
    } from "$lib/document-links";
    import type { RegisterField } from "$lib/domain";
    import { renderMarkdown } from "$lib/markdown";

    import { bitRange } from "./register-bits";

    interface Props {
        field: RegisterField;
        registerId: string;
        onNavigate: (event: MouseEvent, target: DocumentTarget) => void;
    }

    let { field, registerId, onNavigate }: Props = $props();
    let open = $state(true);

    function accessLabel(value: string): string {
        return value ? value.toUpperCase() : "-";
    }
</script>

<Collapsible.Root bind:open>
    <Card id={fieldDomId(field.id)} class="scroll-mt-20 gap-0 overflow-hidden py-0">
        <CardHeader class="border-b border-border/60 bg-muted/25 p-3">
            <div
                class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 overflow-hidden"
            >
                <div class="flex min-w-0 items-baseline gap-1.5 overflow-hidden">
                    <h3
                        class="min-w-12 max-w-[50%] shrink truncate text-lg font-semibold tracking-tight"
                    >
                        <a
                            href={documentHref({
                                kind: "register",
                                registerId,
                                fieldId: field.id,
                            })}
                            class="block truncate rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title={field.name}
                            onclick={(event) =>
                                onNavigate(event, {
                                    kind: "register",
                                    registerId,
                                    fieldId: field.id,
                                })}
                        >
                            {field.name}
                        </a>
                    </h3>
                    <code class="shrink-0 text-xs text-primary" title={bitRange(field)}>
                        {bitRange(field)}
                    </code>
                    <code
                        class="min-w-6 flex-1 truncate text-xs text-muted-foreground"
                        title={field.identifier}
                    >
                        {field.identifier}
                    </code>
                </div>
                <div class="flex shrink-0 items-center gap-1.5">
                    <Badge
                        variant="outline"
                        class="h-7 rounded-[min(var(--radius-md),12px)] px-2.5"
                    >
                        SW {accessLabel(field.softwareAccess)}
                    </Badge>
                    <Badge
                        variant="outline"
                        class="h-7 rounded-[min(var(--radius-md),12px)] px-2.5"
                    >
                        HW {accessLabel(field.hardwareAccess)}
                    </Badge>
                    {#if field.reset}
                        <Badge
                            variant="outline"
                            class="h-7 min-w-0 max-w-16 rounded-[min(var(--radius-md),12px)] px-2.5 sm:max-w-32 lg:max-w-48"
                            title={`Reset ${field.reset.enumMember || field.reset.hex}`}
                        >
                            <span class="truncate"
                                >Reset {field.reset.enumMember || field.reset.hex}</span
                            >
                        </Badge>
                    {/if}
                    <Collapsible.Trigger>
                        {#snippet child({ props })}
                            <Button
                                {...props}
                                variant="ghost"
                                size="icon-sm"
                                aria-label={open
                                    ? `Collapse ${field.name}`
                                    : `Expand ${field.name}`}
                            >
                                {#if open}<ChevronUpIcon />{:else}<ChevronDownIcon />{/if}
                            </Button>
                        {/snippet}
                    </Collapsible.Trigger>
                </div>
            </div>
        </CardHeader>
        <Collapsible.Content>
            <CardContent class="p-3">
                {#if field.description}
                    <div class="markdown text-sm">
                        {@html renderMarkdown(field.description)}
                    </div>
                {:else}
                    <p class="text-sm italic text-muted-foreground">No field description.</p>
                {/if}

                {#if field.enum}
                    <div
                        id={enumDomId(field.id, field.enum.name)}
                        class="mt-3 scroll-mt-20 overflow-hidden rounded-lg"
                    >
                        <div class="border-b border-border/60 bg-muted/40 px-3 py-2">
                            <span class="text-sm font-medium">Enum </span>
                            <a
                                href={documentHref({
                                    kind: "register",
                                    registerId,
                                    fieldId: field.id,
                                    enumName: field.enum.name,
                                })}
                                class="rounded-sm font-mono text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onclick={(event) =>
                                    onNavigate(event, {
                                        kind: "register",
                                        registerId,
                                        fieldId: field.id,
                                        enumName: field.enum?.name,
                                    })}
                            >
                                {field.enum.name}
                            </a>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow class="border-border/60">
                                    <TableHead class="w-28">Value</TableHead>
                                    <TableHead class="w-48">Member</TableHead>
                                    <TableHead>Description</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {#each field.enum.members as member (member.name)}
                                    <TableRow
                                        id={enumMemberDomId(field.id, field.enum.name, member.name)}
                                        class="scroll-mt-20 border-border/60"
                                    >
                                        <TableCell class="font-mono">{member.hex}</TableCell>
                                        <TableCell>
                                            <a
                                                href={documentHref({
                                                    kind: "register",
                                                    registerId,
                                                    fieldId: field.id,
                                                    enumName: field.enum.name,
                                                    memberName: member.name,
                                                })}
                                                class="block rounded-sm text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                onclick={(event) =>
                                                    onNavigate(event, {
                                                        kind: "register",
                                                        registerId,
                                                        fieldId: field.id,
                                                        enumName: field.enum?.name,
                                                        memberName: member.name,
                                                    })}
                                            >
                                                {member.displayName}
                                            </a>
                                            {#if member.displayName !== member.name}
                                                <code class="text-xs text-muted-foreground"
                                                    >{member.name}</code
                                                >
                                            {/if}
                                        </TableCell>
                                        <TableCell>
                                            {#if member.description}
                                                <div class="markdown text-sm">
                                                    {@html renderMarkdown(member.description)}
                                                </div>
                                            {:else}
                                                <span class="text-muted-foreground">–</span>
                                            {/if}
                                        </TableCell>
                                    </TableRow>
                                {/each}
                            </TableBody>
                        </Table>
                    </div>
                {/if}
            </CardContent>
        </Collapsible.Content>
    </Card>
</Collapsible.Root>
