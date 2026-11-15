"""
Gera a planilha de pendências para o gerente preencher, a partir do banco.

Dados reais (saída fica em privado/, ignorada pelo Git):
    python scripts/gerar_pendencias.py --banco privado/ferias.db --saida privado/pendencias_para_gerente.xlsx
Dados fictícios (demonstração):
    python scripts/gerar_pendencias.py
"""
import argparse
import sqlite3
from datetime import date
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

RAIZ = Path(__file__).resolve().parents[1]
ap = argparse.ArgumentParser()
ap.add_argument("--banco", default=str(RAIZ / "data/ferias_exemplo.db"))
ap.add_argument("--saida", default=str(RAIZ / "data/pendencias_exemplo.xlsx"))
ap.add_argument("--hoje", default=date.today().isoformat())
args = ap.parse_args()
HOJE = date.fromisoformat(args.hoje)
con = sqlite3.connect(args.banco)
DATA_PLAN = date.fromisoformat(con.execute(
    "SELECT valor FROM regra_config WHERE chave='data_planilha_origem'").fetchone()[0])
F = "Arial"
AMARELO = PatternFill("solid", fgColor="FFF2CC")
CINZA = PatternFill("solid", fgColor="F2F2F2")
CAB = PatternFill("solid", fgColor="1F3864")
VERMELHO = PatternFill("solid", fgColor="F8CBAD")
borda = Border(*(Side(style="thin", color="BFBFBF"),) * 4)

def d(s):
    return date.fromisoformat(s) if s else None

wb = Workbook()

def aba(titulo, cab, larguras, preencher):
    ws = wb.create_sheet(titulo)
    ws.append(cab)
    for i, (c, w) in enumerate(zip(cab, larguras), 1):
        cel = ws.cell(1, i)
        cel.font = Font(name=F, bold=True, color="FFFFFF")
        cel.fill = CAB
        cel.alignment = Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[1].height = 32
    ws.freeze_panes = "B2"
    ws._preencher = preencher  # índices (1-based) das colunas a preencher
    return ws

def formatar(ws, datas=()):
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.font = Font(name=F)
            c.border = borda
            c.alignment = Alignment(vertical="top", wrap_text=True)
            c.fill = AMARELO if c.column in ws._preencher else CINZA
            if c.column in datas:
                c.number_format = "DD/MM/YYYY"

def lista(ws, col, opcoes, n):
    dv = DataValidation(type="list", formula1='"' + ",".join(opcoes) + '"', allow_blank=True)
    ws.add_data_validation(dv)
    dv.add(f"{col}2:{col}{n+1}")

def validar_data(ws, cols, n):
    dv = DataValidation(type="date", operator="between", formula1="DATE(2015,1,1)",
                        formula2="DATE(2035,12,31)", allow_blank=True,
                        error="Digite uma data válida (dd/mm/aaaa)", showErrorMessage=True)
    ws.add_data_validation(dv)
    for c in cols:
        dv.add(f"{c}2:{c}{n+1}")

# ---------------- Leia-me ----------------
ws = wb.active
ws.title = "Leia-me"
ws.column_dimensions["A"].width = 110
linhas = [
    ("Levantamento de informações para o app de Controle de Férias", True),
    ("", False),
    ("Este arquivo reúne, de uma vez, tudo o que falta para montar a base de dados do novo app.", False),
    (f"A base foi criada a partir da planilha de férias atual (última modificação em {DATA_PLAN:%d/%m/%Y}).", False),
    ("", False),
    ("Como preencher", True),
    ("Células AMARELAS: preencher. Células CINZA: informação já existente, só para referência.", False),
    ("Datas no formato dd/mm/aaaa. Onde houver lista, escolha uma opção.", False),
    ("Se não souber alguma informação, pode deixar em branco.", False),
    ("", False),
    ("Abas, em ordem de prioridade", True),
    ("1. Perguntas gerais: regras da empresa (11 perguntas curtas).", False),
    ("2. Ciclos sem férias: períodos de cada pessoa que não têm férias registradas. Em vermelho, os que já passaram do prazo.", False),
    ("3. Férias lançadas: confirmar se as férias que estavam programadas na planilha aconteceram como previsto.", False),
    ("4. Funcionários: matrícula, data de admissão, e-mail e se a pessoa ainda está na empresa.", False),
    ("5. Times: cliente, cidade e quantas pessoas do time podem sair ao mesmo tempo.", False),
    ("", False),
    ("Exemplo de preenchimento (aba Ciclos sem férias)", True),
    ("Início 1º período: 06/01/2026 | Fim 1º período: 20/01/2026 | Início 2º período: 13/07/2026 | Fim 2º período: 27/07/2026 | Vendeu 10 dias?: Não", False),
    ("", False),
    ("Dica: se você tiver uma versão mais atualizada da planilha de férias, basta enviá-la; isso resolve boa parte das abas 2 e 3.", False),
]
for i, (t, b) in enumerate(linhas, 1):
    c = ws.cell(i, 1, t)
    c.font = Font(name=F, bold=b, size=14 if i == 1 else 11)
    c.alignment = Alignment(wrap_text=True)
