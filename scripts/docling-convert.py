#!/usr/bin/env python
"""Convert a document with Docling and write local markdown/JSON artifacts.

This script is intentionally local-first. It is used to spike whether Docling can
extract useful context from scanned builder specification PDFs before the app is
wired to a hosted parser service.
"""

from __future__ import annotations

import argparse
import importlib.metadata
import json
import re
import sys
import time
import traceback
from pathlib import Path
from typing import Any


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return value or "docling-output"


def json_default(value: Any) -> Any:
    if isinstance(value, Path):
        return str(value)
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if hasattr(value, "dict"):
        return value.dict()
    if hasattr(value, "__dict__"):
        return value.__dict__
    return str(value)


def get_docling_version() -> str | None:
    try:
        return importlib.metadata.version("docling")
    except importlib.metadata.PackageNotFoundError:
        return None


def export_document_dict(document: Any) -> dict[str, Any]:
    for method_name in ("export_to_dict", "to_dict", "model_dump", "dict"):
        method = getattr(document, method_name, None)
        if callable(method):
            try:
                value = method()
                if isinstance(value, dict):
                    return value
                return json.loads(json.dumps(value, default=json_default))
            except TypeError:
                try:
                    value = method(mode="json")
                    if isinstance(value, dict):
                        return value
                    return json.loads(json.dumps(value, default=json_default))
                except Exception:
                    continue
    return json.loads(json.dumps(document, default=json_default))


def export_markdown(document: Any) -> str:
    for method_name in ("export_to_markdown", "export_to_text"):
        method = getattr(document, method_name, None)
        if callable(method):
            value = method()
            if isinstance(value, str):
                return value
    return json.dumps(export_document_dict(document), indent=2, ensure_ascii=False)


def count_tables(document_dict: dict[str, Any]) -> int:
    count = 0

    def visit(value: Any) -> None:
        nonlocal count
        if isinstance(value, dict):
            label = str(value.get("label") or value.get("type") or value.get("self_ref") or "").lower()
            if "table" in label:
                count += 1
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(document_dict)
    return count


def get_page_count(document_dict: dict[str, Any]) -> int | None:
    pages = document_dict.get("pages")
    if isinstance(pages, dict):
        return len(pages)
    if isinstance(pages, list):
        return len(pages)

    max_page = 0

    def visit(value: Any) -> None:
        nonlocal max_page
        if isinstance(value, dict):
            page_no = value.get("page_no") or value.get("page")
            if isinstance(page_no, int):
                max_page = max(max_page, page_no)
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(document_dict)
    return max_page or None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert a document with Docling and write artifacts.")
    parser.add_argument("input", help="Path to the input PDF/document")
    parser.add_argument("--out-dir", default=".local-artifacts/docling", help="Directory for ignored local artifacts")
    parser.add_argument("--basename", help="Output basename without extension")
    parser.add_argument("--quiet", action="store_true", help="Only print the diagnostics JSON path")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    basename = args.basename or slugify(input_path.stem)

    started = time.perf_counter()
    diagnostics: dict[str, Any] = {
        "provider": "docling_local",
        "inputPath": str(input_path),
        "inputFileName": input_path.name,
        "inputBytes": input_path.stat().st_size if input_path.exists() else None,
        "doclingVersion": get_docling_version(),
        "status": "started",
        "warnings": [],
        "outputs": {},
    }

    if not input_path.exists():
        diagnostics.update({"status": "failed", "error": f"Input file not found: {input_path}"})
        print(json.dumps(diagnostics, indent=2), file=sys.stderr)
        return 2

    if diagnostics["doclingVersion"] is None:
        diagnostics.update({"status": "failed", "error": "Python package 'docling' is not installed. Run: python -m pip install docling"})
        print(json.dumps(diagnostics, indent=2), file=sys.stderr)
        return 3

    try:
        from docling.document_converter import DocumentConverter

        out_dir.mkdir(parents=True, exist_ok=True)
        converter = DocumentConverter()
        result = converter.convert(str(input_path))
        document = result.document
        document_dict = export_document_dict(document)
        markdown = export_markdown(document)

        md_path = out_dir / f"{basename}.md"
        json_path = out_dir / f"{basename}.json"
        diag_path = out_dir / f"{basename}-diagnostics.json"

        md_path.write_text(markdown, encoding="utf-8", newline="\n")
        json_path.write_text(json.dumps(document_dict, indent=2, ensure_ascii=False, default=json_default), encoding="utf-8", newline="\n")

        diagnostics.update(
            {
                "status": "completed",
                "elapsedSeconds": round(time.perf_counter() - started, 3),
                "pageCount": get_page_count(document_dict),
                "characterCount": len(markdown),
                "tableCount": count_tables(document_dict),
                "outputs": {
                    "markdown": str(md_path),
                    "json": str(json_path),
                    "diagnostics": str(diag_path),
                },
            }
        )
        diag_path.write_text(json.dumps(diagnostics, indent=2, ensure_ascii=False), encoding="utf-8", newline="\n")

        if args.quiet:
            print(diag_path)
        else:
            print(json.dumps(diagnostics, indent=2, ensure_ascii=False))
        return 0
    except Exception as error:  # noqa: BLE001 - CLI should report any local conversion failure.
        diagnostics.update(
            {
                "status": "failed",
                "elapsedSeconds": round(time.perf_counter() - started, 3),
                "error": str(error),
                "traceback": traceback.format_exc(),
            }
        )
        try:
            out_dir.mkdir(parents=True, exist_ok=True)
            diag_path = out_dir / f"{basename}-diagnostics.json"
            diagnostics["outputs"]["diagnostics"] = str(diag_path)
            diag_path.write_text(json.dumps(diagnostics, indent=2, ensure_ascii=False), encoding="utf-8", newline="\n")
        except Exception:
            pass
        print(json.dumps(diagnostics, indent=2, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
