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