leg = ws.cell(len(linhas) + 2, 1, "Legenda: amarelo = preencher")
leg.fill = AMARELO; leg.font = Font(name=F)
leg2 = ws.cell(len(linhas) + 3, 1, "Legenda: cinza = referência (não precisa alterar)")
leg2.fill = CINZA; leg2.font = Font(name=F)

# ---------------- Perguntas gerais ----------------
perg = [
    (f"Existe uma versão mais atual da planilha de férias (a recebida é de {DATA_PLAN:%d/%m/%Y})?",
     "Se existir, resolve boa parte das outras abas."),
    ("A \"Data Limite\" da planilha é o último dia do período concessivo (prazo para terminar as férias) ou o prazo para INICIAR as férias?",
     "Define como o app calcula os ciclos e o risco de férias em dobro."),
    ("Quem vende 10 dias precisa tirar os 20 restantes corridos, ou pode dividir (ex.: 15 + 5)?",
     "A lei permite dividir; se a empresa não permite, o app bloqueia."),
    ("O descanso semanal de todos é no domingo? Algum time trabalha em escala ou aos fins de semana?",
     "A CLT proíbe iniciar férias nos 2 dias antes do descanso semanal ou de feriado."),
    ("Existe acordo ou convenção coletiva (sindicato) com regras próprias de férias? Qual?",
     "Pode trazer regras diferentes da CLT."),
    ("As faltas injustificadas devem ser controladas no app? (podem reduzir os dias de férias)",
     "Se não, o app considera sempre 30 dias."),
    ("Com quanta antecedência quer ser avisado de que o prazo de férias de alguém vai vencer? (sugestão: 90, 60 e 30 dias)",
     "Configura os alertas."),
    ("Quem vai usar o app: só você, ou também RH / coordenadores? Os funcionários terão acesso?",
     "Define login e permissões."),
    ("Quando alguém sair da empresa, prefere manter o histórico e só marcar como desligado, ou apagar o cadastro?",
     "Recomendação: manter o histórico."),
    ("A empresa costuma ter férias coletivas (ex.: fim de ano)?",
     "Muda o cálculo de saldo."),
    ("Para a fase 2 (pedidos de férias por e-mail): existe um e-mail da empresa que poderia receber esses pedidos?",
     "Não é urgente, só para planejar."),
]
ws = aba("Perguntas gerais", ["Nº", "Pergunta", "Por que importa", "Resposta"], [5, 70, 45, 50], {4})
for i, (p, m) in enumerate(perg, 1):
    ws.append([i, p, m, None])
formatar(ws)
for r in range(2, len(perg) + 2):
    ws.row_dimensions[r].height = 45

# ---------------- Ciclos sem férias ----------------
rows = con.execute("""
  SELECT f.nome, cc.codigo, t.subarea, pa.inicio, pa.fim, pa.limite_concessivo
  FROM periodo_aquisitivo pa
  JOIN funcionario f ON f.id = pa.funcionario_id
  JOIN time t ON t.id = f.time_id JOIN centro_custo cc ON cc.id = t.centro_custo_id
  LEFT JOIN ferias_periodo fp ON fp.periodo_aquisitivo_id = pa.id
  WHERE fp.id IS NULL AND pa.fim < ?
  ORDER BY pa.limite_concessivo, f.nome""", (HOJE.isoformat(),)).fetchall()
cab = ["Nome", "Centro de custo", "Subárea", "Período aquisitivo (início)", "Período aquisitivo (fim)",
       "Prazo para tirar as férias", "Situação", "Início 1º período", "Fim 1º período",
       "Início 2º período", "Fim 2º período", "Início 3º período", "Fim 3º período",
       "Vendeu 10 dias?", "Observação"]
ws = aba("Ciclos sem férias", cab, [34, 11, 22, 13, 13, 13, 14, 12, 12, 12, 12, 12, 12, 10, 30],
         set(range(8, 16)))
