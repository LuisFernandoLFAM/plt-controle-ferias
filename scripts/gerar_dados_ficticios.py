"""
Gera uma planilha FICTÍCIA com a mesma estrutura da planilha real de férias,
para que o projeto rode e possa ser demonstrado publicamente sem dados reais.

    python scripts/gerar_dados_ficticios.py

Saídas:
- data/exemplo/planilha_ferias_ficticia.xlsx: planilha no formato da original.
  Inclui de propósito alguns casos problemáticos (início na sexta, fracionamento
  inválido, prazo vencido sem férias) para exercitar as validações.
- data/exemplo/cadastro_exemplo.json: cadastro do app (clientes, centros de custo,
  times, funcionários e um par de substitutos) com os mesmos nomes da planilha.
  O build embute esse arquivo para o botão "Carregar dados de exemplo" (D44).
"""
import json
import random
import unicodedata
from datetime import date, datetime, timedelta
from pathlib import Path

from dateutil.relativedelta import relativedelta
from openpyxl import Workbook
from openpyxl.worksheet.table import Table, TableStyleInfo

RAIZ = Path(__file__).resolve().parents[1]
SAIDA = RAIZ / "data/exemplo/planilha_ferias_ficticia.xlsx"
SAIDA_CADASTRO = RAIZ / "data/exemplo/cadastro_exemplo.json"
DATA_REFERENCIA = date(2026, 11, 1)  # "data em que a planilha foi salva"
random.seed(42)

NOMES = ["Ana", "Bruno", "Carla", "Diego", "Elaine", "Fábio", "Gisele", "Heitor", "Isabela",
         "João", "Karina", "Luana", "Mariana", "Nelson", "Olívia", "Paulo", "Renata", "Sérgio",
         "Tatiane", "Vinícius", "Yasmin", "André", "Beatriz", "Caio", "Daniela", "Eduardo",
         "Fernanda", "Gustavo", "Helena", "Igor", "Juliana", "Leonardo", "Marcela", "Otávio",
         "Patrícia", "Rafael", "Simone", "Tiago", "Vanessa", "Wagner"]
SOBRENOMES = ["Albuquerque", "Barros", "Cardoso", "Duarte", "Esteves", "Figueiredo", "Gouveia",
              "Hartmann", "Lacerda", "Macedo", "Nogueira", "Paixão", "Queiroz", "Rezende",
              "Sampaio", "Teixeira", "Valadares", "Xavier", "Zanetti", "Moraes"]

TIMES = [("CC 100", "Fiscalização", 6), ("CC 100", "Suprimentos e Orçamentário", 6),
         ("SEDE", "Administrativo", 4), ("CC 210", "Administrativo", 12),
         ("CC 210", "Operacional", 4), ("CC 305", "Externa", 4), ("CC 305", "Interna", 2),
         ("CC 410", "Externa", 2)]

# Cadastro do app (fictício). Clientes e limites partem de config/regras_iniciais.exemplo.json.
CLIENTES_POR_CC = {
    "CC 100": ("Cliente Alfa (Energia)", "Cidade Exemplo A", "SP"),
    "CC 210": ("Cliente Beta (Logística)", "Cidade Exemplo B", "MG"),
    "CC 305": ("Cliente Gama (Saneamento)", "Cidade Exemplo C", "RJ"),
    "CC 410": ("Cliente Gama (Saneamento)", "Cidade Exemplo D", "RJ"),
    "SEDE": ("Interno (Sede)", "Cidade Exemplo A", "SP"),
}
# (centro de custo, time): (limite de ausências, tolerância em dias)
LIMITES = {
    ("CC 100", "Fiscalização"): (1, 0),
    ("CC 100", "Suprimentos e Orçamentário"): (1, 0),
    ("SEDE", "Administrativo"): (2, 0),
    ("CC 210", "Administrativo"): (2, 2),
    ("CC 210", "Operacional"): (1, 0),
    ("CC 305", "Externa"): (1, 1),
    ("CC 305", "Interna"): (1, 1),
    ("CC 410", "Externa"): (1, 0),
}
# D14: gestor do contrato (Fiscalização) e preposto (Suprimentos) não saem juntos
PAR_SUBSTITUTOS = (("CC 100", "Fiscalização"), ("CC 100", "Suprimentos e Orçamentário"))


def proxima_segunda(d):
    return d + timedelta(days=(7 - d.weekday()) % 7)


def nome_unico(usados):
    while True:
        n = f"{random.choice(NOMES)} {random.choice(SOBRENOMES)} {random.choice(SOBRENOMES)}"
        if n not in usados:
            usados.add(n)
            return n


