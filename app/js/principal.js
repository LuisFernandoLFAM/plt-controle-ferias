// Tela e eventos da Fase 0: escolher a pasta, criar/abrir o banco,
// cadastrar e remover clientes, gravar e gerar o Excel espelho.
'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const TELAS = ['tela-carregando', 'tela-nao-suportado', 'tela-inicio', 'tela-criar', 'tela-clientes'];

  const estado = {
    pasta: null,          // FileSystemDirectoryHandle da pasta de dados
    pastaGuardada: null,  // pasta da última vez (vinda do IndexedDB)
    ultimaGravacao: null, // Date
    ocupado: false,
  };

  // ---------- Utilidades de tela ----------

  function mostrarTela(id) {
    for (const t of TELAS) $(t).hidden = t !== id;
  }

  function mensagem(texto, tipo = 'erro') {
    const el = $('mensagem');
    el.textContent = texto;
    el.className = 'mensagem ' + tipo;
    el.hidden = false;
  }

  function limparMensagem() {
    $('mensagem').hidden = true;
  }

  const p2 = n => String(n).padStart(2, '0');
  function dataHora(d) {
    return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  }

  // historico_alteracao.em vem do SQLite em UTC ("AAAA-MM-DD HH:MM:SS").
  function utcParaLocal(texto) {
    const d = new Date(texto.replace(' ', 'T') + 'Z');
    return isNaN(d) ? texto : dataHora(d);
  }

  function atualizarRodape() {
    $('rodape-pasta').textContent = estado.pasta ? 'Pasta: ' + estado.pasta.name : 'Nenhuma pasta aberta';
    $('rodape-gravacao').textContent = estado.ultimaGravacao
      ? 'Última gravação: ' + dataHora(estado.ultimaGravacao)
      : '';
  }

  // Evita cliques repetidos enquanto uma operação está em andamento.
  async function executarAcao(fn) {
    if (estado.ocupado) return;
    estado.ocupado = true;
    document.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try {
      await fn();
    } catch (e) {
      console.error(e);
      mensagem('Algo deu errado: ' + (e && e.message ? e.message : e));
    } finally {
      estado.ocupado = false;
      document.querySelectorAll('button').forEach(b => { b.disabled = false; });
    }
  }

  // ---------- Gravação ----------

  async function gravar() {
    const bytes = Banco.exportar();
    await Arquivo.gravarBanco(estado.pasta, bytes);
    estado.ultimaGravacao = new Date();
    atualizarRodape();
    try {
      await Arquivo.gravarEspelho(estado.pasta, Espelho.gerar());
    } catch (e) {
      console.error(e);
      mensagem('Os dados foram gravados, mas o Excel espelho não foi atualizado. '
        + 'Se ele estiver aberto no Excel, feche o Excel. O espelho será refeito na próxima alteração.', 'aviso');
    }
  }

  // ---------- Pasta e banco ----------

  async function usarPasta(pasta) {
    if (!(await Arquivo.pedirPermissao(pasta))) {
      mensagem('O app precisa de permissão para usar a pasta. Clique de novo e escolha "Permitir" ou "Editar arquivos".');
      return;
    }
    estado.pasta = pasta;
    estado.ultimaGravacao = null;
    await Arquivo.guardarPasta(pasta);
    atualizarRodape();

    const lido = await Arquivo.lerBanco(pasta);
    if (!lido) {
      $('nome-pasta-criar').textContent = pasta.name;
      mostrarTela('tela-criar');
      return;
    }

    try {
      await Banco.abrir(lido.dados);
    } catch (e) {
      console.error(e);
      mensagem(`O arquivo ${Arquivo.NOME_BANCO} desta pasta não é um banco válido. Escolha outra pasta.`);
      mostrarTela('tela-inicio');
      return;
    }
    estado.ultimaGravacao = lido.modificadoEm;
    atualizarRodape();

    try {
      await Arquivo.fazerBackup(pasta, lido.dados);
    } catch (e) {
      console.error(e);
      mensagem('O banco foi aberto, mas não consegui fazer a cópia de segurança na pasta "backups".', 'aviso');
    }
    abrirTelaClientes();
  }

  async function escolherPasta() {
    let pasta;
    try {
      pasta = await Arquivo.escolherPasta();
    } catch (e) {
      if (e.name === 'AbortError') return; // o usuário fechou a janela sem escolher
      throw e;
    }
    await usarPasta(pasta);
  }

  async function criarBanco() {
    await Banco.criarNovo();
    await Arquivo.pastaBackups(estado.pasta);
    await gravar();
    mensagem('Banco criado nesta pasta.', 'ok');
    abrirTelaClientes();
  }

  // ---------- Clientes ----------

  function abrirTelaClientes() {
    mostrarTela('tela-clientes');
    desenharClientes();
    desenharHistorico();
    $('campo-nome').focus();
  }

  function desenharClientes() {
    const clientes = Banco.consultar('SELECT id, nome FROM cliente ORDER BY nome COLLATE NOCASE');
    const lista = $('lista-clientes');
    lista.replaceChildren();
    for (const c of clientes) {
      const li = document.createElement('li');
      const nome = document.createElement('span');
      nome.textContent = c.nome;
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.textContent = 'Remover';
      botao.addEventListener('click', () => executarAcao(() => removerCliente(c.id)));
      li.append(nome, botao);
      lista.append(li);
    }
    $('lista-vazia').hidden = clientes.length > 0;
  }

  function desenharHistorico() {
    const linhas = Banco.consultar(
      'SELECT em, acao, tabela, registro_id, dados_antes, dados_depois FROM historico_alteracao ORDER BY id DESC LIMIT 10',
    );
    const corpo = $('tabela-historico').tBodies[0];
    corpo.replaceChildren();
    for (const h of linhas) {
      const tr = document.createElement('tr');
      const celulas = [utcParaLocal(h.em), h.acao, h.tabela, String(h.registro_id), h.dados_depois || h.dados_antes || ''];
      celulas.forEach((texto, i) => {
        const td = document.createElement('td');
        td.textContent = texto;
        if (i === 4) td.className = 'dados';
        tr.append(td);
      });
      corpo.append(tr);
    }
  }

  async function adicionarCliente() {
    const campo = $('campo-nome');
    const nome = campo.value.trim().replace(/\s+/g, ' ');
    if (!nome) {
      mensagem('Digite o nome do cliente.', 'aviso');
      return;
    }
    const existe = Banco.consultar('SELECT 1 FROM cliente WHERE nome = ? COLLATE NOCASE', [nome]);
    if (existe.length) {
      mensagem('Já existe um cliente com esse nome.', 'aviso');
      return;
    }
    Banco.transacao(() => {
      Banco.executar('INSERT INTO cliente (nome) VALUES (?)', [nome]);
      const id = Banco.ultimoId();
      Banco.registrarHistorico('cliente', id, 'insert', null, { id, nome });
    });
    limparMensagem();
    campo.value = '';
    desenharClientes();
    desenharHistorico();
    await gravar();
    campo.focus();
  }

  async function removerCliente(id) {
    const [cliente] = Banco.consultar('SELECT id, nome FROM cliente WHERE id = ?', [id]);
    if (!cliente) return;
    if (!confirm(`Remover o cliente "${cliente.nome}"?`)) return;
    try {
      Banco.transacao(() => {
        Banco.executar('DELETE FROM cliente WHERE id = ?', [id]);
        Banco.registrarHistorico('cliente', id, 'delete', cliente, null);
      });
    } catch (e) {
      if (/FOREIGN KEY/i.test(e.message)) {
        mensagem('Este cliente está ligado a um centro de custo e não pode ser removido.', 'aviso');
        return;
      }
      throw e;
    }
    limparMensagem();
    desenharClientes();
    desenharHistorico();
    await gravar();
  }

  // ---------- Início ----------

  async function iniciar() {
    if (!Arquivo.suportado()) {
      mostrarTela('tela-nao-suportado');
      return;
    }

    $('btn-escolher-pasta').addEventListener('click', () => executarAcao(() => { limparMensagem(); return escolherPasta(); }));
    $('btn-outra-pasta').addEventListener('click', () => executarAcao(() => { limparMensagem(); return escolherPasta(); }));
    $('btn-pasta-anterior').addEventListener('click', () => executarAcao(() => { limparMensagem(); return usarPasta(estado.pastaGuardada); }));
    $('btn-criar-banco').addEventListener('click', () => executarAcao(criarBanco));
    $('form-cliente').addEventListener('submit', ev => { ev.preventDefault(); executarAcao(adicionarCliente); });

    try {
      await Banco.iniciar();
    } catch (e) {
      console.error(e);
      mostrarTela('tela-inicio');
      $('btn-escolher-pasta').hidden = true;
      mensagem('Não foi possível carregar o banco de dados do app: ' + e.message);
      return;
    }

    estado.pastaGuardada = await Arquivo.lerPastaGuardada();
    if (estado.pastaGuardada) {
      const btn = $('btn-pasta-anterior');
      btn.textContent = `Abrir a pasta de antes (${estado.pastaGuardada.name})`;
      btn.hidden = false;
    }
    atualizarRodape();
    mostrarTela('tela-inicio');
  }

  iniciar();
})();
