// Excel espelho (D16b): cópia somente leitura do banco, refeita a cada gravação.
'use strict';

const Espelho = (() => {
  const AVISO = 'Arquivo gerado automaticamente pelo app. Alterações feitas aqui serão perdidas.';
  const LIMITE_NOME_ABA = 31; // limite do Excel

  function dataHora(d) {
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // Devolve os bytes do .xlsx: aba "Leia-me" e uma aba por tabela com registros.
  function gerar(agora = new Date()) {
    const livro = XLSX.utils.book_new();

    const leiaMe = XLSX.utils.aoa_to_sheet([[AVISO], [], ['Gerado em: ' + dataHora(agora)]]);
    leiaMe['!cols'] = [{ wch: 90 }];
    XLSX.utils.book_append_sheet(livro, leiaMe, 'Leia-me');

    for (const tabela of Banco.tabelas()) {
      const linhas = Banco.consultar(`SELECT * FROM "${tabela}"`);
      if (linhas.length === 0) continue;
      const aba = XLSX.utils.json_to_sheet(linhas);
      XLSX.utils.book_append_sheet(livro, aba, tabela.slice(0, LIMITE_NOME_ABA));
    }

    return new Uint8Array(XLSX.write(livro, { bookType: 'xlsx', type: 'array' }));
  }

  return { AVISO, gerar };
})();
