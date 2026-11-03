require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');

const app = express();
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 3000;

if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL no arquivo .env.');
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET deve ter pelo menos 32 caracteres.');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: production ? { rejectUnauthorized: false } : undefined,
  max: 10,
  connectionTimeoutMillis: 10000
});
pool.on('error', error => console.error('Erro no PostgreSQL:', error.message));

app.disable('x-powered-by');
app.set('trust proxy', 1);
const directives = helmet.contentSecurityPolicy.getDefaultDirectives();
delete directives['upgrade-insecure-requests'];
app.use(helmet({ contentSecurityPolicy: { directives }, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(session({
  store: new pgSession({ pool, tableName: 'sessoes', createTableIfMissing: true }),
  name: 'conecta.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: production, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));

const limitLogin = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10,
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde alguns minutos.' }
});
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const publicUser = user => ({
  id: user.id, nome: user.nome, email: user.email, tipo: user.tipo,
  telefone: user.telefone, cidade: user.cidade, nomeEmpresa: user.nome_empresa
});
const auth = (req, res, next) => req.session.user ? next() : res.status(401).json({ erro: 'Faça login para continuar.' });
const role = type => (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ erro: 'Faça login para continuar.' });
  if (req.session.user.tipo !== type) return res.status(403).json({ erro: 'Você não tem permissão para esta ação.' });
  next();
};

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ sucesso: true, banco: 'conectado' });
}));

app.post('/api/cadastro', limitLogin, asyncRoute(async (req, res) => {
  const nome = clean(req.body.nome, 120);
  const email = clean(req.body.email, 160).toLowerCase();
  const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
  const tipo = clean(req.body.tipo, 20);
  const telefone = clean(req.body.telefone, 30);
  const cidade = clean(req.body.cidade, 100) || 'Capelinha';
  const nomeEmpresa = clean(req.body.nomeEmpresa, 160);
  if (nome.length < 3) return res.status(400).json({ erro: 'Informe seu nome completo.' });
  if (!validEmail(email)) return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  if (senha.length < 8 || senha.length > 72) return res.status(400).json({ erro: 'A senha deve ter entre 8 e 72 caracteres.' });
  if (!['candidato', 'empresa'].includes(tipo)) return res.status(400).json({ erro: 'Tipo de cadastro inválido.' });
  if (tipo === 'empresa' && nomeEmpresa.length < 2) return res.status(400).json({ erro: 'Informe o nome da empresa.' });
  const hash = await bcrypt.hash(senha, 12);
  try {
    const result = await pool.query(
      'INSERT INTO usuarios (nome,email,senha_hash,tipo,telefone,cidade,nome_empresa) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [nome,email,hash,tipo,telefone || null,cidade,tipo === 'empresa' ? nomeEmpresa : null]
    );
    req.session.user = publicUser(result.rows[0]);
    res.status(201).json({ sucesso: true, usuario: req.session.user });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
    throw error;
  }
}));

