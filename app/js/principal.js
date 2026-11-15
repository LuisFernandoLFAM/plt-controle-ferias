// Início do app: pasta de dados, abertura e migração do banco (D38, D39),
// gravação (banco + Excel espelho) e navegação entre as telas.
'use strict';

const App = (() => {
  const { $ } = UI;
  const TELAS_INICIO = ['tela-carregando', 'tela-nao-suportado', 'tela-inicio', 'tela-criar'];
  const TELAS_APP = {
    funcionarios: TelaFuncionarios,
    times: TelaTimes,
    substitutos: TelaSubstitutos,
    historico: TelaHistorico,
  };
  const MSG = {
    fase0: 'Este é um banco de teste antigo. Escolha uma pasta nova.',
    maisNovo: 'Este banco foi criado por uma versão mais nova do app. Use o arquivo mais recente.',
    invalido: `O arquivo ${Arquivo.NOME_BANCO} desta pasta não é um banco deste app. Escolha outra pasta.`,
  };

  const estado = {
    pasta: null,          // FileSystemDirectoryHandle da pasta de dados
    pastaGuardada: null,  // pasta da última vez (vinda do IndexedDB)
    ultimaGravacao: null, // Date
    ocupado: false,
    tela: 'funcionarios',
  };

  // ---------- Utilidades de tela ----------

  function mostrarTela(id) {
    for (const t of TELAS_INICIO) $(t).hidden = t !== id;
    for (const nome of Object.keys(TELAS_APP)) $(`tela-${nome}`).hidden = `tela-${nome}` !== id;
    $('menu').hidden = !id.startsWith('tela-') || TELAS_INICIO.includes(id);
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

  function atualizarRodape() {
    $('rodape-pasta').textContent = estado.pasta ? 'Pasta: ' + estado.pasta.name : 'Nenhuma pasta aberta';
    $('rodape-gravacao').textContent = estado.ultimaGravacao
      ? 'Última gravação: ' + Datas.formatar(estado.ultimaGravacao)
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

  function irPara(nome) {
    estado.tela = nome;
    document.querySelectorAll('#menu button').forEach(b => {
      if (b.dataset.tela === nome) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    mostrarTela(`tela-${nome}`);
    TELAS_APP[nome].desenhar();
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

  // Depois de cada alteração: grava e redesenha a tela atual.
  async function alterou() {
    await gravar();
    TELAS_APP[estado.tela].desenhar();
  }

  // ---------- Pasta e banco ----------

  function recusar(texto) {
    Banco.fechar();
    estado.pasta = null;
    atualizarRodape();
    mensagem(texto);
    mostrarTela('tela-inicio');
  }

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
      recusar(MSG.invalido);
      return;
    }

    const situacao = Banco.situacao();
    if (situacao === 'fase0') { recusar(MSG.fase0); return; }
    if (situacao === 'mais_novo') { recusar(MSG.maisNovo); return; }
    if (situacao === 'desconhecido') { recusar(MSG.invalido); return; }

    estado.ultimaGravacao = lido.modificadoEm;
    atualizarRodape();

    if (situacao === 'desatualizado' || situacao === 'vazio') {
      // D38: backup antes de mexer; migrações numa transação; se falhar, nada muda no arquivo.
      try {
        await Arquivo.fazerBackup(pasta, lido.dados, new Date(), '_antes_migracao');
      } catch (e) {
        console.error(e);
        recusar('Não consegui fazer a cópia de segurança antes de atualizar o banco. Nada foi alterado.');
        return;
      }
      try {
        Banco.migrar();
      } catch (e) {
        console.error(e);
        recusar(e.message + ' Nada foi alterado.');
        return;
      }
      await gravar();
      mensagem('O banco foi atualizado para a versão nova do app. Uma cópia da versão anterior ficou na pasta "backups".', 'ok');
    } else {
      try {
        await Arquivo.fazerBackup(pasta, lido.dados);
      } catch (e) {
        console.error(e);
        mensagem('O banco foi aberto, mas não consegui fazer a cópia de segurança na pasta "backups".', 'aviso');
      }
    }
    irPara('funcionarios');
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
    Banco.migrar();
    await Arquivo.pastaBackups(estado.pasta);
    await gravar();
    mensagem('Banco criado nesta pasta.', 'ok');
    irPara('funcionarios');
  }

  // ---------- Início ----------

  async function iniciar() {
    if (!Arquivo.suportado()) {
      mostrarTela('tela-nao-suportado');
      return;
    }

    const comLimpeza = fn => () => executarAcao(() => { limparMensagem(); return fn(); });
    $('btn-escolher-pasta').addEventListener('click', comLimpeza(escolherPasta));
    $('btn-outra-pasta').addEventListener('click', comLimpeza(escolherPasta));
    $('btn-pasta-anterior').addEventListener('click', comLimpeza(() => usarPasta(estado.pastaGuardada)));
    $('btn-criar-banco').addEventListener('click', () => executarAcao(criarBanco));
    document.querySelectorAll('#menu button').forEach(b => {
      b.addEventListener('click', () => { limparMensagem(); irPara(b.dataset.tela); });
    });
    for (const tela of Object.values(TELAS_APP)) tela.iniciar();

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

  const pronto = iniciar();

  return { estado, pronto, executarAcao, mensagem, limparMensagem, irPara, alterou, gravar, usarPasta, criarBanco, MSG };
})();
