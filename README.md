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

CI pipelines can embed build information with repeatable metadata arguments:

```sh
peakrdl html-single input.rdl -o registers.html \
  --metadata "Git commit=$GIT_COMMIT" \
  --metadata "Commit message=$GIT_COMMIT_MESSAGE"
```

Use `--metadata-file build-metadata.json` to load a JSON object instead. Values
from `--metadata` override matching labels from the file. Embedded values are
shown in the Settings dialog under About.

The optional `doc_group` register property augments the SystemRDL hierarchy.
Slash-separated values add documentation groups beneath each register's real
structural parent. Registers without the property remain direct children of
their structural parent.

## Installation

Install the latest version from GitHub in a virtual environment, then run the
exporter through PeakRDL:

```sh
uv venv
source .venv/bin/activate
```

```sh
uv pip install peakrdl "git+https://github.com/Lomzem/peakrdl-html-single.git"
uv run peakrdl html-single input.rdl -o registers.html
```

The exporter does not require `doc_group`. A source that uses it must declare
it as an optional string property for register components according to normal
SystemRDL rules. An unescaped `/` starts a nested documentation group, `\/`
represents a literal slash, and `\\` represents a literal backslash. Invalid
group paths cause a warning and do not stop export.

Descriptions are rendered as Markdown. Raw HTML is disabled.

## Frontend development

```sh
cd frontend
bun install
bun run dev
bun run check
bun run lint
bun run format
bun test
bun run build
```

`bun run build` creates the single-file frontend shell and copies it into the
Python package. `bun run build:kit` also verifies the regular SvelteKit static
build.

During `bun run dev`, the Vite server uses `example-rdl/example.rdl` when that
file exists. Frontend files keep normal HMR behavior. Changes to the example
RDL trigger a page reload with newly compiled data. Set
`PEAKRDL_HTML_SINGLE_PYTHON` to select a Python executable when needed.

Run Python tests from the repository root:

```sh
python -m pytest
```
