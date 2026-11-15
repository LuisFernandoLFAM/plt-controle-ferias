# Fase 1: banco com migrações e cadastros

> **Instrução para o Claude Code:** este texto é a spec completa da Fase 1.
> 1. Salve este texto inteiro, sem mudanças, em `docs/specs/FASE_1.md`.
> 2. Execute o "Passo 0: atualizar documentação".
> 3. Depois, execute as tarefas da fase, na ordem.

## Passo 0: atualizar documentação

1. Substitua todo o conteúdo de `docs/DECISOES.md` pelo **Anexo A** (sem a linha de abertura e a de fechamento do bloco de código).
2. No `CLAUDE.md`, adicione a seção do **Anexo B** logo depois da seção "Como as specs chegam", se ela ainda não existir.
3. Mostre um resumo curto do que mudou em cada arquivo.

## Objetivo

Trocar a tela de teste da Fase 0 pelos cadastros reais do app:

1. Clientes e centros de custo.
2. Times, com limite de ausências e tolerância em dias (D26), mostrando a ocupação (D43).
3. Funcionários: incluir, editar, desligar, reativar e excluir (D10, D40, D41).
4. Pares de substitutos (D14).

E deixar o banco pronto para crescer nas próximas fases sem perder dados (D38).

Leia antes: D10, D14, D26, D37 a D44 no `docs/DECISOES.md`.

## Tarefas

### 1. Migrações do banco (D38, D39)

- Crie `sql/migracoes/001_inicial.sql` com o esquema do **Anexo C**. Você pode ajustar tipos, índices e `CHECK`, mas mantenha os nomes de tabelas e colunas. Diga o que ajustou.
- Mova o `sql/schema.sql` atual para `scripts/referencia/schema_v0.sql`. Ele vira só referência.
- O `build.py` embute todas as migrações, em ordem.
- Ao criar ou abrir um banco, o app:
  - Lê `PRAGMA user_version`.
  - Se for menor que a versão do app: faz backup em `backups/` com o sufixo `_antes_migracao`, aplica as migrações que faltam numa transação e atualiza o `user_version`. Se der erro, desfaz tudo e mostra a mensagem.
  - Se for maior que a versão do app: mostra "Este banco foi criado por uma versão mais nova do app. Use o arquivo mais recente." e não abre.
  - Se for um banco da Fase 0 (`user_version` = 0 com a tabela `cliente` antiga): mostra "Este é um banco de teste antigo. Escolha uma pasta nova." e não altera nada.

### 2. Data e hora (D37)

- O banco grava data e hora em UTC, no formato `AAAA-MM-DDTHH:MM:SSZ`.
- Crie uma função única de formatação. A tela e o Excel espelho mostram datas como `dd/mm/aaaa` e data e hora como `dd/mm/aaaa hh:mm`, no horário de Brasília (`America/Sao_Paulo`).
- Datas sem hora (admissão, desligamento) são gravadas como `AAAA-MM-DD`, sem conversão de fuso.

### 3. Navegação

Troque a tela de teste por um menu com 4 telas: **Funcionários**, **Times**, **Substitutos** e **Histórico**. O rodapé com a pasta e a última gravação continua.

### 4. Tela Times

- Seção "Clientes e centros de custo": incluir e editar cliente (nome) e centro de custo (código, cliente, município, UF).
- Lista de times agrupada por cliente e centro de custo. Colunas: time, pessoas ativas, limite, tolerância (dias), ocupação.
- Ocupação = (pessoas ativas × 30) ÷ (limite × 365), em %. Cores: até 50% verde, de 50% a 70% amarelo, acima de 70% vermelho (D43).
- Incluir e editar time: centro de custo, nome, limite (mínimo 1), tolerância em dias (mínimo 0).
- Um time com pessoas ativas não pode ser excluído. Ele pode ser marcado como inativo só quando não tem pessoas ativas.

### 5. Tela Funcionários

- Lista com busca por nome ou matrícula e filtros por time e situação (Ativos, que é o padrão, Desligados e Todos).
- Formulário de inclusão e edição:
  - Matrícula: obrigatória e única (D40).
  - Nome: obrigatório.
  - Data de admissão: obrigatória e não pode ser futura.
  - Time: obrigatório.
  - E-mail: opcional. Se preenchido, precisa ter formato válido.
  - Observação: opcional.
