from __future__ import annotations

import json
from collections.abc import Mapping
from importlib.resources import files
from pathlib import Path

from systemrdl.node import AddrmapNode

from .model import build_document_model

DATA_MARKER = '{"marker":"__PEAKRDL_HTML_SINGLE_DOCUMENT__"}'


def _safe_json(value: object) -> str:
    return (
        json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        .replace("<", "\\u003c")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


class HtmlSingleExporter:
    def export(
        self,
        top_node: AddrmapNode,
        output: str | Path,
        metadata: Mapping[str, object] | None = None,
    ) -> None:
        template = files("peakrdl_html_single").joinpath("template.html").read_text(
            encoding="utf-8"
        )
        if template.count(DATA_MARKER) != 1:
            raise RuntimeError("Packaged HTML template has an invalid data marker")

        document = build_document_model(top_node)
        document["metadata"] = [
            {"label": str(label), "value": str(value)}
            for label, value in (metadata or {}).items()
        ]
        html = template.replace(DATA_MARKER, _safe_json(document))
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(html, encoding="utf-8", newline="\n")
