# Testes automáticos

Um comando só, na raiz do projeto:

```bash
python tests/rodar_testes.py
```

Ferramenta só de desenvolvimento. O gestor não precisa instalar nada para usar o app.

## Requisitos

- Python 3.11 ou mais novo (só a biblioteca padrão).
- Microsoft Edge ou Google Chrome instalado. Para usar outro navegador, defina a variável `NAVEGADOR` com o caminho do executável.

## Como funciona

1. O script monta o mesmo HTML do build (`scripts/build.py`), com `tests/testes.js` embutido no fim.
2. Serve a página em `http://127.0.0.1` e abre o navegador sem janela (headless), com um perfil temporário.
3. Os testes rodam dentro da página, com o sql.js e o SheetJS reais. No lugar da pasta escolhida pelo usuário, usam o armazenamento interno do navegador (OPFS), que tem a mesma interface de arquivos.
4. A página manda o resultado para o script, que mostra cada teste e termina com código 0 se tudo passou.

O endereço é `http://127.0.0.1`, e não `file://`, porque o OPFS não existe em páginas `file://`. O funcionamento por `file://` foi provado na Fase 0 e é conferido no teste manual de cada fase.

## O que é testado

| Grupo | O que confere |
|---|---|
| Data e hora | Formatação única (D37): datas `dd/mm/aaaa`, data e hora em Brasília, gravação em UTC. |
| Ocupação | Fórmula e cores do D43, inclusive os limites de 50% e 70%. |
| Migrações | Banco novo, banco antigo, banco da Fase 0, banco de versão mais nova e migração com erro (D38, D39). |
| Funcionários | Validações (matrícula, e-mail, admissão), edição com histórico, desligar e reativar. |
| Exclusão | Só sem férias e sem par de substitutos (D41). |
| Substitutos | Mesma pessoa, par repetido em qualquer ordem, menor id primeiro, par inativo com desligamento (D14). |
| Times | Limite, tolerância, inativar e excluir. |
| Histórico | Antes e depois em JSON, filtro, limite de 100 e descrição legível. |
| Exemplo e espelho | Dados de exemplo (D44) e as 5 abas do Excel espelho. |
| Tela | Fluxo completo com a pasta: criar banco, carregar exemplo, erro ao lado do campo, reabrir, bancos recusados e nenhuma requisição externa. |

## Como acrescentar um teste

Em `tests/testes.js`, use `caso('Grupo', 'o que deve acontecer', async () => { ... })` com as asserções `ok`, `igual` e `esperar`. Use só dados fictícios.
