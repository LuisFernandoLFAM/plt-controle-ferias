// Tela Funcionários: lista com busca e filtros; incluir, editar, desligar, reativar e excluir.
'use strict';

const TelaFuncionarios = (() => {
  const { $, el, botao, linhaTabela, opcoes } = UI;
  const CONFIRMA_EXCLUSAO = 'Excluir definitivamente? Use só para cadastro feito por engano.';

  function rotuloTime(t) {
    return `${t.cliente_nome} · ${t.cc_codigo} · ${t.nome}`;
  }

  function desenhar() {
    const times = Cadastro.listarTimes();
    opcoes($('filtro-time'), times.map(t => ({ valor: t.id, texto: `${t.cc_codigo} · ${t.nome}` })), { vazio: 'Todos os times' });

    const existem = Cadastro.temFuncionarios();
    $('btn-exemplo').hidden = existem || !window.DADOS_EXEMPLO;

    const lista = Cadastro.listarFuncionarios({
      busca: $('filtro-busca').value,
      timeId: $('filtro-time').value,
      situacao: $('filtro-situacao').value,
    });

    const corpo = $('tabela-funcionarios').tBodies[0];
    corpo.replaceChildren(...lista.map(f => linhaTabela([
      f.matricula,
      el('td', {}, f.nome, f.email ? el('div', { class: 'detalhe' }, f.email) : null),
      `${f.cc_codigo} · ${f.time_nome}`,
      Datas.formatar(f.data_admissao),
      f.ativo ? 'Ativo' : `Desligado em ${Datas.formatar(f.data_desligamento)}`,
      el('td', { class: 'acoes' },
        botao('Editar', () => abrirFormulario(f)),
        f.ativo ? botao('Desligar', () => desligar(f)) : botao('Reativar', () => reativar(f)),
        f.pode_excluir ? botao('Excluir', () => excluir(f), 'perigo') : null),
    ])));

    $('tabela-funcionarios').hidden = lista.length === 0;
    $('func-vazio').hidden = lista.length > 0;
    $('func-vazio').textContent = existem
      ? 'Nenhum funcionário encontrado com esses filtros.'
      : 'Nenhum funcionário cadastrado. Clique em "Novo funcionário" ou em "Carregar dados de exemplo".';
    $('func-contagem').textContent = lista.length === 1 ? '1 funcionário' : `${lista.length} funcionários`;
  }

  function abrirFormulario(f = null) {
    const times = Cadastro.listarTimes().filter(t => t.ativo || (f && t.id === f.time_id));
    if (times.length === 0) {
      App.mensagem('Cadastre um time antes, na tela Times.', 'aviso');
      return;
    }
    UI.abrirDialogo('dlg-funcionario', {
      titulo: f ? 'Editar funcionário' : 'Novo funcionário',
      valores: f || {},
      prepararCampos: form => {
        opcoes(form.elements.time_id, times.map(t => ({ valor: t.id, texto: rotuloTime(t) })), { vazio: 'Escolha o time' });
        form.elements.data_admissao.max = Datas.hoje();
      },
      aoSalvar: dados => Cadastro.salvarFuncionario({ ...dados, id: f ? f.id : null }),
    });
  }

  function desligar(f) {
    UI.abrirDialogo('dlg-desligar', {
      titulo: `Desligar ${f.nome}`,
      valores: { data_desligamento: Datas.hoje() },
      prepararCampos: form => { form.elements.data_desligamento.min = f.data_admissao; },
      aoSalvar: dados => Cadastro.desligarFuncionario(f.id, dados.data_desligamento),
    });
  }

  async function reativar(f) {
    const r = Cadastro.reativarFuncionario(f.id);
    if (r.erro) { App.mensagem(r.erro, 'aviso'); return; }
    await App.alterou();
  }

  async function excluir(f) {
    if (!window.confirm(CONFIRMA_EXCLUSAO)) return;
    const r = Cadastro.excluirFuncionario(f.id);
    if (r.erro) { App.mensagem(r.erro, 'aviso'); return; }
    await App.alterou();
  }

  async function carregarExemplo() {
    const r = Cadastro.carregarExemplo();
    if (r.erro) { App.mensagem(r.erro, 'aviso'); return; }
    await App.alterou();
    App.mensagem(`Dados de exemplo carregados: ${r.funcionarios} funcionários fictícios.`, 'ok');
  }

  function iniciar() {
    $('btn-novo-funcionario').addEventListener('click', () => abrirFormulario());
    $('btn-exemplo').addEventListener('click', () => App.executarAcao(carregarExemplo));
    $('filtro-busca').addEventListener('input', desenhar);
    $('filtro-time').addEventListener('change', desenhar);
    $('filtro-situacao').addEventListener('change', desenhar);
  }

  return { iniciar, desenhar, CONFIRMA_EXCLUSAO };
})();