- **Desligar:** pede a data de desligamento (não pode ser anterior à admissão). O funcionário sai da lista padrão e do cálculo de ocupação.
- **Reativar:** volta para ativo e limpa a data de desligamento.
- **Excluir:** só aparece para quem não tem nenhum registro em `ferias_periodo` nem em `regra_substituto`. Pede confirmação: "Excluir definitivamente? Use só para cadastro feito por engano." (D41).
- As mensagens de erro aparecem ao lado do campo, em português simples.

### 6. Tela Substitutos

- Lista de pares: pessoa 1, pessoa 2, tolerância (dias), motivo.
- Incluir e editar: duas listas de funcionários ativos, tolerância (mínimo 0) e motivo.
- Não permite a mesma pessoa nos dois lados, nem um par repetido, em qualquer ordem. Grave sempre o menor `id` em `funcionario_a_id`.
- Se um funcionário do par for desligado, o par fica inativo e aparece marcado na lista.

### 7. Histórico

- Toda inclusão, edição, desligamento, reativação e exclusão grava em `historico_alteracao`, com antes e depois em JSON.
- A tela Histórico mostra as 100 alterações mais recentes, com filtro por tabela. Data e hora no horário de Brasília.

### 8. Excel espelho

Troque as abas técnicas por abas legíveis:

| Aba | Colunas |
|---|---|
| Leia-me | Aviso e data de geração (já existe) |
| Funcionários | Matrícula, Nome, Admissão, Cliente, Centro de custo, Time, E-mail, Situação, Desligamento |
| Times | Cliente, Centro de custo, Time, Pessoas ativas, Limite, Tolerância (dias), Ocupação |
| Substitutos | Pessoa 1, Pessoa 2, Tolerância (dias), Motivo, Situação |
| Histórico | Data e hora, Ação, Tabela, Registro, Dados |

Datas no formato brasileiro, como na tela.

### 9. Dados de exemplo (D44)

- Amplie `scripts/gerar_dados_ficticios.py` para gerar também `data/exemplo/cadastro_exemplo.json`, com clientes, centros de custo, times (com limite e tolerância), funcionários e um par de substitutos. Use os mesmos nomes fictícios da planilha de exemplo, matrículas fictícias e e-mails no domínio `exemplo.com`.
- Use o `config/regras_iniciais.exemplo.json` como base. Se ele ficar redundante, proponha removê-lo.
- O `build.py` embute o JSON. Em banco vazio (sem funcionários), a tela Funcionários mostra o botão "Carregar dados de exemplo". Em banco com dados, o botão não aparece.

### 10. Testes automáticos

- Crie testes para: migração (banco novo, banco antigo, banco da Fase 0, banco de versão mais nova), cálculo de ocupação, validações do funcionário, regras de substitutos, formatação de data e hora e histórico.
- Use a mesma forma de teste automático da Fase 0. Tudo roda com um comando só, documentado em `tests/README.md` e no `CLAUDE.md`.
- O gestor não precisa instalar nada para usar o app. Ferramentas de teste são só para desenvolvimento.

### 11. Preparar o teste manual

Prepare tudo para o usuário fazer só os cliques (ver Anexo B):

1. Crie a pasta vazia `%USERPROFILE%\Documents\Ferias_fase1` (pasta Documents local, não a do OneDrive).
2. Gere o build e abra `dist\controle_ferias.html` no Edge (`file://`).
3. Passe ao usuário este roteiro, com o caminho da pasta:
   1. Escolher a pasta e criar o banco.
   2. Clicar em "Carregar dados de exemplo".
   3. Na tela Times, mudar o limite de um time e ver a ocupação mudar.
   4. Editar um funcionário (mudar o time).
   5. Desligar um funcionário e conferir o filtro "Desligados".
   6. Criar um par de substitutos.
   7. Fechar o Edge, abrir de novo e conferir se está tudo lá.
   8. Dizer "terminei".
4. Quando o usuário disser "terminei": confira o banco (integridade, `user_version`, histórico), abra o `ferias_espelho.xlsx` no Excel e informe o resultado.

### 12. README e commit

- Atualize o `README.md` (o que o app já faz e como testar).
- Rode os testes, rode `git status` e confira as regras de privacidade.
- Proponha a mensagem de commit e espere o "ok". Depois do commit, pergunte se pode fazer o push.