def main():
    usados, ativos, ferias = set(), [], []
    for cc, sub, qtd in TIMES:
        for _ in range(qtd):
            nome = nome_unico(usados)
            limite = date(2026, 9, 1) + timedelta(days=random.randint(0, 420))
            ativos.append([nome, cc, sub, limite])
            ini_conc = limite - relativedelta(years=1) + timedelta(days=1)
            # ~65% com férias lançadas; quem tem prazo já vencido fica sem (gera alerta)
            if limite < DATA_REFERENCIA or random.random() > 0.65:
                ferias.append([nome, None] + [None] * 6)
                continue
            vende = random.random() < 0.2
            ini = proxima_segunda(ini_conc + timedelta(days=random.randint(10, 200)))
            if vende:
                periodos = [(ini, 20)]
            elif random.random() < 0.5:
                periodos = [(ini, 30)]
            else:
                ini2 = proxima_segunda(ini + timedelta(days=random.randint(60, 120)))
                periodos = [(ini, 15), (ini2, 15)]
            linha = [nome, "Sim" if vende else "Não"]
            for p_ini, dias in periodos + [(None, None)] * (3 - len(periodos)):
                linha += [p_ini, p_ini + timedelta(days=dias - 1)] if p_ini else [None, None]
            ferias.append(linha)

    # Casos propositalmente irregulares, para testar as validações
    alvo = next(f for f in ferias if f[2] and f[1] == "Não" and f[4] is None)
    alvo[2] = alvo[2] + timedelta(days=4)                    # começa na sexta-feira
    alvo[3] = alvo[2] + timedelta(days=29)
    alvo2 = next(f for f in ferias if f[2] and f[1] == "Não" and f[4] is None and f is not alvo)
    base = alvo2[2]                                           # 3 períodos de 10 dias
    alvo2[2:8] = [base, base + timedelta(days=9), base + timedelta(days=63),
                  base + timedelta(days=72), base + timedelta(days=126), base + timedelta(days=135)]

    wb = Workbook()
    ws = wb.active
    ws.title = "Ativos"
    ws.append(["Nome", "Centro de Custo", "Subárea", "Data Limite"])
    for a in ativos:
        ws.append(a)
    ws.add_table(Table(displayName="Tabela_Ativos", ref=f"A1:D{len(ativos)+1}",
                       tableStyleInfo=TableStyleInfo(name="TableStyleMedium2")))

    ws = wb.create_sheet("Planilha1 (2)")
    ws.append(["Nome Colaborador", "Vender 10 Dias?", "Início 1º Período", "Fim 1º Período",
               "Início 2º Período", "Fim 2º Período", "Início 3º Período", "Fim 3º Período"])
    for f in ferias:
        ws.append(f)
    ws.add_table(Table(displayName="Tabela_Ferias", ref=f"A1:H{len(ferias)+1}",
                       tableStyleInfo=TableStyleInfo(name="TableStyleMedium2")))
    for w in wb.worksheets:
        for col in "ABCDEFGH":
            w.column_dimensions[col].width = 18
        for row in w.iter_rows(min_row=2):
            for c in row:
                if isinstance(c.value, date):
                    c.number_format = "DD/MM/YYYY"

    wb.properties.created = datetime.combine(DATA_REFERENCIA, datetime.min.time())
    wb.properties.modified = datetime.combine(DATA_REFERENCIA, datetime.min.time())
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    wb.save(SAIDA)
    print(f"{len(ativos)} funcionários fictícios -> {SAIDA}")

    cadastro = montar_cadastro(ativos)
    SAIDA_CADASTRO.write_text(json.dumps(cadastro, ensure_ascii=False, indent=2) + "\n",
                              encoding="utf-8", newline="\n")
    print(f"cadastro de exemplo ({len(cadastro['funcionarios'])} funcionários) -> {SAIDA_CADASTRO}")


def sem_acento(texto):
    return unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()


def montar_cadastro(ativos):
    """Cadastro do app a partir dos funcionários da planilha (mesmos nomes)."""
    rng = random.Random(2026)  # separado, para não mudar a sequência da planilha
    clientes, centros = [], []
    for cc, (cliente, municipio, uf) in CLIENTES_POR_CC.items():
        if cliente not in clientes:
            clientes.append(cliente)
        centros.append({"codigo": cc, "cliente": cliente, "municipio": municipio, "uf": uf})

    times = [{"centro_custo": cc, "nome": sub, "limite_ausencias": LIMITES[(cc, sub)][0],
              "tolerancia_dias": LIMITES[(cc, sub)][1]} for cc, sub, _ in TIMES]

    funcionarios, emails = [], set()
    for i, (nome, cc, sub, limite) in enumerate(ativos, start=1):
        # Data Limite = último dia para iniciar (D03) = fim do concessivo - 29 dias.
        # Com admissão A, o k-ésimo concessivo termina em A + (k + 2) anos - 1 dia.
        admissao = limite + timedelta(days=30) - relativedelta(years=2 + rng.randint(0, 6))
        partes = sem_acento(nome).split()
        email = f"{partes[0]}.{partes[-1]}@exemplo.com"
        n = 2
        while email in emails:
            email = f"{partes[0]}.{partes[-1]}{n}@exemplo.com"
            n += 1
        emails.add(email)
        funcionarios.append({
            "matricula": f"9{i:04d}",
            "nome": nome,
            "data_admissao": admissao.isoformat(),
            "centro_custo": cc,
            "time": sub,
            "email": email if rng.random() > 0.15 else None,  # alguns sem e-mail (campo opcional)
        })

    def primeiro(cc, sub):
        return next(f["matricula"] for f in funcionarios if f["centro_custo"] == cc and f["time"] == sub)

    substitutos = [{
        "matricula_a": primeiro(*PAR_SUBSTITUTOS[0]),
        "matricula_b": primeiro(*PAR_SUBSTITUTOS[1]),
        "tolerancia_dias": 0,
        "motivo": "Gestor do contrato e preposto não podem sair juntos (D14)",
    }]

    return {
        "_comentario": "Dados FICTÍCIOS gerados por scripts/gerar_dados_ficticios.py. "
                       "Os e-mails usam o domínio exemplo.com (D44).",
        "clientes": [{"nome": c} for c in clientes],
        "centros_custo": centros,
        "times": times,
        "funcionarios": funcionarios,
        "substitutos": substitutos,
    }


if __name__ == "__main__":
    main()
