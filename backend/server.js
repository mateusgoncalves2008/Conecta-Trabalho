require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');
const nodemailer = require('nodemailer');

const app = express();
const production = process.env.NODE_ENV === 'production';
const companyCnpjTestMode = process.env.NODE_ENV === 'development' && process.env.COMPANY_CNPJ_TEST_MODE === 'true';
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
const limitCnpj = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 12,
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { erro: 'Muitas consultas de CNPJ. Aguarde alguns minutos.' }
});
const limitCompanySignup = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5,
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { erro: 'Muitas tentativas de cadastro empresarial. Aguarde alguns minutos.' }
});
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const normalizeEmail = value => {
  const email = clean(value, 160).toLowerCase();
  return email && !email.includes('@') ? email + '@gmail.com' : email;
};
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const publicUser = user => ({
  id: user.id, nome: user.nome, email: user.email, tipo: user.tipo,
  telefone: user.telefone, cidade: user.cidade, nomeEmpresa: user.nome_empresa,
  emailVerificado: user.email_verificado === true
});
const auth = (req, res, next) => req.session.user ? next() : res.status(401).json({ erro: 'Faça login para continuar.' });
const role = type => (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ erro: 'Faça login para continuar.' });
  if (req.session.user.tipo !== type) return res.status(403).json({ erro: 'Você não tem permissão para esta ação.' });
  if (type === 'empresa' && !req.session.user.emailVerificado) {
    return res.status(403).json({ erro: 'Esta conta empresarial precisa confirmar o e-mail e validar o CNPJ.' });
  }
  next();
};

