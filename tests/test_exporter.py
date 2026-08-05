import json
import re
from pathlib import Path

from peakrdl_html_single.exporter import DATA_MARKER, HtmlSingleExporter

from .test_model import _compile


def test_export_injects_data_into_one_html_file(tmp_path: Path) -> None:
    output = tmp_path / "registers.html"
    HtmlSingleExporter().export(_compile(tmp_path), output)

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
