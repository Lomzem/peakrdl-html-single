from __future__ import annotations

import warnings
from collections.abc import Iterable
from enum import Enum
import json
from typing import Any, TypeAlias
from urllib.parse import quote

from systemrdl.node import AddrmapNode, FieldNode, MemNode, Node, RegfileNode, RegNode

from .group_path import parse_group_path

StructuralNode: TypeAlias = AddrmapNode | RegfileNode | MemNode


def _properties(node: Node) -> dict[str, object]:
    return {name: node.get_property(name) for name in node.list_properties()}


def _property(node: Node, name: str, default: object = None) -> object:
    try:
        value = node.get_property(name)
    except LookupError:
        return default
    return default if value is None else value


def _string_property(node: Node, name: str, fallback: str = "") -> str:
    value = _property(node, name)
    if value is None:
        return fallback
    return str(value)


def _enum_name(value: object) -> str:
    if isinstance(value, Enum):
        return value.name.lower()
    name = getattr(value, "name", None)
    if isinstance(name, str):
        return name.lower()
    return str(value).lower()


def _hex(value: int) -> str:
    return f"0x{value:x}"


def _path(node: Node) -> str:
    return node.get_path()


def _array_suffix(node: Node) -> str:
    indexes = getattr(node, "current_idx", None)
    if not indexes:
        return ""
    return "".join(f"[{index}]" for index in indexes)


def _identifier(node: Node) -> str:
    return f"{node.inst_name}{_array_suffix(node)}"


def _node_id(kind: str, path: str) -> str:
    return f"{kind}:{path}"


def _address(node: object, attribute: str) -> int | None:
    value = getattr(node, attribute, None)
    return value if isinstance(value, int) else None


def _numeric_value(value: object) -> int | None:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    enum_value = getattr(value, "value", None)
    return enum_value if isinstance(enum_value, int) else None


def _value_model(value: object) -> dict[str, str] | None:
    numeric = _numeric_value(value)
    if numeric is None:
        return None

    result = {"value": str(numeric), "hex": _hex(numeric)}
    member_name = getattr(value, "name", None)
    if isinstance(member_name, str):
        result["enumMember"] = member_name
    return result


def _enum_description(member: object) -> str:
    for attribute in ("rdl_desc", "desc"):
        value = getattr(member, attribute, None)
        if value is not None:
            return str(value)
    return ""


def _enum_model(encode: object) -> dict[str, Any] | None:
    if encode is None:
        return None

    name = getattr(encode, "type_name", None) or getattr(encode, "__name__", None)
    members: list[dict[str, str]] = []

    try:
        candidates: Iterable[object] = encode  # type: ignore[assignment]
    except TypeError:
        return None

    for member in candidates:
        numeric = _numeric_value(member)
        member_name = getattr(member, "name", None) or getattr(member, "rdl_name", None)
        if numeric is None or not isinstance(member_name, str):
            continue
        display_name = getattr(member, "rdl_name", None) or member_name
        members.append(
            {
                "name": member_name,
                "displayName": str(display_name),
                "value": str(numeric),
                "hex": _hex(numeric),
                "description": _enum_description(member),
            }
        )

    if not members:
        return None

    return {"name": str(name or "enum"), "members": members}


def _field_model(field: FieldNode, register_id: str) -> dict[str, Any]:
    reset = _value_model(_property(field, "reset"))
    encode = _enum_model(_property(field, "encode"))
    path = _path(field)
    low = min(field.msb, field.lsb)
    high = max(field.msb, field.lsb)

    return {
        "id": _node_id("field", path),
        "registerId": register_id,
        "identifier": _identifier(field),
        "path": path,
        "name": _string_property(field, "name", field.inst_name),
        "description": _string_property(field, "desc"),
        "low": low,
        "high": high,
        "width": field.width,
        "softwareAccess": _enum_name(_property(field, "sw", "")),
        "hardwareAccess": _enum_name(_property(field, "hw", "")),
        "reset": reset,
        "enum": encode,
    }


