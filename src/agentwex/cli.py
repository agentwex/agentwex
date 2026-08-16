"""Reserved Python namespace for Agent WEX."""

from __future__ import annotations

import argparse

from . import __version__


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="agentwex",
        description=(
            "This is the reserved Python namespace, not the Agent WEX node. "
            "Install the canonical node with: npm install --global agentwex@0.6.0"
        ),
    )
    parser.add_argument("--version", action="version", version=f"agentwex {__version__}")
    return parser


def main() -> int:
    parser = build_parser()
    parser.parse_args()
    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
