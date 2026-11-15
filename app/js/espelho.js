// Excel espelho (D16b): cópia somente leitura do banco, refeita a cada gravação.
// Abas legíveis, com datas no formato brasileiro e horário de Brasília (D37).
'use strict';

const Espelho = (() => {
  const AVISO = 'Arquivo gerado automaticamente pelo app. Alterações feitas aqui serão perdidas.';

  function aba(cabecalho, linhas, larguras) {
    const folha = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
    folha['!cols'] = larguras.map(wch => ({ wch }));
    if (linhas.length) folha['!autofilter'] = { ref: folha['!ref'] };
    return folha;
  }

  function abaFuncionarios() {
    const linhas = Cadastro.listarFuncionarios({ situacao: 'todos' }).map(f => [
      f.matricula, f.nome, Datas.formatar(f.data_admissao), f.cliente_nome, f.cc_codigo, f.time_nome,
      f.email || '', f.ativo ? 'Ativo' : 'Desligado', Datas.formatar(f.data_desligamento),
    ]);
    return aba(['Matrícula', 'Nome', 'Admissão', 'Cliente', 'Centro de custo', 'Time', 'E-mail', 'Situação', 'Desligamento'],
      linhas, [12, 34, 12, 26, 16, 28, 32, 12, 14]);
  }

  function abaTimes() {
    const linhas = Cadastro.listarTimes().map(t => [
      t.cliente_nome, t.cc_codigo, t.ativo ? t.nome : `${t.nome} (inativo)`, t.pessoas_ativas,
      t.limite_ausencias, t.tolerancia_dias, t.ocupacao ? t.ocupacao.texto : '',
    ]);
    return aba(['Cliente', 'Centro de custo', 'Time', 'Pessoas ativas', 'Limite', 'Tolerância (dias)', 'Ocupação'],
      linhas, [26, 16, 30, 14, 8, 16, 10]);
  }

  function abaSubstitutos() {
    const linhas = Cadastro.listarPares().map(p => [
      `${p.a_nome} (${p.a_matricula})`, `${p.b_nome} (${p.b_matricula})`, p.tolerancia_dias, p.motivo || '',
      p.ativo ? 'Ativo' : 'Inativo (pessoa desligada)',
    ]);
    return aba(['Pessoa 1', 'Pessoa 2', 'Tolerância (dias)', 'Motivo', 'Situação'], linhas, [36, 36, 16, 50, 26]);
  }

  function abaHistorico() {
    const linhas = Cadastro.listarHistorico({ limite: 100000 }).map(h => {
      const d = Cadastro.descreverHistorico(h);
      return [d.quando, d.acao, d.tabela, d.registro, d.dados];
    });
    return aba(['Data e hora', 'Ação', 'Tabela', 'Registro', 'Dados'], linhas, [17, 14, 16, 40, 100]);
  }

  // Devolve os bytes do .xlsx.
  function gerar(agora = new Date()) {
    const livro = XLSX.utils.book_new();
    const leiaMe = XLSX.utils.aoa_to_sheet([[AVISO], [], ['Gerado em: ' + Datas.formatar(agora)]]);
    leiaMe['!cols'] = [{ wch: 90 }];
    XLSX.utils.book_append_sheet(livro, leiaMe, 'Leia-me');
    XLSX.utils.book_append_sheet(livro, abaFuncionarios(), 'Funcionários');
    XLSX.utils.book_append_sheet(livro, abaTimes(), 'Times');
    XLSX.utils.book_append_sheet(livro, abaSubstitutos(), 'Substitutos');
    XLSX.utils.book_append_sheet(livro, abaHistorico(), 'Histórico');
    return new Uint8Array(XLSX.write(livro, { bookType: 'xlsx', type: 'array' }));
  }

  return { AVISO, gerar };
})();
