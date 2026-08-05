# PeakRDL HTML Single

`peakrdl-html-single` generates interactive register documentation as one
self-contained HTML file. The output includes its data, search index source,
styles, and application code, and can be served by a static web server or
opened directly from the local filesystem.

## Development status

The exporter is under active development. Its command is:

```sh
peakrdl html-single input.rdl -o registers.html
```

The optional `doc_group` register property augments the SystemRDL hierarchy.
Slash-separated values add documentation groups beneath each register's real
structural parent. Registers without the property remain direct children of
their structural parent.

## Installation

Install the Python package, then run the exporter through PeakRDL:

```sh
python -m pip install .
peakrdl html-single input.rdl -o registers.html
```

The exporter does not require `doc_group`. A source that uses it must declare
it as an optional string property for register components according to normal
SystemRDL rules. An unescaped `/` starts a nested documentation group, `\/`
represents a literal slash, and `\\` represents a literal backslash. Invalid
group paths cause a warning and do not stop export.

Descriptions are rendered as Markdown. Raw HTML is disabled.

## Frontend development

The frontend uses SvelteKit, TypeScript, Tailwind CSS, shadcn-svelte, Effect,
and FlexSearch. Use Bun for all frontend tasks:

```sh
cd frontend
bun install
bun run check
bun test
bun run build
```

`bun run build` creates the single-file frontend shell and copies it into the
Python package. `bun run build:kit` also verifies the regular SvelteKit static
build.

Run Python tests from the repository root:

```sh
python -m pytest
```
