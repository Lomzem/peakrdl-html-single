<script lang="ts">
    import "../app.css";

    import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
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
    import {
        documentHref,
        enumDomId,
        enumMemberDomId,
        fieldDomId,
        parseDocumentHash,
        shouldHandleInApp,
        type DocumentTarget,
    } from "$lib/document-links";
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
    const registerNavigationNodes: NavigationNode[] = [];

    function recordAncestors(node: NavigationNode, ancestors: string[]): void {
        navigationById.set(node.id, node);
        navigationAncestorIds.set(node.id, ancestors);
        if (node.targetId) {
            ancestorIds.set(node.targetId, ancestors);
            registerNavigationNodes.push(node);
        }
        for (const child of node.children) recordAncestors(child, [...ancestors, node.id]);
    }
    recordAncestors(registerDocument.navigation, []);

    const addressNavigation: NavigationNode = {
        ...registerDocument.navigation,
        children: registerNavigationNodes.toSorted((left, right) => {
            const leftAddress = registersById.get(left.targetId || "")?.absoluteAddress;
            const rightAddress = registersById.get(right.targetId || "")?.absoluteAddress;
            if (leftAddress === null || leftAddress === undefined) return 1;
            if (rightAddress === null || rightAddress === undefined) return -1;
            const comparison = BigInt(leftAddress) - BigInt(rightAddress);
            return comparison < 0n
                ? -1
                : comparison > 0n
                  ? 1
                  : left.label.localeCompare(right.label);
        }),
    };

    function expandableIds(root: NavigationNode): string[] {
        const ids: string[] = [];
        const visit = (node: NavigationNode) => {
            if (node.kind === "register" && node.targetId) return;
            ids.push(node.id);
            node.children.forEach(visit);
        };
        visit(root);
        return ids;
    }

    const documentExpandableIds = expandableIds(registerDocument.navigation);
    const addressExpandableIds = expandableIds(addressNavigation);

    let selectedId = $state("");
    let selectedFolderId = $state(registerDocument.navigation.id);
    let expanded = $state<Set<string>>(new Set([registerDocument.navigation.id]));
    let navigationMode = $state<"document" | "address">("document");
    let query = $state("");
    let mobileNavigationOpen = $state(false);
    let sidebarWidth = $state(304);
    let showReservedGaps = $state(true);
    let showBackToTop = $state(false);
    let navigationVersion = 0;
    let navigationRoot = $derived(
        navigationMode === "address" ? addressNavigation : registerDocument.navigation,
    );
    let visibleExpandableIds = $derived(
        navigationMode === "address" ? addressExpandableIds : documentExpandableIds,
    );
    let allNavigationExpanded = $derived(visibleExpandableIds.every((id) => expanded.has(id)));
    let selectedRegister = $derived(registersById.get(selectedId));
    let selectedFolder = $derived(navigationById.get(selectedFolderId));
    let selectedBreadcrumbs = $derived(
        (ancestorIds.get(selectedId) || [])
            .map((id) => navigationById.get(id))
            .filter((node): node is NavigationNode => node !== undefined),
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

    function toggleAllNodes(): void {
        const next = new Set(expanded);
        for (const id of visibleExpandableIds) {
            if (allNavigationExpanded) next.delete(id);
            else next.add(id);
        }
        expanded = next;
        writePreference("peakrdl-expanded", JSON.stringify([...next]));
    }

    function setNavigationMode(mode: "document" | "address"): void {
        navigationMode = mode;
        writePreference("peakrdl-navigation-mode", mode);
    }

    function expandToRegister(id: string): void {
        expanded = new Set([...expanded, ...(ancestorIds.get(id) || [])]);
    }

    async function showTarget(target: DocumentTarget, writeHash = true): Promise<void> {
        const version = ++navigationVersion;
        if (target.kind === "folder") {
            const folder = navigationById.get(target.folderId);
            if (!folder) return;
            selectedId = "";
            selectedFolderId = folder.id;
            expanded = new Set([...expanded, folder.id]);
            mobileNavigationOpen = false;
            query = "";
            if (writeHash && location.hash !== documentHref(target)) {
                history.pushState(null, "", documentHref(target));
            }
            await tick();
            if (version !== navigationVersion) return;
            document.querySelector("main")?.scrollTo({ top: 0 });
            return;
        }

        const register = registersById.get(target.registerId);
        if (!register) return;
        const field = target.fieldId
            ? register.fields.find((candidate) => candidate.id === target.fieldId)
            : undefined;
        const enumValue = field && field.enum?.name === target.enumName ? field.enum : undefined;
        const member = target.memberName
            ? enumValue?.members.find((candidate) => candidate.name === target.memberName)
            : undefined;
        const validTarget: DocumentTarget = {
            kind: "register",
            registerId: register.id,
            ...(field ? { fieldId: field.id } : {}),
            ...(enumValue ? { enumName: enumValue.name } : {}),
            ...(member ? { memberName: member.name } : {}),
        };

        calculator.selectRegister(register);
        selectedId = register.id;
        selectedFolderId = "";
        expandToRegister(register.id);
        mobileNavigationOpen = false;
        query = "";
        if (writeHash && location.hash !== documentHref(validTarget)) {
            history.pushState(null, "", documentHref(validTarget));
        }
        await tick();
        if (version !== navigationVersion) return;
        const destinationId = member
            ? enumMemberDomId(field!.id, enumValue!.name, member.name)
            : enumValue
              ? enumDomId(field!.id, enumValue.name)
              : field
                ? fieldDomId(field.id)
                : "";
        if (destinationId) {
            document.getElementById(destinationId)?.scrollIntoView({
                block: "start",
            });
        } else {
            document.querySelector("main")?.scrollTo({ top: 0 });
        }
    }

    function navigateTo(event: MouseEvent, target: DocumentTarget): void {
        if (!shouldHandleInApp(event)) return;
        event.preventDefault();
        void showTarget(target);
    }

    function selectTarget(target: DocumentTarget): void {
        void showTarget(target);
    }

    function searchTarget(result: SearchRecord): DocumentTarget {
        if (result.folderId) return { kind: "folder", folderId: result.folderId };
        return {
            kind: "register",
            registerId: result.targetId,
            ...(result.fieldId ? { fieldId: result.fieldId } : {}),
            ...(result.enumName ? { enumName: result.enumName } : {}),
            ...(result.memberName ? { memberName: result.memberName } : {}),
        };
    }

    function applyHash(): void {
        const target = parseDocumentHash(location.hash);
        if (target) void showTarget(target, false);
        else void showTarget({ kind: "folder", folderId: registerDocument.navigation.id }, false);
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

    function handleMainScroll(event: Event): void {
        showBackToTop = (event.currentTarget as HTMLElement).scrollTop > 320;
    }

    function scrollToTop(): void {
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
    }

    onMount(() => {
        const savedExpanded = readPreference("peakrdl-expanded");
        if (savedExpanded) {
            try {
                expanded = new Set(JSON.parse(savedExpanded));
            } catch {
                removePreference("peakrdl-expanded");
            }
        }

        navigationMode =
            readPreference("peakrdl-navigation-mode") === "address" ? "address" : "document";
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
    class="h-screen overflow-hidden bg-background md:grid md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]"
    style={`--sidebar-width: ${sidebarWidth}px`}
>
    <aside
        class="print-hidden relative hidden h-full min-h-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block"
    >
        <NavigationPanel
            title={registerDocument.title}
            root={navigationRoot}
            selectedRegisterId={selectedId}
            {selectedFolderId}
            {expanded}
            {registersById}
            {showReservedGaps}
            {navigationMode}
            {allNavigationExpanded}
            onToggle={toggleNode}
            onToggleAll={toggleAllNodes}
            onNavigationModeChange={setNavigationMode}
            onNavigate={navigateTo}
        />
        <button
            type="button"
            aria-label="Resize sidebar"
            class="absolute inset-y-0 -right-1 z-40 w-2 cursor-col-resize touch-none bg-transparent outline-none transition-colors hover:bg-primary/20 focus-visible:bg-primary/30"
            onpointerdown={startSidebarResize}
            onkeydown={handleSidebarResizeKey}
        ></button>
    </aside>

    <div class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <header class="print-hidden shrink-0 border-b bg-background px-3 py-2 md:px-6">
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
                    <Sheet.Content
                        side="left"
                        class="w-[88vw] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-sm"
                    >
                        <Sheet.Title class="sr-only">Register navigation</Sheet.Title>
                        <Sheet.Description class="sr-only">
                            Browse the register hierarchy
                        </Sheet.Description>
                        <NavigationPanel
                            title={registerDocument.title}
                            root={navigationRoot}
                            selectedRegisterId={selectedId}
                            {selectedFolderId}
                            {expanded}
                            {registersById}
                            {showReservedGaps}
                            {navigationMode}
                            {allNavigationExpanded}
                            onToggle={toggleNode}
                            onToggleAll={toggleAllNodes}
                            onNavigationModeChange={setNavigationMode}
                            onNavigate={navigateTo}
                        />
                    </Sheet.Content>
                </Sheet.Root>

                <DocumentSearch
                    {searchService}
                    bind:query
                    {searchTarget}
                    onSelect={selectTarget}
                    onNavigate={navigateTo}
                />
                <DocumentMenu
                    formatVersion={registerDocument.formatVersion}
                    metadata={registerDocument.metadata}
                    bind:showReservedGaps
                />
            </div>
        </header>

        <main
            class="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-5"
            onscroll={handleMainScroll}
        >
            <div class="mx-auto max-w-6xl">
                {#if selectedRegister}
                    <RegisterView
                        register={selectedRegister}
                        breadcrumbs={selectedBreadcrumbs}
                        {showReservedGaps}
                        {calculator}
                        onNavigate={navigateTo}
                    />
                {:else if selectedFolder}
                    <FolderView
                        folder={selectedFolder}
                        breadcrumbs={selectedFolderBreadcrumbs}
                        {registersById}
                        {showReservedGaps}
                        onNavigate={navigateTo}
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
            {#if showBackToTop && (selectedRegister || selectedFolder)}
                <Button
                    variant="secondary"
                    class="print-hidden fixed right-5 bottom-5 z-20 shadow-lg md:right-8 md:bottom-8"
                    onclick={scrollToTop}
                >
                    <ArrowUpIcon />
                    Back to top
                </Button>
            {/if}
        </main>
    </div>
</div>
