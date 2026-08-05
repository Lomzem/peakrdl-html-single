import json
import re
from pathlib import Path

from peakrdl_html_single.dev_document import compile_document
from peakrdl_html_single.exporter import DATA_MARKER, HtmlSingleExporter

from .test_model import RDL_SOURCE, _compile


def test_export_injects_data_into_one_html_file(tmp_path: Path) -> None:
    output = tmp_path / "registers.html"
    HtmlSingleExporter().export(
        _compile(tmp_path),
        output,
        metadata={"Git commit": "0123456789abcdef", "Commit message": "Update registers"},
    )

    html = output.read_text(encoding="utf-8")
    assert DATA_MARKER not in html
    assert "<style" in html
    assert not re.search(r'<(?:script|link)\b[^>]+(?:src|href)=["\'](?!data:)', html)

    match = re.search(
        r'<script id="peakrdl-document" type="application/json">(.*?)</script>',
        html,
        re.DOTALL,
    )
    assert match is not None
    document = json.loads(match.group(1))
    assert document["formatVersion"] == 1
    assert len(document["registers"]) == 4
    assert document["metadata"] == [
        {"label": "Git commit", "value": "0123456789abcdef"},
        {"label": "Commit message", "value": "Update registers"},
    ]


def test_dev_document_emits_the_same_json_model(tmp_path: Path) -> None:
    source = tmp_path / "development.rdl"
    source.write_text(RDL_SOURCE, encoding="utf-8")

    document = json.loads(compile_document(source))
    assert document["formatVersion"] == 1
    assert len(document["registers"]) == 4
