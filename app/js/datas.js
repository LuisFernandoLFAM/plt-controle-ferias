// Datas e horas (D37).
// - Banco: data e hora em UTC "AAAA-MM-DDTHH:MM:SSZ"; datas sem hora em "AAAA-MM-DD".
// - Tela e Excel espelho: "dd/mm/aaaa" e "dd/mm/aaaa hh:mm" no horário de Brasília.
'use strict';

const Datas = (() => {
  const FUSO = 'America/Sao_Paulo';
  const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
  const RE_DATA_HORA_SQLITE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/; // formato antigo, sem "T" e sem "Z"

  const formatoBrasilia = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });

  function partesBrasilia(d) {
    const p = {};
    for (const parte of formatoBrasilia.formatToParts(d)) p[parte.type] = parte.value;
    return p;
  }

  // "AAAA-MM-DD" que existe no calendário (recusa 2026-02-30, por exemplo).
  function dataValida(texto) {
    const m = RE_DATA.exec(texto || '');
    if (!m) return false;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }

  function paraInstante(valor) {
    if (valor instanceof Date) return isNaN(valor) ? null : valor;
    if (typeof valor !== 'string') return null;
    let t = valor.trim();
    if (RE_DATA_HORA_SQLITE.test(t)) t = t.replace(' ', 'T') + 'Z';
    if (!/T\d{2}:\d{2}/.test(t)) return null;
    const d = new Date(t);
    return isNaN(d) ? null : d;
  }

  // Função única de formatação para a tela e o Excel espelho.
  //   "2026-11-14"           -> "14/11/2026"        (data sem hora: sem conversão de fuso)
  //   "2026-11-15T01:23:14Z" -> "14/11/2026 22:23"  (UTC convertido para Brasília)
  //   objeto Date            -> "dd/mm/aaaa hh:mm"  (Brasília)
  function formatar(valor) {
    if (valor == null || valor === '') return '';
    if (typeof valor === 'string') {
      const m = RE_DATA.exec(valor.trim());
      if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    }
    const d = paraInstante(valor);
    if (!d) return String(valor);
    const p = partesBrasilia(d);
    return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
  }

  // Data de hoje em Brasília, "AAAA-MM-DD".
  function hoje(agora = new Date()) {
    const p = partesBrasilia(agora);
    return `${p.year}-${p.month}-${p.day}`;
  }

  // Instante atual em UTC, no formato do banco.
  function agoraUtc(agora = new Date()) {
    return agora.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  return { FUSO, dataValida, formatar, hoje, agoraUtc };
})();
