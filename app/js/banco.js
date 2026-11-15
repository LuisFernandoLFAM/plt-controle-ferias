// Banco de dados SQLite em memória (sql.js) e migrações (D38, D39).
// O arquivo em disco é gravado por arquivo.js a partir de exportar().
'use strict';

const Banco = (() => {
  let SQL = null;
  let db = null;
  // Lista { versao, nome, sql } embutida pelo build. Os testes podem trocar com definirMigracoes().
  let migracoes = Array.isArray(window.MIGRACOES) ? window.MIGRACOES : [];

  function base64ParaBytes(texto) {
    const bin = atob(texto);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function iniciar() {
    if (SQL) return;
    if (typeof window.WASM_BASE64 !== 'string') {
      throw new Error('arquivo incompleto. Use o dist/controle_ferias.html gerado pelo build.');
    }
    SQL = await initSqlJs({ wasmBinary: base64ParaBytes(window.WASM_BASE64) });
  }

  function prepararConexao() {
    db.run('PRAGMA foreign_keys = ON');
  }

  function fechar() {
    if (db) { db.close(); db = null; }
  }

  function aberto() {
    return db !== null;
  }

  // Banco vazio (sem tabelas). Depois, chame migrar().
  async function criarNovo() {
    await iniciar();
    fechar();
    db = new SQL.Database();
    prepararConexao();
  }

  // Lança erro se os bytes não forem um banco SQLite válido.
  async function abrir(bytes) {
    await iniciar();
    fechar();
    const novo = new SQL.Database(bytes);
    try {
      novo.exec('SELECT count(*) FROM sqlite_master');
    } catch (e) {
      novo.close();
      throw e;
    }
    db = novo;
    prepararConexao();
  }

  function consultar(sql, parametros = []) {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(parametros);
      const linhas = [];
      while (stmt.step()) linhas.push(stmt.getAsObject());
      return linhas;
    } finally {
      stmt.free();
    }
  }

  function executar(sql, parametros = []) {
    db.run(sql, parametros);
  }

  function ultimoId() {
    return consultar('SELECT last_insert_rowid() AS id')[0].id;
  }

  // Tudo ou nada: se fn lançar erro, nada do que ela fez fica no banco.
  function transacao(fn) {
    db.run('BEGIN');
    try {
      const resultado = fn();
      db.run('COMMIT');
      return resultado;
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
  }

  function tabelas() {
    return consultar(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).map(l => l.name);
  }

  function exportar() {
    return db.export();
  }

  // ---------- Versão e migrações ----------

  function definirMigracoes(lista) {
    migracoes = lista;
  }

  function versaoApp() {
    return migracoes.reduce((max, m) => Math.max(max, m.versao), 0);
  }

  function versaoBanco() {
    return consultar('PRAGMA user_version')[0].user_version;
  }

  // 'vazio'         banco sem tabelas (novo): precisa das migrações
  // 'desatualizado' versão menor que a do app: precisa das migrações
  // 'ok'            mesma versão do app
  // 'mais_novo'     criado por uma versão mais nova do app: não abrir
  // 'fase0'         banco de teste da Fase 0 (user_version 0 com a tabela cliente): não abrir (D39)
  // 'desconhecido'  user_version 0 com outras tabelas: não é um banco deste app
  function situacao() {
    const versao = versaoBanco();
    if (versao === 0) {
      const lista = tabelas();
      if (lista.length === 0) return 'vazio';
      if (lista.includes('cliente')) return 'fase0';
      return 'desconhecido';
    }
    const app = versaoApp();
    if (versao > app) return 'mais_novo';
    if (versao < app) return 'desatualizado';
    return 'ok';
  }

  // Aplica as migrações que faltam numa transação só. Se uma falhar, desfaz todas.
  // Devolve a quantidade aplicada.
  function migrar() {
    const atual = versaoBanco();
    const pendentes = migracoes.filter(m => m.versao > atual).sort((a, b) => a.versao - b.versao);
    if (pendentes.length === 0) return 0;
    let emAndamento = null;
    db.run('BEGIN');
    try {
      for (const m of pendentes) {
        emAndamento = m;
        db.exec(m.sql);
        db.run(`PRAGMA user_version = ${Number(m.versao)}`);
      }
      db.run('COMMIT');
    } catch (e) {
      db.run('ROLLBACK');
      throw new Error(`Não foi possível atualizar o banco (${emAndamento.nome}): ${e.message}`);
    }
    return pendentes.length;
  }

  return {
    iniciar, criarNovo, abrir, fechar, aberto, consultar, executar, ultimoId,
    transacao, tabelas, exportar,
    definirMigracoes, versaoApp, versaoBanco, situacao, migrar,
  };
})();