const normalizeCnpj = value => clean(value, 30).replace(/[^0-9a-z]/gi, '').toUpperCase();
const validCnpj = value => {
  const cnpj = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;
  const digit = (base, weights) => {
    const sum = [...base].reduce((total, char, index) => total + (char.charCodeAt(0) - 48) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = digit(cnpj.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const second = digit(cnpj.slice(0, 12) + first, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return cnpj.slice(12) === String(first) + String(second);
};
const calculateCnpjDigit = (base, weights) => {
  const sum = [...base].reduce((total, char, index) => total + (char.charCodeAt(0) - 48) * weights[index], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
};
const generateTestCnpj = () => {
  const base = String(crypto.randomInt(10000000, 99999999)) + '0001';
  const first = calculateCnpjDigit(base, [5,4,3,2,9,8,7,6,5,4,3,2]);
  const second = calculateCnpjDigit(base + first, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return base + first + second;
};
const lookupCnpj = async cnpj => {
  const response = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + encodeURIComponent(cnpj), {
    signal: AbortSignal.timeout(6000)
  });
  if (response.status === 404) {
    const error = new Error('CNPJ não encontrado. Confira o número informado.');
    error.statusCode = 404;
    throw error;
  }
  if (!response.ok) {
    const error = new Error('Não foi possível consultar o CNPJ agora. Tente novamente em instantes.');
    error.statusCode = 503;
    throw error;
  }
  const data = await response.json();
  if (Number(data.situacao_cadastral) !== 2) {
    const error = new Error('Este CNPJ não está com situação ATIVA na Receita Federal.');
    error.statusCode = 422;
    throw error;
  }
  return data;
};
const sendCompanyVerificationEmail = async (email, code, companyName) => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    const error = new Error('O envio de e-mails ainda não está configurado no servidor.');
    error.statusCode = 503;
    throw error;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD.replace(/\\s/g, '')
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  const safeCompanyName = String(companyName)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const text = [
    'ConectaTrabalho',
    '',
    'CONFIRME SEU E-MAIL',
    '',
    'Olá!',
    'Use o código abaixo para concluir o cadastro da empresa ' + companyName + ':',
    '',
    code,
    '',
    'Este código expira em 10 minutos.',
    '',
    'Se você não solicitou este cadastro, ignore esta mensagem.',
    '',
    'ConectaTrabalho - Conectando talentos a oportunidades.'
  ].join('\n');

  const html = [
    '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Confirme seu e-mail</title></head>',
    '<body style="margin:0;padding:0;background-color:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#263445;">',
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Seu código de confirmação do ConectaTrabalho.</div>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f5f8;padding:32px 12px;"><tr><td align="center">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e4e8ee;border-radius:12px;overflow:hidden;">',
    '<tr><td style="padding:26px 28px 22px;border-bottom:1px solid #e9edf2;background-color:#ffffff;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>',
    '<td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;"><img src="cid:conectatrabalho-logo" width="48" height="48" alt="ConectaTrabalho" style="display:block;width:48px;height:48px;border:0;"></td>',
    '<td style="padding-left:13px;color:#142b49;font-size:19px;font-weight:700;line-height:1.3;">' + safeCompanyName + '<br><span style="color:#7a8797;font-size:12px;font-weight:400;">ConectaTrabalho</span></td>',
    '</tr></table></td></tr>',
    '<tr><td style="padding:34px 28px 12px;"><p style="margin:0 0 10px;color:#e96f35;font-size:12px;font-weight:700;letter-spacing:1.2px;">CONFIRMAÇÃO DE CADASTRO</p>',
    '<h1 style="margin:0 0 18px;color:#142b49;font-size:25px;line-height:1.25;">Confirme seu e-mail</h1>',
    '<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Olá!</p>',
    '<p style="margin:0;font-size:15px;line-height:1.7;">Use o código abaixo para concluir o cadastro da empresa <strong>' + safeCompanyName + '</strong>.</p></td></tr>',
    '<tr><td align="center" style="padding:22px 28px 18px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:340px;background-color:#f4f6f9;border:1px solid #e1e6ed;border-radius:10px;"><tr>',
    '<td align="center" style="padding:20px 12px;"><p style="margin:0 0 8px;color:#667386;font-size:12px;font-weight:700;letter-spacing:1px;">SEU CÓDIGO DE CONFIRMAÇÃO</p>',
    '<p style="margin:0;color:#142b49;font-family:Arial,Helvetica,sans-serif;font-size:34px;font-weight:700;letter-spacing:8px;">' + code + '</p></td></tr></table></td></tr>',
    '<tr><td style="padding:4px 28px 30px;"><p style="margin:0 0 12px;color:#263445;font-size:14px;line-height:1.7;"><strong>Importante:</strong> este código expira em 10 minutos.</p>',
    '<p style="margin:0;color:#667386;font-size:13px;line-height:1.7;">Se você não solicitou este cadastro, ignore esta mensagem. Nenhuma ação é necessária.</p></td></tr>',
    '<tr><td style="border-top:1px solid #e9edf2;padding:18px 28px;background-color:#fafbfd;"><p style="margin:0;color:#7a8797;font-size:12px;line-height:1.6;">Esta é uma mensagem automática do ConectaTrabalho. Por favor, não responda a este e-mail.</p>',
    '<p style="margin:7px 0 0;color:#7a8797;font-size:12px;">Conectando talentos a oportunidades.</p></td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('');

  const logoPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAABmJLR0QA/wD/AP+gvaeTAAAEKElEQVR4nO3dWUhUURzH8e446oyNU4rihFYWWtqkRmTQSkV7tiS04UMIQbYXLUSSpGmZ5TZqD70UZPg/9wy/8vw+j3LnnD9+R2fmXrlaMf4pXQjHgR7AdAwAxgBgDADGAGAMAMYAYAwAxgBgDADGAGAMAMYAYAwAxgBgDADGAGAMAMYAYAwAxgBgDADGAGAMAMYAYAwAxgBgDADGAGAMAMYAYAwAxgBgDADGAGAMAOYMxqIOhzXI329IRkqGPzkxwdczPs7tCvd6ujoclp1lYwdO/ePXH4+vsrOsdv7imI4frDlAcp+eyxdOmz5xZFxstN6VOyttAXon+Dbnr5w6bphl2Xqam0ZDAMuyshfP3Ji7NDw8zP5qprEbICzUuWdb/szJo7RMYyBbAUKdziNFG8ePztQ1jYFsvQ3dWrCK332b1APMyxq7dMGf3xdSxykGiI7yblmXo3cUMykGWLNifnSUV+8oZlIJ0N3rWb4wS/soZlIJMC9rrNsVrn0UM6kEmDNtjO4xzCUOENUtcnBa/2CMYiZxgBGZ6SEOnsTWRvxJOC21r8I2T1682Xv0XElpWWVVTUNjk8IKf9Hx079qJ65Fp5elxAFSkhKlDzl79fbq9TubAwHpA00g/mUS3yNWdPz7D5W5m4r43W+POIBPeKXl+Jnr3+sbpLuYQxzA09UtOv7uvQfSLYwiDiC96vLqbbl0C6OIAzhDQkTH136tk25hlKC/o29q5svv3/AjFRgDgDEAGAOAMQAYA4AxABgDgDEAGAOAMQAYA4AxABgDgDEAGAOAMQAYA4AxABgDgDEAGAOAMQAYA4AxABgDgDEAWNADhIUG5XYUnYY4QKClRXS8N9Ij3cIo4gCNwj8uT+qTIN3CKOIAdd/qRcePHJou3cIo4gAVldWi4xfPnRThdkl3MYc4QPmHStHx8b7YosJcvhS3Rxzg6cu30ofMmjy6+OSuRbMn9Ir3uXhLm9+Jn5iPnr1W2CY1OXFXYZ7CA3/V3i3L/mvin4CS0rKW1tZgjGImcYCaL1/vP3wejFHMpPJJ+MzlW7rHMJdKgFOXbtY3NGofxUwqAT7X1h06cVH7KGZSPBm3+9Cp6ppavaOYSTFA9efagu379I5iJvXT0acv3zp88orGUcxk63pAwdZ9xXdKdY1iJlsBmgOBJWsLz127o2saA9m9ItbUHMjO37Fh+37pdQL6ScMlyba2tgPHzg+fserSjZLW1jb7CxpF2zXhd+UVy/K2jJiRc/D4hYqPn3Qt2+lZMf4p2hd1OKz01KTMQQMy/Ek//4FDhNsV6Ymwea8z+2dD/8E7ZgUlAHUc/y4IjAHAGACMAcAYAIwBwBgAjAHAGACMAcAYAIwBwBgAjAHAGACMAcAYAIwBwBgAjAHAGACMAcAYAIwBwBgAjAHAGACMAcAYAIwBwH4ALmO/pR3T5fkAAAAASUVORK5CYII=', 'base64');

  await transporter.sendMail({
    from: '"ConectaTrabalho" <' + process.env.GMAIL_USER + '>',
    to: email,
    subject: 'Confirme seu e-mail | ConectaTrabalho',
    text,
    html,
    attachments: [{
      filename: 'logo-conectatrabalho.png',
      content: logoPng,
      cid: 'conectatrabalho-logo',
      contentType: 'image/png',
      contentDisposition: 'inline'
    }]
  });
};

const hashVerificationCode = code => crypto.createHash('sha256')
  .update(code + ':' + process.env.SESSION_SECRET).digest('hex');


app.get('/api/config', (_req, res) => {
  res.json({ modoTesteCnpj: companyCnpjTestMode });
});

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ sucesso: true, banco: 'conectado' });
}));

