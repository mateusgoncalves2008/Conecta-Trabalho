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

CREATE TABLE IF NOT EXISTS vagas_salvas (
  candidato_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  vaga_id BIGINT NOT NULL REFERENCES vagas(id) ON DELETE CASCADE,
  salva_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (candidato_id, vaga_id)
);

CREATE INDEX IF NOT EXISTS idx_vagas_salvas_candidato_data
  ON vagas_salvas (candidato_id, salva_em DESC);
CREATE TABLE IF NOT EXISTS empresas_seguidoras (
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  data_seguimento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, empresa_id),
  CHECK (usuario_id <> empresa_id)
);
CREATE INDEX IF NOT EXISTS idx_empresas_seguidoras_empresa_data ON empresas_seguidoras (empresa_id, data_seguimento DESC);
CREATE INDEX IF NOT EXISTS idx_empresas_seguidoras_usuario_data ON empresas_seguidoras (usuario_id, data_seguimento DESC);
CREATE TABLE IF NOT EXISTS notificacoes_empresas (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  vaga_id BIGINT NOT NULL REFERENCES vagas(id) ON DELETE CASCADE,
  tipo VARCHAR(30) NOT NULL DEFAULT 'nova_vaga',
  lida_em TIMESTAMPTZ,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, vaga_id, tipo)
);
CREATE INDEX IF NOT EXISTS idx_notificacoes_empresas_usuario_data ON notificacoes_empresas (usuario_id, criada_em DESC);


-- Dados adicionais para contas empresariais.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cnpj VARCHAR(14);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS razao_social VARCHAR(160);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(160);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_perfil TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS perfil_publico BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS banner_perfil TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS titulo_profissional VARCHAR(120);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS resumo_profissional TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS objetivo_profissional TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tipo_oportunidade VARCHAR(80);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modalidade_preferida VARCHAR(40);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS experiencias TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS formacao TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS competencias TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS curriculo_url VARCHAR(500);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_site VARCHAR(300);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_setor VARCHAR(100);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_porte VARCHAR(50);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_descricao_curta VARCHAR(240);

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

-- Publicações, mídias, reações e denúncias do feed público.
CREATE TABLE IF NOT EXISTS publicacoes (
  id BIGSERIAL PRIMARY KEY,
  autor_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL DEFAULT '',
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_publicacoes_data ON publicacoes (criada_em DESC);
CREATE INDEX IF NOT EXISTS idx_publicacoes_autor_data ON publicacoes (autor_id, criada_em DESC);

CREATE TABLE IF NOT EXISTS publicacao_midias (
  id BIGSERIAL PRIMARY KEY,
  publicacao_id BIGINT REFERENCES publicacoes(id) ON DELETE CASCADE,
  autor_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('image','video')),
  mime_type VARCHAR(40) NOT NULL,
  tamanho_bytes BIGINT NOT NULL CHECK (tamanho_bytes > 0),
  duracao_segundos NUMERIC(6,2),
  ordem SMALLINT NOT NULL DEFAULT 0,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_publicacao_midias_post ON publicacao_midias (publicacao_id, ordem);
CREATE INDEX IF NOT EXISTS idx_publicacao_midias_staging ON publicacao_midias (autor_id, criada_em) WHERE publicacao_id IS NULL;

CREATE TABLE IF NOT EXISTS publicacao_reacoes (
  publicacao_id BIGINT NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  emoji VARCHAR(16) NOT NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (publicacao_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_publicacao_reacoes_post ON publicacao_reacoes (publicacao_id);

CREATE TABLE IF NOT EXISTS publicacao_visualizacoes (
  publicacao_id BIGINT NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  visualizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (publicacao_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_publicacao_visualizacoes_post ON publicacao_visualizacoes (publicacao_id);
UPDATE publicacao_reacoes SET emoji = '❤️' WHERE emoji <> '❤️';

CREATE TABLE IF NOT EXISTS publicacao_denuncias (
  id BIGSERIAL PRIMARY KEY,
  publicacao_id BIGINT NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE,
  denunciante_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  motivo VARCHAR(100) NOT NULL,
  detalhe VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','em_analise','resolvida','descartada')),
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (publicacao_id, denunciante_id)
);
CREATE INDEX IF NOT EXISTS idx_publicacao_denuncias_status_data
  ON publicacao_denuncias (status, criada_em DESC);


-- Ranking global dos termos mais pesquisados pela comunidade.
CREATE TABLE IF NOT EXISTS pesquisas_populares (
  termo_normalizado TEXT PRIMARY KEY,
  termo_exibicao VARCHAR(100) NOT NULL,
  total_pesquisas BIGINT NOT NULL DEFAULT 0 CHECK (total_pesquisas >= 0),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
