<script lang="ts">
    import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
    import InfoIcon from "@lucide/svelte/icons/info";
    import KeyboardIcon from "@lucide/svelte/icons/keyboard";
    import SettingsIcon from "@lucide/svelte/icons/settings";
    import { onMount } from "svelte";

    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import * as Select from "$lib/components/ui/select";
    import { Separator } from "$lib/components/ui/separator";
    import { Switch } from "$lib/components/ui/switch";
    import { readPreference, writePreference } from "$lib/preferences";

    type Theme = "light" | "dark" | "system";

    interface Props {
        formatVersion: number;
        metadata: ReadonlyArray<Readonly<{ label: string; value: string }>>;
        showReservedGaps: boolean;
    }

    let { formatVersion, metadata, showReservedGaps = $bindable() }: Props = $props();
    let theme = $state<Theme>("system");
    let settingsOpen = $state(false);
    let aboutOpen = $state(false);
    let shortcutsOpen = $state(false);

    function applyTheme(value: Theme): void {
        theme = value;
        const dark =
            value === "dark" ||
            (value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
        document.documentElement.classList.toggle("dark", dark);
        writePreference("peakrdl-theme", value);
    }

    function setReservedGaps(checked: boolean): void {
        showReservedGaps = checked;
        writePreference("peakrdl-show-reserved-gaps", String(checked));
    }

    function themeLabel(value: Theme): string {
        return value[0].toUpperCase() + value.slice(1);
    }

    onMount(() => {
        const savedTheme = readPreference("peakrdl-theme");
        if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
            theme = savedTheme;
        }
        applyTheme(theme);

        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const handleSystemTheme = () => theme === "system" && applyTheme("system");
        media.addEventListener("change", handleSystemTheme);
        return () => media.removeEventListener("change", handleSystemTheme);
    });
</script>

<DropdownMenu.Root>
    <DropdownMenu.Trigger>
        {#snippet child({ props })}
            <Button
                {...props}
                variant="outline"
                size="icon"
                class="size-9 shrink-0"
                aria-label="Open menu"
            >
                <EllipsisVerticalIcon />
            </Button>
        {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="w-52 bg-card text-card-foreground">
        <DropdownMenu.Item onclick={() => (shortcutsOpen = true)}>
            <KeyboardIcon />
            Keyboard Shortcuts
        </DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => (settingsOpen = true)}>
            <SettingsIcon />
            Settings
        </DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => (aboutOpen = true)}>
            <InfoIcon />
            About
        </DropdownMenu.Item>
    </DropdownMenu.Content>
</DropdownMenu.Root>

<Dialog.Root bind:open={settingsOpen}>
    <Dialog.Content
        class="max-h-[85vh] overflow-y-auto border bg-card text-card-foreground shadow-xl ring-0 sm:max-w-md"
    >
        <Dialog.Header>
            <Dialog.Title>Settings</Dialog.Title>
            <Dialog.Description>Customize the register documentation view.</Dialog.Description>
        </Dialog.Header>
        <div class="space-y-4 py-2">
            <div class="flex items-center justify-between gap-6">
                <div>
                    <p class="text-sm font-medium">Theme</p>
                    <p class="text-xs text-muted-foreground">Choose the interface color mode.</p>
                </div>
                <Select.Root
                    type="single"
                    value={theme}
                    onValueChange={(value) => applyTheme(value as Theme)}
                >
                    <Select.Trigger class="w-32 bg-background">{themeLabel(theme)}</Select.Trigger>
                    <Select.Content class="bg-card text-card-foreground">
                        <Select.Item value="light">Light</Select.Item>
                        <Select.Item value="dark">Dark</Select.Item>
                        <Select.Item value="system">System</Select.Item>
                    </Select.Content>
                </Select.Root>
            </div>
            <Separator />
            <div class="flex items-center justify-between gap-6">
                <div>
                    <p class="text-sm font-medium">Show reserved gaps</p>
                    <p class="text-xs text-muted-foreground">
                        Include reserved fields and register ranges.
                    </p>
                </div>
                <Switch
                    bind:checked={showReservedGaps}
                    onCheckedChange={setReservedGaps}
                    class="border-border ring-1 ring-border data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
                    aria-label="Show reserved gaps"
                />
            </div>
        </div>
    </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={aboutOpen}>
    <Dialog.Content
        class="max-h-[85vh] overflow-y-auto border bg-card text-card-foreground shadow-xl ring-0 sm:max-w-md"
    >
        <Dialog.Header>
            <Dialog.Title>About</Dialog.Title>
            <Dialog.Description>Build information embedded in this document.</Dialog.Description>
        </Dialog.Header>
        <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 py-2 text-xs">
            <dt class="text-muted-foreground">Format</dt>
            <dd>{formatVersion}</dd>
            {#each metadata as item (`${item.label}:${item.value}`)}
                <dt class="text-muted-foreground">{item.label}</dt>
                <dd class="whitespace-pre-wrap break-all font-mono">{item.value}</dd>
            {/each}
        </dl>
        {#if !metadata.length}
            <p class="text-xs text-muted-foreground">No build metadata was embedded.</p>
        {/if}
    </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={shortcutsOpen}>
    <Dialog.Content class="border bg-card text-card-foreground shadow-xl ring-0 sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title>Keyboard Shortcuts</Dialog.Title>
            <Dialog.Description>
                Navigate the register documentation without a mouse.
            </Dialog.Description>
        </Dialog.Header>
        <dl class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-3 py-2 text-sm">
            <dt><kbd class="rounded border bg-muted px-2 py-1 font-mono text-xs">Ctrl K</kbd></dt>
            <dd>Focus search</dd>
            <dt><kbd class="rounded border bg-muted px-2 py-1 font-mono text-xs">/</kbd></dt>
            <dd>Focus search</dd>
            <dt><kbd class="rounded border bg-muted px-2 py-1 font-mono text-xs">Esc</kbd></dt>
            <dd>Leave search</dd>
            <dt><kbd class="rounded border bg-muted px-2 py-1 font-mono text-xs">↑ ↓</kbd></dt>
            <dd>Move through search results</dd>
            <dt><kbd class="rounded border bg-muted px-2 py-1 font-mono text-xs">Enter</kbd></dt>
            <dd>Open the selected result</dd>
        </dl>
    </Dialog.Content>
</Dialog.Root>