app.get('/api/empresa/consultar-cnpj/:cnpj', limitCnpj, asyncRoute(async (req, res) => {
  const cnpj = normalizeCnpj(req.params.cnpj);
  if (!validCnpj(cnpj)) return res.status(400).json({ erro: 'Informe um CNPJ válido.' });
  try {
    const data = await lookupCnpj(cnpj);
    res.json({
      cnpj,
      razaoSocial: clean(data.razao_social, 160),
      nomeFantasia: clean(data.nome_fantasia, 160),
      municipio: clean(data.municipio, 100),
      uf: clean(data.uf, 2),
      cep: clean(data.cep, 12),
      logradouro: clean(data.logradouro, 160),
      numero: clean(data.numero, 30),
      bairro: clean(data.bairro, 100),
      situacao: 'ATIVA'
    });
  } catch (error) {
    res.status(error.statusCode || 503).json({ erro: error.message || 'Falha ao consultar o CNPJ.' });
  }
}));

app.post('/api/cadastro/empresa/solicitar-codigo', limitCompanySignup, asyncRoute(async (req, res) => {
  const nome = clean(req.body.nome, 120);
  const email = normalizeEmail(req.body.email);
  const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
  const telefone = clean(req.body.telefone, 30);
  let cnpj = normalizeCnpj(req.body.cnpj);
  if (nome.length < 3) return res.status(400).json({ erro: 'Informe o nome completo do responsável.' });
  if (!validEmail(email)) return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  if (senha.length < 8 || senha.length > 72) return res.status(400).json({ erro: 'A senha deve ter entre 8 e 72 caracteres.' });
  if (telefone.replace(/\D/g, '').length < 10) return res.status(400).json({ erro: 'Informe um telefone de contato válido.' });
  if (!companyCnpjTestMode && !validCnpj(cnpj)) return res.status(400).json({ erro: 'Informe um CNPJ válido.' });
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(503).json({ erro: 'A confirmação por e-mail ainda não está configurada no servidor.' });
  }

  const existing = await pool.query('SELECT id FROM usuarios WHERE email=$1 OR cnpj=$2', [email, cnpj]);
  if (existing.rowCount) return res.status(409).json({ erro: 'Este e-mail ou CNPJ já está cadastrado.' });

  const pendingExisting = await pool.query(
    'SELECT email,cnpj FROM cadastros_empresa_pendentes WHERE email=$1 OR cnpj=$2', [email, cnpj]
  );
  if (pendingExisting.rows.some(row => row.email !== email)) {
    return res.status(409).json({ erro: 'Já existe uma confirmação em andamento para este CNPJ.' });
  }

  let company;
  if (companyCnpjTestMode) {
    cnpj = generateTestCnpj();
    company = {
      razao_social: 'EMPRESA DE TESTE ' + cnpj,
      nome_fantasia: 'Empresa de Teste',
      municipio: clean(req.body.cidade, 90) || 'Capelinha',
      uf: ''
    };
  } else {
    try { company = await lookupCnpj(cnpj); }
    catch (error) { return res.status(error.statusCode || 503).json({ erro: error.message }); }
  }

  const razaoSocial = clean(company.razao_social, 160);
  if (!razaoSocial) return res.status(503).json({ erro: 'A consulta não retornou a razão social da empresa. Tente novamente.' });
  const nomeFantasia = clean(company.nome_fantasia, 160) || razaoSocial;
  const cidade = [clean(company.municipio, 90), clean(company.uf, 2)].filter(Boolean).join(' - ') || 'Não informado';
  const senhaHash = await bcrypt.hash(senha, 12);
  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const codigoHash = hashVerificationCode(codigo);
  const nomeEmpresa = nomeFantasia || razaoSocial;

  await pool.query('DELETE FROM cadastros_empresa_pendentes WHERE email=$1', [email]);
  await pool.query(
    `INSERT INTO cadastros_empresa_pendentes
      (nome,email,senha_hash,telefone,cidade,cnpj,razao_social,nome_fantasia,codigo_hash,expira_em,tentativas)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW() + INTERVAL '10 minutes',0)`,
    [nome,email,senhaHash,telefone,cidade,cnpj,razaoSocial,nomeFantasia,codigoHash]
  );
  try {
    await sendCompanyVerificationEmail(email, codigo, nomeEmpresa);
  } catch (error) {
    await pool.query('DELETE FROM cadastros_empresa_pendentes WHERE email=$1', [email]);
    return res.status(error.statusCode || 502).json({ erro: error.message });
  }
  res.status(200).json({ sucesso: true, mensagem: 'Enviamos um código de confirmação para seu e-mail.' });
}));

