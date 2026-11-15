-- =====================================================================
-- Controle de Férias - Modelo de dados (SQLite; compatível com PostgreSQL
-- com ajustes mínimos de tipos)
-- Camadas: bronze_* (cópia bruta da planilha) -> tabelas de negócio (silver)
-- As visões "gold" (saldo, alertas, ocupação por time) virão depois, no app.
-- =====================================================================
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- BRONZE: dado bruto, exatamente como veio da planilha (tudo texto)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bronze_ativos (
    id_carga        TEXT NOT NULL,
    linha_origem    INTEGER NOT NULL,
    nome            TEXT,
    centro_custo    TEXT,
    subarea         TEXT,
    data_limite     TEXT,
    carregado_em    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bronze_ferias (
    id_carga        TEXT NOT NULL,
    linha_origem    INTEGER NOT NULL,
    nome            TEXT,
    vender_10_dias  TEXT,
    inicio_1        TEXT, fim_1 TEXT,
    inicio_2        TEXT, fim_2 TEXT,
    inicio_3        TEXT, fim_3 TEXT,
    carregado_em    TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- ESTRUTURA ORGANIZACIONAL
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cliente (
    id      INTEGER PRIMARY KEY,
    nome    TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS centro_custo (
    id          INTEGER PRIMARY KEY,
    codigo      TEXT NOT NULL UNIQUE,          -- ex.: CC 100, CC 210, SEDE
    cliente_id  INTEGER REFERENCES cliente(id),-- NULL = ainda não informado
    municipio   TEXT,                          -- para feriados municipais
    uf          TEXT
);

-- "Time" = combinação centro de custo + subárea
-- (ex.: Administrativo da SEDE é diferente de Administrativo do CC 210)
CREATE TABLE IF NOT EXISTS time (
    id                  INTEGER PRIMARY KEY,
    centro_custo_id     INTEGER NOT NULL REFERENCES centro_custo(id),
    subarea             TEXT NOT NULL,
    limite_ausencias    INTEGER,               -- máx. de pessoas fora ao mesmo tempo; NULL = sem regra
    UNIQUE (centro_custo_id, subarea)
);

-- ---------------------------------------------------------------------
-- PESSOAS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS funcionario (
    id                  INTEGER PRIMARY KEY,
    matricula           TEXT UNIQUE,           -- pendente
    nome                TEXT NOT NULL,
    data_admissao       TEXT,                  -- pendente (AAAA-MM-DD)
    aniversario_ciclo   TEXT,                  -- dia/mês derivado da Data Limite (MM-DD), até ter a admissão real
    time_id             INTEGER NOT NULL REFERENCES time(id),
    email               TEXT,                  -- pendente (para pedidos por e-mail)
    ativo               INTEGER NOT NULL DEFAULT 1,
    data_desligamento   TEXT,
    criado_em           TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- DIREITO A FÉRIAS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS periodo_aquisitivo (
    id                      INTEGER PRIMARY KEY,
    funcionario_id          INTEGER NOT NULL REFERENCES funcionario(id),
    inicio                  TEXT NOT NULL,     -- início do período aquisitivo
    fim                     TEXT NOT NULL,     -- fim do período aquisitivo
    limite_concessivo       TEXT NOT NULL,     -- último dia para gozar (após isso: férias em dobro)
    dias_direito            INTEGER NOT NULL DEFAULT 30,
    faltas_injustificadas   INTEGER,           -- art. 130 CLT (fora do MVP)
    vendeu_abono            INTEGER,           -- 1 = vendeu 10 dias, 0 = não, NULL = não informado
    origem                  TEXT NOT NULL,     -- 'planilha_derivado', 'gerado_pelo_sistema', 'manual'
    observacao              TEXT,
    UNIQUE (funcionario_id, inicio)
);

CREATE TABLE IF NOT EXISTS ferias_periodo (
    id                      INTEGER PRIMARY KEY,
    periodo_aquisitivo_id   INTEGER NOT NULL REFERENCES periodo_aquisitivo(id),
    ordem                   INTEGER NOT NULL,  -- 1º, 2º, 3º período
    inicio                  TEXT NOT NULL,
    fim                     TEXT NOT NULL,
    dias                    INTEGER NOT NULL,
    status                  TEXT NOT NULL,     -- 'a_confirmar', 'programado', 'gozado', 'cancelado'
    origem                  TEXT NOT NULL,     -- 'planilha', 'app', 'email'
    CHECK (fim >= inicio)
);

-- ---------------------------------------------------------------------
-- FLUXO DE SOLICITAÇÃO (fase do e-mail + IA; criado vazio)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitacao (
    id                  INTEGER PRIMARY KEY,
    funcionario_id      INTEGER REFERENCES funcionario(id),
    canal               TEXT NOT NULL,         -- 'email', 'app'
    texto_original      TEXT,                  -- e-mail bruto
    dados_extraidos     TEXT,                  -- JSON extraído pela IA
    status              TEXT NOT NULL DEFAULT 'pendente', -- pendente/aprovada/recusada
    decidido_por        TEXT,
    decidido_em         TEXT,
    criado_em           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Auditoria: tudo que o gerente cadastra, edita ou remove fica registrado
CREATE TABLE IF NOT EXISTS historico_alteracao (
    id              INTEGER PRIMARY KEY,
    tabela          TEXT NOT NULL,
    registro_id     INTEGER NOT NULL,
    acao            TEXT NOT NULL,             -- 'insert', 'update', 'delete', 'desligamento'
    dados_antes     TEXT,                      -- JSON
    dados_depois    TEXT,                      -- JSON
    usuario         TEXT,
    em              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- APOIO
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feriado (
    data        TEXT NOT NULL,
    nome        TEXT NOT NULL,
    escopo      TEXT NOT NULL,                 -- 'nacional', 'estadual', 'municipal'
    uf          TEXT,
    municipio   TEXT,
    PRIMARY KEY (data, escopo, uf, municipio)
);

CREATE TABLE IF NOT EXISTS regra_config (
    chave       TEXT PRIMARY KEY,
    valor       TEXT,                          -- NULL = aguardando definição
    descricao   TEXT NOT NULL
);

-- Problemas encontrados na carga (para auditoria e para a lista de pendências)
CREATE TABLE IF NOT EXISTS qualidade_carga (
    id              INTEGER PRIMARY KEY,
    id_carga        TEXT NOT NULL,
    severidade      TEXT NOT NULL,             -- 'erro', 'aviso', 'pendencia'
    entidade        TEXT NOT NULL,
    referencia      TEXT,                      -- nome do funcionário, time etc.
    descricao       TEXT NOT NULL
);
