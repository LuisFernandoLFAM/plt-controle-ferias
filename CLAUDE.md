# Contexto do projeto para o Claude Code

App de controle de férias para o gestor de uma prestadora de serviços. Também é projeto de portfólio público (Engenharia de Dados e IA).

Antes de qualquer tarefa, leia:

1. `docs/DECISOES.md`: todas as decisões do projeto. Siga as que estão como "Decidido" ou "Provisório".
2. A spec da fase atual em `docs/specs/` (ex.: `FASE_0.md`).

## Como as specs chegam

- O usuário cola a spec inteira aqui no chat. Salve a spec em `docs/specs/` com o nome indicado no topo dela.
- Toda spec começa pelo "Passo 0: atualizar documentação". Faça esse passo antes das tarefas.
- O usuário não edita nem substitui arquivos à mão. Quando um arquivo existente precisa mudar, a spec diz o que mudar e você faz a mudança.
- O Anexo com o `docs/DECISOES.md` sempre substitui o arquivo inteiro.

Se uma tarefa entrar em conflito com `docs/DECISOES.md`, pare e pergunte. Não decida sozinho.

## Regras de privacidade (inegociáveis)

- O repositório é PÚBLICO. Nunca coloque nomes de funcionários, clientes ou centros de custo reais em código, testes, docs, commits ou mensagens.
- Tudo que é real fica em `privado/` (ignorada pelo Git). Você pode LER esses arquivos quando eu pedir, mas nunca copie o conteúdo deles para arquivos versionados.
- Para exemplos, testes e demonstrações, use apenas `data/exemplo/` e `config/regras_iniciais.exemplo.json`. Se precisar de mais casos, amplie `scripts/gerar_dados_ficticios.py`.
- Antes de qualquer commit, rode `git status` e confirme que nada de `privado/`, `*.db`, `*.sqlite` ou planilhas fora de `data/exemplo/` está no stage.
- Nunca use `git add -f` nem desative o hook de pre-commit.
- Nunca faça `git push` sem me perguntar antes.

## Stack (ver D15 a D18 e D28)

- App: HTML, CSS e JavaScript puro (sem framework, sem npm obrigatório). Código-fonte em `app/`.
- Banco: SQLite no navegador com sql.js. O arquivo `.sqlite` é gravado pela File System Access API (Edge e Chrome).
- Excel: SheetJS para ler planilhas (.xls e .xlsx) e gerar o Excel espelho.
- Bibliotecas de terceiros ficam em `vendor/`, com a versão anotada em `vendor/VERSOES.md`. Nada é carregado da internet quando o app roda.
- Build: `python scripts/build.py` junta `app/` e `vendor/` num arquivo único `dist/controle_ferias.html` (bibliotecas e wasm embutidos).
- Python (3.11+) só para ferramentas de desenvolvimento: build, dados fictícios e testes de dados.
- Modelo de dados: `sql/schema.sql` (será revisado na Fase 1).

## Convenções

- Nomes de tabelas, colunas, funções e textos da interface em português.
- Datas gravadas como texto ISO (AAAA-MM-DD) e exibidas como dd/mm/aaaa.
- Toda alteração feita pelo app (cadastro, edição, desligamento) grava em `historico_alteracao`.
- Funcionário que sai é "desligado" (ativo = 0), não apagado.
- O app avisa, não bloqueia: regras quebradas viram alerta e o gestor decide (D26).
- Mensagens da interface curtas e claras, para um usuário não técnico.

## Comandos

```bash
python scripts/gerar_dados_ficticios.py   # planilha fictícia em data/exemplo/
python scripts/build.py                   # gera dist/controle_ferias.html
```

## Entregas para o gestor

Toda versão utilizável vem com um passo a passo para o gestor (arquivos, requisitos e como abrir), escrito para quem não é da área de TI.

## Ao terminar cada fase

1. Confira cada critério de aceite da spec e diga quais passaram.
2. Atualize o `README.md` se algo mudou para quem usa ou instala.
3. Proponha a mensagem de commit e mostre o `git status`. Espere meu "ok".
