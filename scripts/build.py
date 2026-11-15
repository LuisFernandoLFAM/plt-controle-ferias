"""Monta o arquivo único dist/controle_ferias.html (D17, D28).

Junta app/index.html com os CSS e JS de app/, as bibliotecas de vendor/,
o sql-wasm.wasm (em base64), as migrações de sql/migracoes/ (em ordem) e o
cadastro de exemplo de data/exemplo/. O resultado não carrega nada da
internet nem de outros arquivos.

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
MIGRACOES = RAIZ / "sql" / "migracoes"
EXEMPLO = RAIZ / "data" / "exemplo" / "cadastro_exemplo.json"
SAIDA = RAIZ / "dist" / "controle_ferias.html"

LIMITE_MB = 5.0

# Bloqueia qualquer acesso à rede no arquivo final (D17).
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
RE_MIGRACAO = re.compile(r"^(\d{3})_[a-z0-9_]+\.sql$")


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


def ler_migracoes() -> list[dict]:
    """Migrações em ordem. Os números precisam ser 001, 002, 003... sem buracos (D38)."""
    lista = []
    for caminho in sorted(MIGRACOES.glob("*.sql")):
        m = RE_MIGRACAO.match(caminho.name)
        if not m:
            raise ErroBuild(f"nome de migração fora do padrão NNN_nome.sql: {caminho.name}")
        lista.append({"versao": int(m.group(1)), "nome": caminho.stem,
                      "sql": caminho.read_text(encoding="utf-8")})
    if not lista:
        raise ErroBuild("nenhuma migração em sql/migracoes/")
    esperadas = list(range(1, len(lista) + 1))
    if [m["versao"] for m in lista] != esperadas:
        raise ErroBuild("as migrações precisam ser numeradas em sequência a partir de 001")
    return lista


def script_dados() -> str:
    wasm_b64 = base64.b64encode((VENDOR / "sql-wasm.wasm").read_bytes()).decode("ascii")
    migracoes = json.dumps(ler_migracoes(), ensure_ascii=False)
    exemplo = json.dumps(json.loads(EXEMPLO.read_text(encoding="utf-8")), ensure_ascii=False)
    return (
        "<script>\n"
        f'window.WASM_BASE64 = "{wasm_b64}";\n'
        f"window.MIGRACOES = {proteger_script(migracoes)};\n"
        f"window.DADOS_EXEMPLO = {proteger_script(exemplo)};\n"
        "</script>"
    )


def montar(csp: str = CSP, scripts_extras: list[Path] | None = None) -> str:
    """Monta o HTML único. Os testes usam csp e scripts_extras (tests/rodar_testes.py)."""
    html = (APP / "index.html").read_text(encoding="utf-8")

    html = RE_CSS.sub(lambda m: f"<style>\n{ler_local(m.group(1))}\n</style>", html)
    html = RE_JS.sub(lambda m: f"<script>\n{proteger_script(ler_local(m.group(1)))}\n</script>", html)

    html = substituir_uma_vez(html, "<!-- build:dados -->", script_dados())
    html = substituir_uma_vez(
        html, "<!-- build:csp -->", f'<meta http-equiv="Content-Security-Policy" content="{csp}">'
    )

    restantes = RE_CSS.findall(html) + RE_JS.findall(html)
    if restantes:
        raise ErroBuild(f"referências não embutidas: {restantes}")

    if scripts_extras:
        extras = "".join(
            f"<script>\n{proteger_script(p.read_text(encoding='utf-8'))}\n</script>\n" for p in scripts_extras
        )
        fim = html.rfind("</body>")  # o último: o SheetJS tem "</body>" dentro do próprio código
        html = html[:fim] + extras + html[fim:]
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
