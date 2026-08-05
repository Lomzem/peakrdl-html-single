from __future__ import annotations

import sys
from pathlib import Path

from systemrdl import RDLCompiler

from .exporter import _safe_json
from .model import build_document_model


def compile_document(source: str | Path) -> str:
    compiler = RDLCompiler()
    compiler.compile_file(Path(source))
    top_node = compiler.elaborate().top
    return _safe_json(build_document_model(top_node))


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: python -m peakrdl_html_single.dev_document <input.rdl>")
    sys.stdout.write(compile_document(sys.argv[1]))


if __name__ == "__main__":
    main()
