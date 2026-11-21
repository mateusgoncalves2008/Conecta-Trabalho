const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const ffmpegStatic = require('ffmpeg-static');

const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
let activeVideoConversions = 0;
const MAX_ACTIVE_VIDEO_CONVERSIONS = 1;

const runFfmpeg = (args, timeoutMs = 180000) => new Promise((resolve, reject) => {
  const child = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, timeoutMs);
  child.stderr.on('data', chunk => {
    stderr += chunk.toString();
    if (stderr.length > 30000) stderr = stderr.slice(-30000);
  });
  child.once('error', error => {
    clearTimeout(timer);
    reject(error);
  });
  child.once('close', code => {
    clearTimeout(timer);
    if (timedOut) return reject(Object.assign(new Error('A conversão do vídeo excedeu o tempo permitido.'), { statusCode: 408 }));
    if (code !== 0) return reject(Object.assign(new Error('O FFmpeg não conseguiu processar o vídeo.'), { statusCode: 400, ffmpegDetails: stderr.slice(-4000) }));
    resolve(stderr);
  });
});

const probeVideoDuration = async inputPath => {
  const output = await runFfmpeg(['-hide_banner', '-protocol_whitelist', 'file,pipe,data', '-i', inputPath, '-t', '0', '-f', 'null', '-'], 30000);
  const match = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(output);
  if (!match) throw Object.assign(new Error('Não foi possível identificar a duração real do vídeo.'), { statusCode: 400 });
  const duration = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  if (!Number.isFinite(duration) || duration <= 0) throw Object.assign(new Error('A duração do vídeo é inválida.'), { statusCode: 400 });
  if (duration > MAX_VIDEO_SECONDS) throw Object.assign(new Error('O vídeo deve ter no máximo 60 segundos.'), { statusCode: 400 });
  return Number(duration.toFixed(2));
};

const convertVideoToMp4 = (inputPath, outputPath) => runFfmpeg([
  '-hide_banner', '-loglevel', 'error', '-y', '-protocol_whitelist', 'file,pipe,data',
  '-i', inputPath, '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn',
  '-map_metadata', '-1', '-map_chapters', '-1', '-vf', 'scale=1920:1920:force_original_aspect_ratio=decrease:force_divisible_by=2', '-c:v', 'libx264', '-preset', 'veryfast',
  '-crf', '23', '-pix_fmt', 'yuv420p', '-threads', '2', '-c:a', 'aac', '-b:a', '128k',
  '-movflags', '+faststart', '-f', 'mp4', outputPath
]);
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { rateLimit } = require('express-rate-limit');

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 60;
const MAX_DESCRIPTION_LENGTH = 4000;
const ALLOWED_REACTIONS = ['❤️'];
const REPORT_REASONS = [
  'Conteúdo ofensivo ou discriminatório',
  'Informação falsa ou enganosa',
  'Spam ou publicidade inadequada',
  'Conteúdo impróprio',
  'Fraude ou tentativa de golpe',
  'Outro motivo'
];
const MIME_TYPES = {
  'image/jpeg': { kind: 'image', extension: 'jpg' },
  'image/png': { kind: 'image', extension: 'png' },
  'image/webp': { kind: 'image', extension: 'webp' },
  'video/mp4': { kind: 'video', extension: 'mp4' },
  'video/quicktime': { kind: 'video', extension: 'mov' },
  'video/webm': { kind: 'video', extension: 'webm' },
  'video/x-matroska': { kind: 'video', extension: 'mkv' },
  'video/x-msvideo': { kind: 'video', extension: 'avi' },
  'video/x-ms-wmv': { kind: 'video', extension: 'wmv' },
  'video/x-flv': { kind: 'video', extension: 'flv' },
  'video/mpeg': { kind: 'video', extension: 'mpeg' },
  'video/x-m4v': { kind: 'video', extension: 'm4v' },
  'video/3gpp': { kind: 'video', extension: '3gp' },
  'video/ogg': { kind: 'video', extension: 'ogv' },
  'video/mp2t': { kind: 'video', extension: 'ts' }
};

