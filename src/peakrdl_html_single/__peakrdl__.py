from __future__ import annotations

from argparse import ArgumentParser, Namespace
import json
from pathlib import Path
from typing import TYPE_CHECKING

from peakrdl.plugins.exporter import ExporterSubcommandPlugin

from .exporter import HtmlSingleExporter

if TYPE_CHECKING:
    from systemrdl.node import AddrmapNode


class Exporter(ExporterSubcommandPlugin):
    short_desc = "Generate one interactive HTML file"
    long_desc = "Generate self-contained, searchable HTML register documentation."

    def add_exporter_arguments(self, arg_group: ArgumentParser) -> None:
        arg_group.add_argument(
            "--metadata",
            action="append",
            default=[],
            metavar="KEY=VALUE",
            help="Embed build metadata. May be specified more than once.",
        )
        arg_group.add_argument(
            "--metadata-file",
            type=Path,
            help="Read build metadata from a JSON object.",
        )

    def do_export(self, top_node: AddrmapNode, options: Namespace) -> None:
        metadata: dict[str, str] = {}
        if options.metadata_file:
            value = json.loads(options.metadata_file.read_text(encoding="utf-8"))
            if not isinstance(value, dict):
                raise ValueError("Metadata file must contain a JSON object")
            metadata.update({str(key): str(item) for key, item in value.items()})

        for assignment in options.metadata:
            key, separator, value = assignment.partition("=")
            if not separator or not key.strip():
                raise ValueError(f"Invalid metadata assignment: {assignment!r}")
            metadata[key.strip()] = value

        HtmlSingleExporter().export(top_node, options.output, metadata=metadata)
