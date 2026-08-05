from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GroupPath:
    segments: tuple[str, ...]
    warnings: tuple[str, ...] = ()


def parse_group_path(value: object) -> GroupPath:
    """Parse a slash-separated documentation path without making it mandatory."""
    if not isinstance(value, str) or not value.strip():
        return GroupPath(())

    segments: list[str] = []
    current: list[str] = []
    messages: list[str] = []
    escaped = False

    for character in value.strip():
        if escaped:
            if character in ("/", "\\"):
                current.append(character)
            else:
                current.extend(("\\", character))
                messages.append(f"unknown escape sequence \\{character}")
            escaped = False
        elif character == "\\":
            escaped = True
        elif character == "/":
            segment = "".join(current).strip()
            if segment:
                segments.append(segment)
            else:
                messages.append("empty path segment")
            current = []
        else:
            current.append(character)

    if escaped:
        current.append("\\")
        messages.append("trailing escape character")

    segment = "".join(current).strip()
    if segment:
        segments.append(segment)
    elif segments:
        messages.append("empty path segment")

    return GroupPath(tuple(segments), tuple(dict.fromkeys(messages)))
