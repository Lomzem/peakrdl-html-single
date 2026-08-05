<script lang="ts">
  import "../app.css";

  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import CpuIcon from "@lucide/svelte/icons/cpu";
  import FileStackIcon from "@lucide/svelte/icons/files";
  import FolderTreeIcon from "@lucide/svelte/icons/folder-tree";
  import HashIcon from "@lucide/svelte/icons/hash";
  import MenuIcon from "@lucide/svelte/icons/menu";
  import SearchIcon from "@lucide/svelte/icons/search";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import { Effect } from "effect";
  import { onMount, tick } from "svelte";

  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardHeader } from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import * as Select from "$lib/components/ui/select";
  import { Separator } from "$lib/components/ui/separator";
  import * as Sheet from "$lib/components/ui/sheet";
  import { Switch } from "$lib/components/ui/switch";
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
  } from "$lib/components/ui/table";
  import type { NavigationNode, Register, RegisterField } from "$lib/domain";
  import { readEmbeddedDocument } from "$lib/domain";
  import { renderMarkdown } from "$lib/markdown";
  import { makeSearchService, type SearchRecord } from "$lib/search";

  type Theme = "light" | "dark" | "system";
  type ValueMode = "hex" | "decimal" | "enum";
  type BitLayoutItem =
    | { kind: "field"; field: RegisterField }
    | { kind: "gap"; low: number; high: number };
  type FolderListItem =
    | { kind: "node"; node: NavigationNode }
    | { kind: "gap"; id: string; low: bigint; high: bigint };

  const registerDocument = readEmbeddedDocument();
  const searchService = Effect.runSync(makeSearchService(registerDocument));
  const registersById = new Map(registerDocument.registers.map((register) => [register.id, register]));
  const resetValuesById = new Map(
    registerDocument.registers.map((register) => [register.id, resetRegisterValue(register)])
  );
  const navigationById = new Map<string, NavigationNode>();
  const ancestorIds = new Map<string, string[]>();

  function recordAncestors(node: NavigationNode, ancestors: string[]): void {
    navigationById.set(node.id, node);
    if (node.targetId) ancestorIds.set(node.targetId, ancestors);
    for (const child of node.children) recordAncestors(child, [...ancestors, node.id]);
  }
  recordAncestors(registerDocument.navigation, []);

  let selectedId = $state(registerDocument.registers[0]?.id || "");
  let selectedFolderId = $state("");
  let expanded = $state<Set<string>>(new Set([registerDocument.navigation.id]));
  let query = $state("");
  let mobileNavigationOpen = $state(false);
  let theme = $state<Theme>("system");
  let activeSearchIndex = $state(-1);
  let sidebarWidth = $state(304);
  let copiedAddress = $state("");
  let showReservedGaps = $state(true);
  let valueMode = $state<ValueMode>("hex");
  let registerValues = $state(new Map(resetValuesById));
  let encodedDraft = $state(
    registerDocument.registers[0]
      ? formatRegisterValue(registerDocument.registers[0], resetValuesById.get(registerDocument.registers[0].id) || 0n, "hex")
      : ""
  );
  let encodedError = $state("");
  let fieldDrafts = $state<Record<string, string>>({});
  let fieldErrors = $state<Record<string, string>>({});
  let copiedEncodedValue = $state(false);
  let selectedRegister = $derived(registersById.get(selectedId));
  let selectedFolder = $derived(navigationById.get(selectedFolderId));
  let selectedBreadcrumbs = $derived(
    (ancestorIds.get(selectedId) || [])
      .map((id) => navigationById.get(id))
      .filter((node): node is NavigationNode => node?.kind === "doc-group")
  );
  let searchResults = $derived(query.trim() ? searchService.search(query.trim()) : []);

  function accessLabel(value: string): string {
    return value ? value.toUpperCase() : "–";
  }

  function bitRange(field: RegisterField): string {
    return field.high === field.low ? `${field.low}` : `${field.high}:${field.low}`;
  }

  function fieldsMsbFirst(fields: ReadonlyArray<RegisterField>): RegisterField[] {
    return [...fields].sort((left, right) => right.high - left.high || right.low - left.low);
  }

  function valueMask(width: number): bigint {
    return width > 0 ? (1n << BigInt(width)) - 1n : 0n;
  }

  function resetRegisterValue(register: Register): bigint {
    let value = 0n;
    for (const field of register.fields) {
      if (!field.reset) continue;
      value |= (BigInt(field.reset.value) & valueMask(field.width)) << BigInt(field.low);
    }
    return value & valueMask(register.width);
  }

  function registerValue(register: Register): bigint {
    return registerValues.get(register.id) ?? resetValuesById.get(register.id) ?? 0n;
  }

  function fieldValue(register: Register, field: RegisterField): bigint {
    return (registerValue(register) >> BigInt(field.low)) & valueMask(field.width);
  }

  function numericMode(mode: ValueMode): "hex" | "decimal" {
    return mode === "decimal" ? "decimal" : "hex";
  }

  function formatNumericValue(value: bigint, width: number, mode: "hex" | "decimal"): string {
    if (mode === "decimal") return value.toString(10);
    return `0x${value.toString(16).padStart(Math.max(1, Math.ceil(width / 4)), "0")}`;
  }

  function formatRegisterValue(register: Register, value: bigint, mode: ValueMode): string {
    return formatNumericValue(value, register.width, numericMode(mode));
  }

  function parseNumericValue(input: string, mode: "hex" | "decimal", width: number): bigint {
    const value = input.trim().replaceAll("_", "");
    const valid = mode === "decimal" ? /^\d+$/.test(value) : /^(?:0x)?[\da-f]+$/i.test(value);
    if (!valid) throw new Error(mode === "decimal" ? "Enter a decimal value." : "Enter a hexadecimal value.");
    const parsed = BigInt(mode === "hex" && !value.toLowerCase().startsWith("0x") ? `0x${value}` : value);
    if (parsed > valueMask(width)) throw new Error(`Value exceeds ${width} bits.`);
    return parsed;
  }

  function matchingEnumMember(field: RegisterField, value: bigint) {
    return field.enum?.members.find((member) => BigInt(member.value) === value);
  }

  function fieldEditorValue(register: Register, field: RegisterField): string {
    return fieldDrafts[field.id] ??
      formatNumericValue(fieldValue(register, field), field.width, numericMode(valueMode));
  }

  function fieldResetLabel(field: RegisterField): string {
    if (!field.reset) return "No reset";
    const value = BigInt(field.reset.value);
    if (valueMode === "enum") {
      const member = matchingEnumMember(field, value);
      if (member) return `Reset: ${member.displayName}`;
    }
    return `Reset: ${formatNumericValue(value, field.width, numericMode(valueMode))}`;
  }

  function setRegisterValue(register: Register, value: bigint): void {
    const next = new Map(registerValues);
    next.set(register.id, value & valueMask(register.width));
    registerValues = next;
  }

  function syncValueEditor(register: Register): void {
    encodedDraft = formatRegisterValue(register, registerValue(register), valueMode);
    encodedError = "";
    fieldDrafts = {};
    fieldErrors = {};
  }

  function setValueMode(mode: ValueMode): void {
    valueMode = mode;
    writePreference("peakrdl-value-mode", mode);
    if (selectedRegister) syncValueEditor(selectedRegister);
  }

  function updateEncodedValue(register: Register, input: string): void {
    encodedDraft = input;
    try {
      const value = parseNumericValue(input, numericMode(valueMode), register.width);
      setRegisterValue(register, value);
      encodedError = "";
      fieldDrafts = {};
      fieldErrors = {};
    } catch (error) {
      encodedError = error instanceof Error ? error.message : "Invalid value.";
    }
  }

  function updateFieldValue(register: Register, field: RegisterField, value: bigint): void {
    const shiftedMask = valueMask(field.width) << BigInt(field.low);
    const encoded = (registerValue(register) & ~shiftedMask) |
      ((value & valueMask(field.width)) << BigInt(field.low));
    setRegisterValue(register, encoded);
    encodedDraft = formatRegisterValue(register, encoded, valueMode);
  }

  function updateFieldDraft(register: Register, field: RegisterField, input: string): void {
    fieldDrafts = { ...fieldDrafts, [field.id]: input };
    try {
      const value = parseNumericValue(input, numericMode(valueMode), field.width);
      updateFieldValue(register, field, value);
      const { [field.id]: _, ...remaining } = fieldErrors;
      fieldErrors = remaining;
    } catch (error) {
      fieldErrors = {
        ...fieldErrors,
        [field.id]: error instanceof Error ? error.message : "Invalid value."
      };
    }
  }

  function resetValueEditor(register: Register): void {
    setRegisterValue(register, resetValuesById.get(register.id) || 0n);
    syncValueEditor(register);
  }

  async function copyEncodedValue(register: Register): Promise<void> {
    const value = formatRegisterValue(register, registerValue(register), valueMode);
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    copiedEncodedValue = true;
    window.setTimeout(() => (copiedEncodedValue = false), 700);
  }

  function bitLayoutItems(register: Register): BitLayoutItem[] {
    const fields = fieldsMsbFirst(register.fields);
    if (!showReservedGaps) return fields.map((field) => ({ kind: "field", field }));

    const items: BitLayoutItem[] = [];
    let nextHigh = register.width - 1;
    for (const field of fields) {
      if (field.high < nextHigh) items.push({ kind: "gap", low: field.high + 1, high: nextHigh });
      items.push({ kind: "field", field });
      nextHigh = Math.min(nextHigh, field.low - 1);
    }
    if (nextHigh >= 0) items.push({ kind: "gap", low: 0, high: nextHigh });
    return items;
  }

  function bitGapLabel(low: number, high: number): string {
    return low === high ? `${low}` : `${low}-${high}`;
  }

  function hex(value: bigint): string {
    return `0x${value.toString(16)}`;
  }

  function addressGapLabel(low: bigint, high: bigint): string {
    return low === high ? hex(low) : `${hex(low)}-${hex(high)}`;
  }

  function folderListItems(folder: NavigationNode): FolderListItem[] {
    if (!showReservedGaps) return folder.children.map((node) => ({ kind: "node", node }));

    const items: FolderListItem[] = [];
    let previousEnd: bigint | null = null;
    for (const node of folder.children) {
      const register = node.targetId ? registersById.get(node.targetId) : undefined;
      if (node.kind !== "register" || !register?.absoluteAddress) {
        items.push({ kind: "node", node });
        previousEnd = null;
        continue;
      }

      const address = BigInt(register.absoluteAddress);
      if (previousEnd !== null && address > previousEnd + 1n) {
        const low = previousEnd + 1n;
        items.push({ kind: "gap", id: `gap:${low}:${address - 1n}`, low, high: address - 1n });
      }
      items.push({ kind: "node", node });
      const byteWidth = BigInt(Math.max(1, Math.ceil(register.width / 8)));
      previousEnd = address + byteWidth - 1n;
    }
    return items;
  }

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

  function toggleNode(id: string): void {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expanded = next;
    writePreference("peakrdl-expanded", JSON.stringify([...next]));
  }

  function expandToRegister(id: string): void {
    expanded = new Set([...expanded, ...(ancestorIds.get(id) || [])]);
  }

  function hashFor(id: string, fieldId = ""): string {
    const parameters = new URLSearchParams({ register: id });
    if (fieldId) parameters.set("field", fieldId);
    return parameters.toString();
  }

  async function selectRegister(id: string, fieldId = "", writeHash = true): Promise<void> {
    const register = registersById.get(id);
    if (!register) return;
    selectedId = id;
    selectedFolderId = "";
    syncValueEditor(register);
    expandToRegister(id);
    mobileNavigationOpen = false;
    query = "";
    if (writeHash) location.hash = hashFor(id, fieldId);
    await tick();
    if (fieldId) {
      document.getElementById(`field-${encodeURIComponent(fieldId)}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } else {
      document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function selectFolder(node: NavigationNode, writeHash = true): Promise<void> {
    selectedId = "";
    selectedFolderId = node.id;
    expanded = new Set([...expanded, node.id]);
    mobileNavigationOpen = false;
    query = "";
    if (writeHash) location.hash = new URLSearchParams({ folder: node.id }).toString();
    await tick();
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectSearchResult(result: SearchRecord): void {
    void selectRegister(result.targetId, result.fieldId);
  }

  function applyHash(): void {
    const parameters = new URLSearchParams(location.hash.slice(1));
    const folderId = parameters.get("folder");
    const id = parameters.get("register");
    const folder = folderId ? navigationById.get(folderId) : undefined;
    if (folder) void selectFolder(folder, false);
    else if (id) void selectRegister(id, parameters.get("field") || "", false);
    else if (registerDocument.registers[0]) {
      void selectRegister(registerDocument.registers[0].id, "", false);
    }
  }

  function readPreference(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writePreference(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable for local files or in privacy modes.
    }
  }

  function removePreference(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to remove when storage is unavailable.
    }
  }

  function applyTheme(value: Theme): void {
    theme = value;
    const dark =
      value === "dark" ||
      (value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    writePreference("peakrdl-theme", value);
  }

  function themeLabel(value: Theme): string {
    return value[0].toUpperCase() + value.slice(1);
  }

  function setReservedGaps(checked: boolean): void {
    showReservedGaps = checked;
    writePreference("peakrdl-show-reserved-gaps", String(checked));
  }

  function resizeSidebar(width: number): void {
    sidebarWidth = Math.min(520, Math.max(240, width));
  }

  function startSidebarResize(event: PointerEvent): void {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const move = (moveEvent: PointerEvent) => resizeSidebar(startWidth + moveEvent.clientX - startX);
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function handleSidebarResizeKey(event: KeyboardEvent): void {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      resizeSidebar(sidebarWidth + (event.key === "ArrowLeft" ? -16 : 16));
    }
  }

  function handleSearchKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      query = "";
      activeSearchIndex = -1;
      return;
    }
    if (!searchResults.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeSearchIndex = Math.min(activeSearchIndex + 1, searchResults.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeSearchIndex = Math.max(activeSearchIndex - 1, 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectSearchResult(searchResults[Math.max(activeSearchIndex, 0)]);
    }
  }

  onMount(() => {
    const savedTheme = readPreference("peakrdl-theme");
    if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
      theme = savedTheme;
    }
    applyTheme(theme);

    const savedExpanded = readPreference("peakrdl-expanded");
    if (savedExpanded) {
      try {
        expanded = new Set([registerDocument.navigation.id, ...JSON.parse(savedExpanded)]);
      } catch {
        removePreference("peakrdl-expanded");
      }
    }

    showReservedGaps = readPreference("peakrdl-show-reserved-gaps") !== "false";
    const savedValueMode = readPreference("peakrdl-value-mode");
    if (savedValueMode === "hex" || savedValueMode === "decimal" || savedValueMode === "enum") {
      valueMode = savedValueMode;
    }

    applyHash();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemTheme = () => theme === "system" && applyTheme("system");
    window.addEventListener("hashchange", applyHash);
    media.addEventListener("change", handleSystemTheme);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      media.removeEventListener("change", handleSystemTheme);
    };
  });
</script>

<svelte:head>
  <title>{registerDocument.title}</title>
  <meta name="description" content="Interactive register documentation" />
</svelte:head>

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

{#snippet navigationNode(node: NavigationNode, depth: number)}
  {#if node.kind === "register" && node.targetId}
    <Button
      variant={selectedId === node.targetId ? "secondary" : "ghost"}
      size="sm"
      class="h-auto min-h-7 w-full justify-start gap-2 whitespace-normal py-1 pr-2 text-left font-normal"
      style={`padding-left: ${0.5 + depth * 0.85}rem`}
      aria-current={selectedId === node.targetId ? "page" : undefined}
      onclick={() => selectRegister(node.targetId || "")}
    >
      <span class="min-w-0 flex-1 truncate">{node.label}</span>
      {#if node.address}<span class="font-mono text-[0.68rem] text-muted-foreground">{node.address}</span>{/if}
    </Button>
  {:else}
    <div class="flex min-h-7 w-full items-center pr-2" style={`padding-left: ${0.25 + depth * 0.85}rem`}>
      <Button
        variant="ghost"
        size="icon-xs"
        class="shrink-0"
        aria-label={`${expanded.has(node.id) ? "Collapse" : "Expand"} ${node.label}`}
        aria-expanded={expanded.has(node.id)}
        onclick={() => toggleNode(node.id)}
      >
        <ChevronRightIcon class={`size-3.5 transition-transform ${expanded.has(node.id) ? "rotate-90" : ""}`} />
      </Button>
      <Button
        variant={selectedFolderId === node.id ? "secondary" : "ghost"}
        size="sm"
        class="h-auto min-h-7 min-w-0 flex-1 justify-start gap-1.5 px-1.5 py-1 text-left font-medium"
        aria-current={selectedFolderId === node.id ? "page" : undefined}
        onclick={() => selectFolder(node)}
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

{#snippet navigationPanel()}
  <div class="flex h-full min-h-0 flex-col">
    <div class="px-4 pb-3 pt-5">
      <h1 class="mt-1 line-clamp-2 text-lg font-semibold leading-tight tracking-tight">{registerDocument.title}</h1>
    </div>
    <Separator />
    <ScrollArea class="min-h-0 flex-1 py-2">
      <nav class="px-2" aria-label="Register hierarchy">
        {@render navigationNode(registerDocument.navigation, 0)}
      </nav>
    </ScrollArea>
  </div>
{/snippet}

<div
  class="min-h-screen bg-background md:grid md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]"
  style={`--sidebar-width: ${sidebarWidth}px`}
>
  <aside class="print-hidden sticky top-0 hidden h-screen border-r bg-card/70 backdrop-blur md:block">
    {@render navigationPanel()}
    <button
      type="button"
      aria-label="Resize sidebar"
      class="absolute inset-y-0 -right-1 z-40 w-2 cursor-col-resize touch-none bg-transparent outline-none transition-colors hover:bg-primary/20 focus-visible:bg-primary/30"
      onpointerdown={startSidebarResize}
      onkeydown={handleSidebarResizeKey}
    ></button>
  </aside>

  <div class="min-w-0">
    <header class="print-hidden sticky top-0 z-30 border-b bg-background/92 px-3 py-2 backdrop-blur md:px-6">
      <div class="mx-auto flex max-w-6xl items-center gap-2">
        <Sheet.Root bind:open={mobileNavigationOpen}>
          <Sheet.Trigger>
            {#snippet child({ props })}
              <Button {...props} variant="outline" size="icon" class="md:hidden" aria-label="Open navigation">
                <MenuIcon />
              </Button>
            {/snippet}
          </Sheet.Trigger>
          <Sheet.Content side="left" class="w-[88vw] p-0 sm:max-w-sm">
            <Sheet.Title class="sr-only">Register navigation</Sheet.Title>
            <Sheet.Description class="sr-only">Browse the register hierarchy</Sheet.Description>
            {@render navigationPanel()}
          </Sheet.Content>
        </Sheet.Root>

        <div class="relative min-w-0 flex-1">
          <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            bind:value={query}
            class="h-9 bg-card pl-9 font-mono text-sm"
            placeholder="Search address, register, field, or enum…"
            aria-label="Search registers"
            role="combobox"
            aria-expanded={Boolean(query.trim())}
            aria-controls={query.trim() ? "search-results" : undefined}
            aria-activedescendant={activeSearchIndex >= 0 ? `search-result-${activeSearchIndex}` : undefined}
            autocomplete="off"
            oninput={() => (activeSearchIndex = -1)}
            onkeydown={handleSearchKeydown}
          />
          {#if query.trim()}
            <div
              id="search-results"
              role="listbox"
              class="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-50 max-h-[65vh] overflow-auto rounded-lg border bg-card p-1.5 text-card-foreground shadow-xl"
            >
              {#if searchResults.length}
                {#each searchResults as result, index (result.id)}
                  <button
                    id={`search-result-${index}`}
                    role="option"
                    aria-selected={activeSearchIndex === index}
                    class="grid w-full grid-cols-[8rem_minmax(0,1fr)] items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none aria-selected:bg-muted"
                    onmouseenter={() => (activeSearchIndex = index)}
                    onclick={() => selectSearchResult(result)}
                  >
                    <Badge variant="outline" class="mt-0.5 justify-self-start capitalize">{result.kind.replace("-", " ")}</Badge>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium leading-5">{result.label}</span>
                      <span class="mt-0.5 block truncate font-mono text-xs leading-4 text-muted-foreground">{result.context}</span>
                    </span>
                  </button>
                {/each}
              {:else}
                <p class="px-3 py-7 text-center text-sm text-muted-foreground">No matching registers or fields</p>
              {/if}
            </div>
          {/if}
          <p class="sr-only" aria-live="polite">
            {query.trim() ? `${searchResults.length} search results` : ""}
          </p>
        </div>

        <Dialog.Root>
          <Dialog.Trigger>
            {#snippet child({ props })}
              <Button {...props} variant="outline" size="icon" aria-label="Open settings">
                <SettingsIcon />
              </Button>
            {/snippet}
          </Dialog.Trigger>
          <Dialog.Content class="border bg-card text-card-foreground shadow-xl ring-0 sm:max-w-md">
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
                  <p class="text-xs text-muted-foreground">Include reserved fields and register ranges.</p>
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
      </div>
    </header>

    <main class="h-[calc(100vh-57px)] overflow-y-auto px-4 py-5 md:px-8 md:py-6">
      <div class="mx-auto max-w-6xl">
        {#if selectedRegister}
          <section aria-labelledby="register-title">
            {#if selectedBreadcrumbs.length}
              <div class="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <FolderTreeIcon class="mr-1 size-3.5" />
                {#each selectedBreadcrumbs as group, index (group.id)}
                  {#if index}<ChevronRightIcon class="size-3" />{/if}
                  <button
                    type="button"
                    class="rounded-sm px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onclick={() => selectFolder(group)}
                  >
                    {group.label}
                  </button>
                {/each}
              </div>
            {/if}

            <div>
              <div class="min-w-0">
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  {#if selectedRegister.absoluteAddressHex}
                    <button
                      type="button"
                      class="group rounded-full outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Copy address ${selectedRegister.absoluteAddressHex}`}
                      title={copiedAddress === selectedRegister.absoluteAddressHex ? "Copied" : "Copy address"}
                      onclick={() => copyAddress(selectedRegister.absoluteAddressHex || "")}
                    >
                      <Badge class="cursor-copy font-mono text-sm">
                        {#if copiedAddress === selectedRegister.absoluteAddressHex}
                          <span class="select-none">Copied</span>
                        {:else}
                          <span class="select-none" aria-hidden="true">@</span><span>{selectedRegister.absoluteAddressHex}</span>
                        {/if}
                      </Badge>
                    </button>
                  {/if}
                </div>
                <h2 id="register-title" class="text-3xl font-semibold tracking-tight md:text-4xl">
                  {selectedRegister.name}
                </h2>
                <p class="mt-2 break-all font-mono text-xs text-muted-foreground">{selectedRegister.identifier}</p>
              </div>
            </div>

            {#if selectedRegister.description}
              <div class="markdown mt-4 max-w-4xl text-sm md:text-base">
                {@html renderMarkdown(selectedRegister.description)}
              </div>
            {/if}

            <Separator class="my-5" />
            {@render registerLayout(selectedRegister)}

            <div class="mt-5">
              {@render valueEditor(selectedRegister)}
            </div>

            <div class="mt-5 space-y-4">
              {#each bitLayoutItems(selectedRegister) as item (item.kind === "field" ? item.field.id : `gap:${item.low}:${item.high}`)}
                {#if item.kind === "field"}
                  {@render fieldCard(item.field)}
                {:else}
                  {@render reservedField(item.low, item.high)}
                {/if}
              {/each}
            </div>
          </section>
        {:else if selectedFolder}
          {@render folderView(selectedFolder)}
        {:else}
          <div class="grid min-h-[55vh] place-items-center text-center">
            <div>
              <CpuIcon class="mx-auto size-10 text-muted-foreground" />
              <h2 class="mt-4 text-xl font-semibold">No registers in this document</h2>
              <p class="mt-2 text-sm text-muted-foreground">The exported model does not contain register instances.</p>
            </div>
          </div>
        {/if}
      </div>
    </main>
  </div>
</div>

{#snippet folderView(folder: NavigationNode)}
  <section aria-labelledby="folder-title">
    {#if folder.address}<Badge variant="outline" class="font-mono">{folder.address}</Badge>{/if}
    <h2 id="folder-title" class="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{folder.label}</h2>
    <p class="mt-2 break-all font-mono text-xs text-muted-foreground">{folder.identifier}</p>

    <Separator class="my-8" />

    {#if folderListItems(folder).length}
      <div class="grid gap-3">
        {#each folderListItems(folder) as item (item.kind === "node" ? item.node.id : item.id)}
          {#if item.kind === "node"}
            <button
              class="group flex min-w-0 items-center gap-3 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onclick={() => item.node.kind === "register" && item.node.targetId ? selectRegister(item.node.targetId) : selectFolder(item.node)}
            >
              <span class="grid size-9 shrink-0 place-items-center rounded-md bg-muted group-hover:bg-background/60">
                {@render kindIcon(item.node)}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium">{item.node.label}</span>
                <span class="mt-1 block truncate font-mono text-xs text-muted-foreground">
                  {item.node.kind === "register" ? item.node.address || item.node.identifier : `${item.node.children.length} items`}
                </span>
              </span>
              <ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" />
            </button>
          {:else}
            <div class="flex items-center justify-between rounded-lg border border-dashed bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
              <span>Reserved</span>
              <code>@{addressGapLabel(item.low, item.high)}</code>
            </div>
          {/if}
        {/each}
      </div>
    {:else}
      <div class="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
        This folder is empty.
      </div>
    {/if}
  </section>
{/snippet}

{#snippet registerLayout(register: Register)}
  <section aria-labelledby="bit-layout-title">
    <div class="mb-3">
      <div>
        <p id="bit-layout-title" class="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary">Bit layout</p>
      </div>
    </div>
    <div class="overflow-x-auto rounded-lg border bg-card p-3">
      <div
        class="grid min-w-[42rem] gap-px overflow-hidden rounded-md bg-border"
        style={`grid-template-columns: repeat(${Math.max(register.width, 1)}, minmax(0, 1fr))`}
      >
        {#each bitLayoutItems(register) as item, index (item.kind === "field" ? item.field.id : `gap:${item.low}:${item.high}`)}
          {#if item.kind === "field"}
            <button
              class={`row-start-1 min-h-16 overflow-hidden border-y px-1 text-center text-[0.65rem] leading-tight transition-colors hover:bg-muted ${index % 2 ? "border-border bg-muted/70" : "border-border bg-secondary"}`}
              style={`grid-column: ${register.width - item.field.high} / ${register.width - item.field.low + 1}`}
              title={`${item.field.name} [${bitRange(item.field)}]`}
              onclick={() => document.getElementById(`field-${encodeURIComponent(item.field.id)}`)?.scrollIntoView({ behavior: "smooth" })}
            >
              <span class="block truncate font-medium">{item.field.name}</span>
              <span class="mt-1 block font-mono text-muted-foreground">[{bitRange(item.field)}]</span>
            </button>
          {:else}
            <div
              class="row-start-1 grid min-h-16 place-content-center overflow-hidden border-y border-dashed border-border bg-muted/25 px-1 text-center text-[0.65rem] leading-tight text-muted-foreground"
              style={`grid-column: ${register.width - item.high} / ${register.width - item.low + 1}`}
            >
              <span class="font-medium">Reserved</span>
              <span class="mt-1 font-mono">[{bitGapLabel(item.low, item.high)}]</span>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </section>
{/snippet}

{#snippet valueEditor(register: Register)}
  <Card class="gap-0 overflow-hidden py-0">
    <CardHeader class="border-b bg-muted/25 p-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="font-semibold">Value editor</h3>
          <p class="text-xs text-muted-foreground">Decode or compose a register value.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex rounded-lg border bg-background p-0.5" aria-label="Value display mode">
            {#each ["hex", "decimal", "enum"] as mode (mode)}
              <Button
                variant={valueMode === mode ? "secondary" : "ghost"}
                size="sm"
                class="capitalize"
                aria-pressed={valueMode === mode}
                onclick={() => setValueMode(mode as ValueMode)}
              >
                {mode}
              </Button>
            {/each}
          </div>
          <Button variant="outline" size="sm" onclick={() => resetValueEditor(register)}>Reset</Button>
        </div>
      </div>
    </CardHeader>

    <CardContent class="p-4">
      <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label class="grid gap-1.5">
          <span class="text-sm font-medium">Encoded register value</span>
          <Input
            value={encodedDraft}
            class="font-mono"
            aria-invalid={Boolean(encodedError)}
            oninput={(event) => updateEncodedValue(register, (event.currentTarget as HTMLInputElement).value)}
          />
        </label>
        <Button variant="outline" onclick={() => copyEncodedValue(register)}>
          {copiedEncodedValue ? "Copied" : "Copy"}
        </Button>
      </div>
      {#if encodedError}
        <p class="mt-1.5 text-xs text-destructive">{encodedError}</p>
      {/if}

      <div class="mt-4 overflow-hidden rounded-lg border">
        {#each bitLayoutItems(register) as item (item.kind === "field" ? item.field.id : `editor-gap:${item.low}:${item.high}`)}
          {#if item.kind === "gap"}
            <div class="flex items-center justify-between border-b border-dashed bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground last:border-b-0">
              <span>Reserved</span>
              <code>[{bitGapLabel(item.low, item.high)}]</code>
            </div>
          {:else}
            <div class="grid gap-3 border-b px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(10rem,1fr)_5rem_minmax(10rem,16rem)] sm:items-center">
              <div class="min-w-0">
                <button
                  type="button"
                  class="block max-w-full truncate text-left text-sm font-medium hover:underline"
                  onclick={() => document.getElementById(`field-${encodeURIComponent(item.field.id)}`)?.scrollIntoView({ behavior: "smooth" })}
                >
                  {item.field.name}
                </button>
                <p class="mt-0.5 truncate font-mono text-xs text-muted-foreground">{item.field.identifier}</p>
              </div>
              <code class="text-xs text-muted-foreground">[{bitRange(item.field)}]</code>
              <div>
                {#if valueMode === "enum" && item.field.enum}
                  {@const value = fieldValue(register, item.field)}
                  {@const member = matchingEnumMember(item.field, value)}
                  <Select.Root
                    type="single"
                    value={value.toString()}
                    onValueChange={(selected) => updateFieldValue(register, item.field, BigInt(selected))}
                  >
                    <Select.Trigger class="w-full bg-background">
                      {member?.displayName || `Unknown (${formatNumericValue(value, item.field.width, "hex")})`}
                    </Select.Trigger>
                    <Select.Content class="bg-card text-card-foreground">
                      {#each item.field.enum.members as option (option.name)}
                        <Select.Item value={option.value}>{option.displayName}</Select.Item>
                      {/each}
                    </Select.Content>
                  </Select.Root>
                {:else}
                  <Input
                    value={fieldEditorValue(register, item.field)}
                    class="font-mono"
                    aria-invalid={Boolean(fieldErrors[item.field.id])}
                    oninput={(event) => updateFieldDraft(register, item.field, (event.currentTarget as HTMLInputElement).value)}
                  />
                {/if}
                <p class="mt-1 text-xs text-muted-foreground">{fieldResetLabel(item.field)}</p>
                {#if fieldErrors[item.field.id]}
                  <p class="mt-1 text-xs text-destructive">{fieldErrors[item.field.id]}</p>
                {/if}
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </CardContent>
  </Card>
{/snippet}

{#snippet reservedField(low: number, high: number)}
  <div class="flex items-center justify-between rounded-lg border border-dashed bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
    <span class="font-medium">Reserved</span>
    <code>[{bitGapLabel(low, high)}]</code>
  </div>
{/snippet}

{#snippet fieldCard(field: RegisterField)}
  <Card id={`field-${encodeURIComponent(field.id)}`} class="scroll-mt-20 gap-0 overflow-hidden py-0">
    <CardHeader class="border-b bg-muted/25 p-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h3 class="text-xl font-semibold tracking-tight">{field.name}</h3>
          <p class="mt-1 font-mono text-xs text-primary">[{bitRange(field)}] · {field.identifier}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Badge variant="secondary">{field.width} bit{field.width === 1 ? "" : "s"}</Badge>
          <Badge variant="outline">SW {accessLabel(field.softwareAccess)}</Badge>
          <Badge variant="outline">HW {accessLabel(field.hardwareAccess)}</Badge>
          {#if field.reset}<Badge variant="outline">Reset {field.reset.enumMember || field.reset.hex}</Badge>{/if}
        </div>
      </div>
    </CardHeader>
    <CardContent class="p-4">
      {#if field.description}
        <div class="markdown text-sm">{@html renderMarkdown(field.description)}</div>
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
                      <code class="text-xs text-muted-foreground">{member.name}</code>
                    {/if}
                  </TableCell>
                  <TableCell>
                    {#if member.description}
                      <div class="markdown text-sm">{@html renderMarkdown(member.description)}</div>
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
{/snippet}
