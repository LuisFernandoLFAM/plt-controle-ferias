# Teste do Controle de Férias: versão de teste (Fase 0)

Esta versão ainda não controla férias. Ela serve só para confirmar que o app consegue guardar os dados no seu computador. Para isso, o teste usa um cadastro simples de clientes. O teste leva uns 10 minutos.

## O que você vai precisar

- O arquivo **controle_ferias.html** (enviado junto com este passo a passo).
- O navegador **Microsoft Edge** ou **Google Chrome**. O Edge já vem no Windows.
- Não precisa instalar nada nem estar conectado à internet.

## Passo a passo

### 1. Salve o arquivo

Salve o arquivo `controle_ferias.html` na pasta **Documentos**.

### 2. Crie uma pasta vazia para os dados

1. Abra a pasta **Documentos**.
2. Clique com o botão direito num espaço vazio, escolha **Novo** e depois **Pasta**.
3. Dê o nome **Ferias_dados**.

É nessa pasta que o app vai guardar os dados.

### 3. Abra o app no Edge

1. Clique com o botão direito no arquivo `controle_ferias.html`.
2. Escolha **Abrir com** e depois **Microsoft Edge**.

O app abre numa aba do navegador, com o título "Controle de Férias".

### 4. Escolha a pasta e cadastre 2 clientes

1. Clique em **Escolher pasta**.
2. Na janela que abrir, entre em **Documentos**, clique uma vez em **Ferias_dados** e depois em **Selecionar pasta**. Escolha a pasta **Ferias_dados**, e não a pasta Documentos inteira.
3. Se o navegador perguntar se o site pode ver ou editar os arquivos da pasta, clique em **Exibir arquivos** e depois em **Salvar alterações** (ou **Permitir**).
4. Clique em **Criar banco novo nesta pasta**.
5. No campo **Nome do cliente**, digite `Cliente Teste 1` e clique em **Adicionar**.
6. Digite `Cliente Teste 2` e clique em **Adicionar**.

Os dois nomes aparecem na lista. Embaixo aparece o "Histórico de alterações". No rodapé da página aparecem o nome da pasta e a hora da última gravação.

### 5. Feche e abra de novo

1. Feche o Edge inteiro.
2. Abra o `controle_ferias.html` de novo, do mesmo jeito do passo 3.
3. Clique em **Abrir a pasta de antes (Ferias_dados)**.
4. Se o navegador pedir permissão de novo, clique em **Permitir** (ou **Editar arquivos**). É normal ele perguntar toda vez.

Confira se os dois clientes continuam na lista.

### 6. Confira o Excel espelho

1. Abra a pasta **Documentos\Ferias_dados**. Ela deve ter:
   - `ferias.sqlite`: o banco de dados (não abra esse arquivo).
   - `ferias_espelho.xlsx`: uma cópia dos dados para consulta no Excel.
   - a pasta `backups`: cópias de segurança automáticas.
2. Abra o `ferias_espelho.xlsx` no Excel. A primeira aba se chama "Leia-me". A aba "cliente" mostra os dois clientes.
3. Feche o Excel antes de voltar ao app.

O Excel espelho é só para consulta. O app refaz esse arquivo a cada alteração, então o que for mudado nele à mão se perde.

### 7. Tire prints e envie

Tire um print (tecla **Windows + Shift + S**) de:

1. A tela do app com os dois clientes, depois de reabrir.
2. A pasta `Ferias_dados` aberta, mostrando os arquivos.
3. O Excel espelho aberto na aba "cliente".

Envie os prints por e-mail ou mensagem.

## Se algo der errado

- **Aparece "Este app funciona no Microsoft Edge ou no Google Chrome."**: o arquivo abriu em outro navegador. Volte ao passo 3 e use "Abrir com" e depois "Microsoft Edge".
- **Aparece uma mensagem em vermelho ou amarelo**: tire um print da tela inteira e envie. Não precisa tentar resolver.
- **O botão "Escolher pasta" não abre nenhuma janela**: o computador da empresa pode estar bloqueando esse recurso. Tire um print e avise.
- **Aviso de que o Excel espelho não foi atualizado**: o espelho estava aberto no Excel. Feche o Excel e cadastre ou remova um cliente de teste. O app refaz o espelho.

Os clientes de teste podem ser removidos depois com o botão **Remover**. Para apagar o teste inteiro, basta apagar a pasta `Ferias_dados`.
