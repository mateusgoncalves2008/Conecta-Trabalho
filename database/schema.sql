CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('candidato','empresa')),
  telefone VARCHAR(30),
  cidade VARCHAR(100) NOT NULL DEFAULT 'Capelinha',
  nome_empresa VARCHAR(160),
  descricao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vagas (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(120) NOT NULL,
  descricao TEXT NOT NULL,
  requisitos TEXT,
  tipo_contrato VARCHAR(40) NOT NULL,
  modalidade VARCHAR(30) NOT NULL DEFAULT 'Presencial',
  cidade VARCHAR(100) NOT NULL,
  salario VARCHAR(80),
  status VARCHAR(20) NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','pausada','encerrada')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidaturas (
  id BIGSERIAL PRIMARY KEY,
  vaga_id BIGINT NOT NULL REFERENCES vagas(id) ON DELETE CASCADE,
  candidato_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mensagem TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'recebida'
    CHECK (status IN ('recebida','em_analise','entrevista','aprovada','rejeitada')),
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vaga_id, candidato_id)
);

CREATE INDEX IF NOT EXISTS idx_vagas_status_data ON vagas(status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_vagas_cidade ON vagas(cidade);
CREATE INDEX IF NOT EXISTS idx_candidaturas_candidato ON candidaturas(candidato_id, criada_em DESC);
CREATE INDEX IF NOT EXISTS idx_candidaturas_vaga ON candidaturas(vaga_id, criada_em DESC);