## Critérios de aceite

| Nº | Critério |
|---|---|
| A1 | `python scripts/build.py` gera o arquivo único com menos de 5 MB. |
| A2 | Banco novo recebe a migração 001 e fica com `user_version` = 1. |
| A3 | Banco da Fase 0 mostra a mensagem do item 1 e não é alterado. Banco de versão mais nova também não abre. |
| A4 | Ocupação certa e com a cor certa. Exemplos: 8 pessoas com limite 2 dá 33% (verde); 16 pessoas com limite 2 dá 66% (amarelo). |
| A5 | Matrícula repetida, e-mail inválido e admissão futura são bloqueados com mensagem clara. |
| A6 | Editar um funcionário grava o antes e o depois no histórico. |
| A7 | Desligar tira a pessoa da lista padrão e da ocupação. Reativar devolve. |
| A8 | Excluir só aparece para quem não tem férias nem par de substituto, e pede confirmação. |
| A9 | Par de substitutos: bloqueia a mesma pessoa dos dois lados e o par repetido em qualquer ordem. |
| A10 | Tela e Excel espelho mostram data e hora no horário de Brasília. |
| A11 | O Excel espelho tem as 5 abas legíveis do item 8. |
| A12 | "Carregar dados de exemplo" só aparece em banco vazio e carrega os dados fictícios. |
| A13 | Todos os testes automáticos passam com um comando só. |
| A14 | Sem nenhuma requisição externa. |
| A15 | `git status` não mostra nada de `privado/`, nem `*.sqlite`, nem planilha fora de `data/exemplo/`. |
| A16 | Teste manual do item 11 feito pelo usuário, com os dados intactos depois de reabrir. |

## Fora do escopo

Importação do relatório da contabilidade e da planilha de programação (Fase 2), regras e lançamento de férias (Fase 3), alertas e Gantt (Fase 4) e o visual final.

---

## Anexo A: conteúdo completo de `docs/DECISOES.md`

````markdown
# Registro de decisões

Este arquivo guarda todas as decisões do projeto. Cada decisão tem um número, um status e um motivo.

- **Decidido**: está valendo. O código deve seguir.
- **Provisório**: está valendo até chegar a resposta do gestor.
- **Proposto**: recomendação ainda sem aprovação.
- **Aberto**: falta informação.

Atualize este arquivo a cada decisão nova. Não apague decisões antigas: marque como "Substituída por Dxx".

> Repositório público: este arquivo usa somente nomes genéricos. Não escreva aqui nomes de pessoas, clientes ou centros de custo reais. Os nomes reais ficam na pasta `privado/`.

## Regras de negócio

| Nº | Status | Decisão | Motivo |
|---|---|---|---|
| D01 | Decidido | A fonte oficial dos funcionários ativos e dos prazos é o relatório de férias da contabilidade. | É o dado mais atual. |
| D02 | Decidido | Funcionário que está na planilha antiga e não está no relatório é tratado como desligado. O histórico fica. | O relatório só lista quem está na empresa. |
| D03 | Decidido | "Data Limite" é o último dia para **iniciar** as férias. Se a data for um dia vedado, o app sugere a data válida anterior. | Confirmado pelo gestor e pelo relatório. |
| D04 | Decidido | Quem vende 10 dias tira os 20 dias restantes de uma vez (sem dividir). | Limitação do sistema da contabilidade. |
| D05 | Decidido | Sem venda: até 3 períodos. Um período tem no mínimo 14 dias. Os outros têm no mínimo 5 dias. | CLT, art. 134, §1º. |
| D06 | Decidido | O descanso semanal é no domingo para todos. As férias não podem iniciar nos 2 dias antes de domingo ou feriado. | CLT, art. 134, §3º. |
| D07 | Decidido | Sem convenção coletiva, sem controle de faltas e sem férias coletivas. | Resposta do gestor. |
| D08 | Decidido | O aviso de férias é emitido 35 dias antes do início. O pagamento é feito 4 dias antes do início. | Prática atual da empresa (a CLT exige 30 e 2 dias). |
| D09 | Decidido | Alerta de vencimento com 90 dias de antecedência. O valor é configurável. | Resposta do gestor. |
| D10 | Decidido | Funcionário desligado não é apagado. A exclusão definitiva é só para cadastro feito por engano. | Manter histórico. |

