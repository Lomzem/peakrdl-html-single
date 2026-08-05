<script lang="ts">
  import "../app.css";

  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import CpuIcon from "@lucide/svelte/icons/cpu";
  import FileStackIcon from "@lucide/svelte/icons/files";
  import FolderTreeIcon from "@lucide/svelte/icons/folder-tree";
  import HashIcon from "@lucide/svelte/icons/hash";
  import MenuIcon from "@lucide/svelte/icons/menu";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import SearchIcon from "@lucide/svelte/icons/search";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { Effect } from "effect";
  import { onMount, tick } from "svelte";

  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardHeader } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Separator } from "$lib/components/ui/separator";
  import * as Sheet from "$lib/components/ui/sheet";
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

  const registerDocument = readEmbeddedDocument();
  const searchService = Effect.runSync(makeSearchService(registerDocument));
  const registersById = new Map(registerDocument.registers.map((register) => [register.id, register]));
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
  let selectedRegister = $derived(registersById.get(selectedId));
  let selectedFolder = $derived(navigationById.get(selectedFolderId));
  let searchResults = $derived(query.trim() ? searchService.search(query.trim()) : []);

  function accessLabel(value: string): string {
    return value ? value.toUpperCase() : "–";
  }

  function bitRange(field: RegisterField): string {
    return field.high === field.low ? `${field.low}` : `${field.high}:${field.low}`;
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
    if (!registersById.has(id)) return;
    selectedId = id;
    selectedFolderId = "";
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

  function cycleTheme(): void {
    applyTheme(theme === "system" ? "light" : theme === "light" ? "dark" : "system");
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
      role="separator"
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-valuemin="240"
      aria-valuemax="520"
      aria-valuenow={sidebarWidth}
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
              class="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-50 max-h-[65vh] overflow-auto rounded-lg border bg-popover p-1.5 shadow-xl"
            >
              {#if searchResults.length}
                {#each searchResults as result, index (result.id)}
                  <button
                    id={`search-result-${index}`}
                    role="option"
                    aria-selected={activeSearchIndex === index}
                    class="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none aria-selected:bg-accent"
                    onmouseenter={() => (activeSearchIndex = index)}
                    onclick={() => selectSearchResult(result)}
                  >
                    <Badge variant="outline" class="mt-0.5 capitalize">{result.kind.replace("-", " ")}</Badge>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium">{result.label}</span>
                      <span class="block truncate font-mono text-xs text-muted-foreground">{result.context}</span>
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

        <Button variant="outline" size="icon" onclick={cycleTheme} aria-label={`Theme: ${theme}`}>
          {#if theme === "dark"}<MoonIcon />{:else}<SunIcon />{/if}
        </Button>
      </div>
    </header>

    <main class="h-[calc(100vh-57px)] overflow-y-auto px-4 py-7 md:px-8 md:py-10">
      <div class="mx-auto max-w-6xl">
        {#if selectedRegister}
          <section aria-labelledby="register-title">
            <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0">
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  {#if selectedRegister.absoluteAddressHex}
                    <Badge class="font-mono text-sm">{selectedRegister.absoluteAddressHex}</Badge>
                  {/if}
                  <Badge variant="secondary">{selectedRegister.width}-bit</Badge>
                  <Badge variant="outline">SW {accessLabel(selectedRegister.softwareAccess)}</Badge>
                  <Badge variant="outline">HW {accessLabel(selectedRegister.hardwareAccess)}</Badge>
                </div>
                <h2 id="register-title" class="text-3xl font-semibold tracking-tight md:text-4xl">
                  {selectedRegister.name}
                </h2>
                <p class="mt-2 break-all font-mono text-xs text-muted-foreground">{selectedRegister.path}</p>
              </div>

              <div class="grid shrink-0 grid-cols-2 gap-x-6 gap-y-1 rounded-lg border bg-card px-4 py-3 text-sm">
                <span class="text-muted-foreground">Identifier</span>
                <code class="text-right">{selectedRegister.identifier}</code>
                <span class="text-muted-foreground">Offset</span>
                <code class="text-right">{selectedRegister.addressOffsetHex || "–"}</code>
                {#if selectedRegister.arrayDimensions.length}
                  <span class="text-muted-foreground">Array</span>
                  <code class="text-right">[{selectedRegister.arrayDimensions.join("][")}]</code>
                {/if}
                {#if selectedRegister.arrayStrideHex}
                  <span class="text-muted-foreground">Stride</span>
                  <code class="break-all text-right">{selectedRegister.arrayStrideHex}</code>
                {/if}
              </div>
            </div>

            {#if selectedRegister.groupPath.length}
              <div class="mt-5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <FolderTreeIcon class="mr-1 size-3.5" />
                {#each selectedRegister.groupPath as group, index}
                  {#if index}<ChevronRightIcon class="size-3" />{/if}
                  <span>{group}</span>
                {/each}
              </div>
            {/if}

            {#if selectedRegister.description}
              <div class="markdown mt-6 max-w-4xl text-sm md:text-base">
                {@html renderMarkdown(selectedRegister.description)}
              </div>
            {/if}

            <Separator class="my-8" />
            {@render registerLayout(selectedRegister)}

            <div class="mt-8 space-y-5">
              {#each selectedRegister.fields as field (field.id)}
                {@render fieldCard(field)}
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

    {#if folder.children.length}
      <div class="grid gap-3">
        {#each folder.children as child (child.id)}
          <button
            class="group flex min-w-0 items-center gap-3 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onclick={() => child.kind === "register" && child.targetId ? selectRegister(child.targetId) : selectFolder(child)}
          >
            <span class="grid size-9 shrink-0 place-items-center rounded-md bg-muted group-hover:bg-background/60">
              {@render kindIcon(child)}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{child.label}</span>
              <span class="mt-1 block truncate font-mono text-xs text-muted-foreground">
                {child.kind === "register" ? child.address || child.identifier : `${child.children.length} items`}
              </span>
            </span>
            <ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" />
          </button>
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
    <div class="mb-3 flex items-end justify-between gap-4">
      <div>
        <p class="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary">Bit layout</p>
        <h3 id="bit-layout-title" class="mt-1 text-lg font-semibold">{register.width} bits</h3>
      </div>
      <p class="font-mono text-xs text-muted-foreground">MSB {Math.max(register.width - 1, 0)} · LSB 0</p>
    </div>
    <div class="overflow-x-auto rounded-lg border bg-card p-3">
      <div
        class="grid min-w-[42rem] gap-px overflow-hidden rounded-md bg-border"
        style={`grid-template-columns: repeat(${Math.max(register.width, 1)}, minmax(0, 1fr))`}
      >
        {#each register.fields as field, index (field.id)}
          <button
            class={`row-start-1 min-h-16 overflow-hidden border-y-2 px-1 text-center text-[0.65rem] leading-tight transition hover:brightness-95 ${index % 2 ? "border-primary/35 bg-accent" : "border-primary/60 bg-secondary"}`}
            style={`grid-column: ${register.width - field.high} / ${register.width - field.low + 1}`}
            title={`${field.name} [${bitRange(field)}]`}
            onclick={() => document.getElementById(`field-${encodeURIComponent(field.id)}`)?.scrollIntoView({ behavior: "smooth" })}
          >
            <span class="block truncate font-medium">{field.name}</span>
            <span class="mt-1 block font-mono text-muted-foreground">[{bitRange(field)}]</span>
          </button>
        {/each}
      </div>
    </div>
  </section>
{/snippet}

{#snippet fieldCard(field: RegisterField)}
  <Card id={`field-${encodeURIComponent(field.id)}`} class="scroll-mt-20 gap-0 overflow-hidden py-0">
    <CardHeader class="border-b bg-muted/25 p-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <p class="font-mono text-xs text-primary">[{bitRange(field)}] · {field.identifier}</p>
          <h3 class="mt-1 text-xl font-semibold tracking-tight">{field.name}</h3>
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
