// Tela Histórico: as 100 alterações mais recentes, com filtro por tabela.
'use strict';

const TelaHistorico = (() => {
  const { $, el, linhaTabela, opcoes } = UI;

  function desenhar() {
    opcoes($('filtro-historico'),
      Cadastro.tabelasDoHistorico().map(t => ({ valor: t, texto: Cadastro.TABELAS[t] || t })),
      { vazio: 'Todas' });
    const linhas = Cadastro.listarHistorico({ tabela: $('filtro-historico').value || null, limite: 100 });
    $('tabela-historico').tBodies[0].replaceChildren(...linhas.map(h => {
      const d = Cadastro.descreverHistorico(h);
      return linhaTabela([d.quando, d.acao, d.tabela, d.registro, el('td', { class: 'dados' }, d.dados)]);
    }));
    $('tabela-historico').hidden = linhas.length === 0;
    $('historico-vazio').hidden = linhas.length > 0;
  }

  function iniciar() {
    $('filtro-historico').addEventListener('change', desenhar);
  }

  return { iniciar, desenhar };
})();
