from peakrdl_html_single.group_path import parse_group_path


def test_optional_group_is_empty() -> None:
    assert parse_group_path(None).segments == ()
    assert parse_group_path("  ").segments == ()


def test_nested_and_escaped_groups() -> None:
    result = parse_group_path(r"Block\/Channel/Controls\\Status")

    assert result.segments == ("Block/Channel", "Controls\\Status")
    assert result.warnings == ()


def test_invalid_segments_are_non_fatal() -> None:
    result = parse_group_path(r"Primary//Secondary\q/")

    assert result.segments == ("Primary", r"Secondary\q")
    assert "empty path segment" in result.warnings
    assert r"unknown escape sequence \q" in result.warnings