app.post('/api/cadastro/empresa/confirmar-codigo', limitCompanySignup, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const codigo = clean(req.body.codigo, 6);
  if (!validEmail(email) || !/^\d{6}$/.test(codigo)) {
    return res.status(400).json({ erro: 'Informe o e-mail e o código de 6 dígitos.' });
  }

  const client = await pool.connect();
  let user;
  try {
    await client.query('BEGIN');
    const pending = await client.query('SELECT * FROM cadastros_empresa_pendentes WHERE email=$1 FOR UPDATE', [email]);
    if (!pending.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Código não encontrado. Solicite um novo código.' });
    }
    const registration = pending.rows[0];
    if (new Date(registration.expira_em).getTime() <= Date.now()) {
      await client.query('DELETE FROM cadastros_empresa_pendentes WHERE email=$1', [email]);
      await client.query('COMMIT');
      return res.status(400).json({ erro: 'O código expirou. Faça o cadastro novamente.' });
    }
    if (registration.tentativas >= 5) {
      await client.query('DELETE FROM cadastros_empresa_pendentes WHERE email=$1', [email]);
      await client.query('COMMIT');
      return res.status(429).json({ erro: 'Limite de tentativas atingido. Faça o cadastro novamente.' });
    }

    const expected = Buffer.from(registration.codigo_hash, 'hex');
    const received = Buffer.from(hashVerificationCode(codigo), 'hex');
    const matches = expected.length === received.length && crypto.timingSafeEqual(expected, received);
    if (!matches) {
      await client.query('UPDATE cadastros_empresa_pendentes SET tentativas=tentativas+1 WHERE email=$1', [email]);
      await client.query('COMMIT');
      return res.status(400).json({ erro: 'Código incorreto. Confira o e-mail e tente novamente.' });
    }

    const inserted = await client.query(
      `INSERT INTO usuarios
        (nome,email,senha_hash,tipo,telefone,cidade,nome_empresa,cnpj,razao_social,nome_fantasia,email_verificado)
       VALUES ($1,$2,$3,'empresa',$4,$5,$6,$7,$8,$9,TRUE) RETURNING *`,
      [registration.nome,registration.email,registration.senha_hash,registration.telefone,
       registration.cidade,registration.nome_fantasia || registration.razao_social,registration.cnpj,
       registration.razao_social,registration.nome_fantasia]
    );
    user = inserted.rows[0];
    await client.query('DELETE FROM cadastros_empresa_pendentes WHERE email=$1', [email]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ erro: 'Este e-mail ou CNPJ já está cadastrado.' });
    throw error;
  } finally {
    client.release();
  }

  req.session.regenerate(error => {
    if (error) return res.status(500).json({ erro: 'Conta criada, mas não foi possível iniciar sua sessão. Faça login.' });
    req.session.user = publicUser(user);
    req.session.save(saveError => {
      if (saveError) return res.status(500).json({ erro: 'Conta criada, mas não foi possível salvar sua sessão. Faça login.' });
      res.status(201).json({ sucesso: true, usuario: req.session.user });
    });
  });
}));

