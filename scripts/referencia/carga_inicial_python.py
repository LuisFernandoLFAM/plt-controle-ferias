"""
Carga inicial: Planilha de Férias (Excel) -> banco SQLite (ferias.db)

CÓDIGO ANTIGO, SÓ PARA CONSULTA. O app atual não usa este script (D18, D28).
Ele usa o esquema antigo (scripts/referencia/schema_v0.sql) e exige um arquivo
de configuração em --config, no formato antigo, que não existe mais no repositório.

Uso (dados reais, tudo dentro de privado/):
    python src/ingestao/carga_inicial.py --planilha "privado/Planilha_Férias.xlsx" \
        --config privado/regras_iniciais.json --banco privado/ferias.db

O que faz:
  1. Copia os dados brutos para as tabelas bronze_* (rastreabilidade).
  2. Cria cliente, centro de custo, time e funcionário.
  3. Deriva o período aquisitivo a partir da "Data Limite" (tratada como
     último dia do período concessivo) e gera os ciclos seguintes até hoje.
  4. Normaliza os até 3 períodos de férias por linha em ferias_periodo.
  5. Valida regras da CLT e registra problemas em qualidade_carga.

A planilha não é alterada; ela é só fonte de leitura.
"""
import argparse
import json
import sqlite3
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

import openpyxl
from dateutil.easter import easter
from dateutil.relativedelta import relativedelta

ABA_FERIAS = "Planilha1 (2)"
TABELA_FERIAS = "Tabela_Ferias"
ABA_ATIVOS = "Ativos"
TABELA_ATIVOS = "Tabela_Ativos"

RAIZ = Path(__file__).resolve().parents[2]


def ler_config(caminho):
    """Clientes por centro de custo e limites de ausência por time.
    Ficam fora do código porque contêm informações reais da empresa:
    a versão real vai em privado/ (ignorada pelo Git)."""
    cfg = json.loads(Path(caminho).read_text(encoding="utf-8"))
    clientes = cfg.get("clientes_por_centro_custo", {})
    limites = {(l["centro_custo"], l["subarea"]): l["limite"]
               for l in cfg.get("limites_ausencia", [])}
    return clientes, limites


# ----------------------------------------------------------------------
# Leitura da planilha
# ----------------------------------------------------------------------
def ler_tabela(ws, nome_tabela):
    """Lê uma Tabela do Excel pelo nome e devolve (linha_excel, dict)."""
    ref = ws.tables[nome_tabela].ref
    linhas = list(ws[ref])
    cab = [c.value for c in linhas[0]]
    for linha in linhas[1:]:
        reg = dict(zip(cab, (c.value for c in linha)))
        yield linha[0].row, reg


def como_data(v):
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    return None


def txt(v):
    if v is None:
        return None
    if isinstance(v, (datetime, date)):
        return como_data(v).isoformat()
    return str(v).strip() or None


# ----------------------------------------------------------------------
# Regras de negócio
# ----------------------------------------------------------------------
def ciclo_pelo_limite(limite):
    """Data Limite (fim do concessivo) -> (inicio_aq, fim_aq, limite)."""
    fim_aq = limite - relativedelta(years=1)
    inicio_aq = fim_aq - relativedelta(years=1) + timedelta(days=1)
    return inicio_aq, fim_aq, limite


def proximo_ciclo(inicio_aq):
    novo_inicio = inicio_aq + relativedelta(years=1)
    novo_fim = novo_inicio + relativedelta(years=1) - timedelta(days=1)
    return novo_inicio, novo_fim, novo_fim + relativedelta(years=1)


def feriados_nacionais(anos):
    fixos = [
        (1, 1, "Confraternização Universal"), (4, 21, "Tiradentes"),
        (5, 1, "Dia do Trabalho"), (9, 7, "Independência do Brasil"),
        (10, 12, "Nossa Senhora Aparecida"), (11, 2, "Finados"),
        (11, 15, "Proclamação da República"),
        (11, 20, "Dia Nacional de Zumbi e da Consciência Negra"),
        (12, 25, "Natal"),
    ]
    for ano in anos:
        for m, d, nome in fixos:
            yield date(ano, m, d), nome
        yield easter(ano) - timedelta(days=2), "Paixão de Cristo"