## Times, limites e substitutos

Método da sugestão: ocupação = (pessoas × 30 dias) ÷ (limite × 365 dias). Até 50%: confortável. De 50% a 70%: apertado. Acima de 100%: impossível.

| Nº | Status | Time (nome genérico) | Pessoas | Limite | Ocupação |
|---|---|---|---|---|---|
| D11 | Decidido | Contrato A, Suprimentos e Orçamento | 4 | 1 | 33% |
| D12 | Provisório | Contrato A, Fiscalização | 8 | 2 | 33% |
| D13a | Provisório | Contrato B, Administrativo | 16 | 3 | 44% |
| D13b | Provisório | Contrato B, Operacional | 5 | 1 | 41% |
| D13c | Provisório | Contrato C (Externa e Interna juntas, um time só) | 5 | 1 | 41% |
| D13d | Provisório | Escritório | 3 | 1 | 25% |

| Nº | Status | Decisão |
|---|---|---|
| D14 | Provisório | Regra de substitutos: o gestor do contrato (time Fiscalização) e o preposto (time Suprimentos) não podem estar de férias ao mesmo tempo. Tolerância provisória: 0 dias. O app aceita outros pares no futuro. |
| D26 | Decidido | Cada limite tem uma "tolerância em dias". Acima do limite: alerta amarelo se o excesso dura até a tolerância; alerta vermelho se dura mais. O app avisa e não bloqueia. O gestor decide. |
| D27 | Aberto | Respostas do gestor sobre limites, tolerâncias e composição dos times. Enquanto não chegam, o desenvolvimento usa os valores provisórios acima. Quando chegarem, só a configuração muda (o código não muda). |

## Tecnologia e arquitetura

