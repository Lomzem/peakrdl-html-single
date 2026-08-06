<script lang="ts">
    import SearchIcon from "@lucide/svelte/icons/search";
    import { createHotkey } from "@tanstack/svelte-hotkeys";

    import { Badge } from "$lib/components/ui/badge";
    import { Input } from "$lib/components/ui/input";
    import * as Kbd from "$lib/components/ui/kbd";
    import type { SearchRecord, SearchService } from "$lib/search";

    interface Props {
        searchService: SearchService;
        query: string;
        onSelect: (result: SearchRecord) => void;
    }

    let { searchService, query = $bindable(), onSelect }: Props = $props();
    let searchInput = $state<HTMLInputElement | null>(null);
    let searchFocused = $state(false);
    let activeSearchIndex = $state(-1);
    let searchResults = $derived(query.trim() ? searchService.search(query.trim()) : []);

    function focusSearch(): void {
        searchInput?.focus();
        searchInput?.select();
    }

    function handleFocusOut(event: FocusEvent): void {
        const nextTarget = event.relatedTarget;
        const search = event.currentTarget as HTMLDivElement;
        if (!(nextTarget instanceof Node) || !search.contains(nextTarget)) {
            searchFocused = false;
        }
    }

    function matchedTextParts(
        value: string,
        search: string,
    ): Array<{ text: string; matched: boolean }> {
        const needle = search.toLowerCase().replace(/\s+/g, "");
        if (!needle) return [{ text: value, matched: false }];

        const matched = new Set<number>();
        let start = 0;
        for (const character of needle) {
            const index = value.toLowerCase().indexOf(character, start);
            if (index === -1) return [{ text: value, matched: false }];
            matched.add(index);
            start = index + 1;
        }

        const parts: Array<{ text: string; matched: boolean }> = [];
        for (let index = 0; index < value.length; index += 1) {
            const isMatched = matched.has(index);
            const previous = parts.at(-1);
            if (previous?.matched === isMatched) previous.text += value[index];
            else parts.push({ text: value[index], matched: isMatched });
        }
        return parts;
    }

    function handleKeydown(event: KeyboardEvent): void {
        if (!searchResults.length) return;
        if (event.key === "ArrowDown") {
            event.preventDefault();
            activeSearchIndex = Math.min(activeSearchIndex + 1, searchResults.length - 1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            activeSearchIndex = Math.max(activeSearchIndex - 1, 0);
        } else if (event.key === "Enter") {
            event.preventDefault();
            onSelect(searchResults[Math.max(activeSearchIndex, 0)]);
        }
    }

    createHotkey("Control+K", focusSearch);
    createHotkey("/", focusSearch);
    createHotkey(
        "Escape",
        () => {
            searchInput?.blur();
            searchFocused = false;
        },
        () => ({ enabled: searchFocused }),
    );
</script>

<div class="relative min-w-0 flex-1" onfocusout={handleFocusOut}>
    <SearchIcon
        class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
    />
    <Input
        bind:ref={searchInput}
        bind:value={query}
        class="h-9 bg-card pl-9 pr-16 font-mono text-sm"
        placeholder="Search by address, register, field, or enum"
        aria-label="Search registers"
        aria-keyshortcuts="Control+K /"
        role="combobox"
        aria-expanded={Boolean(query.trim() && searchFocused)}
        aria-controls={query.trim() && searchFocused ? "search-results" : undefined}
        aria-activedescendant={activeSearchIndex >= 0
            ? `search-result-${activeSearchIndex}`
            : undefined}
        autocomplete="off"
        onfocus={() => (searchFocused = true)}
        oninput={() => (activeSearchIndex = -1)}
        onkeydown={handleKeydown}
    />
    <Kbd.Root class="absolute right-2 top-1/2 -translate-y-1/2">Ctrl K</Kbd.Root>
    {#if query.trim() && searchFocused}
        <div
            id="search-results"
            role="listbox"
            class="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-50 max-h-[65vh] overflow-auto rounded-lg border bg-card p-1.5 text-card-foreground shadow-xl"
        >
            {#if searchResults.length}
                {#each searchResults as result, index (result.id)}
                    <button
                        type="button"
                        id={`search-result-${index}`}
                        role="option"
                        aria-selected={activeSearchIndex === index}
                        class="grid w-full grid-cols-[8rem_minmax(0,1fr)] items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none aria-selected:bg-muted"
                        onmouseenter={() => (activeSearchIndex = index)}
                        onclick={() => onSelect(result)}
                    >
                        <Badge variant="outline" class="mt-0.5 justify-self-start capitalize">
                            {result.kind.replace("-", " ")}
                        </Badge>
                        <span class="min-w-0 flex-1">
                            <span
                                class="block truncate text-sm font-medium leading-5 text-muted-foreground"
                            >
                                {#each matchedTextParts(result.label, query) as part, partIndex (partIndex)}
                                    <span class:text-primary={part.matched}>{part.text}</span>
                                {/each}
                            </span>
                            <span
                                class="mt-0.5 block truncate font-mono text-xs leading-4 text-muted-foreground"
                            >
                                {#each matchedTextParts(result.context, query) as part, partIndex (partIndex)}
                                    <span class:text-primary={part.matched}>{part.text}</span>
                                {/each}
                            </span>
                        </span>
                    </button>
                {/each}
            {:else}
                <p class="px-3 py-7 text-center text-sm text-muted-foreground">
                    No matching registers or fields
                </p>
            {/if}
        </div>
    {/if}
    <p class="sr-only" aria-live="polite">
        {query.trim() ? `${searchResults.length} search results` : ""}
    </p>
</div>