DIAS_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]


def inicio_vedado(inicio, feriados, dia_dsr=6):
    """Art. 134 §3º: não pode iniciar nos 2 dias que antecedem feriado ou DSR.
    dia_dsr: 6 = domingo (a confirmar com o gerente)."""
    for d in (inicio + timedelta(days=1), inicio + timedelta(days=2)):
        if d.weekday() == dia_dsr:
            return "antecede o descanso semanal (domingo)"
        if d in feriados:
            return f"antecede feriado ({feriados[d]} em {d:%d/%m/%Y})"
    return None


# ----------------------------------------------------------------------
# Carga
# ----------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--planilha", default=str(RAIZ / "data/exemplo/planilha_ferias_ficticia.xlsx"))
    ap.add_argument("--config", required=True)
    ap.add_argument("--banco", default=str(RAIZ / "data/ferias_exemplo.db"))
    ap.add_argument("--schema", default=str(RAIZ / "scripts/referencia/schema_v0.sql"))
    ap.add_argument("--hoje", default=date.today().isoformat())
    args = ap.parse_args()

    hoje = date.fromisoformat(args.hoje)
    clientes_cfg, limites_cfg = ler_config(args.config)
    id_carga = datetime.now().strftime("%Y%m%d%H%M%S") + "-" + uuid.uuid4().hex[:6]
    agora = datetime.now().isoformat(timespec="seconds")

    wb = openpyxl.load_workbook(args.planilha, data_only=True)
    data_planilha = (wb.properties.modified or datetime.now()).date()

    banco = Path(args.banco)
    if banco.exists():
        banco.unlink()  # carga inicial é recriada do zero
    con = sqlite3.connect(banco)
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(Path(args.schema).read_text(encoding="utf-8"))

    problemas = []

    def problema(sev, entidade, ref, desc):
        problemas.append((id_carga, sev, entidade, ref, desc))

    # ---- BRONZE --------------------------------------------------------
    ativos = list(ler_tabela(wb[ABA_ATIVOS], TABELA_ATIVOS))
    ferias = list(ler_tabela(wb[ABA_FERIAS], TABELA_FERIAS))

    con.executemany(
        "INSERT INTO bronze_ativos VALUES (?,?,?,?,?,?,?)",
        [(id_carga, n, txt(r["Nome"]), txt(r["Centro de Custo"]), txt(r["Subárea"]),
          txt(r["Data Limite"]), agora) for n, r in ativos],
    )
    con.executemany(
        "INSERT INTO bronze_ferias VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [(id_carga, n, txt(r["Nome Colaborador"]), txt(r["Vender 10 Dias?"]),
          txt(r["Início 1º Período"]), txt(r["Fim 1º Período"]),
          txt(r["Início 2º Período"]), txt(r["Fim 2º Período"]),
          txt(r["Início 3º Período"]), txt(r["Fim 3º Período"]), agora)
         for n, r in ferias],
    )

    # ---- FERIADOS e CONFIG ----------------------------------------------
    anos = range(data_planilha.year - 1, hoje.year + 2)
    fer = dict(feriados_nacionais(anos))
    con.executemany(
        "INSERT INTO feriado (data, nome, escopo, uf, municipio) VALUES (?,?, 'nacional', '', '')",
        [(d.isoformat(), n) for d, n in sorted(fer.items())],
    )
    con.executemany(
        "INSERT INTO regra_config VALUES (?,?,?)",
        [
            ("abono_exige_20_corridos", None,
             "Se vender 10 dias, os 20 restantes precisam ser corridos? (regra interna)"),
            ("dia_dsr", "domingo", "Dia de repouso semanal remunerado (a confirmar)"),
            ("alertas_dias_antecedencia", "90,60,30",
             "Antecedência dos alertas de vencimento do período concessivo"),
            ("data_planilha_origem", data_planilha.isoformat(),
             "Última modificação da planilha usada na carga inicial"),
        ],
    )

    # ---- ESTRUTURA E FUNCIONÁRIOS ---------------------------------------
    clientes, ccs, times, funcs = {}, {}, {}, {}

    def obter_cliente(nome):
        if nome not in clientes:
            clientes[nome] = con.execute(
                "INSERT INTO cliente (nome) VALUES (?)", (nome,)).lastrowid
        return clientes[nome]

    def obter_cc(codigo):
        if codigo not in ccs:
            cli = clientes_cfg.get(codigo)
            cli_id = obter_cliente(cli) if cli else None
            ccs[codigo] = con.execute(
                "INSERT INTO centro_custo (codigo, cliente_id) VALUES (?,?)",
                (codigo, cli_id)).lastrowid
            if not cli:
                problema("pendencia", "centro_custo", codigo, "Cliente não informado")
            problema("pendencia", "centro_custo", codigo,
                     "Município não informado (necessário para feriados municipais)")
        return ccs[codigo]

    def obter_time(cc, sub):
        chave = (cc, sub)
        if chave not in times:
            lim = limites_cfg.get(chave)
            times[chave] = con.execute(
                "INSERT INTO time (centro_custo_id, subarea, limite_ausencias) VALUES (?,?,?)",
                (obter_cc(cc), sub, lim)).lastrowid
            if lim is None:
                problema("pendencia", "time", f"{cc} / {sub}",
                         "Limite de pessoas ausentes ao mesmo tempo não definido")
        return times[chave]

    ciclo_planilha = {}  # nome -> id do periodo_aquisitivo vindo da planilha
    for linha, r in ativos:
        nome = txt(r["Nome"])
        if not nome:
            continue
        if nome in funcs:
            problema("erro", "funcionario", nome, f"Nome duplicado na aba Ativos (linha {linha})")
            continue
        cc, sub = txt(r["Centro de Custo"]), txt(r["Subárea"])
        limite = como_data(r["Data Limite"])
        if not (cc and sub):
            problema("erro", "funcionario", nome, "Sem centro de custo ou subárea")
            continue
        aniv = None
        if limite:
            ini_aq, fim_aq, lim = ciclo_pelo_limite(limite)
            aniv = ini_aq.strftime("%m-%d")
        funcs[nome] = con.execute(
            "INSERT INTO funcionario (nome, aniversario_ciclo, time_id) VALUES (?,?,?)",
            (nome, aniv, obter_time(cc, sub))).lastrowid
        problema("pendencia", "funcionario", nome,
                 "Faltam matrícula, data de admissão e e-mail")

        if not limite:
            problema("erro", "funcionario", nome, "Sem Data Limite: ciclo de férias não calculado")
            continue

        # ciclo da planilha + ciclos seguintes até o ciclo atual
        pa_id = con.execute(
            """INSERT INTO periodo_aquisitivo
               (funcionario_id, inicio, fim, limite_concessivo, origem, observacao)
               VALUES (?,?,?,?, 'planilha_derivado',
                       'Derivado da Data Limite da planilha (confirmar admissão)')""",
            (funcs[nome], ini_aq.isoformat(), fim_aq.isoformat(), lim.isoformat())).lastrowid
        ciclo_planilha[nome] = (pa_id, ini_aq, fim_aq, lim)
        prox = proximo_ciclo(ini_aq)
        while prox[0] <= hoje:
            con.execute(
                """INSERT INTO periodo_aquisitivo
                   (funcionario_id, inicio, fim, limite_concessivo, origem)
                   VALUES (?,?,?,?, 'gerado_pelo_sistema')""",
                (funcs[nome], *(d.isoformat() for d in prox)))
            prox = proximo_ciclo(prox[0])

    # ---- FÉRIAS ---------------------------------------------------------
    for linha, r in ferias:
        nome = txt(r["Nome Colaborador"])
        if not nome:
            continue
        if nome not in ciclo_planilha:
            problema("erro", "ferias", nome, f"Nome não encontrado na aba Ativos (linha {linha})")
            continue
        pa_id, ini_aq, fim_aq, lim = ciclo_planilha[nome]
        vende = {"Sim": 1, "Não": 0}.get(txt(r["Vender 10 Dias?"]))
        con.execute("UPDATE periodo_aquisitivo SET vendeu_abono=? WHERE id=?", (vende, pa_id))

        periodos = []
        for i in (1, 2, 3):
            ini, fim = como_data(r[f"Início {i}º Período"]), como_data(r[f"Fim {i}º Período"])
            if ini and not fim or fim and not ini:
                problema("erro", "ferias", nome, f"{i}º período com início ou fim faltando")
                continue
            if not ini:
                continue
            if fim < ini:
                problema("erro", "ferias", nome, f"{i}º período com fim antes do início")
                continue
            dias = (fim - ini).days + 1
            status = "a_confirmar" if fim >= data_planilha else "gozado"
            con.execute(
                """INSERT INTO ferias_periodo
                   (periodo_aquisitivo_id, ordem, inicio, fim, dias, status, origem)
                   VALUES (?,?,?,?,?,?, 'planilha')""",
                (pa_id, i, ini.isoformat(), fim.isoformat(), dias, status))
            periodos.append((i, ini, fim, dias))

            motivo = inicio_vedado(ini, fer)
            if motivo:
                problema("aviso", "ferias", nome,
                         f"{i}º período inicia em {DIAS_SEMANA[ini.weekday()]} {ini:%d/%m/%Y}, "
                         f"que {motivo} (art. 134 §3º)")
            if ini <= fim_aq:
                problema("aviso", "ferias", nome,
                         f"{i}º período ({ini:%d/%m/%Y}) começa antes do fim do período aquisitivo "
                         f"derivado ({fim_aq:%d/%m/%Y}): Data Limite pode ser de outro ciclo")
            if fim > lim:
                problema("erro", "ferias", nome,
                         f"{i}º período termina depois da Data Limite ({lim:%d/%m/%Y})")

        if not periodos:
            continue
        total = sum(p[3] for p in periodos) + (10 if vende else 0)
        if total > 30:
            problema("erro", "ferias", nome, f"Total de {total} dias (com abono) passa de 30")
        dias_lista = [p[3] for p in periodos]
        if len(dias_lista) > 1 and (max(dias_lista) < 14 or min(dias_lista) < 5):
            problema("erro", "ferias", nome,
                     "Fracionamento fora da CLT (um período >= 14 dias e os demais >= 5)")
        if len(dias_lista) == 1 and dias_lista[0] < 14:
            problema("aviso", "ferias", nome, "Período único com menos de 14 dias (saldo em aberto?)")

    # ---- CICLOS SEM FÉRIAS REGISTRADAS ----------------------------------
    sem_ferias = con.execute(
        """SELECT f.nome, pa.inicio, pa.fim, pa.limite_concessivo, pa.origem
           FROM periodo_aquisitivo pa
           JOIN funcionario f ON f.id = pa.funcionario_id
           LEFT JOIN ferias_periodo fp ON fp.periodo_aquisitivo_id = pa.id
           WHERE fp.id IS NULL AND pa.fim < ?
           ORDER BY pa.limite_concessivo""", (hoje.isoformat(),)).fetchall()
    for nome, ini, fim, lim, origem in sem_ferias:
        venc = date.fromisoformat(lim) < hoje
        problema("pendencia", "periodo_aquisitivo", nome,
                 f"Ciclo {date.fromisoformat(ini):%d/%m/%Y} a {date.fromisoformat(fim):%d/%m/%Y} "
                 f"sem férias registradas (limite {date.fromisoformat(lim):%d/%m/%Y}"
                 f"{', JÁ VENCIDO' if venc else ''})")

    con.executemany(
        "INSERT INTO qualidade_carga (id_carga, severidade, entidade, referencia, descricao) "
        "VALUES (?,?,?,?,?)", problemas)
    con.commit()

    # ---- RESUMO ---------------------------------------------------------
    print(f"Carga {id_carga} concluída em {banco}")
    for tab in ("funcionario", "time", "centro_custo", "periodo_aquisitivo",
                "ferias_periodo", "feriado"):
        print(f"  {tab:20s} {con.execute(f'SELECT COUNT(*) FROM {tab}').fetchone()[0]:>4}")
    print("  problemas por severidade:",
          dict(con.execute("SELECT severidade, COUNT(*) FROM qualidade_carga GROUP BY 1")))
    con.close()


if __name__ == "__main__":
    main()