| Nº | Status | Decisão | Motivo |
|---|---|---|---|
| D15 | Decidido | O app é uma página HTML que abre no navegador (Edge ou Chrome). Não precisa instalar nada no computador do gestor. | O computador da empresa pode exigir senha de administrador. |
| D16 | Decidido | O banco de dados é um arquivo SQLite (`.sqlite`), usado dentro do navegador pela biblioteca sql.js. O gestor escolhe a pasta do arquivo (pode ser no OneDrive). O app grava o arquivo e faz cópias de segurança. | Banco real com SQL e chaves. Reaproveita o `sql/schema.sql`. Volume pequeno (menos de 100 pessoas). |
| D16b | Decidido | O Excel não é o banco. A cada gravação, o app gera um Excel "espelho" (somente leitura) na mesma pasta. | O gestor consegue abrir os dados no Excel. O Power Automate consegue ler o espelho no futuro. Editar o Excel à mão não quebra o banco. |
| D17 | Decidido | As bibliotecas (sql.js, SheetJS para ler e gerar Excel) ficam embutidas no arquivo final. | O app funciona mesmo se a rede bloquear sites externos. |
| D18 | Decidido | O app usa JavaScript, que é a linguagem do navegador. O Python fica para as ferramentas de desenvolvimento: dados fictícios, montagem (build) do arquivo final e testes de dados. | Python no navegador (Pyodide) pesa mais de 10 MB e demora para abrir. Para este volume de dados, o JavaScript é rápido. |
| D19 | Decidido | O gestor é o único usuário. Os funcionários não acessam o app. | Resposta do gestor. |
| D20 | Decidido | O app não depende do Power Automate. O fluxo diário que o gestor já tem pode continuar. O Excel espelho (D16b) permite ligar esse fluxo ao app no futuro, se ele quiser. | O gestor prefere uma ferramenta só. A porta fica aberta. |
| D21 | Decidido | Pedidos de férias (fase futura), **sem Power Automate**: o funcionário preenche um Microsoft Forms padrão → o Forms grava as respostas sozinho num Excel do OneDrive e avisa o gestor por e-mail → o app lê esse Excel pela pasta sincronizada e confere as regras → o gestor decide no app → o app abre um e-mail pronto no Outlook do gestor (D32). Substitui a versão anterior, que usava Power Automate. | O gestor não precisa manter fluxos no Power Automate. Menos peças, menos pontos de falha. |
| D29 | Decidido | O formulário é aberto (qualquer pessoa com o link responde). O funcionário informa matrícula e nome. Ele **não digita o e-mail**. O app encontra o e-mail no cadastro pela matrícula. | Evita erro de digitação. A resposta vai sempre para o dono da matrícula. |
| D30 | Decidido | O e-mail pessoal de cada funcionário é um campo do cadastro no app. A lista inicial vem do gestor. | Dado pessoal: fica só no banco do gestor e em `privado/`, nunca no repositório. |
| D31 | Decidido | Matrícula que não existe no cadastro: o pedido aparece como "não identificado" e o botão de resposta fica desligado. | Não enviar resposta para endereço desconhecido. |
| D32 | Decidido | Resposta ao funcionário: botão "Responder por e-mail" no app. Ele abre o Outlook do gestor com destinatário, assunto e texto prontos (link `mailto:`). O gestor revisa e clica em Enviar. | Funciona sem internet no app e sem Power Automate. O gestor sempre revisa antes de enviar. |
| D33 | Decidido | Limites do `mailto:`: só texto simples, sem anexo, até cerca de 1.500 caracteres. O texto da resposta é curto: decisão, datas, prazo de assinatura do aviso. O e-mail sai da conta padrão do Outlook do gestor. | Limitação do Windows e dos navegadores. |
| D34 | Aberto | Testar na fase do formulário: o Excel do Forms sincroniza na pasta do OneDrive do gestor? Qual é o app de e-mail padrão no computador dele (Outlook clássico ou novo)? | Os dois pontos dependem da configuração do computador. |
| D28 | Decidido | O código fica em `app/` (vários arquivos, fácil de manter). O script `scripts/build.py` junta tudo num único arquivo `dist/controle_ferias.html`, que é o que vai para o gestor. | Fácil de desenvolver e fácil de entregar. |
| D37 | Decidido | O banco grava data e hora em UTC (padrão do SQLite). A tela e o Excel espelho mostram sempre o horário de Brasília, no formato dd/mm/aaaa hh:mm. | No teste da Fase 0, o espelho mostrou 01:23 (UTC) para uma ação feita às 22:23. |
| D38 | Decidido | O banco tem versão (`PRAGMA user_version`). As mudanças de estrutura ficam em `sql/migracoes/NNN_nome.sql`. Ao abrir um banco antigo, o app faz backup e aplica as migrações que faltam, numa transação. Banco de versão mais nova que o app: o app avisa e não abre. | O gestor vai ter dados reais. Mudar o banco nas próximas fases não pode perder nada. |
| D39 | Decidido | Bancos de teste da Fase 0 não são migrados. O app reconhece e pede uma pasta nova. | Só existem dados de teste nesses bancos. |
| D40 | Decidido | A matrícula identifica o funcionário: obrigatória e única. Ela vem do campo "Código" do relatório da contabilidade. | É a chave usada no formulário de pedidos (D29) e na importação (Fase 2). |
| D41 | Decidido | Exclusão definitiva de funcionário: só se ele não tem nenhuma férias registrada, com confirmação. Nos outros casos, o app oferece "Desligar". | Complementa D10. |
| D42 | Decidido | Status das férias: o banco guarda só "programado" ou "cancelado". "Em andamento" e "concluído" são calculados pelas datas, na hora de mostrar. | Na planilha antiga, o status gravado ficava desatualizado. |
| D43 | Decidido | A tela de times mostra a ocupação (método das D11 a D13): até 50% verde, de 50% a 70% amarelo, acima de 70% vermelho. | Ajuda o gestor a calibrar os limites. |
| D44 | Decidido | Botão "Carregar dados de exemplo", só em banco vazio. Os dados são fictícios e os e-mails usam o domínio `exemplo.com`. | Demonstração do portfólio e testes sem dados reais. |

## Privacidade

| Nº | Status | Decisão |
|---|---|---|
| D22 | Decidido | O repositório público tem só dados fictícios. Os dados reais ficam na pasta `privado/` (ignorada pelo Git) e no computador do gestor. |
| D23 | Decidido | O desenvolvimento usa dados fictícios. A carga dos dados reais acontece no computador do gestor, pelo próprio app. |

## Forma de trabalho