def _register_model(node: RegNode, group_path: tuple[str, ...]) -> dict[str, Any]:
    path = _path(node)
    register_id = _node_id("register", path)
    absolute = _address(node, "absolute_address")
    offset = _address(node, "address_offset")
    fields = [_field_model(field, register_id) for field in node.fields()]
    width = _property(node, "regwidth", 0)
    stride = getattr(node, "array_stride", None)

    def common_access(key: str) -> str:
        values = {field[key] for field in fields if field[key]}
        if len(values) == 1:
            return values.pop()
        return "mixed" if values else ""

    return {
        "id": register_id,
        "identifier": _identifier(node),
        "path": path,
        "name": _string_property(node, "name", node.inst_name),
        "description": _string_property(node, "desc"),
        "absoluteAddress": str(absolute) if absolute is not None else None,
        "absoluteAddressHex": _hex(absolute) if absolute is not None else None,
        "addressOffset": str(offset) if offset is not None else None,
        "addressOffsetHex": _hex(offset) if offset is not None else None,
        "width": width if isinstance(width, int) else 0,
        "softwareAccess": common_access("softwareAccess"),
        "hardwareAccess": common_access("hardwareAccess"),
        "groupPath": list(group_path),
        "arrayDimensions": list(getattr(node, "array_dimensions", None) or []),
        "arrayStride": str(stride) if isinstance(stride, int) else None,
        "arrayStrideHex": _hex(stride) if isinstance(stride, int) else None,
        "fields": fields,
    }


def _leaf(register: dict[str, Any], node: RegNode) -> dict[str, Any]:
    suffix = _array_suffix(node)
    label = register["name"] + (f" {suffix}" if suffix else "")
    return {
        "id": f"nav:{register['id']}",
        "kind": "register",
        "label": label,
        "identifier": register["identifier"],
        "targetId": register["id"],
        "address": register["absoluteAddressHex"],
        "sortAddress": int(register["absoluteAddress"] or 0),
        "children": [],
    }


def _structural_kind(node: StructuralNode) -> str:
    if isinstance(node, AddrmapNode):
        return "addrmap"
    if isinstance(node, RegfileNode):
        return "regfile"
    return "memory"


class DocumentModelBuilder:
    def __init__(self, top_node: AddrmapNode):
        self.top_node = top_node
        self.registers: list[dict[str, Any]] = []

    def build(self) -> dict[str, Any]:
        navigation = self._structural_node(self.top_node)
        self._sort_tree(navigation)
        return {
            "formatVersion": 1,
            "title": _string_property(self.top_node, "name", self.top_node.inst_name),
            "description": _string_property(self.top_node, "desc"),
            "rootPath": _path(self.top_node),
            "navigation": navigation,
            "registers": self.registers,
        }

    def _structural_node(self, node: StructuralNode) -> dict[str, Any]:
        kind = _structural_kind(node)
        path = _path(node)
        absolute = _address(node, "absolute_address")
        suffix = _array_suffix(node)
        label = _string_property(node, "name", node.inst_name)
        navigation: dict[str, Any] = {
            "id": _node_id(kind, path),
            "kind": kind,
            "label": label + (f" {suffix}" if suffix else ""),
            "identifier": _identifier(node),
            "address": _hex(absolute) if absolute is not None else None,
            "sortAddress": absolute or 0,
            "children": [],
        }

        for child in node.children(unroll=True):
            if isinstance(child, RegNode):
                self._add_register(navigation, child)
            elif isinstance(child, (AddrmapNode, RegfileNode, MemNode)):
                navigation["children"].append(self._structural_node(child))

        return navigation

    def _add_register(self, parent: dict[str, Any], node: RegNode) -> None:
        raw_group = _properties(node).get("doc_group")
        parsed = parse_group_path(raw_group)
        for message in parsed.warnings:
            warnings.warn(
                f"Ignoring part of invalid doc_group on {_path(node)!r}: {message}",
                stacklevel=2,
            )

        register = _register_model(node, parsed.segments)
        self.registers.append(register)
        leaf = _leaf(register, node)
        container = parent
        group_prefix: list[str] = []

        for segment in parsed.segments:
            group_prefix.append(segment)
            group_id = "doc-group:" + quote(parent["id"], safe="") + ":" + quote(
                json.dumps(group_prefix, ensure_ascii=False, separators=(",", ":")), safe=""
            )
            existing = next(
                (
                    child
                    for child in container["children"]
                    if child["kind"] == "doc-group" and child["id"] == group_id
                ),
                None,
            )
            if existing is None:
                existing = {
                    "id": group_id,
                    "kind": "doc-group",
                    "label": segment,
                    "identifier": "/".join(group_prefix),
                    "address": None,
                    "sortAddress": leaf["sortAddress"],
                    "children": [],
                }
                container["children"].append(existing)
            else:
                existing["sortAddress"] = min(existing["sortAddress"], leaf["sortAddress"])
            container = existing

        container["children"].append(leaf)

    def _sort_tree(self, node: dict[str, Any]) -> None:
        node["children"].sort(
            key=lambda child: (
                child["sortAddress"],
                0 if child["kind"] == "doc-group" else 1,
                child["label"].casefold(),
            )
        )
        for child in node["children"]:
            self._sort_tree(child)
        node.pop("sortAddress", None)


def build_document_model(top_node: AddrmapNode) -> dict[str, Any]:
    return DocumentModelBuilder(top_node).build()