for nome, cc, sub, ini, fim, lim in rows:
    venc = d(lim) < HOJE
    ws.append([nome, cc, sub, d(ini), d(fim), d(lim), "PRAZO VENCIDO" if venc else "No prazo"]
              + [None] * 8)
formatar(ws, datas=set(range(4, 14)))
for r in range(2, len(rows) + 2):
    if ws.cell(r, 7).value == "PRAZO VENCIDO":
        for c in range(1, 8):
            ws.cell(r, c).fill = VERMELHO
lista(ws, "N", ["Sim", "Não"], len(rows))
validar_data(ws, "HIJKLM", len(rows))
ws.auto_filter.ref = f"A1:O{len(rows)+1}"

# ---------------- Férias lançadas ----------------
rows = con.execute("""
  SELECT f.nome, fp.ordem, fp.inicio, fp.fim, fp.dias, pa.vendeu_abono
  FROM ferias_periodo fp JOIN periodo_aquisitivo pa ON pa.id = fp.periodo_aquisitivo_id
  JOIN funcionario f ON f.id = pa.funcionario_id ORDER BY fp.inicio""").fetchall()
avisos = {}
for ref, desc in con.execute("SELECT referencia, descricao FROM qualidade_carga WHERE severidade IN ('aviso','erro')"):
    avisos.setdefault(ref, []).append(desc)
cab = ["Nome", "Período", "Início (planilha)", "Fim (planilha)", "Dias", "Vendeu 10 dias?",
       "Observação do sistema", "Aconteceu como lançado?", "Se não: início real", "Se não: fim real"]
ws = aba("Férias lançadas", cab, [34, 8, 13, 13, 6, 10, 50, 13, 13, 13], {8, 9, 10})
vistos = set()
for nome, ordem, ini, fim, dias, vende in rows:
    obs = [a for a in avisos.get(nome, []) if a.startswith(f"{ordem}º")]
    ws.append([nome, f"{ordem}º", d(ini), d(fim), dias,
               {1: "Sim", 0: "Não"}.get(vende, ""), "; ".join(obs) or None, None, None, None])
formatar(ws, datas={3, 4, 9, 10})
lista(ws, "H", ["Sim", "Não", "Cancelado"], len(rows))
validar_data(ws, "IJ", len(rows))

# ---------------- Funcionários ----------------
rows = con.execute("""
  SELECT f.nome, cc.codigo, t.subarea,
         (SELECT MIN(limite_concessivo) FROM periodo_aquisitivo WHERE funcionario_id=f.id AND origem='planilha_derivado')
  FROM funcionario f JOIN time t ON t.id=f.time_id JOIN centro_custo cc ON cc.id=t.centro_custo_id
  ORDER BY cc.codigo, t.subarea, f.nome""").fetchall()
cab = ["Nome", "Centro de custo", "Subárea", "Data Limite (planilha)", "Matrícula", "Data de admissão",
       "E-mail", "Ainda está na empresa?", "Se saiu: data de saída", "Mudou de centro de custo ou subárea? Qual?"]
ws = aba("Funcionários", cab, [34, 11, 22, 13, 12, 13, 30, 12, 13, 30], set(range(5, 11)))
for nome, cc, sub, lim in rows:
    ws.append([nome, cc, sub, d(lim)] + [None] * 6)
formatar(ws, datas={4, 6, 9})
lista(ws, "H", ["Sim", "Não"], len(rows))
validar_data(ws, "FI", len(rows))
ws.auto_filter.ref = f"A1:J{len(rows)+1}"

# ---------------- Times ----------------
rows = con.execute("""
  SELECT cc.codigo, t.subarea, COUNT(f.id), c.nome, t.limite_ausencias
  FROM time t JOIN centro_custo cc ON cc.id=t.centro_custo_id
  LEFT JOIN cliente c ON c.id=cc.cliente_id LEFT JOIN funcionario f ON f.time_id=t.id
  GROUP BY t.id ORDER BY cc.codigo, t.subarea""").fetchall()
cab = ["Centro de custo", "Subárea", "Nº de pessoas", "Cliente (confirmar ou preencher)",
       "Cidade / UF onde trabalham", "Máx. de pessoas fora ao mesmo tempo",
       "Observação"]
ws = aba("Times", cab, [13, 26, 10, 28, 26, 16, 40], {4, 5, 6, 7})
for cc, sub, n, cli, lim in rows:
    obs = "Valor atual da planilha; confirmar" if lim is not None else None
    ws.append([cc, sub, n, cli, None, lim, obs])
formatar(ws)

wb.move_sheet("Ciclos sem férias", offset=0)
wb.save(args.saida)
print(f"Pendências geradas em {args.saida}")
