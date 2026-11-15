// Acesso à pasta de dados: escolha da pasta, permissão, leitura e gravação
// de arquivos e cópias de segurança. Usa a File System Access API (Edge e Chrome).
'use strict';

const Arquivo = (() => {
  const NOME_BANCO = 'ferias.sqlite';
  const NOME_ESPELHO = 'ferias_espelho.xlsx';
  const PASTA_BACKUPS = 'backups';
  const MAX_BACKUPS = 30;
  const PADRAO_BACKUP = /^ferias_\d{4}-\d{2}-\d{2}_\d{4}\.sqlite$/;

  const IDB_NOME = 'controle_ferias';
  const IDB_LOJA = 'config';
  const IDB_CHAVE_PASTA = 'pasta_dados';

  function suportado() {
    return typeof window.showDirectoryPicker === 'function';
  }

  // ---------- IndexedDB: guarda o identificador da pasta entre aberturas ----------

  function abrirIdb() {
    return new Promise((resolver, rejeitar) => {
      const req = indexedDB.open(IDB_NOME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_LOJA);
      req.onsuccess = () => resolver(req.result);
      req.onerror = () => rejeitar(req.error);
    });
  }

  async function usarIdb(modo, operacao) {
    const idb = await abrirIdb();
    return new Promise((resolver, rejeitar) => {
      const tx = idb.transaction(IDB_LOJA, modo);
      const req = operacao(tx.objectStore(IDB_LOJA));
      tx.oncomplete = () => { idb.close(); resolver(req.result); };
      tx.onerror = () => { idb.close(); rejeitar(tx.error); };
      tx.onabort = () => { idb.close(); rejeitar(tx.error); };
    });
  }

  function guardarPasta(pasta) {
    return usarIdb('readwrite', loja => loja.put(pasta, IDB_CHAVE_PASTA));
  }

  async function lerPastaGuardada() {
    try {
      return (await usarIdb('readonly', loja => loja.get(IDB_CHAVE_PASTA))) || null;
    } catch {
      return null; // sem IndexedDB: o usuário só escolhe a pasta de novo
    }
  }

  // ---------- Pasta e permissão ----------

  function escolherPasta() {
    return window.showDirectoryPicker({ id: 'controle-ferias', mode: 'readwrite' });
  }

  // Precisa ser chamada a partir de um clique (exigência do navegador).
  async function pedirPermissao(pasta) {
    const opcoes = { mode: 'readwrite' };
    if ((await pasta.queryPermission(opcoes)) === 'granted') return true;
    return (await pasta.requestPermission(opcoes)) === 'granted';
  }

  // ---------- Leitura e gravação ----------

  // Devolve { dados, modificadoEm } ou null se a pasta não tem o banco.
  async function lerBanco(pasta) {
    let arquivo;
    try {
      arquivo = await (await pasta.getFileHandle(NOME_BANCO)).getFile();
    } catch (e) {
      if (e.name === 'NotFoundError') return null;
      throw e;
    }
    return {
      dados: new Uint8Array(await arquivo.arrayBuffer()),
      modificadoEm: new Date(arquivo.lastModified),
    };
  }

  // Gravação segura: createWritable() escreve num arquivo temporário
  // (ex.: ferias.sqlite.crswap). Só no close() o navegador troca o arquivo
  // principal pelo temporário. Se algo falhar antes, o principal fica intacto.
  async function gravarArquivo(pasta, nome, bytes) {
    const handle = await pasta.getFileHandle(nome, { create: true });
    const escrita = await handle.createWritable();
    try {
      await escrita.write(bytes);
      await escrita.close();
    } catch (e) {
      try { await escrita.abort(); } catch { /* já fechado */ }
      throw e;
    }
  }

  function gravarBanco(pasta, bytes) {
    return gravarArquivo(pasta, NOME_BANCO, bytes);
  }

  function gravarEspelho(pasta, bytes) {
    return gravarArquivo(pasta, NOME_ESPELHO, bytes);
  }

  // ---------- Cópias de segurança ----------

  function pastaBackups(pasta) {
    return pasta.getDirectoryHandle(PASTA_BACKUPS, { create: true });
  }

  function carimbo(d) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }

  // Copia o banco para backups/ferias_AAAA-MM-DD_HHMM.sqlite e apaga as mais antigas.
  async function fazerBackup(pasta, bytes, agora = new Date()) {
    const dir = await pastaBackups(pasta);
    const nome = `ferias_${carimbo(agora)}.sqlite`;
    await gravarArquivo(dir, nome, bytes);
    await limparBackups(dir);
    return nome;
  }

  async function limparBackups(dir) {
    const nomes = [];
    for await (const [nome, handle] of dir.entries()) {
      if (handle.kind === 'file' && PADRAO_BACKUP.test(nome)) nomes.push(nome);
    }
    nomes.sort(); // o nome tem a data no formato AAAA-MM-DD_HHMM: ordem alfabética = ordem de data
    const excedentes = nomes.slice(0, Math.max(0, nomes.length - MAX_BACKUPS));
    for (const nome of excedentes) await dir.removeEntry(nome);
  }

  return {
    NOME_BANCO, NOME_ESPELHO, MAX_BACKUPS,
    suportado, guardarPasta, lerPastaGuardada, escolherPasta, pedirPermissao,
    lerBanco, gravarBanco, gravarEspelho, pastaBackups, fazerBackup,
  };
})();
