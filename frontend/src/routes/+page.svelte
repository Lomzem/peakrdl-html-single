<script lang="ts">
    import "../app.css";

    import CpuIcon from "@lucide/svelte/icons/cpu";
    import MenuIcon from "@lucide/svelte/icons/menu";
    import { Effect } from "effect";
    import { onMount, tick } from "svelte";

    import DocumentMenu from "$lib/components/register-document/document-menu.svelte";
    import DocumentSearch from "$lib/components/register-document/document-search.svelte";
    import FolderView from "$lib/components/register-document/folder-view.svelte";
    import NavigationPanel from "$lib/components/register-document/navigation-panel.svelte";
    import RegisterView from "$lib/components/register-document/register-view.svelte";
    import { RegisterCalculatorState } from "$lib/components/register-document/calculator-state.svelte";
    import { Button } from "$lib/components/ui/button";
    import * as Sheet from "$lib/components/ui/sheet";
    import type { NavigationNode } from "$lib/domain";
    import { readEmbeddedDocument } from "$lib/domain";
    import { readPreference, removePreference, writePreference } from "$lib/preferences";
    import { makeSearchService, type SearchRecord } from "$lib/search";

    const registerDocument = readEmbeddedDocument();
    const searchService = Effect.runSync(makeSearchService(registerDocument));
    const calculator = new RegisterCalculatorState(registerDocument.registers);
    const registersById = new Map(
        registerDocument.registers.map((register) => [register.id, register]),
    );
    const navigationById = new Map<string, NavigationNode>();
    const ancestorIds = new Map<string, string[]>();
    const navigationAncestorIds = new Map<string, string[]>();

    function recordAncestors(node: NavigationNode, ancestors: string[]): void {
        navigationById.set(node.id, node);
        navigationAncestorIds.set(node.id, ancestors);
        if (node.targetId) ancestorIds.set(node.targetId, ancestors);
        for (const child of node.children) recordAncestors(child, [...ancestors, node.id]);
    }
    recordAncestors(registerDocument.navigation, []);

    let selectedId = $state(registerDocument.registers[0]?.id || "");
    let selectedFolderId = $state("");
    let expanded = $state<Set<string>>(new Set([registerDocument.navigation.id]));
    let query = $state("");
    let mobileNavigationOpen = $state(false);
    let sidebarWidth = $state(304);
    let showReservedGaps = $state(true);
    let selectedRegister = $derived(registersById.get(selectedId));
    let selectedFolder = $derived(navigationById.get(selectedFolderId));
    let selectedBreadcrumbs = $derived(
        (ancestorIds.get(selectedId) || [])
            .map((id) => navigationById.get(id))
            .filter((node): node is NavigationNode => node?.kind === "doc-group"),
    );
    let selectedFolderBreadcrumbs = $derived(
        (navigationAncestorIds.get(selectedFolderId) || [])
            .map((id) => navigationById.get(id))
            .filter((node): node is NavigationNode => node !== undefined),
    );

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
        calculator.selectRegister(register);
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
                block: "start",
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

    function resizeSidebar(width: number): void {
        sidebarWidth = Math.min(520, Math.max(240, width));
    }

    function startSidebarResize(event: PointerEvent): void {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = sidebarWidth;
        const move = (moveEvent: PointerEvent) =>
            resizeSidebar(startWidth + moveEvent.clientX - startX);
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

    onMount(() => {
        const savedExpanded = readPreference("peakrdl-expanded");
        if (savedExpanded) {
            try {
                expanded = new Set([registerDocument.navigation.id, ...JSON.parse(savedExpanded)]);
            } catch {
                removePreference("peakrdl-expanded");
            }
        }

        showReservedGaps = readPreference("peakrdl-show-reserved-gaps") !== "false";
        applyHash();
        window.addEventListener("hashchange", applyHash);
        return () => window.removeEventListener("hashchange", applyHash);
    });
</script>

<svelte:head>
    <title>{registerDocument.title}</title>
    <meta name="description" content="Interactive register documentation" />
</svelte:head>

<div
    class="min-h-screen bg-background md:grid md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]"
    style={`--sidebar-width: ${sidebarWidth}px`}
>
    <aside
        class="print-hidden sticky top-0 hidden h-screen border-r bg-card/70 backdrop-blur md:block"
    >
        <NavigationPanel
            title={registerDocument.title}
            root={registerDocument.navigation}
            selectedRegisterId={selectedId}
            {selectedFolderId}
            {expanded}
            onToggle={toggleNode}
            onSelectRegister={(id) => void selectRegister(id)}
            onSelectFolder={(node) => void selectFolder(node)}
        />
        <button
            type="button"
            aria-label="Resize sidebar"
            class="absolute inset-y-0 -right-1 z-40 w-2 cursor-col-resize touch-none bg-transparent outline-none transition-colors hover:bg-primary/20 focus-visible:bg-primary/30"
            onpointerdown={startSidebarResize}
            onkeydown={handleSidebarResizeKey}
        ></button>
    </aside>

    <div class="min-w-0">
        <header
            class="print-hidden sticky top-0 z-30 border-b bg-background/92 px-3 py-2 backdrop-blur md:px-6"
        >
            <div class="mx-auto flex max-w-6xl items-center gap-2">
                <Sheet.Root bind:open={mobileNavigationOpen}>
                    <Sheet.Trigger>
                        {#snippet child({ props })}
                            <Button
                                {...props}
                                variant="outline"
                                size="icon"
                                class="md:hidden"
                                aria-label="Open navigation"
                            >
                                <MenuIcon />
                            </Button>
                        {/snippet}
                    </Sheet.Trigger>
                    <Sheet.Content side="left" class="w-[88vw] p-0 sm:max-w-sm">
                        <Sheet.Title class="sr-only">Register navigation</Sheet.Title>
                        <Sheet.Description class="sr-only">
                            Browse the register hierarchy
                        </Sheet.Description>
                        <NavigationPanel
                            title={registerDocument.title}
                            root={registerDocument.navigation}
                            selectedRegisterId={selectedId}
                            {selectedFolderId}
                            {expanded}
                            onToggle={toggleNode}
                            onSelectRegister={(id) => void selectRegister(id)}
                            onSelectFolder={(node) => void selectFolder(node)}
                        />
                    </Sheet.Content>
                </Sheet.Root>

                <DocumentSearch {searchService} bind:query onSelect={selectSearchResult} />
                <DocumentMenu
                    formatVersion={registerDocument.formatVersion}
                    metadata={registerDocument.metadata}
                    bind:showReservedGaps
                />
            </div>
        </header>

        <main class="h-[calc(100vh-57px)] overflow-y-auto px-4 py-5 md:px-8 md:py-6">
            <div class="mx-auto max-w-6xl">
                {#if selectedRegister}
                    <RegisterView
                        register={selectedRegister}
                        breadcrumbs={selectedBreadcrumbs}
                        {showReservedGaps}
                        {calculator}
                        onSelectFolder={(node) => void selectFolder(node)}
                    />
                {:else if selectedFolder}
                    <FolderView
                        folder={selectedFolder}
                        breadcrumbs={selectedFolderBreadcrumbs}
                        {registersById}
                        {showReservedGaps}
                        onSelectRegister={(id) => void selectRegister(id)}
                        onSelectFolder={(node) => void selectFolder(node)}
                    />
                {:else}
                    <div class="grid min-h-[55vh] place-items-center text-center">
                        <div>
                            <CpuIcon class="mx-auto size-10 text-muted-foreground" />
                            <h2 class="mt-4 text-xl font-semibold">
                                No registers in this document
                            </h2>
                            <p class="mt-2 text-sm text-muted-foreground">
                                The exported model does not contain register instances.
                            </p>
                        </div>
                    </div>
                {/if}
            </div>
        </main>
    </div>
</div>
