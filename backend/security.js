const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function configuredOrigins() {
  const configured = (process.env.APP_ORIGINS || '').trim();
  if (!configured) return null;

  return configured.split(',').map(value => {
    try {
      const url = new URL(value.trim());
      return ['http:', 'https:'].includes(url.protocol) ? url.origin : null;
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function isSameOriginRequest(req) {
  const source = req.get('origin') || req.get('referer');
  if (!source) return false;

  try {
    const sourceUrl = new URL(source);
    if (!['http:', 'https:'].includes(sourceUrl.protocol)) return false;
    const sourceOrigin = sourceUrl.origin;
    const allowedOrigins = configuredOrigins();

    // Em produção, a lista explícita permite validar o domínio do frontend
    // mesmo quando um proxy altera o cabeçalho Host enviado ao backend.
    if (allowedOrigins !== null) return allowedOrigins.includes(sourceOrigin);

    const host = req.get('host');
    if (!host || !['http', 'https'].includes(req.protocol)) return false;
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
