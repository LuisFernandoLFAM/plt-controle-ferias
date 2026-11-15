// Cadastros: clientes, centros de custo, times, funcionários e pares de substitutos.
// Toda alteração grava em historico_alteracao, com antes e depois em JSON.
// As funções salvar* devolvem { id } quando gravam ou { erros: { campo: mensagem } }.
'use strict';

const Cadastro = (() => {
  const q = (sql, p = []) => Banco.consultar(sql, p);
  const um = (sql, p = []) => q(sql, p)[0] || null;
  const T = Regras.texto;
  const ouNulo = v => (T(v) === '' ? null : T(v));
  const temErros = erros => Object.keys(erros).length > 0;

  // ---------- Base: inclusão, edição e exclusão com histórico ----------

  function linha(tabela, id) {
    return um(`SELECT * FROM "${tabela}" WHERE id = ?`, [id]);
  }

  function registrar(tabela, id, acao, antes, depois) {
    Banco.executar(
      'INSERT INTO historico_alteracao (tabela, registro_id, acao, dados_antes, dados_depois) VALUES (?, ?, ?, ?, ?)',
      [tabela, id, acao, antes ? JSON.stringify(antes) : null, depois ? JSON.stringify(depois) : null],
    );
  }

  function inserir(tabela, campos) {
    const cols = Object.keys(campos);
    Banco.executar(
      `INSERT INTO "${tabela}" (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      cols.map(c => campos[c]),
    );
    const id = Banco.ultimoId();
    registrar(tabela, id, 'inclusao', null, linha(tabela, id));
    return id;
  }

  // Só grava (e só registra no histórico) se algum campo mudou.
  function atualizar(tabela, id, campos, acao = 'edicao') {
    const antes = linha(tabela, id);
    if (!antes) throw new Error('Registro não encontrado.');
    if (!Object.keys(campos).some(c => antes[c] !== campos[c])) return false;
    const valores = tabela === 'funcionario' ? { ...campos, atualizado_em: Datas.agoraUtc() } : campos;
    const cols = Object.keys(valores);
    Banco.executar(
      `UPDATE "${tabela}" SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...cols.map(c => valores[c]), id],
    );
    registrar(tabela, id, acao, antes, linha(tabela, id));
    return true;
  }

  function remover(tabela, id) {
    const antes = linha(tabela, id);
    if (!antes) throw new Error('Registro não encontrado.');
    Banco.executar(`DELETE FROM "${tabela}" WHERE id = ?`, [id]);
    registrar(tabela, id, 'exclusao', antes, null);
  }

  function salvar(tabela, id, campos) {
    return Banco.transacao(() => {
      if (id) { atualizar(tabela, id, campos); return { id }; }
      return { id: inserir(tabela, campos) };
    });
  }

  const idOuNulo = d => (d.id ? Number(d.id) : null);

  // ---------- Clientes e centros de custo ----------

  function listarClientes() {
    return q('SELECT * FROM cliente ORDER BY nome COLLATE NOCASE');
  }

  function salvarCliente(d) {
    const id = idOuNulo(d);
    const erros = Regras.validarCliente(d, {
      nomeEmUso: nome => !!um('SELECT 1 FROM cliente WHERE nome = ? COLLATE NOCASE AND id IS NOT ?', [nome, id]),
    });
    if (temErros(erros)) return { erros };
    return salvar('cliente', id, { nome: T(d.nome) });
  }

  function listarCentros() {
    return q(`SELECT cc.*, c.nome AS cliente_nome FROM centro_custo cc
              JOIN cliente c ON c.id = cc.cliente_id
              ORDER BY c.nome COLLATE NOCASE, cc.codigo COLLATE NOCASE`);
  }

  function salvarCentro(d) {
    const id = idOuNulo(d);
    const erros = Regras.validarCentroCusto(d, {
      codigoEmUso: codigo => !!um('SELECT 1 FROM centro_custo WHERE codigo = ? COLLATE NOCASE AND id IS NOT ?', [codigo, id]),
    });
    if (temErros(erros)) return { erros };
    const uf = ouNulo(d.uf);
    return salvar('centro_custo', id, {
      codigo: T(d.codigo),
      cliente_id: Number(d.cliente_id),
      municipio: ouNulo(d.municipio),
      uf: uf ? uf.toUpperCase() : null,
    });
  }

  // ---------- Times ----------

  function listarTimes() {
    return q(`SELECT t.*, cc.codigo AS cc_codigo, c.id AS cliente_id, c.nome AS cliente_nome,
                (SELECT count(*) FROM funcionario f WHERE f.time_id = t.id AND f.ativo = 1) AS pessoas_ativas,
                (SELECT count(*) FROM funcionario f WHERE f.time_id = t.id) AS pessoas_total
              FROM time t
              JOIN centro_custo cc ON cc.id = t.centro_custo_id
              JOIN cliente c ON c.id = cc.cliente_id
              ORDER BY c.nome COLLATE NOCASE, cc.codigo COLLATE NOCASE, t.nome COLLATE NOCASE`)
      .map(t => ({ ...t, ocupacao: t.ativo ? Regras.calcularOcupacao(t.pessoas_ativas, t.limite_ausencias) : null }));
  }

  function obterTime(id) {
    return listarTimes().find(t => t.id === Number(id)) || null;
  }

  function salvarTime(d) {
    const id = idOuNulo(d);
    const erros = Regras.validarTime(d, {
      nomeEmUso: (ccId, nome) => !!um(
        'SELECT 1 FROM time WHERE centro_custo_id = ? AND nome = ? COLLATE NOCASE AND id IS NOT ?',
        [Number(ccId), nome, id]),
    });
    if (temErros(erros)) return { erros };
    return salvar('time', id, {
      centro_custo_id: Number(d.centro_custo_id),
      nome: T(d.nome),
      limite_ausencias: Regras.inteiro(d.limite_ausencias),
      tolerancia_dias: Regras.inteiro(d.tolerancia_dias),
    });
  }

  function inativarTime(id) {
    const t = obterTime(id);
    if (t.pessoas_ativas > 0) {
      return { erro: 'Este time tem pessoas ativas. Mude as pessoas de time ou desligue-as antes de inativar.' };
    }
    Banco.transacao(() => atualizar('time', t.id, { ativo: 0 }));
    return { id: t.id };
  }

  function reativarTime(id) {
    Banco.transacao(() => atualizar('time', Number(id), { ativo: 1 }, 'reativacao'));
    return { id: Number(id) };
  }

  function excluirTime(id) {
    const t = obterTime(id);
    if (t.pessoas_total > 0) {
      return { erro: 'Este time tem funcionários cadastrados (ativos ou desligados) e não pode ser excluído.' };
    }
    Banco.transacao(() => remover('time', t.id));
    return { id: t.id };
  }

  // ---------- Funcionários ----------

  const SQL_FUNCIONARIOS = `
    SELECT f.*, t.nome AS time_nome, t.ativo AS time_ativo, cc.codigo AS cc_codigo, c.nome AS cliente_nome,
      EXISTS (SELECT 1 FROM regra_substituto r WHERE r.funcionario_a_id = f.id OR r.funcionario_b_id = f.id) AS tem_par,
      EXISTS (SELECT 1 FROM periodo_aquisitivo pa JOIN ferias_periodo fp ON fp.periodo_aquisitivo_id = pa.id
              WHERE pa.funcionario_id = f.id) AS tem_ferias,
      EXISTS (SELECT 1 FROM periodo_aquisitivo pa WHERE pa.funcionario_id = f.id) AS tem_periodo
    FROM funcionario f
    JOIN time t ON t.id = f.time_id
    JOIN centro_custo cc ON cc.id = t.centro_custo_id
    JOIN cliente c ON c.id = cc.cliente_id`;

  function comFlags(f) {
    // D41: exclusão só sem férias e sem par de substitutos. Período aquisitivo também
    // impede, porque a exclusão apagaria o direito a férias registrado.
    return { ...f, pode_excluir: !f.tem_ferias && !f.tem_par && !f.tem_periodo };
  }

  function normalizarBusca(t) {
    return T(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // filtro: { busca, timeId, situacao: 'ativos' (padrão) | 'desligados' | 'todos' }
  function listarFuncionarios(filtro = {}) {
    const situacao = filtro.situacao || 'ativos';
    const busca = normalizarBusca(filtro.busca);
    return q(`${SQL_FUNCIONARIOS} ORDER BY f.nome COLLATE NOCASE`)
      .map(comFlags)
      .filter(f => situacao === 'todos' || (situacao === 'ativos' ? f.ativo === 1 : f.ativo === 0))
      .filter(f => !filtro.timeId || f.time_id === Number(filtro.timeId))
      .filter(f => !busca || normalizarBusca(f.nome).includes(busca) || normalizarBusca(f.matricula).includes(busca));
  }

  function obterFuncionario(id) {
    const f = um(`${SQL_FUNCIONARIOS} WHERE f.id = ?`, [Number(id)]);
    return f ? comFlags(f) : null;
  }

  function temFuncionarios() {
    return um('SELECT count(*) AS n FROM funcionario').n > 0;
  }

  function salvarFuncionario(d, hoje = Datas.hoje()) {
    const id = idOuNulo(d);
    const atual = id ? linha('funcionario', id) : null;
    const erros = Regras.validarFuncionario({ ...d, data_desligamento: atual ? atual.data_desligamento : null }, {
      hoje,
      matriculaEmUso: m => !!um('SELECT 1 FROM funcionario WHERE matricula = ? AND id IS NOT ?', [m, id]),
    });
    if (!erros.time_id && !linha('time', Number(d.time_id))) erros.time_id = 'Escolha o time.';
    if (temErros(erros)) return { erros };
    return salvar('funcionario', id, {
      matricula: T(d.matricula),
      nome: T(d.nome),
      data_admissao: T(d.data_admissao),
      time_id: Number(d.time_id),
      email: ouNulo(d.email),
      observacao: ouNulo(d.observacao),
    });
  }

  function paresDe(funcionarioId, ativo) {
    return q(`SELECT * FROM regra_substituto WHERE ativo = ? AND (funcionario_a_id = ? OR funcionario_b_id = ?)`,
      [ativo, funcionarioId, funcionarioId]);
  }

  // O funcionário sai da lista padrão e da ocupação. Os pares dele ficam inativos (D14).
  function desligarFuncionario(id, data) {
    const f = linha('funcionario', Number(id));
    if (!f.ativo) return { erro: 'Este funcionário já está desligado.' };
    const erros = Regras.validarDesligamento(data, f.data_admissao);
    if (temErros(erros)) return { erros };
    Banco.transacao(() => {
      atualizar('funcionario', f.id, { ativo: 0, data_desligamento: T(data) }, 'desligamento');
      for (const par of paresDe(f.id, 1)) atualizar('regra_substituto', par.id, { ativo: 0 });
    });
    return { id: f.id };
  }

  // Volta para ativo e limpa a data de desligamento. Os pares voltam se a outra pessoa estiver ativa.
  function reativarFuncionario(id) {
    const f = linha('funcionario', Number(id));
    if (f.ativo) return { erro: 'Este funcionário já está ativo.' };
    Banco.transacao(() => {
      atualizar('funcionario', f.id, { ativo: 1, data_desligamento: null }, 'reativacao');
      for (const par of paresDe(f.id, 0)) {
        const outro = par.funcionario_a_id === f.id ? par.funcionario_b_id : par.funcionario_a_id;
        if (linha('funcionario', outro).ativo) atualizar('regra_substituto', par.id, { ativo: 1 }, 'reativacao');
      }
    });
    return { id: f.id };
  }

  function excluirFuncionario(id) {
    const f = obterFuncionario(id);
    if (!f.pode_excluir) {
      return { erro: 'Este funcionário tem férias ou par de substitutos registrados. Use "Desligar".' };
    }
    Banco.transacao(() => remover('funcionario', f.id));
    return { id: f.id };
  }

  // ---------- Pares de substitutos (D14) ----------

  function listarPares() {
    return q(`SELECT r.*,
                fa.nome AS a_nome, fa.matricula AS a_matricula, fa.ativo AS a_ativo, ta.nome AS a_time,
                fb.nome AS b_nome, fb.matricula AS b_matricula, fb.ativo AS b_ativo, tb.nome AS b_time
              FROM regra_substituto r
              JOIN funcionario fa ON fa.id = r.funcionario_a_id JOIN time ta ON ta.id = fa.time_id
              JOIN funcionario fb ON fb.id = r.funcionario_b_id JOIN time tb ON tb.id = fb.time_id
              ORDER BY r.ativo DESC, fa.nome COLLATE NOCASE`);
  }

  function salvarPar(d) {
    const id = idOuNulo(d);
    const erros = Regras.validarPar(d, {
      parExiste: (a, b) => !!um(
        'SELECT 1 FROM regra_substituto WHERE funcionario_a_id = ? AND funcionario_b_id = ? AND id IS NOT ?', [a, b, id]),
    });
    if (temErros(erros)) return { erros };
    const [a, b] = Regras.normalizarPar(d.funcionario_a_id, d.funcionario_b_id);
    const atual = id ? linha('regra_substituto', id) : null;
    const mesmasPessoas = atual && atual.funcionario_a_id === a && atual.funcionario_b_id === b;
    for (const campo of ['funcionario_a_id', 'funcionario_b_id']) {
      const f = linha('funcionario', Number(d[campo]));
      if (!f) erros[campo] = 'Funcionário não encontrado.';
      else if (!f.ativo && !mesmasPessoas) erros[campo] = 'Escolha um funcionário ativo.';
    }
    if (temErros(erros)) return { erros };
    const fa = linha('funcionario', a);
    const fb = linha('funcionario', b);
    return salvar('regra_substituto', id, {
      funcionario_a_id: a,
      funcionario_b_id: b,
      tolerancia_dias: Regras.inteiro(d.tolerancia_dias),
      motivo: ouNulo(d.motivo),
      ativo: fa.ativo && fb.ativo ? 1 : 0,
    });
  }

  function excluirPar(id) {
    Banco.transacao(() => remover('regra_substituto', Number(id)));
    return { id: Number(id) };
  }

  // ---------- Histórico ----------

  const ACOES = {
    inclusao: 'Inclusão', edicao: 'Edição', exclusao: 'Exclusão', desligamento: 'Desligamento', reativacao: 'Reativação',
  };
  const TABELAS = {
    funcionario: 'Funcionário', time: 'Time', cliente: 'Cliente', centro_custo: 'Centro de custo',
    regra_substituto: 'Substitutos',
  };
  const ROTULOS = {
    matricula: 'Matrícula', nome: 'Nome', data_admissao: 'Admissão', time_id: 'Time', email: 'E-mail',
    observacao: 'Observação', ativo: 'Situação', data_desligamento: 'Desligamento', limite_ausencias: 'Limite',
    tolerancia_dias: 'Tolerância (dias)', centro_custo_id: 'Centro de custo', cliente_id: 'Cliente',
    codigo: 'Código', municipio: 'Município', uf: 'UF', funcionario_a_id: 'Pessoa 1', funcionario_b_id: 'Pessoa 2',
    motivo: 'Motivo',
  };
  const IGNORAR = new Set(['id', 'criado_em', 'atualizado_em']);

  function listarHistorico(filtro = {}) {
    const tabela = filtro.tabela || null;
    return q(`SELECT * FROM historico_alteracao WHERE (? IS NULL OR tabela = ?) ORDER BY id DESC LIMIT ?`,
      [tabela, tabela, filtro.limite || 100]);
  }

  function tabelasDoHistorico() {
    return q('SELECT DISTINCT tabela FROM historico_alteracao ORDER BY tabela').map(l => l.tabela);
  }

  function nomeFuncionario(id) {
    const f = linha('funcionario', id);
    return f ? `${f.nome} (${f.matricula})` : `funcionário #${id}`;
  }

  function valorLegivel(tabela, campo, v) {
    if (v === null || v === undefined || v === '') return '(vazio)';
    if (campo === 'ativo') return tabela === 'funcionario' ? (v ? 'Ativo' : 'Desligado') : (v ? 'Ativo' : 'Inativo');
    if (campo.startsWith('data_')) return Datas.formatar(v);
    if (campo === 'time_id') { const t = linha('time', v); return t ? t.nome : `time #${v}`; }
    if (campo === 'centro_custo_id') { const c = linha('centro_custo', v); return c ? c.codigo : `#${v}`; }
    if (campo === 'cliente_id') { const c = linha('cliente', v); return c ? c.nome : `#${v}`; }
    if (campo === 'funcionario_a_id' || campo === 'funcionario_b_id') return nomeFuncionario(v);
    return String(v);
  }

  function descreverCampos(tabela, obj) {
    return Object.keys(obj).filter(c => !IGNORAR.has(c) && obj[c] !== null)
      .map(c => `${ROTULOS[c] || c}: ${valorLegivel(tabela, c, obj[c])}`).join('; ');
  }

  function descreverMudancas(tabela, antes, depois) {
    return Object.keys(depois).filter(c => !IGNORAR.has(c) && antes[c] !== depois[c])
      .map(c => `${ROTULOS[c] || c}: ${valorLegivel(tabela, c, antes[c])} → ${valorLegivel(tabela, c, depois[c])}`)
      .join('; ');
  }

  function descreverRegistro(tabela, id, obj) {
    if (!obj) return `#${id}`;
    if (tabela === 'funcionario') return `${obj.nome} (${obj.matricula})`;
    if (tabela === 'centro_custo') return obj.codigo;
    if (tabela === 'regra_substituto') {
      return `${nomeFuncionario(obj.funcionario_a_id)} × ${nomeFuncionario(obj.funcionario_b_id)}`;
    }
    return obj.nome || `#${id}`;
  }

  // Texto legível de uma linha do histórico, para a tela e o Excel espelho.
  function descreverHistorico(h) {
    const antes = h.dados_antes ? JSON.parse(h.dados_antes) : null;
    const depois = h.dados_depois ? JSON.parse(h.dados_depois) : null;
    let dados;
    if (antes && depois) dados = descreverMudancas(h.tabela, antes, depois);
    else dados = descreverCampos(h.tabela, depois || antes || {});
    return {
      quando: Datas.formatar(h.em),
      acao: ACOES[h.acao] || h.acao,
      tabela: TABELAS[h.tabela] || h.tabela,
      registro: descreverRegistro(h.tabela, h.registro_id, depois || antes),
      dados,
    };
  }

  // ---------- Dados de exemplo (D44) ----------

  // Só em banco sem funcionários. Reaproveita clientes, centros e times que já existirem.
  function carregarExemplo(dados = window.DADOS_EXEMPLO, hoje = Datas.hoje()) {
    if (!dados) return { erro: 'Os dados de exemplo não estão neste arquivo.' };
    if (temFuncionarios()) return { erro: 'Os dados de exemplo só podem ser carregados num banco sem funcionários.' };
    return Banco.transacao(() => {
      const idCliente = {};
      for (const c of dados.clientes) {
        const existente = um('SELECT id FROM cliente WHERE nome = ? COLLATE NOCASE', [c.nome]);
        idCliente[c.nome] = existente ? existente.id : inserir('cliente', { nome: c.nome });
      }
      const idCentro = {};
      for (const cc of dados.centros_custo) {
        const existente = um('SELECT id FROM centro_custo WHERE codigo = ? COLLATE NOCASE', [cc.codigo]);
        idCentro[cc.codigo] = existente ? existente.id : inserir('centro_custo', {
          codigo: cc.codigo, cliente_id: idCliente[cc.cliente], municipio: cc.municipio || null, uf: cc.uf || null,
        });
      }
      const idTime = {};
      for (const t of dados.times) {
        const ccId = idCentro[t.centro_custo];
        const existente = um('SELECT id FROM time WHERE centro_custo_id = ? AND nome = ? COLLATE NOCASE', [ccId, t.nome]);
        idTime[`${t.centro_custo}|${t.nome}`] = existente ? existente.id : inserir('time', {
          centro_custo_id: ccId, nome: t.nome, limite_ausencias: t.limite_ausencias, tolerancia_dias: t.tolerancia_dias,
        });
      }
      const idFuncionario = {};
      for (const f of dados.funcionarios) {
        const campos = {
          matricula: f.matricula, nome: f.nome, data_admissao: f.data_admissao,
          time_id: idTime[`${f.centro_custo}|${f.time}`], email: f.email || null, observacao: null,
        };
        const erros = Regras.validarFuncionario(campos, { hoje, matriculaEmUso: () => false });
        if (temErros(erros)) throw new Error(`Dado de exemplo inválido (${f.matricula}): ${Object.values(erros).join(' ')}`);
        idFuncionario[f.matricula] = inserir('funcionario', campos);
      }
      for (const s of dados.substitutos) {
        const [a, b] = Regras.normalizarPar(idFuncionario[s.matricula_a], idFuncionario[s.matricula_b]);
        inserir('regra_substituto', {
          funcionario_a_id: a, funcionario_b_id: b, tolerancia_dias: s.tolerancia_dias, motivo: s.motivo || null,
        });
      }
      return { funcionarios: dados.funcionarios.length };
    });
  }

  return {
    listarClientes, salvarCliente, listarCentros, salvarCentro,
    listarTimes, obterTime, salvarTime, inativarTime, reativarTime, excluirTime,
    listarFuncionarios, obterFuncionario, temFuncionarios, salvarFuncionario,
    desligarFuncionario, reativarFuncionario, excluirFuncionario,
    listarPares, salvarPar, excluirPar,
    listarHistorico, tabelasDoHistorico, descreverHistorico,
    carregarExemplo, TABELAS,
  };
})();
