# Bibliotecas de terceiros

Estes arquivos são embutidos em `dist/controle_ferias.html` por `scripts/build.py`. Nada é baixado da internet quando o app roda (D17).

Para conferir um arquivo: `sha256sum vendor/<arquivo>` (Git Bash) ou `Get-FileHash vendor\<arquivo>` (PowerShell).

| Arquivo | Biblioteca | Versão | Origem | Licença | SHA-256 |
|---|---|---|---|---|---|
| `sql-wasm.js` | sql.js | 1.16.0 | https://github.com/sql-js/sql.js/releases/download/v1.16.0/sqljs-wasm.zip | MIT | `9b96118841c6edfdf53c6f388c1419d1f473cf469df6a6fc2864b386d60bdb5e` |
| `sql-wasm.wasm` | sql.js | 1.16.0 | https://github.com/sql-js/sql.js/releases/download/v1.16.0/sqljs-wasm.zip | MIT | `43bbcdd44287e5a2db3b6b5af34b1a3485a7a441285d247976c1ebe3c61f8dbf` |
| `xlsx.full.min.js` | SheetJS Community Edition | 0.20.3 | https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js | Apache-2.0 | `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41` |

Notas:

- sql.js: os dois arquivos vêm do mesmo zip da release v1.16.0 (baixada em 14/11/2026).
- SheetJS: baixado de `cdn.sheetjs.com`, e não do npm, porque a versão do npm está desatualizada.

## Como atualizar

1. Baixe a nova versão das mesmas origens.
2. Substitua o arquivo em `vendor/`.
3. Atualize versão, origem e SHA-256 nesta tabela.
4. Rode `python scripts/build.py` e teste o app.
