// Tela Times: clientes, centros de custo e times com limite, tolerância e ocupação (D26, D43).
'use strict';

const TelaTimes = (() => {
  const { $, el, botao, linhaTabela, opcoes } = UI;

  function desenharClientes(clientes) {
    $('tabela-clientes').tBodies[0].replaceChildren(...clientes.map(c => linhaTabela([
      c.nome,
      el('td', { class: 'acoes' }, botao('Editar', () => abrirCliente(c))),
    ])));
  }

  function desenharCentros(centros) {
    $('tabela-centros').tBodies[0].replaceChildren(...centros.map(cc => linhaTabela([
      cc.codigo, cc.cliente_nome, cc.municipio || '', cc.uf || '',
      el('td', { class: 'acoes' }, botao('Editar', () => abrirCentro(cc))),
    ])));
  }

  function seloOcupacao(t) {
    if (!t.ocupacao) return el('td', {}, '—');
    return el('td', {}, el('span', { class: `selo ${t.ocupacao.cor}`, title: `${t.ocupacao.valor.toFixed(1)}%` }, t.ocupacao.texto));
  }

  function desenharTimes(times) {
    const grupos = new Map();
    for (const t of times) {
      const chave = `${t.cliente_nome} · ${t.cc_codigo}`;
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(t);
    }
    const blocos = [];
    for (const [titulo, lista] of grupos) {
      blocos.push(el('h3', { class: 'grupo' }, titulo));
      blocos.push(el('table', { class: 'tabela tabela-times' },
        el('thead', {}, el('tr', {}, ...['Time', 'Pessoas ativas', 'Limite', 'Tolerância (dias)', 'Ocupação', ''].map(h => el('th', {}, h)))),
        el('tbody', {}, ...lista.map(t => {
          const tr = linhaTabela([
            t.ativo ? t.nome : `${t.nome} (inativo)`,
            String(t.pessoas_ativas), String(t.limite_ausencias), String(t.tolerancia_dias),
            seloOcupacao(t),
            el('td', { class: 'acoes' },
              botao('Editar', () => abrirTime(t)),
              t.ativo
                ? (t.pessoas_ativas === 0 ? botao('Inativar', () => mudarSituacao(t, false)) : null)
                : botao('Reativar', () => mudarSituacao(t, true)),
              t.pessoas_total === 0 ? botao('Excluir', () => excluirTime(t), 'perigo') : null),
          ]);
          if (!t.ativo) tr.className = 'inativo';
          return tr;
        }))));
    }
    $('lista-times').replaceChildren(...blocos);
    $('times-vazio').hidden = times.length > 0;
  }

  function desenhar() {
    desenharClientes(Cadastro.listarClientes());
    desenharCentros(Cadastro.listarCentros());
    desenharTimes(Cadastro.listarTimes());
  }

  function abrirCliente(c = null) {
    UI.abrirDialogo('dlg-cliente', {
      titulo: c ? 'Editar cliente' : 'Novo cliente',
      valores: c || {},
      aoSalvar: d => Cadastro.salvarCliente({ ...d, id: c ? c.id : null }),
    });
  }

  function abrirCentro(cc = null) {
    const clientes = Cadastro.listarClientes();
    if (clientes.length === 0) { App.mensagem('Cadastre um cliente antes.', 'aviso'); return; }
    UI.abrirDialogo('dlg-centro', {
      titulo: cc ? 'Editar centro de custo' : 'Novo centro de custo',
      valores: cc || {},
      prepararCampos: form => opcoes(form.elements.cliente_id, clientes.map(c => ({ valor: c.id, texto: c.nome })), { vazio: 'Escolha o cliente' }),
      aoSalvar: d => Cadastro.salvarCentro({ ...d, id: cc ? cc.id : null }),
    });
  }

  function abrirTime(t = null) {
    const centros = Cadastro.listarCentros();
    if (centros.length === 0) { App.mensagem('Cadastre um centro de custo antes.', 'aviso'); return; }
    UI.abrirDialogo('dlg-time', {
      titulo: t ? 'Editar time' : 'Novo time',
      valores: t || { limite_ausencias: 1, tolerancia_dias: 0 },
      prepararCampos: form => opcoes(form.elements.centro_custo_id,
        centros.map(cc => ({ valor: cc.id, texto: `${cc.cliente_nome} · ${cc.codigo}` })), { vazio: 'Escolha o centro de custo' }),
      aoSalvar: d => Cadastro.salvarTime({ ...d, id: t ? t.id : null }),
    });
  }

  async function mudarSituacao(t, ativar) {
    const r = ativar ? Cadastro.reativarTime(t.id) : Cadastro.inativarTime(t.id);
    if (r.erro) { App.mensagem(r.erro, 'aviso'); return; }
    await App.alterou();
  }

  async function excluirTime(t) {
    if (!window.confirm(`Excluir o time "${t.nome}"?`)) return;
    const r = Cadastro.excluirTime(t.id);
    if (r.erro) { App.mensagem(r.erro, 'aviso'); return; }
    await App.alterou();
  }

  function iniciar() {
    $('btn-novo-cliente').addEventListener('click', () => abrirCliente());
    $('btn-novo-centro').addEventListener('click', () => abrirCentro());
    $('btn-novo-time').addEventListener('click', () => abrirTime());
  }

  return { iniciar, desenhar };
})();
