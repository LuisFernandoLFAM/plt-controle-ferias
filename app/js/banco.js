// Banco de dados SQLite em memória (sql.js). O arquivo em disco é gravado
// por arquivo.js a partir de exportar().
'use strict';

const Banco = (() => {
  let SQL = null;
  let db = null;

  function base64ParaBytes(texto) {
    const bin = atob(texto);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // No arquivo final (dist/), o build embute o .wasm e o schema.
  // Em desenvolvimento (servidor local), eles são lidos das pastas do projeto.
  async function lerWasm() {
    if (typeof window.WASM_BASE64 === 'string') return base64ParaBytes(window.WASM_BASE64);
    const resp = await fetch('../vendor/sql-wasm.wasm');
    if (!resp.ok) throw new Error('não encontrei vendor/sql-wasm.wasm');
    return new Uint8Array(await resp.arrayBuffer());
  }

  async function lerSchema() {
    if (typeof window.SCHEMA_SQL === 'string') return window.SCHEMA_SQL;
    const resp = await fetch('../sql/schema.sql');
    if (!resp.ok) throw new Error('não encontrei sql/schema.sql');
    return resp.text();
  }

  async function iniciar() {
    if (!SQL) SQL = await initSqlJs({ wasmBinary: await lerWasm() });
  }

  function prepararConexao() {
    db.run('PRAGMA foreign_keys = ON');
  }

  function fechar() {
    if (db) { db.close(); db = null; }
  }

  async function criarNovo() {
    await iniciar();
    fechar();
    db = new SQL.Database();
    db.exec(await lerSchema());
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

  function registrarHistorico(tabela, registroId, acao, antes, depois) {
    executar(
      `INSERT INTO historico_alteracao (tabela, registro_id, acao, dados_antes, dados_depois, usuario)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tabela, registroId, acao,
        antes == null ? null : JSON.stringify(antes),
        depois == null ? null : JSON.stringify(depois),
        'gestor'],
    );
  }

  function tabelas() {
    return consultar(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).map(l => l.name);
  }

  function exportar() {
    return db.export();
  }

  return {
    iniciar, criarNovo, abrir, fechar, consultar, executar, ultimoId,
    transacao, registrarHistorico, tabelas, exportar,
  };
})();
