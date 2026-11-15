// Testes automáticos do app. Rodam dentro da página montada por tests/rodar_testes.py.
// Usam só dados fictícios.
'use strict';

(async () => {
  const casos = [];
  const caso = (grupo, nome, fn) => casos.push({ grupo, nome, fn });

  // ---------- Asserções ----------

  function ok(condicao, msg = 'esperava verdadeiro') {
    if (!condicao) throw new Error(msg);
  }
  function igual(atual, esperado, msg = '') {
    const a = JSON.stringify(atual);
    const e = JSON.stringify(esperado);
    if (a !== e) throw new Error(`${msg ? msg + ': ' : ''}esperava ${e}, veio ${a}`);
  }
  async function esperar(condicao, msg = 'condição', ms = 15000) {
    const inicio = Date.now();
    while (Date.now() - inicio < ms) {
      if (condicao()) return;
      await new Promise(r => setTimeout(r, 50));
    }
    throw new Error('tempo esgotado esperando: ' + msg);
  }

  // ---------- Apoio ----------

  const HOJE = '2026-11-14';
  const RE_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  const MIGRACOES_APP = window.MIGRACOES;
  const $ = id => document.getElementById(id);

  async function novoBanco() {
    Banco.definirMigracoes(MIGRACOES_APP);
    await Banco.criarNovo();
    Banco.migrar();
  }

  // Cliente, centro de custo e dois times fictícios.
  function criarBase() {
    const cliente = Cadastro.salvarCliente({ nome: 'Cliente Teste' }).id;
    const cc = Cadastro.salvarCentro({ codigo: 'CC 900', cliente_id: cliente, municipio: 'Cidade Teste', uf: 'sp' }).id;
    const timeA = Cadastro.salvarTime({ centro_custo_id: cc, nome: 'Time A', limite_ausencias: '2', tolerancia_dias: '0' }).id;
    const timeB = Cadastro.salvarTime({ centro_custo_id: cc, nome: 'Time B', limite_ausencias: '1', tolerancia_dias: '1' }).id;
    return { cliente, cc, timeA, timeB };
  }

  let seq = 0;
  function novoFuncionario(timeId, extra = {}) {
    seq++;
    const r = Cadastro.salvarFuncionario({
      matricula: `T${String(seq).padStart(4, '0')}`, nome: `Pessoa Teste ${seq}`,
      data_admissao: '2020-01-10', time_id: timeId, email: '', observacao: '', ...extra,
    }, HOJE);
    if (r.erros) throw new Error('não criou funcionário: ' + JSON.stringify(r.erros));
    return r.id;
  }

  const ultimoHistorico = () => Banco.consultar('SELECT * FROM historico_alteracao ORDER BY id DESC LIMIT 1')[0];

  async function pastaOpfs(nome) {
    const raiz = await navigator.storage.getDirectory();
    try { await raiz.removeEntry(nome, { recursive: true }); } catch { /* não existia */ }
    return raiz.getDirectoryHandle(nome, { create: true });
  }
  async function lerBytes(pasta, nome) {
    return new Uint8Array(await (await (await pasta.getFileHandle(nome)).getFile()).arrayBuffer());
  }
  async function gravarBytes(pasta, nome, bytes) {
    const w = await (await pasta.getFileHandle(nome, { create: true })).createWritable();
    await w.write(bytes);
    await w.close();
  }
  async function listar(pasta) {
    const nomes = [];
    for await (const [nome] of pasta.entries()) nomes.push(nome);
    return nomes.sort();
  }
  const mesmosBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const esperarLivre = () => esperar(() => !App.estado.ocupado, 'ação terminar');

  // =====================================================================
  // Data e hora (D37)
  // =====================================================================

  caso('Data e hora', 'data sem hora fica dd/mm/aaaa, sem conversão de fuso', () => {
    igual(Datas.formatar('2026-11-14'), '14/11/2026');
    igual(Datas.formatar('2026-01-01'), '01/01/2026');
  });
  caso('Data e hora', 'UTC do banco aparece no horário de Brasília', () => {
    igual(Datas.formatar('2026-11-15T01:23:14Z'), '14/11/2026 22:23');
    igual(Datas.formatar('2026-07-01T15:00:00Z'), '01/07/2026 12:00');
  });
  caso('Data e hora', 'meia-noite aparece como 00:00', () => {
    igual(Datas.formatar('2026-11-15T03:00:00Z'), '15/11/2026 00:00');
  });
  caso('Data e hora', 'formato antigo do SQLite (sem T e sem Z) também é UTC', () => {
    igual(Datas.formatar('2026-11-15 01:23:14'), '14/11/2026 22:23');
  });
  caso('Data e hora', 'objeto Date é formatado em Brasília', () => {
    igual(Datas.formatar(new Date('2026-11-15T01:23:00Z')), '14/11/2026 22:23');
  });
  caso('Data e hora', '"hoje" usa o dia de Brasília', () => {
    igual(Datas.hoje(new Date('2026-11-15T02:59:00Z')), '2026-11-14');
    igual(Datas.hoje(new Date('2026-11-15T03:00:00Z')), '2026-11-15');
  });
  caso('Data e hora', 'agoraUtc grava AAAA-MM-DDTHH:MM:SSZ', () => {
    igual(Datas.agoraUtc(new Date('2026-11-14T12:34:56.789Z')), '2026-11-14T12:34:56Z');
  });
  caso('Data e hora', 'datas inexistentes são recusadas', () => {
    igual(Datas.dataValida('2026-02-29'), false);
    igual(Datas.dataValida('2028-02-29'), true);
    igual(Datas.dataValida('14/11/2026'), false);
  });
  caso('Data e hora', 'o banco grava data e hora em UTC no formato do D37', async () => {
    await novoBanco();
    const { timeA } = criarBase();
    const id = novoFuncionario(timeA);
    const f = Banco.consultar('SELECT criado_em, atualizado_em FROM funcionario WHERE id = ?', [id])[0];
    ok(RE_UTC.test(f.criado_em), 'criado_em: ' + f.criado_em);
    ok(RE_UTC.test(ultimoHistorico().em), 'historico.em: ' + ultimoHistorico().em);
    Cadastro.salvarFuncionario({ ...Cadastro.obterFuncionario(id), nome: 'Outro Nome' }, HOJE);
    const depois = Banco.consultar('SELECT atualizado_em FROM funcionario WHERE id = ?', [id])[0];
    ok(RE_UTC.test(depois.atualizado_em), 'atualizado_em: ' + depois.atualizado_em);
  });

  // =====================================================================
  // Ocupação (D43)
  // =====================================================================

  caso('Ocupação', '8 pessoas, limite 2: 33% verde', () => {
    const o = Regras.calcularOcupacao(8, 2);
    igual([o.texto, o.cor], ['33%', 'verde']);
  });
  caso('Ocupação', '16 pessoas, limite 2: 66% amarelo', () => {
    const o = Regras.calcularOcupacao(16, 2);
    igual([o.texto, o.cor], ['66%', 'amarelo']);
  });
  caso('Ocupação', '10 pessoas, limite 1: 82% vermelho', () => {
    const o = Regras.calcularOcupacao(10, 1);
    igual([o.texto, o.cor], ['82%', 'vermelho']);
  });
  caso('Ocupação', 'exatamente 50% é verde e exatamente 70% é amarelo', () => {
    igual(Regras.calcularOcupacao(73, 12).valor, 50);
    igual(Regras.calcularOcupacao(73, 12).cor, 'verde');
    igual(Math.round(Regras.calcularOcupacao(511, 60).valor * 1e9) / 1e9, 70);
    igual(Regras.calcularOcupacao(511, 60).cor, 'amarelo');
  });
  caso('Ocupação', 'limite inválido não calcula', () => {
    igual(Regras.calcularOcupacao(3, 0), null);
  });
  caso('Ocupação', 'a lista de times calcula pela quantidade de pessoas ativas', async () => {
    await novoBanco();
    const { timeA } = criarBase();
    for (let i = 0; i < 8; i++) novoFuncionario(timeA);
    const t = Cadastro.obterTime(timeA);
    igual([t.pessoas_ativas, t.ocupacao.texto, t.ocupacao.cor], [8, '33%', 'verde']);
  });

  // =====================================================================
  // Migrações (D38, D39)
  // =====================================================================

  caso('Migrações', 'banco novo recebe a 001 e fica com user_version 1', async () => {
    await Banco.criarNovo();
    igual(Banco.situacao(), 'vazio');
    igual(Banco.migrar(), 1);
    igual(Banco.versaoBanco(), 1);
    igual(Banco.situacao(), 'ok');
    const tabelas = Banco.tabelas();
    for (const t of ['cliente', 'centro_custo', 'time', 'funcionario', 'regra_substituto', 'historico_alteracao']) {
      ok(tabelas.includes(t), 'faltou a tabela ' + t);
    }
    igual(Banco.consultar('SELECT count(*) AS n FROM regra_config')[0].n, 5);
  });
  caso('Migrações', 'banco da Fase 0 é reconhecido', async () => {
    await Banco.criarNovo();
    Banco.executar('CREATE TABLE cliente (id INTEGER PRIMARY KEY, nome TEXT NOT NULL UNIQUE)');
    Banco.executar('CREATE TABLE historico_alteracao (id INTEGER PRIMARY KEY, tabela TEXT)');
    igual(Banco.situacao(), 'fase0');
  });
  caso('Migrações', 'banco de versão mais nova é reconhecido', async () => {
    await novoBanco();
    Banco.executar('PRAGMA user_version = 99');
    igual(Banco.situacao(), 'mais_novo');
  });
  caso('Migrações', 'arquivo SQLite que não é do app é reconhecido', async () => {
    await Banco.criarNovo();
    Banco.executar('CREATE TABLE outra_coisa (id INTEGER)');
    igual(Banco.situacao(), 'desconhecido');
  });
  caso('Migrações', 'banco antigo recebe só as migrações que faltam e mantém os dados', async () => {
    try {
      await novoBanco();
      Cadastro.salvarCliente({ nome: 'Cliente Antigo' });
      Banco.definirMigracoes([...MIGRACOES_APP, {
        versao: 2, nome: '002_teste', sql: 'ALTER TABLE cliente ADD COLUMN apelido TEXT; CREATE TABLE teste_nova (id INTEGER PRIMARY KEY);',
      }]);
      igual(Banco.situacao(), 'desatualizado');
      igual(Banco.migrar(), 1);
      igual(Banco.versaoBanco(), 2);
      igual(Banco.consultar('SELECT nome, apelido FROM cliente'), [{ nome: 'Cliente Antigo', apelido: null }]);
      ok(Banco.tabelas().includes('teste_nova'));
    } finally {
      Banco.definirMigracoes(MIGRACOES_APP);
    }
  });
  caso('Migrações', 'migração com erro desfaz tudo e não muda o user_version', async () => {
    try {
      await novoBanco();
      Banco.definirMigracoes([...MIGRACOES_APP, {
        versao: 2, nome: '002_quebrada', sql: 'CREATE TABLE teste_x (id INTEGER); INSERT INTO tabela_que_nao_existe VALUES (1);',
      }]);
      let erro = null;
      try { Banco.migrar(); } catch (e) { erro = e; }
      ok(erro && erro.message.includes('002_quebrada'), 'esperava erro com o nome da migração');
      igual(Banco.versaoBanco(), 1);
      ok(!Banco.tabelas().includes('teste_x'), 'a tabela da migração quebrada ficou no banco');
    } finally {
      Banco.definirMigracoes(MIGRACOES_APP);
    }
  });

  // =====================================================================
  // Funcionários: validações (A5) e histórico (A6)
  // =====================================================================

  caso('Funcionários', 'matrícula repetida é bloqueada', async () => {
    await novoBanco();
    const { timeA } = criarBase();
    novoFuncionario(timeA, { matricula: 'M100' });
    const r = Cadastro.salvarFuncionario({ matricula: ' M100 ', nome: 'Outra', data_admissao: '2021-01-01', time_id: timeA }, HOJE);
    igual(r.erros.matricula, 'Já existe um funcionário com esta matrícula.');
  });
  caso('Funcionários', 'e-mail inválido é bloqueado e e-mail vazio é aceito', async () => {
    await novoBanco();
    const { timeA } = criarBase();
    const r = Cadastro.salvarFuncionario({ matricula: 'M1', nome: 'Pessoa', data_admissao: '2021-01-01', time_id: timeA, email: 'pessoa@exemplo' }, HOJE);
    igual(r.erros.email, 'E-mail inválido. Exemplo: nome@exemplo.com');
    const r2 = Cadastro.salvarFuncionario({ matricula: 'M1', nome: 'Pessoa', data_admissao: '2021-01-01', time_id: timeA, email: '' }, HOJE);
    ok(r2.id, 'deveria aceitar sem e-mail');
    igual(Cadastro.obterFuncionario(r2.id).email, null);
  });
  caso('Funcionários', 'admissão futura é bloqueada; admissão hoje é aceita', async () => {
    await novoBanco();
    const { timeA } = criarBase();
    const r = Cadastro.salvarFuncionario({ matricula: 'M1', nome: 'Pessoa', data_admissao: '2026-11-15', time_id: timeA }, HOJE);
    igual(r.erros.data_admissao, 'A admissão não pode ser uma data futura.');
    ok(Cadastro.salvarFuncionario({ matricula: 'M1', nome: 'Pessoa', data_admissao: HOJE, time_id: timeA }, HOJE).id);
  });
  caso('Funcionários', 'campos obrigatórios e data inexistente', async () => {
    await novoBanco();
    criarBase();
    const r = Cadastro.salvarFuncionario({ matricula: '', nome: ' ', data_admissao: '', time_id: '' }, HOJE);
    igual(Object.keys(r.erros).sort(), ['data_admissao', 'matricula', 'nome', 'time_id']);
    const r2 = Cadastro.salvarFuncionario({ matricula: 'M2', nome: 'X', data_admissao: '2026-02-30', time_id: 1 }, HOJE);
    igual(r2.erros.data_admissao, 'Data inválida.');
  });
  caso('Funcionários', 'editar sem mudar a matrícula não acusa repetição', async () => {
    await novoBanco();
    const { timeA } = criarBase();
    const id = novoFuncionario(timeA, { matricula: 'M7' });
    const r = Cadastro.salvarFuncionario({ ...Cadastro.obterFuncionario(id), nome: 'Nome Novo' }, HOJE);
    igual(r, { id });
  });
  caso('Funcionários', 'editar grava antes e depois no histórico', async () => {
    await novoBanco();
    const { timeA, timeB } = criarBase();
    const id = novoFuncionario(timeA);
    Cadastro.salvarFuncionario({ ...Cadastro.obterFuncionario(id), time_id: timeB }, HOJE);
    const h = ultimoHistorico();
    igual([h.tabela, h.registro_id, h.acao, h.usuario], ['funcionario', id, 'edicao', 'gestor']);
    igual(JSON.parse(h.dados_antes).time_id, timeA);
    igual(JSON.parse(h.dados_depois).time_id, timeB);
    const d = Cadastro.descreverHistorico(h);
    ok(d.dados.includes('Time: Time A → Time B'), 'descrição: ' + d.dados);
    ok(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(d.quando), 'quando: ' + d.quando);
  });
  caso('Funcionários', 'salvar sem mudanças não grava histórico', async () => {
    await novoBanco();
    const { timeA } = criarBase();
    const id = novoFuncionario(timeA);
    const antes = ultimoHistorico().id;
    Cadastro.salvarFuncionario(Cadastro.obterFuncionario(id), HOJE);
    igual(ultimoHistorico().id, antes);
  });
  caso('Funcionários', 'desligar tira da lista padrão e da ocupação; reativar devolve', async () => {
    await novoBanco();
    const { timeA } = criarBase();
    const id = novoFuncionario(timeA);
    novoFuncionario(timeA);
    igual(Cadastro.obterTime(timeA).pessoas_ativas, 2);
    igual(Cadastro.desligarFuncionario(id, '2026-10-31'), { id });
    igual(ultimoHistorico().acao, 'desligamento');
    ok(!Cadastro.listarFuncionarios().some(f => f.id === id), 'continuou na lista padrão');
    ok(Cadastro.listarFuncionarios({ situacao: 'desligados' }).some(f => f.id === id), 'não apareceu em Desligados');
    igual(Cadastro.obterTime(timeA).pessoas_ativas, 1);
    igual(Cadastro.reativarFuncionario(id), { id });
    igual(ultimoHistorico().acao, 'reativacao');
    const f = Cadastro.obterFuncionario(id);
    igual([f.ativo, f.data_desligamento], [1, null]);
    igual(Cadastro.obterTime(timeA).pessoas_ativas, 2);
  });
  caso('Funcionários', 'desligamento antes da admissão é bloqueado', async () => {
    await novoBanco();
    const { timeA } = criarBase();
    const id = novoFuncionario(timeA, { data_admissao: '2022-05-10' });
    const r = Cadastro.desligarFuncionario(id, '2022-05-09');
    igual(r.erros.data_desligamento, 'O desligamento não pode ser antes da admissão (10/05/2022).');
  });
  caso('Funcionários', 'busca ignora acentos e procura também pela matrícula', async () => {
    await novoBanco();
    const { timeA, timeB } = criarBase();
    novoFuncionario(timeA, { nome: 'Fábio Teste', matricula: 'X1' });
    novoFuncionario(timeB, { nome: 'Outra Pessoa', matricula: 'X2' });
    igual(Cadastro.listarFuncionarios({ busca: 'fabio' }).map(f => f.matricula), ['X1']);
    igual(Cadastro.listarFuncionarios({ busca: 'x2' }).map(f => f.matricula), ['X2']);
    igual(Cadastro.listarFuncionarios({ timeId: timeB }).map(f => f.matricula), ['X2']);
  });

  // =====================================================================
  // Exclusão (A8, D41)
  // =====================================================================

  caso('Exclusão', 'funcionário sem férias e sem par pode ser excluído (com histórico)', async () => {
    await novoBanco();
    const { timeA } = criarBase();
    const id = novoFuncionario(timeA);
    ok(Cadastro.obterFuncionario(id).pode_excluir);
    igual(Cadastro.excluirFuncionario(id), { id });
    igual(Cadastro.obterFuncionario(id), null);
    const h = ultimoHistorico();
    igual([h.acao, h.dados_depois], ['exclusao', null]);
    igual(JSON.parse(h.dados_antes).id, id);
  });
  caso('Exclusão', 'com par de substitutos não pode ser excluído', async () => {
    await novoBanco();
    const { timeA, timeB } = criarBase();
    const a = novoFuncionario(timeA);
    const b = novoFuncionario(timeB);
    Cadastro.salvarPar({ funcionario_a_id: a, funcionario_b_id: b, tolerancia_dias: '0' });
    igual(Cadastro.obterFuncionario(a).pode_excluir, false);
    ok(Cadastro.excluirFuncionario(a).erro, 'deveria recusar');
    ok(Cadastro.obterFuncionario(a), 'foi excluído');
  });
  caso('Exclusão', 'com férias registradas não pode ser excluído', async () => {
    await novoBanco();
    const { timeA } = criarBase();
    const id = novoFuncionario(timeA);
    Banco.executar(`INSERT INTO periodo_aquisitivo (funcionario_id, inicio, fim, limite_concessivo, origem)
                    VALUES (?, '2025-01-10', '2026-01-09', '2027-01-09', 'app')`, [id]);
    Banco.executar(`INSERT INTO ferias_periodo (periodo_aquisitivo_id, ordem, inicio, fim, dias, origem)
                    VALUES (last_insert_rowid(), 1, '2026-03-02', '2026-03-31', 30, 'app')`);
    const f = Cadastro.obterFuncionario(id);
    igual([f.tem_ferias, f.pode_excluir], [1, false]);
    ok(Cadastro.excluirFuncionario(id).erro, 'deveria recusar');
  });

  // =====================================================================
  // Substitutos (A9, D14)
  // =====================================================================

  caso('Substitutos', 'a mesma pessoa dos dois lados é bloqueada', async () => {
    await novoBanco();
    const { timeA } = criarBase();
    const a = novoFuncionario(timeA);
    const r = Cadastro.salvarPar({ funcionario_a_id: a, funcionario_b_id: a, tolerancia_dias: '0' });
    igual(r.erros.funcionario_b_id, 'Escolha duas pessoas diferentes.');
  });
  caso('Substitutos', 'par repetido é bloqueado em qualquer ordem', async () => {
    await novoBanco();
    const { timeA, timeB } = criarBase();
    const a = novoFuncionario(timeA);
    const b = novoFuncionario(timeB);
    ok(Cadastro.salvarPar({ funcionario_a_id: a, funcionario_b_id: b, tolerancia_dias: '0' }).id);
    igual(Cadastro.salvarPar({ funcionario_a_id: a, funcionario_b_id: b, tolerancia_dias: '0' }).erros.funcionario_b_id, 'Este par já está cadastrado.');
    igual(Cadastro.salvarPar({ funcionario_a_id: b, funcionario_b_id: a, tolerancia_dias: '0' }).erros.funcionario_b_id, 'Este par já está cadastrado.');
  });
  caso('Substitutos', 'grava sempre o menor id em funcionario_a_id', async () => {
    await novoBanco();
    const { timeA, timeB } = criarBase();
    const a = novoFuncionario(timeA);
    const b = novoFuncionario(timeB);
    const id = Cadastro.salvarPar({ funcionario_a_id: b, funcionario_b_id: a, tolerancia_dias: '2', motivo: 'Teste' }).id;
    const par = Banco.consultar('SELECT * FROM regra_substituto WHERE id = ?', [id])[0];
    igual([par.funcionario_a_id, par.funcionario_b_id, par.tolerancia_dias], [Math.min(a, b), Math.max(a, b), 2]);
    igual(ultimoHistorico().acao, 'inclusao');
  });
  caso('Substitutos', 'editar o par sem trocar as pessoas não acusa repetição', async () => {
    await novoBanco();
    const { timeA, timeB } = criarBase();
    const a = novoFuncionario(timeA);
    const b = novoFuncionario(timeB);
    const id = Cadastro.salvarPar({ funcionario_a_id: a, funcionario_b_id: b, tolerancia_dias: '0' }).id;
    igual(Cadastro.salvarPar({ id, funcionario_a_id: a, funcionario_b_id: b, tolerancia_dias: '3' }), { id });
  });
  caso('Substitutos', 'tolerância negativa é bloqueada', async () => {
    await novoBanco();
    const { timeA, timeB } = criarBase();
    const r = Cadastro.salvarPar({ funcionario_a_id: novoFuncionario(timeA), funcionario_b_id: novoFuncionario(timeB), tolerancia_dias: '-1' });
    ok(r.erros.tolerancia_dias);
  });
  caso('Substitutos', 'desligar uma pessoa deixa o par inativo; reativar volta', async () => {
    await novoBanco();
    const { timeA, timeB } = criarBase();
    const a = novoFuncionario(timeA);
    const b = novoFuncionario(timeB);
    const id = Cadastro.salvarPar({ funcionario_a_id: a, funcionario_b_id: b, tolerancia_dias: '0' }).id;
    Cadastro.desligarFuncionario(b, '2026-11-01');
    igual(Cadastro.listarPares().find(p => p.id === id).ativo, 0);
    Cadastro.reativarFuncionario(b);
    igual(Cadastro.listarPares().find(p => p.id === id).ativo, 1);
  });

  // =====================================================================
  // Times e clientes
  // =====================================================================

  caso('Times', 'limite mínimo 1 e tolerância mínima 0', async () => {
    await novoBanco();
    const { cc } = criarBase();
    const r = Cadastro.salvarTime({ centro_custo_id: cc, nome: 'Time C', limite_ausencias: '0', tolerancia_dias: '-1' });
    ok(r.erros.limite_ausencias && r.erros.tolerancia_dias);
  });
  caso('Times', 'nome de time repetido no mesmo centro de custo é bloqueado', async () => {
    await novoBanco();
    const { cc } = criarBase();
    ok(Cadastro.salvarTime({ centro_custo_id: cc, nome: 'time a', limite_ausencias: '1', tolerancia_dias: '0' }).erros.nome);
  });
  caso('Times', 'time com pessoas ativas não pode ser inativado nem excluído', async () => {
    await novoBanco();
    const { timeA } = criarBase();
    const id = novoFuncionario(timeA);
    ok(Cadastro.inativarTime(timeA).erro);
    ok(Cadastro.excluirTime(timeA).erro);
    Cadastro.desligarFuncionario(id, '2026-11-01');
    igual(Cadastro.inativarTime(timeA), { id: timeA });
    igual(Cadastro.obterTime(timeA).ativo, 0);
    ok(Cadastro.excluirTime(timeA).erro, 'tem funcionário desligado: não pode excluir');
  });
  caso('Times', 'time sem funcionários pode ser excluído', async () => {
    await novoBanco();
    const { timeB } = criarBase();
    igual(Cadastro.excluirTime(timeB), { id: timeB });
    igual(ultimoHistorico().acao, 'exclusao');
  });
  caso('Times', 'cliente e centro de custo repetidos são bloqueados; UF fica maiúscula', async () => {
    await novoBanco();
    const { cliente } = criarBase();
    ok(Cadastro.salvarCliente({ nome: 'cliente teste' }).erros.nome);
    ok(Cadastro.salvarCentro({ codigo: 'cc 900', cliente_id: cliente }).erros.codigo);
    igual(Cadastro.listarCentros()[0].uf, 'SP');
    ok(Cadastro.salvarCentro({ codigo: 'CC 901', cliente_id: cliente, uf: 'São' }).erros.uf);
  });

  // =====================================================================
  // Histórico
  // =====================================================================

  caso('Histórico', 'toda inclusão grava o depois em JSON', async () => {
    await novoBanco();
    criarBase();
    const linhas = Banco.consultar('SELECT tabela, acao, dados_antes, dados_depois FROM historico_alteracao ORDER BY id');
    igual(linhas.map(l => `${l.tabela}:${l.acao}`), ['cliente:inclusao', 'centro_custo:inclusao', 'time:inclusao', 'time:inclusao']);
    ok(linhas.every(l => l.dados_antes === null && JSON.parse(l.dados_depois).id), 'dados_depois deveria ter o registro');
  });
  caso('Histórico', 'filtro por tabela e limite de 100', async () => {
    await novoBanco();
    const { cliente } = criarBase();
    for (let i = 0; i < 110; i++) Cadastro.salvarCliente({ id: cliente, nome: `Cliente Teste ${i}` });
    igual(Cadastro.listarHistorico().length, 100);
    igual(new Set(Cadastro.listarHistorico({ tabela: 'time' }).map(h => h.tabela)), new Set(['time']));
    igual(Cadastro.listarHistorico({ tabela: 'time' }).length, 2);
  });
  caso('Histórico', 'descrição legível de inclusão e de exclusão', async () => {
    await novoBanco();
    const { timeA } = criarBase();
    const id = novoFuncionario(timeA, { nome: 'Pessoa Descrita', matricula: 'D1', data_admissao: '2021-03-05' });
    const inc = Cadastro.descreverHistorico(ultimoHistorico());
    igual([inc.acao, inc.tabela, inc.registro], ['Inclusão', 'Funcionário', 'Pessoa Descrita (D1)']);
    ok(inc.dados.includes('Admissão: 05/03/2021') && inc.dados.includes('Time: Time A'), inc.dados);
    Cadastro.excluirFuncionario(id);
    const exc = Cadastro.descreverHistorico(ultimoHistorico());
    igual([exc.acao, exc.registro], ['Exclusão', 'Pessoa Descrita (D1)']);
  });

  // =====================================================================
  // Dados de exemplo e Excel espelho (A10, A11, A12)
  // =====================================================================

  caso('Exemplo e espelho', 'dados de exemplo carregam só em banco sem funcionários', async () => {
    await novoBanco();
    const r = Cadastro.carregarExemplo(window.DADOS_EXEMPLO, HOJE);
    igual(r.funcionarios, window.DADOS_EXEMPLO.funcionarios.length);
    igual(Cadastro.listarFuncionarios().length, window.DADOS_EXEMPLO.funcionarios.length);
    igual(Cadastro.listarPares().length, 1);
    ok(Cadastro.listarFuncionarios().every(f => !f.email || f.email.endsWith('@exemplo.com')), 'e-mail fora de exemplo.com');
    ok(Cadastro.carregarExemplo(window.DADOS_EXEMPLO, HOJE).erro, 'deveria recusar a segunda carga');
  });
  caso('Exemplo e espelho', 'o Excel espelho tem as 5 abas legíveis com os cabeçalhos certos', async () => {
    await novoBanco();
    Cadastro.carregarExemplo(window.DADOS_EXEMPLO, HOJE);
    const livro = XLSX.read(Espelho.gerar(), { type: 'array' });
    igual(livro.SheetNames, ['Leia-me', 'Funcionários', 'Times', 'Substitutos', 'Histórico']);
    const cab = nome => XLSX.utils.sheet_to_json(livro.Sheets[nome], { header: 1 })[0];
    igual(cab('Funcionários'), ['Matrícula', 'Nome', 'Admissão', 'Cliente', 'Centro de custo', 'Time', 'E-mail', 'Situação', 'Desligamento']);
    igual(cab('Times'), ['Cliente', 'Centro de custo', 'Time', 'Pessoas ativas', 'Limite', 'Tolerância (dias)', 'Ocupação']);
    igual(cab('Substitutos'), ['Pessoa 1', 'Pessoa 2', 'Tolerância (dias)', 'Motivo', 'Situação']);
    igual(cab('Histórico'), ['Data e hora', 'Ação', 'Tabela', 'Registro', 'Dados']);
    igual(XLSX.utils.sheet_to_json(livro.Sheets['Leia-me'], { header: 1 })[0][0], Espelho.AVISO);
    const func = XLSX.utils.sheet_to_json(livro.Sheets['Funcionários']);
    igual(func.length, window.DADOS_EXEMPLO.funcionarios.length);
    ok(func.every(f => /^\d{2}\/\d{2}\/\d{4}$/.test(f['Admissão'])), 'admissão fora do formato dd/mm/aaaa');
    const times = XLSX.utils.sheet_to_json(livro.Sheets.Times);
    ok(times.every(t => /^\d+%$/.test(t['Ocupação'])), 'ocupação sem %');
  });
  caso('Exemplo e espelho', 'o espelho mostra data e hora no horário de Brasília', async () => {
    await novoBanco();
    criarBase();
    Banco.executar("UPDATE historico_alteracao SET em = '2026-11-15T01:23:14Z' WHERE id = 1");
    const livro = XLSX.read(Espelho.gerar(new Date('2026-11-15T01:30:00Z')), { type: 'array' });
    const hist = XLSX.utils.sheet_to_json(livro.Sheets['Histórico']);
    igual(hist[hist.length - 1]['Data e hora'], '14/11/2026 22:23');
    igual(XLSX.utils.sheet_to_json(livro.Sheets['Leia-me'], { header: 1 })[2][0], 'Gerado em: 14/11/2026 22:30');
  });

  // =====================================================================
  // Fluxo na tela, com uma pasta do armazenamento interno do navegador (OPFS)
  // =====================================================================

  let respostaConfirm = true;
  let ultimoConfirm = null;
  window.confirm = msg => { ultimoConfirm = msg; return respostaConfirm; };

  caso('Tela', 'pasta vazia: cria o banco com user_version 1 e a pasta backups', async () => {
    await App.pronto;
    const pasta = await pastaOpfs('teste_fluxo');
    await App.usarPasta(pasta);
    ok(!$('tela-criar').hidden, 'não mostrou a tela de criar banco');
    $('btn-criar-banco').click();
    await esperar(() => !$('tela-funcionarios').hidden, 'tela Funcionários');
    await esperarLivre();
    igual(await listar(pasta), ['backups', 'ferias.sqlite', 'ferias_espelho.xlsx']);
    igual(Banco.versaoBanco(), 1);
  });
  caso('Tela', '"Carregar dados de exemplo" aparece em banco vazio e some depois de carregar', async () => {
    ok(!$('btn-exemplo').hidden, 'o botão deveria aparecer');
    $('btn-exemplo').click();
    await esperar(() => $('btn-exemplo').hidden, 'o botão sumir');
    await esperarLivre();
    igual($('tabela-funcionarios').tBodies[0].rows.length, window.DADOS_EXEMPLO.funcionarios.length);
  });
  caso('Tela', 'erro aparece ao lado do campo no formulário (matrícula repetida)', async () => {
    $('btn-novo-funcionario').click();
    const form = $('dlg-funcionario').querySelector('form');
    form.elements.matricula.value = window.DADOS_EXEMPLO.funcionarios[0].matricula;
    form.elements.nome.value = 'Pessoa Repetida';
    form.elements.data_admissao.value = '2020-01-01';
    form.elements.time_id.selectedIndex = 1;
    form.requestSubmit();
    await esperarLivre();
    igual(form.querySelector('[data-erro="matricula"]').textContent, 'Já existe um funcionário com esta matrícula.');
    ok($('dlg-funcionario').open, 'o formulário fechou');
    $('dlg-funcionario').close();
  });
  const botaoDaLinha = (linha, texto) => [...linha.querySelectorAll('button')].find(b => b.textContent === texto);

  caso('Tela', 'editar pela tela troca o time e grava no histórico', async () => {
    const linha = $('tabela-funcionarios').tBodies[0].rows[0];
    const matricula = linha.cells[0].textContent;
    const antes = Cadastro.listarFuncionarios().find(f => f.matricula === matricula);
    botaoDaLinha(linha, 'Editar').click();
    await esperarLivre();
    const form = $('dlg-funcionario').querySelector('form');
    const outro = [...form.elements.time_id.options].find(o => o.value && Number(o.value) !== antes.time_id);
    form.elements.time_id.value = outro.value;
    form.requestSubmit();
    await esperar(() => !$('dlg-funcionario').open, 'o formulário fechar');
    await esperarLivre();
    const erros = [...form.querySelectorAll('[data-erro]')].map(s => s.textContent).filter(Boolean);
    igual(erros, [], 'erros no formulário');
    igual(Cadastro.listarFuncionarios().find(f => f.matricula === matricula).time_id, Number(outro.value));
    igual([ultimoHistorico().acao, ultimoHistorico().tabela], ['edicao', 'funcionario']);
  });
  caso('Tela', 'desligar pela tela tira a pessoa da lista e aparece em Desligados', async () => {
    const linha = $('tabela-funcionarios').tBodies[0].rows[1];
    const matricula = linha.cells[0].textContent;
    botaoDaLinha(linha, 'Desligar').click();
    await esperarLivre();
    const form = $('dlg-desligar').querySelector('form');
    form.requestSubmit();
    await esperar(() => !$('dlg-desligar').open, 'o formulário fechar');
    await esperarLivre();
    igual(ultimoHistorico().acao, 'desligamento');
    ok(![...$('tabela-funcionarios').tBodies[0].rows].some(r => r.cells[0].textContent === matricula), 'continuou na lista');
    $('filtro-situacao').value = 'desligados';
    $('filtro-situacao').dispatchEvent(new Event('change'));
    ok([...$('tabela-funcionarios').tBodies[0].rows].some(r => r.cells[0].textContent === matricula), 'não apareceu em Desligados');
    $('filtro-situacao').value = 'ativos';
    $('filtro-situacao').dispatchEvent(new Event('change'));
  });
  caso('Tela', '"Excluir" só aparece para quem não tem par e pede a confirmação do D41', async () => {
    const linhas = [...$('tabela-funcionarios').tBodies[0].rows];
    const doPar = window.DADOS_EXEMPLO.substitutos[0].matricula_a;
    const linhaPar = linhas.find(r => r.cells[0].textContent === doPar);
    ok(![...linhaPar.querySelectorAll('button')].some(b => b.textContent === 'Excluir'), 'pessoa do par tem botão Excluir');
    const outra = linhas.find(r => r.cells[0].textContent !== doPar && r.cells[0].textContent !== window.DADOS_EXEMPLO.substitutos[0].matricula_b);
    const matricula = outra.cells[0].textContent;
    respostaConfirm = false;
    [...outra.querySelectorAll('button')].find(b => b.textContent === 'Excluir').click();
    await esperarLivre();
    igual(ultimoConfirm, 'Excluir definitivamente? Use só para cadastro feito por engano.');
    ok(Cadastro.listarFuncionarios().some(f => f.matricula === matricula), 'excluiu mesmo com "Cancelar"');
    respostaConfirm = true;
  });
  caso('Tela', 'ao reabrir a pasta, os dados continuam lá (lidos do arquivo)', async () => {
    const pasta = App.estado.pasta;
    const total = Cadastro.listarFuncionarios().length;
    Banco.fechar();
    await App.usarPasta(pasta);
    await esperarLivre();
    igual(Cadastro.listarFuncionarios().length, total);
    const backups = await listar(await pasta.getDirectoryHandle('backups'));
    ok(backups.some(n => /^ferias_\d{4}-\d{2}-\d{2}_\d{4}\.sqlite$/.test(n)), 'faltou o backup da abertura: ' + backups);
  });
  caso('Tela', 'banco da Fase 0: mostra a mensagem e não altera nada', async () => {
    const pasta = await pastaOpfs('teste_fase0');
    await Banco.criarNovo();
    Banco.executar('CREATE TABLE cliente (id INTEGER PRIMARY KEY, nome TEXT NOT NULL UNIQUE)');
    Banco.executar("INSERT INTO cliente (nome) VALUES ('Cliente Teste 1')");
    const bytes = Banco.exportar();
    await gravarBytes(pasta, 'ferias.sqlite', bytes);
    await App.usarPasta(pasta);
    igual($('mensagem').textContent, 'Este é um banco de teste antigo. Escolha uma pasta nova.');
    ok(mesmosBytes(await lerBytes(pasta, 'ferias.sqlite'), bytes), 'o arquivo foi alterado');
    igual(await listar(pasta), ['ferias.sqlite']);
    ok(!$('tela-inicio').hidden, 'deveria voltar para a tela inicial');
  });
  caso('Tela', 'banco de versão mais nova: mostra a mensagem e não abre', async () => {
    const pasta = await pastaOpfs('teste_mais_novo');
    await novoBanco();
    Banco.executar('PRAGMA user_version = 99');
    const bytes = Banco.exportar();
    await gravarBytes(pasta, 'ferias.sqlite', bytes);
    await App.usarPasta(pasta);
    igual($('mensagem').textContent, 'Este banco foi criado por uma versão mais nova do app. Use o arquivo mais recente.');
    ok(mesmosBytes(await lerBytes(pasta, 'ferias.sqlite'), bytes), 'o arquivo foi alterado');
    igual(Banco.aberto(), false);
  });
  caso('Tela', 'banco antigo: faz backup _antes_migracao e migra', async () => {
    const pasta = await pastaOpfs('teste_migracao');
    await novoBanco();
    Cadastro.salvarCliente({ nome: 'Cliente Antigo' });
    await gravarBytes(pasta, 'ferias.sqlite', Banco.exportar());
    try {
      Banco.definirMigracoes([...MIGRACOES_APP, { versao: 2, nome: '002_teste', sql: 'CREATE TABLE teste_nova (id INTEGER PRIMARY KEY);' }]);
      await App.usarPasta(pasta);
      igual(Banco.versaoBanco(), 2);
      const backups = await listar(await pasta.getDirectoryHandle('backups'));
      ok(backups.some(n => /_antes_migracao\.sqlite$/.test(n)), 'faltou o backup antes da migração: ' + backups);
      const doArquivo = await lerBytes(pasta, 'ferias.sqlite');
      const SQLx = await initSqlJs({ wasmBinary: Uint8Array.from(atob(window.WASM_BASE64), c => c.charCodeAt(0)) });
      const conferencia = new SQLx.Database(doArquivo);
      igual(conferencia.exec('PRAGMA user_version')[0].values[0][0], 2);
      igual(conferencia.exec('SELECT nome FROM cliente')[0].values, [['Cliente Antigo']]);
      conferencia.close();
    } finally {
      Banco.definirMigracoes(MIGRACOES_APP);
    }
  });
  caso('Tela', 'nenhuma requisição externa', async () => {
    const externas = performance.getEntriesByType('resource')
      .map(e => e.name).filter(n => !n.startsWith(location.origin) && !/^(data|blob):/.test(n));
    igual(externas, []);
  });

  // ---------- Execução ----------

  const resultados = [];
  for (const c of casos) {
    try {
      await c.fn();
      resultados.push({ grupo: c.grupo, nome: c.nome, ok: true });
    } catch (e) {
      resultados.push({ grupo: c.grupo, nome: c.nome, ok: false, erro: e && e.message ? e.message : String(e) });
    }
  }
  await fetch('/resultado', { method: 'POST', body: JSON.stringify({ resultados }) });
})().catch(e => fetch('/resultado', { method: 'POST', body: JSON.stringify({ erro_fatal: String(e && e.stack || e) }) }));
