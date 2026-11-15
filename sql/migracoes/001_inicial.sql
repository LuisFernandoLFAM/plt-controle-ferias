-- 001_inicial.sql
-- Esquema inicial do app de férias (D38).
-- Datas: 'AAAA-MM-DD'. Data e hora: UTC 'AAAA-MM-DDTHH:MM:SSZ' (D37).
-- O app liga foreign_keys na conexão e grava user_version depois de aplicar a migração.


-- Estrutura organizacional ---------------------------------------------

CREATE TABLE cliente (
    id      INTEGER PRIMARY KEY,
    nome    TEXT NOT NULL UNIQUE,
    ativo   INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);

CREATE TABLE centro_custo (
    id          INTEGER PRIMARY KEY,
    codigo      TEXT NOT NULL UNIQUE,
    cliente_id  INTEGER NOT NULL REFERENCES cliente(id),
    municipio   TEXT,
    uf          TEXT,
    ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);

CREATE INDEX ix_centro_custo_cliente ON centro_custo(cliente_id);

CREATE TABLE time (
    id                  INTEGER PRIMARY KEY,
    centro_custo_id     INTEGER NOT NULL REFERENCES centro_custo(id),
    nome                TEXT NOT NULL,
    limite_ausencias    INTEGER NOT NULL DEFAULT 1 CHECK (limite_ausencias >= 1),
    tolerancia_dias     INTEGER NOT NULL DEFAULT 0 CHECK (tolerancia_dias >= 0),
    ativo               INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    UNIQUE (centro_custo_id, nome)
);

-- Pessoas ----------------------------------------------------------------

CREATE TABLE funcionario (
    id                  INTEGER PRIMARY KEY,
    matricula           TEXT NOT NULL UNIQUE,              -- D40
    nome                TEXT NOT NULL,
    data_admissao       TEXT NOT NULL,
    time_id             INTEGER NOT NULL REFERENCES time(id),
    email               TEXT,                              -- D30
    observacao          TEXT,
    ativo               INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    data_desligamento   TEXT,
    criado_em           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    atualizado_em       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CHECK (data_admissao GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    CHECK (data_desligamento IS NULL
           OR data_desligamento GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    CHECK (ativo = 1 OR data_desligamento IS NOT NULL),
    CHECK (data_desligamento IS NULL OR data_desligamento >= data_admissao)
);

CREATE INDEX ix_funcionario_time ON funcionario(time_id);

-- Pares de substitutos (D14) ----------------------------------------------

CREATE TABLE regra_substituto (
    id                  INTEGER PRIMARY KEY,
    funcionario_a_id    INTEGER NOT NULL REFERENCES funcionario(id),
    funcionario_b_id    INTEGER NOT NULL REFERENCES funcionario(id),
    tolerancia_dias     INTEGER NOT NULL DEFAULT 0 CHECK (tolerancia_dias >= 0),
    motivo              TEXT,
    ativo               INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    CHECK (funcionario_a_id < funcionario_b_id),
    UNIQUE (funcionario_a_id, funcionario_b_id)
);

CREATE INDEX ix_regra_substituto_b ON regra_substituto(funcionario_b_id);

-- Direito a férias (usado a partir das Fases 2 e 3) --------------------------

CREATE TABLE periodo_aquisitivo (
    id                  INTEGER PRIMARY KEY,
    funcionario_id      INTEGER NOT NULL REFERENCES funcionario(id),
    inicio              TEXT NOT NULL,
    fim                 TEXT NOT NULL,
    limite_concessivo   TEXT NOT NULL,     -- fim do período concessivo
    data_limite_inicio  TEXT,              -- último dia para iniciar as férias (D03)
    dias_direito        INTEGER NOT NULL DEFAULT 30,
    vendeu_abono        INTEGER CHECK (vendeu_abono IN (0, 1)),
    origem              TEXT NOT NULL,     -- 'relatorio', 'planilha', 'app', 'calculado'
    observacao          TEXT,
    UNIQUE (funcionario_id, inicio)
);

CREATE TABLE ferias_periodo (
    id                      INTEGER PRIMARY KEY,
    periodo_aquisitivo_id   INTEGER NOT NULL REFERENCES periodo_aquisitivo(id),
    ordem                   INTEGER NOT NULL CHECK (ordem BETWEEN 1 AND 3),
    inicio                  TEXT NOT NULL,
    fim                     TEXT NOT NULL,
    dias                    INTEGER NOT NULL CHECK (dias > 0),
    status                  TEXT NOT NULL DEFAULT 'programado'
                            CHECK (status IN ('programado', 'cancelado')),   -- D42
    data_aviso              TEXT,          -- D08: início - 35 dias (editável)
    aviso_emitido           INTEGER NOT NULL DEFAULT 0 CHECK (aviso_emitido IN (0, 1)),
    data_pagamento          TEXT,          -- D08: início - 4 dias (editável)
    pagamento_realizado     INTEGER NOT NULL DEFAULT 0 CHECK (pagamento_realizado IN (0, 1)),
    origem                  TEXT NOT NULL, -- 'planilha', 'app', 'formulario'
    CHECK (fim >= inicio)
);

CREATE INDEX ix_ferias_periodo_periodo ON ferias_periodo(periodo_aquisitivo_id);

-- Apoio ----------------------------------------------------------------------

CREATE TABLE feriado (
    data        TEXT NOT NULL,
    nome        TEXT NOT NULL,
    escopo      TEXT NOT NULL CHECK (escopo IN ('nacional', 'estadual', 'municipal')),
    uf          TEXT NOT NULL DEFAULT '',
    municipio   TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (data, escopo, uf, municipio)
);

CREATE TABLE regra_config (
    chave       TEXT PRIMARY KEY,
    valor       TEXT,
    descricao   TEXT NOT NULL
);

INSERT INTO regra_config (chave, valor, descricao) VALUES
    ('alerta_vencimento_dias', '90', 'Antecedência do alerta de vencimento (D09)'),
    ('aviso_antecedencia_dias', '35', 'Dias antes do início para emitir o aviso (D08)'),
    ('pagamento_antecedencia_dias', '4', 'Dias antes do início para o pagamento (D08)'),
    ('abono_permite_fracionar', '0', 'Quem vende 10 dias pode dividir os 20 restantes? 0 = não (D04)'),
    ('dia_descanso', 'domingo', 'Dia de descanso semanal (D06)');

-- Auditoria ------------------------------------------------------------------

CREATE TABLE historico_alteracao (
    id              INTEGER PRIMARY KEY,
    tabela          TEXT NOT NULL,
    registro_id     INTEGER NOT NULL,
    acao            TEXT NOT NULL CHECK (acao IN
                    ('inclusao', 'edicao', 'exclusao', 'desligamento', 'reativacao')),
    dados_antes     TEXT,              -- JSON
    dados_depois    TEXT,              -- JSON
    usuario         TEXT NOT NULL DEFAULT 'gestor',
    em              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX ix_historico_em ON historico_alteracao(em);