| Nº | Status | Decisão |
|---|---|---|
| D24 | Decidido | As decisões e as specs são feitas no chat do Projeto Claude. O Claude Code (VS Code) implementa. |
| D25 | Decidido | O trabalho é feito em fases pequenas. Cada fase tem uma spec em `docs/specs/` com critérios de aceite. |
| D35 | Decidido | O usuário não edita nem substitui arquivos à mão. Cada spec chega como um texto único para colar no Claude Code. A spec manda o Claude Code salvar a própria spec, atualizar os arquivos existentes (decisões, CLAUDE.md, README) e criar os novos. |
| D36 | Decidido | Toda spec tem a seção "Passo 0: atualizar documentação" antes das tarefas, e o `docs/DECISOES.md` completo vai num anexo da spec. O anexo substitui o arquivo inteiro. |

## Plano de fases

| Fase | Entrega | Status |
|---|---|---|
| 0 | Estrutura do app, bibliotecas embutidas, prova de gravação do banco SQLite pelo navegador, build do arquivo único, primeiro commit. | Concluída e publicada no GitHub em 14/11/2026. Falta o teste no computador do gestor. |
| 1 | Banco com migrações e cadastro de clientes, centros de custo, times, funcionários e substitutos (incluir, editar, desligar). | Próxima |
| 2 | Importar o relatório da contabilidade e a planilha de programação, com validação. | Pendente |
| 3 | Programação de férias com as regras D03 a D08 e os prazos de aviso e pagamento. | Pendente |
| 4 | Tela "o que fazer hoje", alertas, Gantt e conflitos por time e por substitutos. | Pendente |
| 5 | Excel espelho e pacote de entrega para o gestor, com passo a passo. | Pendente |
| 6+ | Pedidos via Forms e resposta por e-mail (D21, D32) e assistente com IA. | Futuro |
````

## Anexo B: seção para o `CLAUDE.md`

````markdown
## Testes manuais

- Antes de pedir um teste manual ao usuário, prepare tudo o que não exige clique: crie as pastas, gere o build e abra o app no Edge.
- Passe ao usuário um roteiro curto, só com o que exige clique ou decisão dele, com os caminhos exatos.
- Quando ele disser "terminei", confira os arquivos e o banco e informe o resultado.
````

## Anexo C: esquema da migração `sql/migracoes/001_inicial.sql`

````sql
-- 001_inicial.sql
-- Esquema inicial do app de férias (D38).
-- Datas: 'AAAA-MM-DD'. Data e hora: UTC 'AAAA-MM-DDTHH:MM:SSZ' (D37).
-- O app liga foreign_keys na conexão e grava user_version depois de aplicar a migração.


-- Estrutura organizacional ---------------------------------------------

CREATE TABLE cliente (
    id      INTEGER PRIMARY KEY,
    nome    TEXT NOT NULL UNIQUE,
    ativo   INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);

CREATE TABLE centro_custo (
    id          INTEGER PRIMARY KEY,
    codigo      TEXT NOT NULL UNIQUE,
    cliente_id  INTEGER NOT NULL REFERENCES cliente(id),
    municipio   TEXT,
    uf          TEXT,
    ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);

CREATE TABLE time (
    id                  INTEGER PRIMARY KEY,
    centro_custo_id     INTEGER NOT NULL REFERENCES centro_custo(id),
    nome                TEXT NOT NULL,
    limite_ausencias    INTEGER NOT NULL DEFAULT 1 CHECK (limite_ausencias >= 1),
    tolerancia_dias     INTEGER NOT NULL DEFAULT 0 CHECK (tolerancia_dias >= 0),
    ativo               INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    UNIQUE (centro_custo_id, nome)
);

-- Pessoas ----------------------------------------------------------------

CREATE TABLE funcionario (
    id                  INTEGER PRIMARY KEY,
    matricula           TEXT NOT NULL UNIQUE,              -- D40
    nome                TEXT NOT NULL,
    data_admissao       TEXT NOT NULL,
    time_id             INTEGER NOT NULL REFERENCES time(id),
    email               TEXT,                              -- D30
    observacao          TEXT,
    ativo               INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    data_desligamento   TEXT,
    criado_em           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    atualizado_em       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CHECK (ativo = 1 OR data_desligamento IS NOT NULL),
    CHECK (data_desligamento IS NULL OR data_desligamento >= data_admissao)
);

CREATE INDEX ix_funcionario_time ON funcionario(time_id);

-- Pares de substitutos (D14) ----------------------------------------------

