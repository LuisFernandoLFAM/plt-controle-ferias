"""Testes automáticos do app.

Uso:  python tests/rodar_testes.py

Monta o mesmo HTML do build (scripts/build.py) com os testes de tests/testes.js
embutidos, serve a página em 127.0.0.1 e abre o Edge (ou o Chrome) sem janela
(headless). Os testes rodam dentro da página, com o sql.js e o SheetJS reais, e
mandam o resultado de volta para este script.

Só usa a biblioteca padrão do Python. Precisa do Microsoft Edge ou do Google
Chrome instalado. Para escolher o navegador: variável NAVEGADOR com o caminho do .exe.
"""

from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
TESTES_JS = RAIZ / "tests" / "testes.js"
TEMPO_LIMITE = 180  # segundos

NAVEGADORES = [
    os.environ.get("NAVEGADOR", ""),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "/usr/bin/microsoft-edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
]


def carregar_build():
    spec = importlib.util.spec_from_file_location("build", RAIZ / "scripts" / "build.py")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def achar_navegador() -> str | None:
    return next((n for n in NAVEGADORES if n and Path(n).is_file()), None)


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    build = carregar_build()
    # Mesma política de segurança do app, mas a página de teste pode falar com este script.
    csp = build.CSP.replace("connect-src 'none'", "connect-src 'self'")
    html = build.montar(csp=csp, scripts_extras=[TESTES_JS]).encode("utf-8")

    navegador = achar_navegador()
    if not navegador:
        print("Não encontrei o Edge nem o Chrome. Defina a variável NAVEGADOR com o caminho do .exe.")
        return 2

    resultado: dict = {}
    recebido = threading.Event()

    class Tratador(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path != "/testes.html":
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self.end_headers()
            self.wfile.write(html)

        def do_POST(self):
            corpo = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            if self.path == "/resultado":
                resultado.update(json.loads(corpo))
                recebido.set()
            self.send_response(204)
            self.end_headers()

        def log_message(self, *args):
            pass

    servidor = ThreadingHTTPServer(("127.0.0.1", 0), Tratador)
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{servidor.server_address[1]}/testes.html"

    perfil = tempfile.mkdtemp(prefix="testes_ferias_")
    processo = subprocess.Popen(
        [navegador, "--headless=new", f"--user-data-dir={perfil}", "--no-first-run",
         "--no-default-browser-check", "--disable-extensions", "--disable-sync", url],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        if not recebido.wait(TEMPO_LIMITE):
            print(f"Os testes não terminaram em {TEMPO_LIMITE} segundos.")
            return 1
    finally:
        processo.terminate()
        try:
            processo.wait(10)
        except subprocess.TimeoutExpired:
            processo.kill()
        servidor.shutdown()
        shutil.rmtree(perfil, ignore_errors=True)

    if resultado.get("erro_fatal"):
        print("Erro ao rodar os testes:", resultado["erro_fatal"])
        return 1

    casos = resultado.get("resultados", [])
    grupo_atual = None
    falhas = 0
    for c in casos:
        if c["grupo"] != grupo_atual:
            grupo_atual = c["grupo"]
            print(f"\n{grupo_atual}")
        if c["ok"]:
            print(f"  ok     {c['nome']}")
        else:
            falhas += 1
            print(f"  FALHOU {c['nome']}\n         {c['erro']}")

    print(f"\n{len(casos) - falhas} de {len(casos)} testes passaram ({Path(navegador).stem}).")
    return 0 if falhas == 0 and casos else 1


if __name__ == "__main__":
    sys.exit(main())
