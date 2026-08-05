from pathlib import Path

from systemrdl import RDLCompiler

from peakrdl_html_single.model import build_document_model


RDL_SOURCE = r'''
property doc_group {
    type = string;
    component = reg;
};

addrmap sample_map {
    default regwidth = 32;

    reg {
        name = "Direct Register";
        field { sw = rw; reset = 1; } enabled[0:0];
    } direct @ 0x0;

    reg {
        name = "Array Register";
        field { sw = r; } value[7:0];
    } items[2] @ 0x20 += 0x4;

    regfile {
        reg {
            doc_group = "Section\\/Controls/Settings";
            name = "Grouped Register";
            enum mode_e {
                OFF = 0 { desc = "Disabled"; };
                ON = 1 { desc = "Enabled"; };
            };
            field { sw = rw; encode = mode_e; reset = mode_e::OFF; } mode[1:0];
        } grouped @ 0x4;
    } nested @ 0x100;
};
'''


def _compile(tmp_path: Path):
    source = tmp_path / "sample.rdl"
    source.write_text(RDL_SOURCE, encoding="utf-8")
    compiler = RDLCompiler()
    compiler.compile_file(source)
    return compiler.elaborate().top


def test_builds_structural_and_document_hierarchy(tmp_path: Path) -> None:
    document = build_document_model(_compile(tmp_path))

    assert len(document["registers"]) == 4
    root_children = document["navigation"]["children"]
    assert root_children[0]["kind"] == "register"
    assert root_children[-1]["kind"] == "regfile"
    assert [register["identifier"] for register in document["registers"][1:3]] == [
        "items[0]",
        "items[1]",
    ]

    nested_children = root_children[-1]["children"]
    assert nested_children[0]["kind"] == "doc-group"
    assert nested_children[0]["children"][0]["kind"] == "doc-group"
    assert nested_children[0]["children"][0]["children"][0]["kind"] == "register"


def test_preserves_fields_addresses_and_enums(tmp_path: Path) -> None:
    document = build_document_model(_compile(tmp_path))
    grouped = document["registers"][-1]
    field = grouped["fields"][0]

    assert grouped["absoluteAddressHex"] == "0x104"
    assert grouped["groupPath"] == ["Section/Controls", "Settings"]
    assert field["low"] == 0
    assert field["high"] == 1
    assert field["softwareAccess"] == "rw"
    assert grouped["softwareAccess"] == "rw"
    assert field["enum"]["name"] == "mode_e"
    assert [member["name"] for member in field["enum"]["members"]] == ["OFF", "ON"]


def test_doc_group_definition_is_not_required(tmp_path: Path) -> None:
    source = tmp_path / "plain.rdl"
    source.write_text(
        '''
        addrmap plain_map {
            reg {
                field {} value[7:0];
            } status;
        };
        ''',
        encoding="utf-8",
    )
    compiler = RDLCompiler()
    compiler.compile_file(source)

    document = build_document_model(compiler.elaborate().top)
    assert document["registers"][0]["groupPath"] == []
    assert document["navigation"]["children"][0]["kind"] == "register"


def test_native_defaults_are_preserved(tmp_path: Path) -> None:
    source = tmp_path / "defaults.rdl"
    source.write_text(
        "addrmap defaults { reg { field {} value[0:0]; } status; };",
        encoding="utf-8",
    )
    compiler = RDLCompiler()
    compiler.compile_file(source)
    register = build_document_model(compiler.elaborate().top)["registers"][0]

    assert register["width"] == 32
    assert register["fields"][0]["softwareAccess"] == "rw"
    assert register["fields"][0]["hardwareAccess"] == "rw"
