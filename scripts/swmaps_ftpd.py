"""SW Maps ingest receiver — throwaway FTP dropbox on trusted LAN.

Repeatable field-to-repo handoff: the Pixel uploads SW Maps exports
(GeoJSON points, GPX track, project backups) straight to this box instead
of sneaker-net through Drive.

Run from the repo root on rocm-aibox::

    source dataset/.venv/bin/activate
    python scripts/swmaps_ftpd.py <password>

Listens on the LAN interface only (never the public IP). One account,
jailed to dataset/survey/_incoming/ftp/. Stop it after ingest
(the shell that started it owns the process).

Part of the ground-survey procedure in docs/ground-survey-guide.md.
"""

import os
import sys

from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer

LAN_HOST = "192.168.4.53"
PORT = 2121
PASSIVE_RANGE = range(60000, 60010)

JAIL = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "dataset",
    "survey",
    "_incoming",
    "ftp",
)


def main() -> None:
    if len(sys.argv) != 2 or not sys.argv[1]:
        print("usage: python scripts/swmaps_ftpd.py <password>", file=sys.stderr)
        sys.exit(2)
    os.makedirs(JAIL, exist_ok=True)

    auth = DummyAuthorizer()
    # upload + list + mkdir + append; no delete/rename inside the jail.
    auth.add_user("swmaps", sys.argv[1], JAIL, perm="elramw")

    handler = FTPHandler
    handler.authorizer = auth
    handler.banner = "cloudcroft disc-golf survey dropbox"
    handler.passive_ports = PASSIVE_RANGE

    server = FTPServer((LAN_HOST, PORT), handler)
    print(f"serving {JAIL} on {LAN_HOST}:{PORT} as swmaps", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
