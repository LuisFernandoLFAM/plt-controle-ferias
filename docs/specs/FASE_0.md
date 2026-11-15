# Fase 0: estrutura do app e prova de gravação do banco

> **Instrução para o Claude Code:** este texto é a spec completa da Fase 0.
> 1. Salve este texto inteiro, sem mudanças, em `docs/specs/FASE_0.md` (substitua se o arquivo já existir).
> 2. Execute o "Passo 0: atualizar documentação".
> 3. Depois, execute as tarefas da fase, na ordem.

## Passo 0: atualizar documentação

O usuário não edita arquivos à mão (D35). Você faz todas as atualizações abaixo.

1. Se `CLAUDE.md` não existir na raiz da pasta, pare e avise o usuário: a pasta pode estar errada.
2. Substitua todo o conteúdo de `docs/DECISOES.md` pelo conteúdo do **Anexo A** (sem a linha de abertura e a de fechamento do bloco de código).
3. No `CLAUDE.md`, logo depois da lista "Antes de qualquer tarefa, leia", adicione a seção do **Anexo B**, se ela ainda não existir.
4. No `README.md`, confira se o último item do Roadmap diz "Futuro: pedidos via Microsoft Forms, resposta por e-mail e assistente com IA". Se não disser, corrija.
5. Mostre ao usuário um resumo curto do que mudou em cada arquivo.

## Objetivo

Provar que um arquivo HTML único, aberto por duplo clique no Windows, consegue:

1. Criar, abrir e gravar um banco SQLite numa pasta escolhida pelo usuário.
2. Fazer cópia de segurança desse banco.
3. Gerar um Excel espelho dos dados.
4. Funcionar sem internet.

Esta fase não tem regra de férias. Ela testa a base técnica (D15, D16, D16b, D17, D28). Se algum item não funcionar, pare e explique o problema. Não troque a tecnologia sem perguntar.

## Antes de começar

1. Leia `CLAUDE.md` e `docs/DECISOES.md`.
2. Confira o estado da pasta:
   - Se não for repositório Git: rode `git init` e `git config core.hooksPath .githooks`.
   - Se for: rode `git config core.hooksPath .githooks` mesmo assim.
   - Se existirem pastas ou arquivos que não estão na estrutura abaixo (ex.: `src/`, `requirements.txt`, arquivos soltos de versões antigas), liste esses itens e pergunte antes de apagar ou mover.
3. Confirme que `privado/` está ignorada: `git check-ignore privado/qualquer.xlsx` deve responder o caminho.

## Estrutura esperada ao final

```
app/
  index.html
  css/estilo.css
  js/arquivo.js      acesso à pasta, leitura e gravação de arquivos
  js/banco.js        sql.js: criar, abrir, executar, exportar
  js/espelho.js      geração do Excel espelho (SheetJS)
  js/principal.js    tela e eventos
vendor/
  sql-wasm.js
  sql-wasm.wasm
  xlsx.full.min.js
  VERSOES.md         versão, origem, licença e SHA-256 de cada arquivo
scripts/
  build.py
  gerar_dados_ficticios.py   (já existe)
  referencia/                (já existe: código Python antigo, só consulta)
sql/schema.sql               (já existe)
docs/
  DECISOES.md
  specs/FASE_0.md
  entrega/teste_fase0.md     passo a passo para o gestor testar
dist/                        (ignorada pelo Git)
```

## Tarefas

### 1. Bibliotecas em `vendor/`

- sql.js: versão estável mais recente (`sql-wasm.js` e `sql-wasm.wasm`).
- SheetJS Community Edition: `xlsx.full.min.js`, baixado de `cdn.sheetjs.com` (a versão do npm está desatualizada).
- Em `vendor/VERSOES.md`, anote para cada arquivo: versão, URL de origem, licença e SHA-256.

### 2. Pasta de dados

O usuário escolhe uma **pasta** (não um arquivo) com `showDirectoryPicker`. Dentro dela, o app usa:

```
ferias.sqlite            banco de dados
ferias_espelho.xlsx      Excel espelho (somente leitura, refeito a cada gravação)
backups/                 cópias do banco
```

- Guarde o identificador da pasta no IndexedDB. Na próxima abertura, mostre o botão "Abrir a pasta de antes" e peça a permissão de novo (`requestPermission`).
- Se a pasta não tiver `ferias.sqlite`, ofereça "Criar banco novo nesta pasta". O banco novo recebe o conteúdo de `sql/schema.sql`.
- Se o navegador não tiver `showDirectoryPicker` (ex.: Firefox), mostre: "Este app funciona no Microsoft Edge ou no Google Chrome."

### 3. Gravação e cópia de segurança

