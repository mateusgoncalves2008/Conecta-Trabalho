const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isSameOriginRequest(req) {
  const source = req.get('origin') || req.get('referer');
  const host = req.get('host');

  if (!source || !host || !['http', 'https'].includes(req.protocol)) return false;

  try {
    const sourceOrigin = new URL(source).origin;
    const requestOrigin = new URL(req.protocol + '://' + host).origin;
    return sourceOrigin === requestOrigin;
  } catch {
    return false;
  }
}

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  if (!isSameOriginRequest(req)) {
    return res.status(403).json({
      erro: 'Solicitação bloqueada por proteção de segurança. Atualize a página e tente novamente.'
    });
  }

  return next();
}

module.exports = { isSameOriginRequest, csrfProtection };
