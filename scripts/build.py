"""Monta o arquivo único dist/controle_ferias.html (D17, D28).

Junta app/index.html com os CSS e JS de app/, as bibliotecas de vendor/,
o sql-wasm.wasm (em base64) e o sql/schema.sql. O resultado não carrega
nada da internet nem de outros arquivos.

Uso:  python scripts/build.py
Só usa a biblioteca padrão do Python.
"""

from __future__ import annotations

import base64
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
APP = RAIZ / "app"
VENDOR = RAIZ / "vendor"
SCHEMA = RAIZ / "sql" / "schema.sql"
SAIDA = RAIZ / "dist" / "controle_ferias.html"

LIMITE_MB = 5.0

# Bloqueia qualquer acesso à rede no arquivo final (critério A6).
# 'wasm-unsafe-eval' é necessário para o sql.js rodar o WebAssembly.
CSP = (
    "default-src 'none'; "
    "script-src 'unsafe-inline' 'wasm-unsafe-eval'; "
    "style-src 'unsafe-inline'; "
    "img-src data:; "
    "connect-src 'none'; "
    "form-action 'none'; "
    "base-uri 'none'"
)

RE_CSS = re.compile(r'<link rel="stylesheet" href="([^"]+)">')
RE_JS = re.compile(r'<script src="([^"]+)"></script>')


class ErroBuild(Exception):
    pass


def ler_local(relativo: str) -> str:
    """Lê um arquivo referenciado pelo index.html (caminho relativo a app/)."""
    caminho = (APP / relativo).resolve()
    if RAIZ not in caminho.parents:
        raise ErroBuild(f"caminho fora do projeto: {relativo}")
    if not caminho.is_file():
        raise ErroBuild(f"arquivo não encontrado: {relativo}")
    return caminho.read_text(encoding="utf-8")


def proteger_script(codigo: str) -> str:
    """Evita que o conteúdo do JS feche a tag <script> antes da hora.

    Nos arquivos atuais, esses trechos só aparecem dentro de textos entre aspas,
    onde '<\\/' e '<\\!' valem o mesmo que '</' e '<!'.
    """
    codigo = re.sub(r"</(script)", r"<\\/\1", codigo, flags=re.IGNORECASE)
    return codigo.replace("<!--", "<\\!--")


def substituir_uma_vez(html: str, marcador: str, conteudo: str) -> str:
    if html.count(marcador) != 1:
        raise ErroBuild(f"o index.html deve ter o marcador {marcador} exatamente uma vez")
    return html.replace(marcador, conteudo)


def montar() -> str:
    html = (APP / "index.html").read_text(encoding="utf-8")

    html = RE_CSS.sub(lambda m: f"<style>\n{ler_local(m.group(1))}\n</style>", html)
    html = RE_JS.sub(lambda m: f"<script>\n{proteger_script(ler_local(m.group(1)))}\n</script>", html)

    wasm_b64 = base64.b64encode((VENDOR / "sql-wasm.wasm").read_bytes()).decode("ascii")
    schema = json.dumps(SCHEMA.read_text(encoding="utf-8"), ensure_ascii=False)
    dados = (
        "<script>\n"
        f'window.WASM_BASE64 = "{wasm_b64}";\n'
        f"window.SCHEMA_SQL = {proteger_script(schema)};\n"
        "</script>"
    )
    html = substituir_uma_vez(html, "<!-- build:dados -->", dados)
    html = substituir_uma_vez(
        html, "<!-- build:csp -->", f'<meta http-equiv="Content-Security-Policy" content="{CSP}">'
    )

    restantes = RE_CSS.findall(html) + RE_JS.findall(html)
    if restantes:
        raise ErroBuild(f"referências não embutidas: {restantes}")
    return html


def main() -> int:
    try:
        html = montar()
    except ErroBuild as e:
        print(f"Erro no build: {e}", file=sys.stderr)
        return 1

    SAIDA.parent.mkdir(exist_ok=True)
    SAIDA.write_text(html, encoding="utf-8", newline="\n")

    tamanho_mb = SAIDA.stat().st_size / (1024 * 1024)
    print(f"Gerado: {SAIDA.relative_to(RAIZ).as_posix()} ({tamanho_mb:.2f} MB)")
    if tamanho_mb >= LIMITE_MB:
        print(f"ATENÇÃO: o arquivo passou de {LIMITE_MB:.0f} MB.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
