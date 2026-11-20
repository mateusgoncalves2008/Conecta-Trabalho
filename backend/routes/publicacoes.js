const express = require('express');
const crypto = require('crypto');
const { Transform } = require('stream');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { rateLimit } = require('express-rate-limit');

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 60;
const MAX_DESCRIPTION_LENGTH = 2000;
const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '👏', '🎉', '💡', '🔥'];
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
  'video/webm': { kind: 'video', extension: 'webm' }
};

const createPublicacoesRouter = ({ pool, s3, storageBucket, auth, imageReference }) => {
  const router = express.Router();
  const schemaReady = pool.query([
    'CREATE TABLE IF NOT EXISTS publicacoes (id BIGSERIAL PRIMARY KEY, autor_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, descricao TEXT NOT NULL DEFAULT \'\', criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW())',
    'CREATE INDEX IF NOT EXISTS idx_publicacoes_data ON publicacoes (criada_em DESC)',
    'CREATE INDEX IF NOT EXISTS idx_publicacoes_autor_data ON publicacoes (autor_id, criada_em DESC)',
    'CREATE TABLE IF NOT EXISTS publicacao_midias (id BIGSERIAL PRIMARY KEY, publicacao_id BIGINT REFERENCES publicacoes(id) ON DELETE CASCADE, autor_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, storage_key TEXT NOT NULL UNIQUE, tipo VARCHAR(10) NOT NULL CHECK (tipo IN (\'image\',\'video\')), mime_type VARCHAR(40) NOT NULL, tamanho_bytes BIGINT NOT NULL CHECK (tamanho_bytes > 0), duracao_segundos NUMERIC(6,2), ordem SMALLINT NOT NULL DEFAULT 0, criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW())',
    'CREATE INDEX IF NOT EXISTS idx_publicacao_midias_post ON publicacao_midias (publicacao_id, ordem)',
    'CREATE INDEX IF NOT EXISTS idx_publicacao_midias_staging ON publicacao_midias (autor_id, criada_em) WHERE publicacao_id IS NULL',
    'CREATE TABLE IF NOT EXISTS publicacao_reacoes (publicacao_id BIGINT NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE, usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, emoji VARCHAR(16) NOT NULL, criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (publicacao_id, usuario_id))',
    'CREATE INDEX IF NOT EXISTS idx_publicacao_reacoes_post ON publicacao_reacoes (publicacao_id)',
    'CREATE TABLE IF NOT EXISTS publicacao_denuncias (id BIGSERIAL PRIMARY KEY, publicacao_id BIGINT NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE, denunciante_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, motivo VARCHAR(100) NOT NULL, detalhe VARCHAR(500), status VARCHAR(20) NOT NULL DEFAULT \'pendente\' CHECK (status IN (\'pendente\',\'em_analise\',\'resolvida\',\'descartada\')), criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (publicacao_id, denunciante_id))',
    'CREATE INDEX IF NOT EXISTS idx_publicacao_denuncias_status_data ON publicacao_denuncias (status, criada_em DESC)'
  ].join(';'));
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
    if (mime === 'video/mp4') return buffer.toString('ascii', 4, 8) === 'ftyp';
    if (mime === 'video/webm') return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    return false;
  };
  const mediaUrl = id => '/api/publicacoes/midia/' + encodeURIComponent(id);

  router.get('/midia/:id', asyncRoute(async (req, res) => {
    await schemaReady;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(404).end();
    const result = await pool.query('SELECT m.storage_key,m.mime_type FROM publicacao_midias m JOIN publicacoes p ON p.id=m.publicacao_id WHERE m.id=$1', [id]);
    if (!result.rowCount || !s3) return res.status(404).end();
    const object = await s3.send(new GetObjectCommand({ Bucket: storageBucket, Key: result.rows[0].storage_key }));
    res.set({
      'Content-Type': result.rows[0].mime_type,
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
    });
    if (object.Body && typeof object.Body.pipe === 'function') return object.Body.pipe(res);
    if (object.Body && typeof object.Body.transformToByteArray === 'function') return res.send(Buffer.from(await object.Body.transformToByteArray()));
    return res.status(502).end();
  }));

  router.get('/', asyncRoute(async (req, res) => {
    await schemaReady;
    const limit = Math.min(Math.max(Number(req.query.limit) || 15, 1), 30);
    const cursor = Number(req.query.cursor) || 0;
    if (!Number.isSafeInteger(cursor) || cursor < 0) return res.status(400).json({ erro: 'Página inválida.' });
    const posts = await pool.query(
      'SELECT p.id,p.descricao,p.criada_em,u.id AS autor_id,u.nome,u.tipo,COALESCE(NULLIF(u.nome_empresa,\'\'),NULLIF(u.nome_fantasia,\'\'),u.nome) AS nome_exibicao,u.foto_perfil FROM publicacoes p JOIN usuarios u ON u.id=p.autor_id ORDER BY p.criada_em DESC,p.id DESC LIMIT $1 OFFSET $2',
      [limit + 1, cursor]
    );
    const hasMore = posts.rows.length > limit;
    const rows = posts.rows.slice(0, limit);
    if (!rows.length) return res.json({ publicacoes: [], proximoCursor: null });
    const ids = rows.map(post => post.id);
    const [mediaResult, reactionResult, myReactionResult] = await Promise.all([
      pool.query('SELECT id,publicacao_id,tipo,mime_type,tamanho_bytes,duracao_segundos,ordem FROM publicacao_midias WHERE publicacao_id=ANY($1::bigint[]) ORDER BY ordem,id', [ids]),
      pool.query('SELECT publicacao_id,emoji,COUNT(*)::int AS total FROM publicacao_reacoes WHERE publicacao_id=ANY($1::bigint[]) GROUP BY publicacao_id,emoji ORDER BY emoji', [ids]),
      req.session.user ? pool.query('SELECT publicacao_id,emoji FROM publicacao_reacoes WHERE usuario_id=$1 AND publicacao_id=ANY($2::bigint[])', [req.session.user.id, ids]) : Promise.resolve({ rows: [] })
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
    const myReactions = new Map(myReactionResult.rows.map(item => [String(item.publicacao_id), item.emoji]));
    res.json({
      publicacoes: rows.map(post => ({
        id: post.id, descricao: post.descricao, criadaEm: post.criada_em,
        autor: {
          id: post.autor_id, nome: post.nome_exibicao, tipo: post.tipo,
          foto: imageReference(post.autor_id, 'foto_perfil', post.foto_perfil)
        },
        midias: mediaByPost.get(post.id) || [],
        reacoes: reactionsByPost.get(post.id) || [],
        minhaReacao: myReactions.get(String(post.id)) || null,
        minha: Boolean(req.session.user && String(req.session.user.id) === String(post.autor_id))
      })),
      proximoCursor: hasMore ? cursor + limit : null
    });
  }));

  router.post('/upload', auth, uploadLimit, asyncRoute(async (req, res) => {
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
    const duration = kind === 'video' ? Number(req.headers['x-media-duration']) : null;
    if (kind === 'video' && (!Number.isFinite(duration) || duration <= 0 || duration > MAX_VIDEO_SECONDS)) {
      return res.status(400).json({ erro: 'O vídeo deve ter duração máxima de 60 segundos.' });
    }
    let inspected = false;
    let prefix = Buffer.alloc(0);
    let received = 0;
    const validator = new Transform({
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
    const key = 'publicacoes/temporarios/' + req.session.user.id + '/' + crypto.randomUUID() + '.' + media.extension;
    try {
      const upload = s3.send(new PutObjectCommand({
        Bucket: storageBucket, Key: key, Body: validator,
        ContentLength: length, ContentType: mime, CacheControl: 'public, max-age=86400'
      }));
      req.pipe(validator);
      await upload;
      const saved = await pool.query(
        'INSERT INTO publicacao_midias (autor_id,storage_key,tipo,mime_type,tamanho_bytes,duracao_segundos) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,tipo,mime_type,tamanho_bytes,duracao_segundos',
        [req.session.user.id, key, kind, mime, length, duration]
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
      try { await s3.send(new DeleteObjectCommand({ Bucket: storageBucket, Key: key })); } catch {}
      if (error.statusCode) return res.status(error.statusCode).json({ erro: error.message });
      throw error;
    }
  }));

  router.delete('/upload/:id', auth, asyncRoute(async (req, res) => {
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

  router.post('/', auth, asyncRoute(async (req, res) => {
    await schemaReady;
    const description = typeof req.body.descricao === 'string' ? req.body.descricao.trim() : '';
    const mediaIds = Array.isArray(req.body.midias) ? [...new Set(req.body.midias.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))] : [];
    if (description.length > MAX_DESCRIPTION_LENGTH) return res.status(400).json({ erro: 'A descrição pode ter no máximo 2.000 caracteres.' });
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

  router.delete('/:id', auth, asyncRoute(async (req, res) => {
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

  router.put('/:id/reacao', auth, asyncRoute(async (req, res) => {
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

  router.delete('/:id/reacao', auth, asyncRoute(async (req, res) => {
    await schemaReady;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'Publicação inválida.' });
    await pool.query('DELETE FROM publicacao_reacoes WHERE publicacao_id=$1 AND usuario_id=$2', [id, req.session.user.id]);
    res.json({ sucesso: true });
  }));

  router.post('/:id/denuncias', auth, asyncRoute(async (req, res) => {
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

  return { router, schemaReady };
};

module.exports = { createPublicacoesRouter, ALLOWED_REACTIONS, REPORT_REASONS };