const createPublicacoesRouter = ({ pool, s3, storageBucket, imageReference, profileSchemaReady }) => {
  const router = express.Router();
  const publicationSchemaReady = pool.query([
    'CREATE TABLE IF NOT EXISTS publicacoes (id BIGSERIAL PRIMARY KEY, autor_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, descricao TEXT NOT NULL DEFAULT \'\', criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW())',
    'CREATE INDEX IF NOT EXISTS idx_publicacoes_data ON publicacoes (criada_em DESC)',
    'CREATE INDEX IF NOT EXISTS idx_publicacoes_autor_data ON publicacoes (autor_id, criada_em DESC)',
    'CREATE TABLE IF NOT EXISTS publicacao_midias (id BIGSERIAL PRIMARY KEY, publicacao_id BIGINT REFERENCES publicacoes(id) ON DELETE CASCADE, autor_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, storage_key TEXT NOT NULL UNIQUE, tipo VARCHAR(10) NOT NULL CHECK (tipo IN (\'image\',\'video\')), mime_type VARCHAR(40) NOT NULL, tamanho_bytes BIGINT NOT NULL CHECK (tamanho_bytes > 0), duracao_segundos NUMERIC(6,2), ordem SMALLINT NOT NULL DEFAULT 0, criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW())',
    'CREATE INDEX IF NOT EXISTS idx_publicacao_midias_post ON publicacao_midias (publicacao_id, ordem)',
    'CREATE INDEX IF NOT EXISTS idx_publicacao_midias_staging ON publicacao_midias (autor_id, criada_em) WHERE publicacao_id IS NULL',
    'CREATE TABLE IF NOT EXISTS publicacao_reacoes (publicacao_id BIGINT NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE, usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, emoji VARCHAR(16) NOT NULL, criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (publicacao_id, usuario_id))',
    'CREATE INDEX IF NOT EXISTS idx_publicacao_reacoes_post ON publicacao_reacoes (publicacao_id)',
    'CREATE TABLE IF NOT EXISTS publicacao_visualizacoes (publicacao_id BIGINT NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE, usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, visualizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (publicacao_id, usuario_id))',
    'CREATE INDEX IF NOT EXISTS idx_publicacao_visualizacoes_post ON publicacao_visualizacoes (publicacao_id)',
    "UPDATE publicacao_reacoes SET emoji='❤️' WHERE emoji <> '❤️'",
    'CREATE TABLE IF NOT EXISTS publicacao_denuncias (id BIGSERIAL PRIMARY KEY, publicacao_id BIGINT NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE, denunciante_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, motivo VARCHAR(100) NOT NULL, detalhe VARCHAR(500), status VARCHAR(20) NOT NULL DEFAULT \'pendente\' CHECK (status IN (\'pendente\',\'em_analise\',\'resolvida\',\'descartada\')), criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (publicacao_id, denunciante_id))',
    'CREATE INDEX IF NOT EXISTS idx_publicacao_denuncias_status_data ON publicacao_denuncias (status, criada_em DESC)',
    'CREATE TABLE IF NOT EXISTS publicacoes_salvas (publicacao_id BIGINT NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE, usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, salva_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (publicacao_id, usuario_id))',
    'CREATE INDEX IF NOT EXISTS idx_publicacoes_salvas_usuario_data ON publicacoes_salvas (usuario_id, salva_em DESC)'
  ].join(';'));
  const schemaReady = profileSchemaReady ? Promise.all([profileSchemaReady, publicationSchemaReady]) : publicationSchemaReady;
  const member = (req, res, next) => {
    const user = req.session.user;
    if (!user) return res.status(401).json({ erro: 'Faça login para continuar.' });
    if (!['candidato', 'empresa'].includes(user.tipo)) return res.status(403).json({ erro: 'Somente candidatos e empresas podem interagir com as publicações.' });
    if (user.tipo === 'empresa' && !user.emailVerificado) return res.status(403).json({ erro: 'Confirme o e-mail da empresa para continuar.' });
    next();
  };
  const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const uploadLimit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 25,
    standardHeaders: 'draft-7', legacyHeaders: false,
    message: { erro: 'Muitos arquivos enviados. Aguarde alguns minutos.' }
  });
  const isValidSignature = (buffer, mime) => {
    if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (mime === 'image/webp') return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    if (['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/3gpp'].includes(mime)) return buffer.toString('ascii', 4, 8) === 'ftyp';
    if (mime === 'video/webm' || mime === 'video/x-matroska') return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (mime === 'video/x-msvideo') return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'AVI ';
    if (mime === 'video/x-flv') return buffer.toString('ascii', 0, 3) === 'FLV';
    if (mime === 'video/x-ms-wmv') return buffer.subarray(0, 4).equals(Buffer.from([0x30, 0x26, 0xb2, 0x75]));
    if (mime === 'video/mpeg') return buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && [0xb3, 0xba, 0xb8].includes(buffer[3]);
    if (mime === 'video/ogg') return buffer.toString('ascii', 0, 4) === 'OggS';
    if (mime === 'video/mp2t') return buffer[0] === 0x47;
    return false;
  };
  const mediaUrl = id => '/api/publicacoes/midia/' + encodeURIComponent(id);

  router.get('/empresa/:id', asyncRoute(async (req, res) => {
    await schemaReady;
    const companyId = Number(req.params.id);
    if (!Number.isSafeInteger(companyId) || companyId < 1) return res.status(400).json({ erro: 'Empresa inválida.' });
    const company = await pool.query("SELECT id FROM usuarios WHERE id=$1 AND tipo='empresa'", [companyId]);
    if (!company.rowCount) return res.status(404).json({ erro: 'Empresa não encontrada.' });
    const followingOnly = req.query.seguindo === '1';
    if (followingOnly && !req.session.user) return res.status(401).json({ erro: 'Faça login para ver os perfis que você segue.' });
    const posts = await pool.query(
      'SELECT p.id,p.descricao,p.criada_em,u.id AS autor_id,u.nome,u.tipo,u.titulo_profissional,COALESCE(NULLIF(u.nome_empresa,\\'\\'),NULLIF(u.nome_fantasia,\\'\\'),u.nome) AS nome_exibicao,u.foto_perfil,u.visibilidade_foto,(SELECT COUNT(*)::int FROM empresas_seguidoras es WHERE es.empresa_id=u.id) AS total_seguidores,EXISTS(SELECT 1 FROM empresas_seguidoras es WHERE es.empresa_id=u.id AND es.usuario_id=$3) AS seguindo FROM publicacoes p JOIN usuarios u ON u.id=p.autor_id WHERE (NOT $4::boolean OR EXISTS(SELECT 1 FROM empresas_seguidoras es WHERE es.usuario_id=$3 AND es.empresa_id=p.autor_id)) ORDER BY p.criada_em DESC,p.id DESC LIMIT $1 OFFSET $2',
      [limit + 1, cursor, req.session.user?.id || null, followingOnly]
    );
    if (!posts.rowCount) return res.json({ publicacoes: [] });
    const ids = posts.rows.map(post => post.id);
    const media = await pool.query(
      'SELECT id,publicacao_id,tipo,mime_type,ordem FROM publicacao_midias WHERE publicacao_id=ANY($1::bigint[]) ORDER BY ordem,id',
      [ids]
    );
    const mediaByPost = new Map();
    for (const item of media.rows) {
      if (!mediaByPost.has(item.publicacao_id)) mediaByPost.set(item.publicacao_id, []);
      mediaByPost.get(item.publicacao_id).push({ id: item.id, tipo: item.tipo, mimeType: item.mime_type, ordem: item.ordem, url: mediaUrl(item.id) });
    }
    res.json({ publicacoes: posts.rows.map(post => ({
      id: post.id, descricao: post.descricao, criadaEm: post.criada_em,
      visualizacoes: Number(post.visualizacoes || 0),
      reacoes: Number(post.total_curtidas || 0) ? [{ emoji: '❤️', total: Number(post.total_curtidas) }] : [],
      minhaCurtida: Boolean(post.minha_curtida), minha: Boolean(post.minha),
      midias: mediaByPost.get(post.id) || []
    })) });
  }));

  router.post('/:id/visualizacao', member, asyncRoute(async (req, res) => {
    await schemaReady;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'Publicação inválida.' });
    const result = await pool.query(
      'INSERT INTO publicacao_visualizacoes (publicacao_id,usuario_id) SELECT p.id,$2 FROM publicacoes p WHERE p.id=$1 AND p.autor_id<>$2 ON CONFLICT (publicacao_id,usuario_id) DO NOTHING RETURNING publicacao_id',
      [id, req.session.user.id]
    );
    const total = await pool.query('SELECT COUNT(*)::int AS total FROM publicacao_visualizacoes WHERE publicacao_id=$1', [id]);
    res.json({ sucesso: true, registrada: result.rowCount > 0, visualizacoes: Number(total.rows[0]?.total || 0) });
  }));

  router.get('/midia/:id', asyncRoute(async (req, res) => {
    await schemaReady;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(404).end();
    const result = await pool.query('SELECT m.storage_key,m.mime_type FROM publicacao_midias m JOIN publicacoes p ON p.id=m.publicacao_id WHERE m.id=$1', [id]);
    if (!result.rowCount || !s3) return res.status(404).end();
    const rangeHeader = req.headers.range;
    if (rangeHeader && !/^bytes=\d*-\d*$/.test(rangeHeader)) return res.status(416).end();
    const object = await s3.send(new GetObjectCommand({
      Bucket: storageBucket,
      Key: result.rows[0].storage_key,
      ...(rangeHeader ? { Range: rangeHeader } : {})
    }));
    res.status(rangeHeader ? 206 : 200);
    res.set({
      'Content-Type': result.rows[0].mime_type,
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
    });
    if (object.ContentLength != null) res.set('Content-Length', String(object.ContentLength));
    if (object.ContentRange) res.set('Content-Range', object.ContentRange);
    if (object.Body && typeof object.Body.pipe === 'function') return object.Body.pipe(res);
    if (object.Body && typeof object.Body.transformToByteArray === 'function') return res.send(Buffer.from(await object.Body.transformToByteArray()));
    return res.status(502).end();
  }));

  router.get('/', asyncRoute(async (req, res) => {
    await schemaReady;
    if (s3) {
      const expired = await pool.query("SELECT id,storage_key FROM publicacao_midias WHERE publicacao_id IS NULL AND criada_em < NOW() - INTERVAL '24 hours' ORDER BY criada_em LIMIT 50");
      for (const item of expired.rows) {
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: storageBucket, Key: item.storage_key }));
          await pool.query('DELETE FROM publicacao_midias WHERE id=$1 AND publicacao_id IS NULL', [item.id]);
        } catch (error) {
          console.warn('Não foi possível limpar uma mídia temporária:', error.message);
        }
      }
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 15, 1), 30);
    const cursor = Number(req.query.cursor) || 0;
    if (!Number.isSafeInteger(cursor) || cursor < 0) return res.status(400).json({ erro: 'Página inválida.' });
    const posts = await pool.query(
      'SELECT p.id,p.descricao,p.criada_em,u.id AS autor_id,u.nome,u.tipo,u.titulo_profissional,COALESCE(NULLIF(u.nome_empresa,\'\'),NULLIF(u.nome_fantasia,\'\'),u.nome) AS nome_exibicao,u.foto_perfil,u.visibilidade_foto,(SELECT COUNT(*)::int FROM empresas_seguidoras es WHERE es.empresa_id=u.id) AS total_seguidores,EXISTS(SELECT 1 FROM empresas_seguidoras es WHERE es.empresa_id=u.id AND es.usuario_id=$3) AS seguindo FROM publicacoes p JOIN usuarios u ON u.id=p.autor_id ORDER BY p.criada_em DESC,p.id DESC LIMIT $1 OFFSET $2',
      [limit + 1, cursor, req.session.user?.tipo === 'candidato' ? req.session.user.id : null]
    );
    const hasMore = posts.rows.length > limit;
    const rows = posts.rows.slice(0, limit);
    if (!rows.length) return res.json({ publicacoes: [], proximoCursor: null });
    const ids = rows.map(post => post.id);
    const [mediaResult, reactionResult, myReactionResult, mySavedResult] = await Promise.all([
      pool.query('SELECT id,publicacao_id,tipo,mime_type,tamanho_bytes,duracao_segundos,ordem FROM publicacao_midias WHERE publicacao_id=ANY($1::bigint[]) ORDER BY ordem,id', [ids]),
      pool.query('SELECT publicacao_id,emoji,COUNT(*)::int AS total FROM publicacao_reacoes WHERE publicacao_id=ANY($1::bigint[]) GROUP BY publicacao_id,emoji ORDER BY emoji', [ids]),
      req.session.user ? pool.query('SELECT publicacao_id FROM publicacao_reacoes WHERE usuario_id=$1 AND publicacao_id=ANY($2::bigint[])', [req.session.user.id, ids]) : Promise.resolve({ rows: [] }),
      req.session.user ? pool.query('SELECT publicacao_id FROM publicacoes_salvas WHERE usuario_id=$1 AND publicacao_id=ANY($2::bigint[])', [req.session.user.id, ids]) : Promise.resolve({ rows: [] })
    ]);
    const mediaByPost = new Map();
    for (const media of mediaResult.rows) {
      if (!mediaByPost.has(media.publicacao_id)) mediaByPost.set(media.publicacao_id, []);
      mediaByPost.get(media.publicacao_id).push({
        id: media.id, tipo: media.tipo, mimeType: media.mime_type,
        tamanhoBytes: Number(media.tamanho_bytes),
        duracaoSegundos: media.duracao_segundos ? Number(media.duracao_segundos) : null,
        ordem: media.ordem, url: mediaUrl(media.id)
      });
    }
    const reactionsByPost = new Map();
    for (const reaction of reactionResult.rows) {
      if (!reactionsByPost.has(reaction.publicacao_id)) reactionsByPost.set(reaction.publicacao_id, []);
      reactionsByPost.get(reaction.publicacao_id).push({ emoji: reaction.emoji, total: reaction.total });
    }
    const myReactions = new Set(myReactionResult.rows.map(item => String(item.publicacao_id)));
    const mySaved = new Set(mySavedResult.rows.map(item => String(item.publicacao_id)));
    res.json({
      publicacoes: rows.map(post => ({
        id: post.id, descricao: post.descricao, criadaEm: post.criada_em,
        autor: {
          id: post.autor_id, nome: post.nome_exibicao, tipo: post.tipo,
          tituloProfissional: post.titulo_profissional,
          totalSeguidores: Number(post.total_seguidores || 0),
          seguindo: Boolean(post.seguindo),
          foto: (String(req.session.user?.id) === String(post.autor_id) || post.visibilidade_foto === 'todos' || (post.visibilidade_foto === 'usuarios' && req.session.user)) ? imageReference(post.autor_id, 'foto_perfil', post.foto_perfil) : null
        },
        midias: mediaByPost.get(post.id) || [],
        reacoes: reactionsByPost.get(post.id) || [],
        minhaCurtida: myReactions.has(String(post.id)),
        minhaSalva: mySaved.has(String(post.id)),
        minha: Boolean(req.session.user && String(req.session.user.id) === String(post.autor_id))
      })),
      proximoCursor: hasMore ? cursor + limit : null
    });
  }));

  router.post('/:id/salvar', member, asyncRoute(async (req, res) => {
    await schemaReady;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'Publicação inválida.' });
    const post = await pool.query('SELECT id FROM publicacoes WHERE id=$1', [id]);
    if (!post.rowCount) return res.status(404).json({ erro: 'Publicação não encontrada.' });
    await pool.query('INSERT INTO publicacoes_salvas (publicacao_id,usuario_id) VALUES ($1,$2) ON CONFLICT (publicacao_id,usuario_id) DO NOTHING', [id, req.session.user.id]);
    res.json({ sucesso: true, salva: true });
  }));

  router.delete('/:id/salvar', member, asyncRoute(async (req, res) => {
    await schemaReady;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'Publicação inválida.' });
    await pool.query('DELETE FROM publicacoes_salvas WHERE publicacao_id=$1 AND usuario_id=$2', [id, req.session.user.id]);
    res.json({ sucesso: true, salva: false });
  }));

  router.post('/upload', member, uploadLimit, asyncRoute(async (req, res) => {
    await schemaReady;
    if (!s3) return res.status(503).json({ erro: 'O armazenamento de arquivos não está configurado no servidor.' });
    const mime = String(req.headers['x-media-mime'] || '').toLowerCase();
    const media = MIME_TYPES[mime];
    const kind = String(req.headers['x-media-kind'] || '');
    const length = Number(req.headers['content-length']);
    if (!media || media.kind !== kind) return res.status(400).json({ erro: 'Formato de arquivo não permitido.' });
    if (!Number.isSafeInteger(length) || length < 12) return res.status(400).json({ erro: 'Não foi possível identificar o tamanho do arquivo.' });
    const maxBytes = kind === 'image' ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES;
    if (length > maxBytes) return res.status(413).json({ erro: kind === 'image' ? 'Cada foto pode ter no máximo 20 MB.' : 'Cada vídeo pode ter no máximo 150 MB.' });

    const createValidator = () => {
      let inspected = false;
      let prefix = Buffer.alloc(0);
      let received = 0;
      return new Transform({
        transform(chunk, _encoding, callback) {
          received += chunk.length;
          if (received > length || received > maxBytes) {
            const error = new Error('O arquivo ultrapassou o tamanho permitido.');
            error.statusCode = 413;
            return callback(error);
          }
          if (!inspected) {
            prefix = Buffer.concat([prefix, chunk]);
            if (prefix.length < 12) return callback();
            if (!isValidSignature(prefix, mime)) {
              const error = new Error('O conteúdo enviado não corresponde ao formato informado.');
              error.statusCode = 400;
              return callback(error);
            }
            inspected = true;
            this.push(prefix);
            prefix = Buffer.alloc(0);
          } else {
            this.push(chunk);
          }
          callback();
        },
        flush(callback) {
          if (!inspected || received !== length) {
            const error = new Error('O arquivo enviado está incompleto ou inválido.');
            error.statusCode = 400;
            return callback(error);
          }
          callback();
        }
      });
    };

    if (kind === 'video') {
      if (activeVideoConversions >= MAX_ACTIVE_VIDEO_CONVERSIONS) {
        return res.status(429).json({ erro: 'Já existe um vídeo sendo processado. Aguarde um instante e tente novamente.' });
      }
      activeVideoConversions += 1;
      let tempDir = null;
      let key = null;
      try {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'conecta-video-'));
        const inputPath = path.join(tempDir, 'original.' + media.extension);
        const outputPath = path.join(tempDir, 'convertido.mp4');
        await pipeline(req, createValidator(), fs.createWriteStream(inputPath, { flags: 'wx' }));
        const duration = await probeVideoDuration(inputPath);
        await convertVideoToMp4(inputPath, outputPath);
        const outputStats = await fs.promises.stat(outputPath);
        if (!outputStats.size || outputStats.size > MAX_VIDEO_BYTES) {
          return res.status(413).json({ erro: 'O vídeo convertido ultrapassou o limite de 150 MB.' });
        }
        key = 'publicacoes/temporarios/' + req.session.user.id + '/' + crypto.randomUUID() + '.mp4';
        await s3.send(new PutObjectCommand({
          Bucket: storageBucket, Key: key, Body: fs.createReadStream(outputPath),
          ContentLength: outputStats.size, ContentType: 'video/mp4', CacheControl: 'public, max-age=86400'
        }));
        const saved = await pool.query(
          'INSERT INTO publicacao_midias (autor_id,storage_key,tipo,mime_type,tamanho_bytes,duracao_segundos) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,tipo,mime_type,tamanho_bytes,duracao_segundos',
          [req.session.user.id, key, 'video', 'video/mp4', outputStats.size, duration]
        );
        const item = saved.rows[0];
        res.status(201).json({
          sucesso: true,
          midia: {
            id: item.id, tipo: item.tipo, mimeType: item.mime_type,
            tamanhoBytes: Number(item.tamanho_bytes),
            duracaoSegundos: item.duracao_segundos ? Number(item.duracao_segundos) : null,
            url: mediaUrl(item.id)
          }
        });
      } catch (error) {
        if (key) {
          try { await s3.send(new DeleteObjectCommand({ Bucket: storageBucket, Key: key })); } catch {}
        }
        if (error.statusCode) return res.status(error.statusCode).json({
          erro: error.statusCode === 400 && error.ffmpegDetails
            ? 'Não foi possível converter este vídeo. Verifique se o arquivo está íntegro e tente outro.'
            : error.message
        });
        if (error.code === 'ENOENT') return res.status(503).json({ erro: 'O conversor de vídeos não está disponível no servidor.' });
        throw error;
      } finally {
        activeVideoConversions = Math.max(0, activeVideoConversions - 1);
        if (tempDir) await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
      return;
    }

    const key = 'publicacoes/temporarios/' + req.session.user.id + '/' + crypto.randomUUID() + '.' + media.extension;
    try {
      const validator = createValidator();
      const upload = s3.send(new PutObjectCommand({
        Bucket: storageBucket, Key: key, Body: validator,
        ContentLength: length, ContentType: mime, CacheControl: 'public, max-age=86400'
      }));
      req.pipe(validator);
      await upload;
      const saved = await pool.query(
        'INSERT INTO publicacao_midias (autor_id,storage_key,tipo,mime_type,tamanho_bytes,duracao_segundos) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,tipo,mime_type,tamanho_bytes,duracao_segundos',
        [req.session.user.id, key, kind, mime, length, null]
      );
      const item = saved.rows[0];
      res.status(201).json({
        sucesso: true,
        midia: {
          id: item.id, tipo: item.tipo, mimeType: item.mime_type,
          tamanhoBytes: Number(item.tamanho_bytes),
          duracaoSegundos: null,
          url: mediaUrl(item.id)
        }
      });
    } catch (error) {
      try { await s3.send(new DeleteObjectCommand({ Bucket: storageBucket, Key: key })); } catch {}
      if (error.statusCode) return res.status(error.statusCode).json({ erro: error.message });
      throw error;
    }
  }));
  router.delete('/upload/:id', member, asyncRoute(async (req, res) => {
    await schemaReady;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'Arquivo inválido.' });
    const found = await pool.query(
      'SELECT storage_key FROM publicacao_midias WHERE id=$1 AND autor_id=$2 AND publicacao_id IS NULL',
      [id, req.session.user.id]
    );
    if (!found.rowCount) return res.status(404).json({ erro: 'Arquivo temporário não encontrado.' });
    if (!s3) return res.status(503).json({ erro: 'O armazenamento de arquivos não está configurado.' });
    await s3.send(new DeleteObjectCommand({ Bucket: storageBucket, Key: found.rows[0].storage_key }));
    await pool.query('DELETE FROM publicacao_midias WHERE id=$1 AND autor_id=$2 AND publicacao_id IS NULL', [id, req.session.user.id]);
    res.json({ sucesso: true });
  }));

  router.post('/', member, asyncRoute(async (req, res) => {
    await schemaReady;
    const description = typeof req.body.descricao === 'string' ? req.body.descricao.trim() : '';
    const mediaIds = Array.isArray(req.body.midias) ? [...new Set(req.body.midias.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))] : [];
    if (description.length > MAX_DESCRIPTION_LENGTH) return res.status(400).json({ erro: 'O título e a descrição juntos podem ter no máximo 4.000 caracteres.' });
    if (!mediaIds.length || mediaIds.length > 10) return res.status(400).json({ erro: 'Adicione de 1 a 10 fotos ou um vídeo.' });
    const client = await pool.connect();
    let post;
    try {
      await client.query('BEGIN');
      const mediaResult = await client.query(
        'SELECT id,tipo FROM publicacao_midias WHERE id=ANY($1::bigint[]) AND autor_id=$2 AND publicacao_id IS NULL FOR UPDATE',
        [mediaIds, req.session.user.id]
      );
      if (mediaResult.rowCount !== mediaIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'Uma ou mais mídias expiraram. Selecione os arquivos novamente.' });
      }
      const kinds = new Set(mediaResult.rows.map(item => item.tipo));
      if (kinds.size !== 1 || (kinds.has('video') && mediaIds.length !== 1)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'Uma publicação aceita até 10 fotos ou somente 1 vídeo.' });
      }
      const inserted = await client.query('INSERT INTO publicacoes (autor_id,descricao) VALUES ($1,$2) RETURNING id,descricao,criada_em', [req.session.user.id, description]);
      post = inserted.rows[0];
      await client.query(
        'UPDATE publicacao_midias SET publicacao_id=$1,ordem=ordered.ordem_numero FROM (SELECT id,(ROW_NUMBER() OVER (ORDER BY array_position($2::bigint[],id))-1)::smallint AS ordem_numero FROM publicacao_midias WHERE id=ANY($2::bigint[])) ordered WHERE publicacao_midias.id=ordered.id',
        [post.id, mediaIds]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    res.status(201).json({ sucesso: true, publicacao: post });
  }));

  router.delete('/:id', member, asyncRoute(async (req, res) => {
    await schemaReady;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'Publicação inválida.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const post = await client.query('SELECT id FROM publicacoes WHERE id=$1 AND autor_id=$2 FOR UPDATE', [id, req.session.user.id]);
      if (!post.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ erro: 'Publicação não encontrada ou você não tem permissão para excluí-la.' });
      }
      const media = await client.query('SELECT storage_key FROM publicacao_midias WHERE publicacao_id=$1', [id]);
      for (const item of media.rows) {
        if (!s3) throw new Error('O armazenamento de arquivos não está configurado.');
        await s3.send(new DeleteObjectCommand({ Bucket: storageBucket, Key: item.storage_key }));
      }
      await client.query('DELETE FROM publicacoes WHERE id=$1', [id]);
      await client.query('COMMIT');
      res.json({ sucesso: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }));

  router.put('/:id/reacao', member, asyncRoute(async (req, res) => {
    await schemaReady;
    const id = Number(req.params.id);
    const emoji = typeof req.body.emoji === 'string' ? req.body.emoji : '';
    if (!Number.isSafeInteger(id) || id < 1 || !ALLOWED_REACTIONS.includes(emoji)) return res.status(400).json({ erro: 'Escolha uma reação válida.' });
    const post = await pool.query('SELECT id FROM publicacoes WHERE id=$1', [id]);
    if (!post.rowCount) return res.status(404).json({ erro: 'Publicação não encontrada.' });
    const result = await pool.query(
      'INSERT INTO publicacao_reacoes (publicacao_id,usuario_id,emoji) VALUES ($1,$2,$3) ON CONFLICT (publicacao_id,usuario_id) DO UPDATE SET emoji=EXCLUDED.emoji,criada_em=NOW() RETURNING emoji',
      [id, req.session.user.id, emoji]
    );
    res.json({ sucesso: true, emoji: result.rows[0].emoji });
  }));

  router.delete('/:id/reacao', member, asyncRoute(async (req, res) => {
    await schemaReady;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'Publicação inválida.' });
    await pool.query('DELETE FROM publicacao_reacoes WHERE publicacao_id=$1 AND usuario_id=$2', [id, req.session.user.id]);
    res.json({ sucesso: true });
  }));

  router.post('/:id/denuncias', member, asyncRoute(async (req, res) => {
    await schemaReady;
    const id = Number(req.params.id);
    const reason = typeof req.body.motivo === 'string' ? req.body.motivo : '';
    const detail = typeof req.body.detalhe === 'string' ? req.body.detalhe.trim().slice(0, 500) : '';
    if (!Number.isSafeInteger(id) || id < 1 || !REPORT_REASONS.includes(reason)) return res.status(400).json({ erro: 'Selecione um motivo de denúncia válido.' });
    if (reason === 'Outro motivo' && detail.length < 5) return res.status(400).json({ erro: 'Explique brevemente o motivo da denúncia.' });
    const post = await pool.query('SELECT autor_id FROM publicacoes WHERE id=$1', [id]);
    if (!post.rowCount) return res.status(404).json({ erro: 'Publicação não encontrada.' });
    if (String(post.rows[0].autor_id) === String(req.session.user.id)) return res.status(400).json({ erro: 'Você não pode denunciar sua própria publicação.' });
    try {
      await pool.query('INSERT INTO publicacao_denuncias (publicacao_id,denunciante_id,motivo,detalhe) VALUES ($1,$2,$3,$4)', [id, req.session.user.id, reason, detail || null]);
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ erro: 'Você já denunciou esta publicação.' });
      throw error;
    }
    res.status(201).json({ sucesso: true, mensagem: 'Denúncia enviada para análise.' });
  }));

  const moderator = (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ erro: 'Faça login para continuar.' });
    const allowedEmails = String(process.env.PUBLICACOES_ADMIN_EMAILS || '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean);
    if (!allowedEmails.includes(String(req.session.user.email || '').toLowerCase())) {
      return res.status(403).json({ erro: 'Esta conta não tem acesso à moderação de publicações.' });
    }
    next();
  };

  router.get('/moderacao/acesso', (req, res) => {
    const allowedEmails = String(process.env.PUBLICACOES_ADMIN_EMAILS || '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean);
    const email = String(req.session.user?.email || '').toLowerCase();
    res.json({ autorizado: Boolean(email && allowedEmails.includes(email)) });
  });

  router.get('/denuncias', moderator, asyncRoute(async (req, res) => {
    await schemaReady;
    const status = String(req.query.status || 'todas');
    const validStatuses = ['todas', 'pendente', 'em_analise', 'resolvida', 'descartada'];
    if (!validStatuses.includes(status)) return res.status(400).json({ erro: 'Filtro de situação inválido.' });
    const result = await pool.query(
      'SELECT d.id,d.motivo,d.detalhe,d.status,d.criada_em,p.id AS publicacao_id,p.descricao,p.criada_em AS publicacao_criada_em,denunciante.nome AS denunciante_nome,COALESCE(NULLIF(autor.nome_empresa,\'\'),NULLIF(autor.nome_fantasia,\'\'),autor.nome) AS autor_nome FROM publicacao_denuncias d JOIN publicacoes p ON p.id=d.publicacao_id JOIN usuarios denunciante ON denunciante.id=d.denunciante_id JOIN usuarios autor ON autor.id=p.autor_id WHERE ($1=\'todas\' OR d.status=$1) ORDER BY CASE d.status WHEN \'pendente\' THEN 0 WHEN \'em_analise\' THEN 1 ELSE 2 END,d.criada_em DESC LIMIT 200',
      [status]
    );
    const postIds = [...new Set(result.rows.map(row => row.publicacao_id))];
    const mediaResult = postIds.length
      ? await pool.query('SELECT id,publicacao_id,tipo,mime_type FROM publicacao_midias WHERE publicacao_id=ANY($1::bigint[]) ORDER BY ordem,id', [postIds])
      : { rows: [] };
    const mediaByPost = new Map();
    for (const media of mediaResult.rows) {
      if (!mediaByPost.has(media.publicacao_id)) mediaByPost.set(media.publicacao_id, []);
      mediaByPost.get(media.publicacao_id).push({
        id: media.id,
        tipo: media.tipo,
        mimeType: media.mime_type,
        url: mediaUrl(media.id)
      });
    }
    res.json({
      denuncias: result.rows.map(report => ({
        ...report,
        midias: mediaByPost.get(report.publicacao_id) || []
      }))
    });
  }));

  router.patch('/denuncias/:id', moderator, asyncRoute(async (req, res) => {
    await schemaReady;
    const id = Number(req.params.id);
    const status = String(req.body.status || '');
    if (!Number.isSafeInteger(id) || id < 1 || !['pendente', 'em_analise', 'resolvida', 'descartada'].includes(status)) {
      return res.status(400).json({ erro: 'Informe uma situação válida para a denúncia.' });
    }
    const result = await pool.query(
      'UPDATE publicacao_denuncias SET status=$1 WHERE id=$2 RETURNING id,status',
      [status, id]
    );
    if (!result.rowCount) return res.status(404).json({ erro: 'Denúncia não encontrada.' });
    res.json({ sucesso: true, denuncia: result.rows[0] });
  }));

  return { router, schemaReady };
};

module.exports = { createPublicacoesRouter, ALLOWED_REACTIONS, REPORT_REASONS };
