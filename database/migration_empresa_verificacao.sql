-- Dados adicionais para contas empresariais.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cnpj VARCHAR(14);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS razao_social VARCHAR(160);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(160);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_cnpj_unico
  ON usuarios (cnpj) WHERE cnpj IS NOT NULL;

CREATE TABLE IF NOT EXISTS cadastros_empresa_pendentes (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  telefone VARCHAR(30) NOT NULL,
  cidade VARCHAR(100) NOT NULL,
  cnpj VARCHAR(14) NOT NULL UNIQUE,
  razao_social VARCHAR(160) NOT NULL,
  nome_fantasia VARCHAR(160),
  codigo_hash CHAR(64) NOT NULL,
  expira_em TIMESTAMPTZ NOT NULL,
  tentativas SMALLINT NOT NULL DEFAULT 0 CHECK (tentativas >= 0 AND tentativas <= 5),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cadastros_empresa_pendentes_expira
  ON cadastros_empresa_pendentes (expira_em);
