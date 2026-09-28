"""Provision and start the integrated shuzhi-class development stack."""
from __future__ import annotations

import os
import secrets
import socket
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / ".local"
MYSQL_HOME = Path(r"C:\Program Files\MySQL\MySQL Server 9.5")
MYSQLD = MYSQL_HOME / "bin" / "mysqld.exe"
MYSQL_DATA = LOCAL / "mysql-data"
MYSQL_PORT = 3307
NODE = Path(r"C:\Program Files\nodejs\node.exe")
NPM = Path(r"C:\Program Files\nodejs\npm.cmd")
VITE = ROOT / "node_modules" / "vite" / "bin" / "vite.js"


def listening(port: int) -> bool:
    with socket.socket() as connection:
        connection.settimeout(0.5)
        return connection.connect_ex(("127.0.0.1", port)) == 0


def write_env() -> None:
    target = ROOT / ".env.local"
    if target.exists():
        return
    target.write_text(
        "\n".join([
            "API_PORT=4000",
            "CLIENT_ORIGIN=http://localhost:3000",
            f"JWT_SECRET={secrets.token_urlsafe(48)}",
            "MYSQL_HOST=127.0.0.1",
            f"MYSQL_PORT={MYSQL_PORT}",
            "MYSQL_USER=root",
            "MYSQL_PASSWORD=",
            "MYSQL_DATABASE=shuzhi_classroom",
            "TEACHER_STUDIO_SERVICE_URL=http://127.0.0.1:8765",
            "TEACHER_STUDIO_AUTOSTART=true",
            f"TEACHER_STUDIO_PYTHON={ROOT.parents[0] / '.venv' / 'Scripts' / 'python.exe'}",
            "",
        ]),
        encoding="utf-8",
    )


def start_mysql() -> None:
    if listening(MYSQL_PORT):
        print(f"mysql already listening on {MYSQL_PORT}")
        return
    if not MYSQLD.exists():
        raise FileNotFoundError(f"MySQL server not found: {MYSQLD}")
    LOCAL.mkdir(parents=True, exist_ok=True)
    if not (MYSQL_DATA / "mysql").exists():
        MYSQL_DATA.mkdir(parents=True, exist_ok=True)
        subprocess.run([
            str(MYSQLD), "--initialize-insecure", f"--datadir={MYSQL_DATA}",
            f"--basedir={MYSQL_HOME}", "--console",
        ], check=True, cwd=ROOT)
    log = (LOCAL / "mysql.log").open("ab")
    subprocess.Popen([
        str(MYSQLD), f"--datadir={MYSQL_DATA}", f"--basedir={MYSQL_HOME}",
        f"--port={MYSQL_PORT}", "--bind-address=127.0.0.1", "--console",
    ], cwd=ROOT, stdin=subprocess.DEVNULL, stdout=log, stderr=log,
       creationflags=subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP)
    for _ in range(60):
        if listening(MYSQL_PORT):
            print(f"mysql started on {MYSQL_PORT}")
            return
        time.sleep(0.5)
    raise RuntimeError(f"MySQL did not start; inspect {LOCAL / 'mysql.log'}")


def main() -> None:
    write_env()
    start_mysql()
    if not (ROOT / "node_modules" / ".bin" / "vite.cmd").exists():
        subprocess.run([str(NPM), "install", "--legacy-peer-deps"], cwd=ROOT, check=True)
    processes = [
        subprocess.Popen([str(NODE), "server/index.js"], cwd=ROOT),
        subprocess.Popen([str(NODE), str(VITE), "--host", "0.0.0.0", "--port", "3000", "--strictPort"], cwd=ROOT),
    ]
    print("web: http://127.0.0.1:3000")
    print("api: http://127.0.0.1:4000")
    try:
        while all(process.poll() is None for process in processes):
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
    raise SystemExit(next((process.returncode for process in processes if process.returncode), 0))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Startup failed: {error}", file=sys.stderr)
        raise
