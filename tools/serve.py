#!/usr/bin/env python3
"""Serve the AI Search Visibility Checklist app on http://localhost:8767 and open it in your browser.

Standard library only. It serves the app/ folder on your own computer
(localhost), nothing is sent anywhere. Stop it with Ctrl+C.

Usage:
    python3 tools/serve.py            # port 8767, opens the browser
    python3 tools/serve.py --port 9000
    python3 tools/serve.py --no-open
"""
from __future__ import annotations

import argparse
import functools
import http.server
import socketserver
import sys
import threading
import webbrowser
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent / "app"
DEFAULT_PORT = 8767


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """Serves files from app/ and keeps the terminal readable."""

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".svg": "image/svg+xml",
        ".json": "application/json",
    }

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:  # noqa: A002 (stdlib signature)
        return


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the AI Search Visibility Checklist locally.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="port to use (default 8767)")
    parser.add_argument("--no-open", action="store_true", help="do not open the browser")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    if not (APP_DIR / "index.html").is_file():
        print(f"Could not find {APP_DIR / 'index.html'}. Run this from the repo you downloaded.", file=sys.stderr)
        return 1
    if not 1 <= args.port <= 65535:
        print("Use a port between 1 and 65535.", file=sys.stderr)
        return 2

    handler = functools.partial(QuietHandler, directory=str(APP_DIR))
    socketserver.TCPServer.allow_reuse_address = True
    try:
        server = socketserver.ThreadingTCPServer(("127.0.0.1", args.port), handler)
    except OSError as err:
        print(f"Port {args.port} is busy ({err.strerror}). Try: python3 tools/serve.py --port {args.port + 1}", file=sys.stderr)
        return 1

    url = f"http://localhost:{args.port}/"
    print(f"AI Search Visibility Checklist is running at {url}")
    print("Everything stays on this computer. Press Ctrl+C to stop.")
    if not args.no_open:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