app.post('/api/login', limitLogin, asyncRoute(async (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
  if (!validEmail(email) || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  const result = await pool.query('SELECT * FROM usuarios WHERE email=$1', [email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(senha, user.senha_hash))) {
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  }
  req.session.regenerate(error => {
    if (error) return res.status(500).json({ erro: 'Não foi possível iniciar sua sessão.' });
    req.session.user = publicUser(user);
    req.session.save(saveError => {
      if (saveError) return res.status(500).json({ erro: 'Não foi possível salvar sua sessão.' });
      res.json({ sucesso: true, usuario: req.session.user });
    });
  });
}));

app.post('/api/logout', (req, res) => {
  req.session.destroy(error => {
    if (error) return res.status(500).json({ erro: 'Não foi possível sair da conta.' });
    res.clearCookie('conecta.sid');
    res.json({ sucesso: true });
  });
});
app.get('/api/me', (req, res) => res.json({ usuario: req.session.user || null }));

app.get('/api/vagas', asyncRoute(async (req, res) => {
  const busca = clean(req.query.busca, 100);
  const cidade = clean(req.query.cidade, 100);
  const values = [];
  let where = "v.status='aberta'";
  if (busca) {
    values.push('%' + busca + '%');
    const p = '$' + values.length;
    where += ` AND (v.titulo ILIKE ${p} OR v.descricao ILIKE ${p} OR COALESCE(v.requisitos,'') ILIKE ${p})`;
  }
  if (cidade) {
    values.push('%' + cidade + '%');
    where += ' AND v.cidade ILIKE $' + values.length;
  }
  const result = await pool.query(
    `SELECT v.id,v.titulo,v.descricao,v.requisitos,v.tipo_contrato,v.modalidade,v.cidade,v.salario,v.criado_em,u.nome_empresa
     FROM vagas v JOIN usuarios u ON u.id=v.empresa_id WHERE ${where} ORDER BY v.criado_em DESC LIMIT 60`, values
  );
  res.json({ vagas: result.rows });
}));

app.post('/api/vagas', role('empresa'), asyncRoute(async (req, res) => {
  const titulo = clean(req.body.titulo, 120);
  const descricao = clean(req.body.descricao, 5000);
  const requisitos = clean(req.body.requisitos, 3000);
  const contrato = clean(req.body.tipoContrato, 40);
  const modalidade = clean(req.body.modalidade, 30);
  const cidade = clean(req.body.cidade, 100);
  const salario = clean(req.body.salario, 80);
  if (titulo.length < 4) return res.status(400).json({ erro: 'O título deve ter pelo menos 4 caracteres.' });
  if (descricao.length < 20) return res.status(400).json({ erro: 'A descrição deve ter pelo menos 20 caracteres.' });
  if (!['CLT','Estágio','Temporário','Jovem Aprendiz','Freelancer','Autônomo'].includes(contrato)) return res.status(400).json({ erro: 'Selecione um contrato válido.' });
  if (!['Presencial','Híbrido','Remoto'].includes(modalidade)) return res.status(400).json({ erro: 'Selecione uma modalidade válida.' });
  if (cidade.length < 2) return res.status(400).json({ erro: 'Informe a cidade da vaga.' });
  const result = await pool.query(
    'INSERT INTO vagas (empresa_id,titulo,descricao,requisitos,tipo_contrato,modalidade,cidade,salario) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [req.session.user.id,titulo,descricao,requisitos || null,contrato,modalidade,cidade,salario || null]
  );
  res.status(201).json({ sucesso: true, vaga: result.rows[0] });
}));

app.get('/api/painel/empresa', role('empresa'), asyncRoute(async (req, res) => {
  const vagas = await pool.query('SELECT * FROM vagas WHERE empresa_id=$1 ORDER BY criado_em DESC', [req.session.user.id]);
  const candidaturas = await pool.query(
    `SELECT c.id,c.status,c.criada_em,c.mensagem,u.nome candidato_nome,u.email candidato_email,u.telefone,
      v.id vaga_id,v.titulo vaga_titulo FROM candidaturas c
      JOIN usuarios u ON u.id=c.candidato_id JOIN vagas v ON v.id=c.vaga_id
      WHERE v.empresa_id=$1 ORDER BY c.criada_em DESC`, [req.session.user.id]
  );
  res.json({ vagas: vagas.rows, candidaturas: candidaturas.rows });
}));

app.get('/api/painel/candidato', role('candidato'), asyncRoute(async (req, res) => {
  const result = await pool.query(
    `SELECT c.id,c.status,c.criada_em,c.mensagem,v.id vaga_id,v.titulo,v.cidade,v.nome_empresa
     FROM candidaturas c JOIN vagas v ON v.id=c.vaga_id
     WHERE c.candidato_id=$1 ORDER BY c.criada_em DESC`, [req.session.user.id]
  );
  res.json({ candidaturas: result.rows });
}));

app.post('/api/vagas/:id/candidatar', role('candidato'), asyncRoute(async (req, res) => {
  const vagaId = Number(req.params.id);
  const mensagem = clean(req.body.mensagem, 1000);
  if (!Number.isSafeInteger(vagaId) || vagaId < 1) return res.status(400).json({ erro: 'Vaga inválida.' });
  const vaga = await pool.query("SELECT id FROM vagas WHERE id=$1 AND status='aberta'", [vagaId]);
  if (!vaga.rowCount) return res.status(404).json({ erro: 'Esta vaga não está mais disponível.' });
  try {
    await pool.query('INSERT INTO candidaturas (vaga_id,candidato_id,mensagem) VALUES ($1,$2,$3)', [vagaId,req.session.user.id,mensagem || null]);
    res.status(201).json({ sucesso: true, mensagem: 'Candidatura enviada com sucesso.' });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ erro: 'Você já se candidatou a esta vaga.' });
    throw error;
  }
}));

app.patch('/api/candidaturas/:id/status', role('empresa'), asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const status = clean(req.body.status, 30);
  if (!Number.isSafeInteger(id) || id < 1 || !['recebida','em_analise','entrevista','aprovada','rejeitada'].includes(status)) {
    return res.status(400).json({ erro: 'Dados inválidos.' });
  }
  const result = await pool.query(
    'UPDATE candidaturas c SET status=$1 FROM vagas v WHERE c.id=$2 AND c.vaga_id=v.id AND v.empresa_id=$3 RETURNING c.id,c.status',
    [status,id,req.session.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ erro: 'Candidatura não encontrada.' });
  res.json({ sucesso: true, candidatura: result.rows[0] });
}));

app.patch('/api/vagas/:id/status', role('empresa'), asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const status = clean(req.body.status, 20);
  if (!Number.isSafeInteger(id) || id < 1 || !['aberta','pausada','encerrada'].includes(status)) return res.status(400).json({ erro: 'Dados inválidos.' });
  const result = await pool.query('UPDATE vagas SET status=$1 WHERE id=$2 AND empresa_id=$3 RETURNING id,status', [status,id,req.session.user.id]);
  if (!result.rowCount) return res.status(404).json({ erro: 'Vaga não encontrada.' });
  res.json({ sucesso: true, vaga: result.rows[0] });
}));

app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  if (!res.headersSent) res.status(500).json({ erro: 'Ocorreu um erro interno. Tente novamente.' });
});
app.listen(port, () => console.log(`ConectaTrabalho rodando na porta ${port}`));
