// Regras e validações dos cadastros. Funções puras: não acessam o banco.
// Cada validação devolve um objeto { campo: 'mensagem' }; vazio quando está tudo certo.
'use strict';

const Regras = (() => {
  const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function texto(valor) {
    return (valor ?? '').toString().trim().replace(/\s+/g, ' ');
  }

  function inteiro(valor) {
    const t = texto(valor);
    if (!/^-?\d+$/.test(t)) return null;
    return Number(t);
  }

  // Ocupação (D11 a D13, D43) = (pessoas × 30) ÷ (limite × 365).
  // Até 50%: verde. De 50% a 70%: amarelo. Acima de 70%: vermelho.
  function calcularOcupacao(pessoas, limite) {
    if (!(limite >= 1)) return null;
    const valor = (pessoas * 30) / (limite * 365) * 100;
    const cor = valor <= 50 ? 'verde' : valor <= 70 ? 'amarelo' : 'vermelho';
    return { valor, texto: `${Math.round(valor)}%`, cor };
  }

  // d: { matricula, nome, data_admissao, time_id, email, data_desligamento? }
  // ctx: { hoje: 'AAAA-MM-DD', matriculaEmUso: (matricula) => boolean }
  function validarFuncionario(d, ctx) {
    const erros = {};
    const matricula = texto(d.matricula);
    if (!matricula) erros.matricula = 'Informe a matrícula.';
    else if (ctx.matriculaEmUso(matricula)) erros.matricula = 'Já existe um funcionário com esta matrícula.';

    if (!texto(d.nome)) erros.nome = 'Informe o nome.';

    const admissao = texto(d.data_admissao);
    if (!admissao) erros.data_admissao = 'Informe a data de admissão.';
    else if (!Datas.dataValida(admissao)) erros.data_admissao = 'Data inválida.';
    else if (admissao > ctx.hoje) erros.data_admissao = 'A admissão não pode ser uma data futura.';
    else if (d.data_desligamento && admissao > d.data_desligamento) {
      erros.data_admissao = `A admissão não pode ser depois do desligamento (${Datas.formatar(d.data_desligamento)}).`;
    }

    if (!d.time_id) erros.time_id = 'Escolha o time.';

    const email = texto(d.email);
    if (email && !RE_EMAIL.test(email)) erros.email = 'E-mail inválido. Exemplo: nome@exemplo.com';
    return erros;
  }

  function validarDesligamento(data, admissao) {
    const erros = {};
    const t = texto(data);
    if (!t) erros.data_desligamento = 'Informe a data de desligamento.';
    else if (!Datas.dataValida(t)) erros.data_desligamento = 'Data inválida.';
    else if (t < admissao) {
      erros.data_desligamento = `O desligamento não pode ser antes da admissão (${Datas.formatar(admissao)}).`;
    }
    return erros;
  }

  // ctx: { nomeEmUso: (centroCustoId, nome) => boolean }
  function validarTime(d, ctx) {
    const erros = {};
    if (!d.centro_custo_id) erros.centro_custo_id = 'Escolha o centro de custo.';
    const nome = texto(d.nome);
    if (!nome) erros.nome = 'Informe o nome do time.';
    else if (d.centro_custo_id && ctx.nomeEmUso(d.centro_custo_id, nome)) {
      erros.nome = 'Já existe um time com este nome neste centro de custo.';
    }
    const limite = inteiro(d.limite_ausencias);
    if (limite === null || limite < 1) erros.limite_ausencias = 'O limite precisa ser um número inteiro, 1 ou mais.';
    const tolerancia = inteiro(d.tolerancia_dias);
    if (tolerancia === null || tolerancia < 0) erros.tolerancia_dias = 'A tolerância precisa ser um número inteiro, 0 ou mais.';
    return erros;
  }

  function validarCliente(d, ctx) {
    const erros = {};
    const nome = texto(d.nome);
    if (!nome) erros.nome = 'Informe o nome do cliente.';
    else if (ctx.nomeEmUso(nome)) erros.nome = 'Já existe um cliente com este nome.';
    return erros;
  }

  function validarCentroCusto(d, ctx) {
    const erros = {};
    const codigo = texto(d.codigo);
    if (!codigo) erros.codigo = 'Informe o código.';
    else if (ctx.codigoEmUso(codigo)) erros.codigo = 'Já existe um centro de custo com este código.';
    if (!d.cliente_id) erros.cliente_id = 'Escolha o cliente.';
    const uf = texto(d.uf);
    if (uf && !/^[A-Za-z]{2}$/.test(uf)) erros.uf = 'Use a sigla com 2 letras. Exemplo: SP';
    return erros;
  }

  // O par é guardado sempre com o menor id primeiro (D14).
  function normalizarPar(a, b) {
    const x = Number(a);
    const y = Number(b);
    return x < y ? [x, y] : [y, x];
  }

  // ctx: { parExiste: (menorId, maiorId) => boolean }
  function validarPar(d, ctx) {
    const erros = {};
    if (!d.funcionario_a_id) erros.funcionario_a_id = 'Escolha a pessoa 1.';
    if (!d.funcionario_b_id) erros.funcionario_b_id = 'Escolha a pessoa 2.';
    if (d.funcionario_a_id && d.funcionario_b_id) {
      if (Number(d.funcionario_a_id) === Number(d.funcionario_b_id)) {
        erros.funcionario_b_id = 'Escolha duas pessoas diferentes.';
      } else if (ctx.parExiste(...normalizarPar(d.funcionario_a_id, d.funcionario_b_id))) {
        erros.funcionario_b_id = 'Este par já está cadastrado.';
      }
    }
    const tolerancia = inteiro(d.tolerancia_dias);
    if (tolerancia === null || tolerancia < 0) erros.tolerancia_dias = 'A tolerância precisa ser um número inteiro, 0 ou mais.';
    return erros;
  }

  return {
    texto, inteiro, calcularOcupacao, validarFuncionario, validarDesligamento,
    validarTime, validarCliente, validarCentroCusto, normalizarPar, validarPar,
  };
})();