app.post('/api/cadastro', limitLogin, asyncRoute(async (req, res) => {
  const nome = clean(req.body.nome, 120);
  const email = normalizeEmail(req.body.email);
  const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
  const tipo = clean(req.body.tipo, 20);
  const telefone = clean(req.body.telefone, 30);
  const cidade = clean(req.body.cidade, 100) || 'Capelinha';
  const nomeEmpresa = clean(req.body.nomeEmpresa, 160);
  if (nome.length < 3) return res.status(400).json({ erro: 'Informe seu nome completo.' });
  if (!validEmail(email)) return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  if (senha.length < 8 || senha.length > 72) return res.status(400).json({ erro: 'A senha deve ter entre 8 e 72 caracteres.' });
  if (!['candidato', 'empresa'].includes(tipo)) return res.status(400).json({ erro: 'Tipo de cadastro inválido.' });
  if (tipo === 'empresa') return res.status(400).json({ erro: 'Use a confirmação de CNPJ e e-mail para criar uma conta empresarial.' });
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
    `SELECT c.id,c.status,c.criada_em,c.mensagem,v.id vaga_id,v.titulo,v.cidade,empresa.nome_empresa
     FROM candidaturas c
     JOIN vagas v ON v.id=c.vaga_id
     JOIN usuarios empresa ON empresa.id=v.empresa_id
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
