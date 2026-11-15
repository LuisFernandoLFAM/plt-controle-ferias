// Auxiliares de interface: criação de elementos, listas de opções e formulários em diálogo.
'use strict';

const UI = (() => {
  const $ = id => document.getElementById(id);

  // el('button', { class: 'x', onclick: fn }, 'texto', outroElemento)
  function el(tag, props = {}, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k in e && typeof v !== 'string') e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const f of filhos) {
      if (f === null || f === undefined || f === false) continue;
      e.append(f instanceof Node ? f : document.createTextNode(String(f)));
    }
    return e;
  }

  // Botão que roda a ação com proteção contra clique duplo.
  function botao(texto, acao, classe) {
    return el('button', { type: 'button', class: classe, onclick: () => App.executarAcao(acao) }, texto);
  }

  function linhaTabela(celulas) {
    return el('tr', {}, ...celulas.map(c => (c instanceof Node && c.tagName === 'TD' ? c : el('td', {}, c))));
  }

  // itens: [{ valor, texto }]. Mantém o valor escolhido quando ele ainda existe.
  function opcoes(select, itens, { vazio = null, valor } = {}) {
    const escolhido = valor !== undefined ? String(valor ?? '') : select.value;
    select.replaceChildren();
    if (vazio !== null) select.append(el('option', { value: '' }, vazio));
    for (const i of itens) select.append(el('option', { value: String(i.valor) }, i.texto));
    select.value = [...select.options].some(o => o.value === escolhido) ? escolhido : (vazio !== null ? '' : select.options[0]?.value || '');
  }

  function lerFormulario(form) {
    const dados = {};
    for (const e of form.elements) if (e.name) dados[e.name] = e.value;
    return dados;
  }

  function preencherFormulario(form, valores) {
    for (const e of form.elements) {
      if (!e.name) continue;
      const v = valores[e.name];
      e.value = v === null || v === undefined ? '' : String(v);
    }
  }

  function limparErros(form) {
    form.querySelectorAll('[data-erro]').forEach(s => { s.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
  }

  // Mensagem de erro ao lado de cada campo.
  function mostrarErros(form, erros) {
    limparErros(form);
    let primeiro = null;
    for (const [campo, msg] of Object.entries(erros)) {
      const span = form.querySelector(`[data-erro="${campo}"]`) || form.querySelector('[data-erro="_geral"]');
      span.textContent = msg;
      const entrada = form.elements[campo];
      if (entrada) {
        entrada.setAttribute('aria-invalid', 'true');
        if (!primeiro) primeiro = entrada;
      }
    }
    if (primeiro) primeiro.focus();
  }

  // Abre um formulário em diálogo. aoSalvar(dados) devolve { id }, { erros } ou { erro }.
  // Antes de preencher, prepararCampos(form) pode montar as listas de opções.
  function abrirDialogo(id, { titulo, valores = {}, prepararCampos, aoSalvar }) {
    const dialogo = $(id);
    const form = dialogo.querySelector('form');
    form.reset();
    limparErros(form);
    dialogo.querySelector('.titulo-dialogo').textContent = titulo;
    if (prepararCampos) prepararCampos(form);
    preencherFormulario(form, valores);
    form.onsubmit = ev => {
      ev.preventDefault();
      App.executarAcao(async () => {
        const r = aoSalvar(lerFormulario(form));
        if (r && r.erros) { mostrarErros(form, r.erros); return; }
        if (r && r.erro) { mostrarErros(form, { _geral: r.erro }); return; }
        dialogo.close();
        await App.alterou();
      });
    };
    dialogo.showModal();
    const primeiro = [...form.elements].find(e => e.name && !e.disabled);
    if (primeiro) primeiro.focus();
  }

  document.addEventListener('click', ev => {
    if (ev.target.matches('[data-fechar]')) ev.target.closest('dialog').close();
  });

  return { $, el, botao, linhaTabela, opcoes, lerFormulario, mostrarErros, abrirDialogo };
})();