CREATE TABLE regra_substituto (
    id                  INTEGER PRIMARY KEY,
    funcionario_a_id    INTEGER NOT NULL REFERENCES funcionario(id),
    funcionario_b_id    INTEGER NOT NULL REFERENCES funcionario(id),
    tolerancia_dias     INTEGER NOT NULL DEFAULT 0 CHECK (tolerancia_dias >= 0),
    motivo              TEXT,
    ativo               INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    CHECK (funcionario_a_id < funcionario_b_id),
    UNIQUE (funcionario_a_id, funcionario_b_id)
);

-- Direito a férias (usado a partir das Fases 2 e 3) --------------------------

CREATE TABLE periodo_aquisitivo (
    id                  INTEGER PRIMARY KEY,
    funcionario_id      INTEGER NOT NULL REFERENCES funcionario(id),
    inicio              TEXT NOT NULL,
    fim                 TEXT NOT NULL,
    limite_concessivo   TEXT NOT NULL,     -- fim do período concessivo
    data_limite_inicio  TEXT,              -- último dia para iniciar as férias (D03)
    dias_direito        INTEGER NOT NULL DEFAULT 30,
    vendeu_abono        INTEGER CHECK (vendeu_abono IN (0, 1)),
    origem              TEXT NOT NULL,     -- 'relatorio', 'planilha', 'app', 'calculado'
    observacao          TEXT,
    UNIQUE (funcionario_id, inicio)
);

CREATE TABLE ferias_periodo (
    id                      INTEGER PRIMARY KEY,
    periodo_aquisitivo_id   INTEGER NOT NULL REFERENCES periodo_aquisitivo(id),
    ordem                   INTEGER NOT NULL CHECK (ordem BETWEEN 1 AND 3),
    inicio                  TEXT NOT NULL,
    fim                     TEXT NOT NULL,
    dias                    INTEGER NOT NULL CHECK (dias > 0),
    status                  TEXT NOT NULL DEFAULT 'programado'
                            CHECK (status IN ('programado', 'cancelado')),   -- D42
    data_aviso              TEXT,          -- D08: início - 35 dias (editável)
    aviso_emitido           INTEGER NOT NULL DEFAULT 0 CHECK (aviso_emitido IN (0, 1)),
    data_pagamento          TEXT,          -- D08: início - 4 dias (editável)
    pagamento_realizado     INTEGER NOT NULL DEFAULT 0 CHECK (pagamento_realizado IN (0, 1)),
    origem                  TEXT NOT NULL, -- 'planilha', 'app', 'formulario'
    CHECK (fim >= inicio)
);

-- Apoio ----------------------------------------------------------------------

CREATE TABLE feriado (
    data        TEXT NOT NULL,
    nome        TEXT NOT NULL,
    escopo      TEXT NOT NULL CHECK (escopo IN ('nacional', 'estadual', 'municipal')),
    uf          TEXT NOT NULL DEFAULT '',
    municipio   TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (data, escopo, uf, municipio)
);

CREATE TABLE regra_config (
    chave       TEXT PRIMARY KEY,
    valor       TEXT,
    descricao   TEXT NOT NULL
);

INSERT INTO regra_config (chave, valor, descricao) VALUES
    ('alerta_vencimento_dias', '90', 'Antecedência do alerta de vencimento (D09)'),
    ('aviso_antecedencia_dias', '35', 'Dias antes do início para emitir o aviso (D08)'),
    ('pagamento_antecedencia_dias', '4', 'Dias antes do início para o pagamento (D08)'),
    ('abono_permite_fracionar', '0', 'Quem vende 10 dias pode dividir os 20 restantes? 0 = não (D04)'),
    ('dia_descanso', 'domingo', 'Dia de descanso semanal (D06)');

-- Auditoria ------------------------------------------------------------------

CREATE TABLE historico_alteracao (
    id              INTEGER PRIMARY KEY,
    tabela          TEXT NOT NULL,
    registro_id     INTEGER NOT NULL,
    acao            TEXT NOT NULL CHECK (acao IN
                    ('inclusao', 'edicao', 'exclusao', 'desligamento', 'reativacao')),
    dados_antes     TEXT,              -- JSON
    dados_depois    TEXT,              -- JSON
    usuario         TEXT NOT NULL DEFAULT 'gestor',
    em              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX ix_historico_em ON historico_alteracao(em);
````
