// Tela Substitutos: pares de pessoas que não devem sair de férias juntas (D14).
'use strict';

const TelaSubstitutos = (() => {
  const { $, el, botao, linhaTabela, opcoes } = UI;

  function desenhar() {
    const pares = Cadastro.listarPares();
    $('tabela-pares').tBodies[0].replaceChildren(...pares.map(p => {
      const tr = linhaTabela([
        el('td', {}, `${p.a_nome} (${p.a_matricula})`, el('div', { class: 'detalhe' }, p.a_time)),
        el('td', {}, `${p.b_nome} (${p.b_matricula})`, el('div', { class: 'detalhe' }, p.b_time)),
        String(p.tolerancia_dias),
        p.motivo || '',
        p.ativo ? 'Ativo' : el('td', {}, el('span', { class: 'selo amarelo' }, 'Inativo: pessoa desligada')),
        el('td', { class: 'acoes' },
          botao('Editar', () => abrirFormulario(p)),
          botao('Excluir', () => excluir(p), 'perigo')),
      ]);
      if (!p.ativo) tr.className = 'inativo';
      return tr;
    }));
    $('tabela-pares').hidden = pares.length === 0;
    $('pares-vazio').hidden = pares.length > 0;
  }

  function abrirFormulario(p = null) {
    const pessoas = Cadastro.listarFuncionarios({ situacao: 'todos' })
      .filter(f => f.ativo || (p && (f.id === p.funcionario_a_id || f.id === p.funcionario_b_id)));
    if (pessoas.filter(f => f.ativo).length < 2 && !p) {
      App.mensagem('É preciso ter pelo menos 2 funcionários ativos para criar um par.', 'aviso');
      return;
    }
    const itens = pessoas.map(f => ({
      valor: f.id, texto: `${f.nome} (${f.matricula}) · ${f.time_nome}${f.ativo ? '' : ' · desligado'}`,
    }));
    UI.abrirDialogo('dlg-par', {
      titulo: p ? 'Editar par de substitutos' : 'Novo par de substitutos',
      valores: p || { tolerancia_dias: 0 },
      prepararCampos: form => {
        opcoes(form.elements.funcionario_a_id, itens, { vazio: 'Escolha a pessoa 1' });
        opcoes(form.elements.funcionario_b_id, itens, { vazio: 'Escolha a pessoa 2' });
      },
      aoSalvar: d => Cadastro.salvarPar({ ...d, id: p ? p.id : null }),
    });
  }

  async function excluir(p) {
    if (!window.confirm(`Excluir o par ${p.a_nome} × ${p.b_nome}?`)) return;
    Cadastro.excluirPar(p.id);
    await App.alterou();
  }

  function iniciar() {
    $('btn-novo-par').addEventListener('click', () => abrirFormulario());
  }

  return { iniciar, desenhar };
})();
