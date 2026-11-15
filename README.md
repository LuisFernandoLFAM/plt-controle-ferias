# Controle de Férias: do Excel para uma solução de dados

App para o gestor de uma prestadora de serviços controlar as férias de funcionários alocados em diferentes clientes. O app aplica as regras da CLT, acompanha os prazos de aviso e pagamento e avisa quando um time fica descoberto.

> Projeto de portfólio em Engenharia de Dados e IA. Todos os dados deste repositório são **fictícios**.

## O problema

O controle era feito numa planilha Excel: cadastro de funcionários, um Gantt em formatação condicional e um alerta quando muitas pessoas do mesmo time saíam juntas. A planilha tinha limites: regras espalhadas em fórmulas, uma aba por ano, nenhum histórico e nenhum cálculo automático de prazos.

## A solução (em construção)

Um arquivo HTML único que abre no navegador, sem instalar nada:

| Parte | Tecnologia |
|---|---|
| Interface | HTML, CSS e JavaScript |
| Banco de dados | SQLite rodando no navegador (sql.js), gravado numa pasta do usuário |
| Planilhas | SheetJS: importa os relatórios e gera um Excel espelho |
| Ferramentas de desenvolvimento | Python: dados fictícios e montagem do arquivo final |

Como funciona:

- O usuário escolhe uma pasta no computador (pode ser no OneDrive). O app guarda nela o banco `ferias.sqlite`, o `ferias_espelho.xlsx` e a pasta `backups/`.
- O banco roda em memória no navegador e é gravado na pasta depois de cada alteração. O navegador grava num arquivo temporário e só depois troca o arquivo principal, então uma falha no meio não corrompe o banco.
- Ao abrir um banco, o app faz uma cópia em `backups/` e mantém as 30 mais novas.
- As bibliotecas e o WebAssembly do SQLite ficam embutidos no HTML final. Uma política de segurança (CSP) bloqueia qualquer acesso à rede.
- Funciona no Edge e no Chrome, inclusive aberto por duplo clique (`file://`). Firefox e Safari não têm a API de acesso a pastas.

As decisões do projeto, com os motivos, estão em [`docs/DECISOES.md`](docs/DECISOES.md). As especificações de cada fase estão em [`docs/specs/`](docs/specs/).

## Estrutura

```
app/          código do app (HTML, CSS, JS)
dist/         arquivo final gerado pelo build: ignorado pelo Git
vendor/       bibliotecas de terceiros, com versão registrada
sql/          modelo de dados (schema.sql)
scripts/      build, dados fictícios e código de referência
config/       configuração de exemplo
data/exemplo/ planilha fictícia
docs/         decisões, specs e guias de entrega
privado/      dados reais: ignorado pelo Git
```

## Como rodar

Requisitos: Python 3.11+ (só para o desenvolvimento) e Microsoft Edge ou Google Chrome. Não usa npm.

```bash
python scripts/build.py                   # gera dist/controle_ferias.html (só biblioteca padrão)
```

Abra `dist/controle_ferias.html` por duplo clique, no Edge ou no Chrome. É esse arquivo único que vai para o gestor.

Durante o desenvolvimento, dá para abrir o código de `app/` sem build, por um servidor local (pelo `file://` o navegador não deixa ler o `.wasm` e o `schema.sql` soltos):

```bash
python -m http.server 8000                # na raiz do projeto
# abra http://localhost:8000/app/
```

Dados fictícios (precisa de `pip install -r requirements-dev.txt`):

```bash
python scripts/gerar_dados_ficticios.py   # planilha fictícia em data/exemplo/
```

As bibliotecas de terceiros, com versão, origem, licença e SHA-256, estão em [`vendor/VERSOES.md`](vendor/VERSOES.md).

## Como testar

- Passo a passo de teste manual (escrito para o gestor): [`docs/entrega/teste_fase0.md`](docs/entrega/teste_fase0.md).
- Critérios de aceite de cada fase: no fim de cada spec em [`docs/specs/`](docs/specs/).

## Privacidade (LGPD)

Dados reais nunca entram no repositório:

1. O `.gitignore` ignora `privado/`, bancos (`*.db`, `*.sqlite`) e planilhas fora de `data/exemplo/`.
2. Um hook de pre-commit bloqueia esses arquivos mesmo se forem adicionados à força. Para ativar após clonar: `git config core.hooksPath .githooks`.

## Roadmap

- [x] Modelo de dados inicial e análise da planilha original
- [x] Fase 0: base técnica (banco no navegador, build em arquivo único)
- [ ] Fase 1: cadastro de funcionários, times, limites e substitutos
- [ ] Fase 2: importação do relatório da contabilidade e da programação
- [ ] Fase 3: programação de férias com regras da CLT e prazos de aviso e pagamento
- [ ] Fase 4: painel do dia, alertas, Gantt e conflitos por time
- [ ] Fase 5: Excel espelho e pacote de entrega
- [ ] Futuro: pedidos via Microsoft Forms, resposta por e-mail e assistente com IA
