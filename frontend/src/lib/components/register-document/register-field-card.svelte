<script lang="ts">
    import { Badge } from "$lib/components/ui/badge";
    import { Card, CardContent, CardHeader } from "$lib/components/ui/card";
    import {
        Table,
        TableBody,
        TableCell,
        TableHead,
        TableHeader,
        TableRow,
    } from "$lib/components/ui/table";
    import type { RegisterField } from "$lib/domain";
    import { renderMarkdown } from "$lib/markdown";

    import { bitRange } from "./register-bits";

    interface Props {
        field: RegisterField;
    }

    let { field }: Props = $props();

    function accessLabel(value: string): string {
        return value ? value.toUpperCase() : "-";
    }
</script>

<Card id={`field-${encodeURIComponent(field.id)}`} class="scroll-mt-20 gap-0 overflow-hidden py-0">
    <CardHeader class="border-b bg-muted/25 p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
                <h3 class="text-xl font-semibold tracking-tight">{field.name}</h3>
                <p class="mt-1 font-mono text-xs text-primary">
                    [{bitRange(field)}] · {field.identifier}
                </p>
            </div>
            <div class="flex flex-wrap gap-2">
                <Badge variant="secondary">{field.width} bit{field.width === 1 ? "" : "s"}</Badge>
                <Badge variant="outline">SW {accessLabel(field.softwareAccess)}</Badge>
                <Badge variant="outline">HW {accessLabel(field.hardwareAccess)}</Badge>
                {#if field.reset}
                    <Badge variant="outline"
                        >Reset {field.reset.enumMember || field.reset.hex}</Badge
                    >
                {/if}
            </div>
        </div>
    </CardHeader>
    <CardContent class="p-4">
        {#if field.description}
            <div class="markdown text-sm">
                {@html renderMarkdown(field.description)}
            </div>
        {:else}
            <p class="text-sm italic text-muted-foreground">No field description.</p>
        {/if}

        {#if field.enum}
            <div class="mt-4 overflow-hidden rounded-lg border">
                <div class="border-b bg-muted/40 px-4 py-2.5">
                    <span class="text-sm font-medium">Enum </span>
                    <code class="text-xs text-primary">{field.enum.name}</code>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead class="w-28">Value</TableHead>
                            <TableHead class="w-48">Member</TableHead>
                            <TableHead>Description</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {#each field.enum.members as member (member.name)}
                            <TableRow>
                                <TableCell class="font-mono">{member.hex}</TableCell>
                                <TableCell>
                                    <span class="block text-sm">{member.displayName}</span>
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
</Card>
