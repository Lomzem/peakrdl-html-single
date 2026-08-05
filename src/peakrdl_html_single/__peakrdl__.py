from __future__ import annotations

from argparse import ArgumentParser, Namespace
from typing import TYPE_CHECKING

from peakrdl.plugins.exporter import ExporterSubcommandPlugin

from .exporter import HtmlSingleExporter

if TYPE_CHECKING:
    from systemrdl.node import AddrmapNode


class Exporter(ExporterSubcommandPlugin):
    short_desc = "Generate one interactive HTML file"
    long_desc = "Generate self-contained, searchable HTML register documentation."

    def add_exporter_arguments(self, arg_group: ArgumentParser) -> None:
        pass

    def do_export(self, top_node: AddrmapNode, options: Namespace) -> None:
        HtmlSingleExporter().export(top_node, options.output)