- Grave o banco depois de cada alteração (exportar com `db.export()` e escrever o arquivo inteiro).
- Grave primeiro num arquivo temporário e depois substitua o principal, para não corromper o banco se a gravação falhar no meio. Se a API não permitir isso de forma simples, explique a alternativa escolhida.
- Ao abrir um banco, copie o arquivo para `backups/ferias_AAAA-MM-DD_HHMM.sqlite`. Mantenha só as 30 cópias mais novas.
- Mostre no rodapé: nome da pasta e hora da última gravação.

### 4. Tela de teste

Uma tela simples para provar o ciclo completo, usando a tabela `cliente` do `schema.sql`:

- Campo "Nome do cliente" e botão "Adicionar".
- Lista dos clientes cadastrados, com botão "Remover".
- Cada ação grava em `historico_alteracao`.

### 5. Excel espelho

Depois de cada gravação, gere `ferias_espelho.xlsx` com uma aba por tabela que tenha registros. A primeira aba se chama "Leia-me" e diz: "Arquivo gerado automaticamente pelo app. Alterações feitas aqui serão perdidas."

### 6. Build em arquivo único

`scripts/build.py` (somente biblioteca padrão do Python):

- Lê `app/index.html` e coloca no próprio HTML o conteúdo dos CSS e JS de `app/`.
- Embute `vendor/sql-wasm.js`, `vendor/xlsx.full.min.js` e o `.wasm` em base64 (usar `initSqlJs({ wasmBinary })`).
- Embute o conteúdo de `sql/schema.sql` como texto.
- Grava `dist/controle_ferias.html` e mostra o tamanho final.

### 7. Passo a passo para o gestor

Crie `docs/entrega/teste_fase0.md`, escrito para quem não é de TI:

1. Salvar `controle_ferias.html` em Documentos.
2. Criar uma pasta vazia (ex.: `Documentos\Ferias_dados`).
3. Abrir o HTML no Edge (botão direito, "Abrir com", Microsoft Edge).
4. Escolher a pasta, cadastrar 2 clientes de teste, fechar e abrir de novo.
5. Conferir se os clientes continuam lá e se o Excel espelho abre.
6. Tirar print e enviar.

### 8. README e commit

- Atualize o `README.md`: nova stack (HTML + SQLite no navegador), como gerar o build e como testar.
- Rode `git status` e confira as regras de privacidade do `CLAUDE.md`.
- Proponha a mensagem do primeiro commit e espere meu "ok". Não faça `push`.

## Critérios de aceite

| Nº | Critério |
|---|---|
| A1 | `python scripts/build.py` gera `dist/controle_ferias.html` com menos de 5 MB. |
| A2 | Por duplo clique (endereço `file://`), o app abre no Edge e no Chrome do Windows. |
| A3 | Escolher uma pasta vazia cria `ferias.sqlite` e a pasta `backups/`. |
| A4 | Cadastrar 3 clientes, fechar o navegador, abrir de novo: os 3 continuam lá. |
| A5 | `ferias_espelho.xlsx` abre no Excel e mostra os 3 clientes. |
| A6 | Com a internet desligada, o app funciona. Na aba Rede do DevTools não há requisição externa. |
| A7 | No Firefox, aparece a mensagem de navegador não suportado. |
| A8 | `historico_alteracao` registra as inclusões e remoções. |
| A9 | `git status` não mostra nada de `privado/`, nem `*.sqlite`, nem planilha fora de `data/exemplo/`. |

Se A2 ou A3 falharem por causa do endereço `file://`, pare e descreva o erro exato. Essa é a principal dúvida técnica desta fase.

## Fora do escopo

Cadastro de funcionários, regras de férias, importação de planilhas, Gantt, alertas e visual final. Isso fica para as próximas fases.

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
| 0 | Estrutura do app, bibliotecas embutidas, prova de gravação do banco SQLite pelo navegador, build do arquivo único, primeiro commit. | Próxima |
| 1 | Revisão do `schema.sql` e cadastro de funcionários, times, limites e substitutos (incluir, editar, desligar). | Pendente |
| 2 | Importar o relatório da contabilidade e a planilha de programação, com validação. | Pendente |
| 3 | Programação de férias com as regras D03 a D08 e os prazos de aviso e pagamento. | Pendente |
| 4 | Tela "o que fazer hoje", alertas, Gantt e conflitos por time e por substitutos. | Pendente |
| 5 | Excel espelho e pacote de entrega para o gestor, com passo a passo. | Pendente |
| 6+ | Pedidos via Forms e resposta por e-mail (D21, D32) e assistente com IA. | Futuro |
````

## Anexo B: seção para o `CLAUDE.md`

````markdown
## Como as specs chegam

- O usuário cola a spec inteira aqui no chat. Salve a spec em `docs/specs/` com o nome indicado no topo dela.
- Toda spec começa pelo "Passo 0: atualizar documentação". Faça esse passo antes das tarefas.
- O usuário não edita nem substitui arquivos à mão. Quando um arquivo existente precisa mudar, a spec diz o que mudar e você faz a mudança.
- O Anexo com o `docs/DECISOES.md` sempre substitui o arquivo inteiro.
````
