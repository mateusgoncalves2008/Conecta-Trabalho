(() => {
  const list = document.getElementById('moderation-list');
  if (!list) return;
  const api = window.Conecta && window.Conecta.api;
  const filter = document.getElementById('moderation-filter');
  const count = document.getElementById('moderation-count');
  const accessMessage = document.getElementById('moderation-access-message');
  const statusNames = {
    pendente: 'Pendente',
    em_analise: 'Em análise',
    resolvida: 'Resolvida',
    descartada: 'Descartada'
  };
  const escapeHTML = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const formatDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };
  const showMessage = message => {
    list.hidden = true;
    document.querySelector('.moderation-panel').hidden = true;
    accessMessage.hidden = false;
    accessMessage.textContent = message;
  };

  async function loadReports() {
    Conecta.renderSkeleton(list, 'reports');
    list.hidden = false;
    try {
      const result = await api('/api/publicacoes/denuncias?status=' + encodeURIComponent(filter.value));
      const reports = result.denuncias || [];
      count.textContent = reports.length + (reports.length === 1 ? ' denúncia' : ' denúncias');
      if (!reports.length) {
        list.classList.remove('ct-skeleton-container');
        list.removeAttribute('aria-busy');
        list.innerHTML = '<div class="feed-empty">Não há denúncias nesta situação.</div>';
        return;
      }
      list.innerHTML = reports.map(report => {
        const status = statusNames[report.status] || report.status;
        const buttons = report.status === 'pendente'
          ? '<button type="button" data-status="em_analise" data-id="' + report.id + '">Assumir análise</button><button type="button" data-status="resolvida" data-id="' + report.id + '">Marcar resolvida</button><button type="button" data-status="descartada" data-id="' + report.id + '">Descartar</button>'
          : report.status === 'em_analise'
            ? '<button type="button" data-status="resolvida" data-id="' + report.id + '">Marcar resolvida</button><button type="button" data-status="descartada" data-id="' + report.id + '">Descartar</button>'
            : '<button type="button" data-status="pendente" data-id="' + report.id + '">Reabrir denúncia</button>';
        return '<article class="moderation-card"><div class="moderation-card-top"><div><h3>' + escapeHTML(report.motivo) + '</h3><small>Denúncia #' + report.id + ' · ' + escapeHTML(formatDate(report.criada_em)) + '</small></div><span class="moderation-status" data-status="' + escapeHTML(report.status) + '">' + escapeHTML(status) + '</span></div>' +
          '<div class="moderation-details"><p><strong>Denunciante:</strong> ' + escapeHTML(report.denunciante_nome) + '</p><p><strong>Autor:</strong> ' + escapeHTML(report.autor_nome) + '</p><p><strong>Publicação:</strong> #' + report.publicacao_id + '</p><p><strong>Publicada em:</strong> ' + escapeHTML(formatDate(report.publicacao_criada_em)) + '</p></div>' +
          (report.descricao ? '<div class="moderation-description">' + escapeHTML(report.descricao) + '</div>' : '') +
          (report.midias && report.midias.length ? '<div class="moderation-media">' + report.midias.map(media => media.tipo === 'video'
            ? '<video controls playsinline preload="metadata" src="' + escapeHTML(media.url) + '"></video>'
            : '<img loading="lazy" src="' + escapeHTML(media.url) + '" alt="Mídia da publicação denunciada">').join('') + '</div>' : '') +
          (report.detalhe ? '<p><strong>Detalhes da denúncia:</strong> ' + escapeHTML(report.detalhe) + '</p>' : '') +
          '<div class="moderation-actions">' + buttons + '</div></article>';
      }).join('');
      list.classList.remove('ct-skeleton-container');
      list.removeAttribute('aria-busy');
    } catch (error) {
      if (/acesso|login|conta/i.test(error.message)) {
        showMessage(error.message + ' Se você administra a plataforma, configure seu e-mail em PUBLICACOES_ADMIN_EMAILS nas variáveis de ambiente do servidor.');
      } else {
        list.classList.remove('ct-skeleton-container');
        list.removeAttribute('aria-busy');
        list.innerHTML = '<div class="feed-empty">' + escapeHTML(error.message) + '</div>';
      }
    }
  }

  filter.addEventListener('change', loadReports);
  list.addEventListener('click', async event => {
    const button = event.target.closest('[data-status]');
    if (!button) return;
    button.disabled = true;
    try {
      await api('/api/publicacoes/denuncias/' + button.dataset.id, {
        method: 'PATCH',
        body: JSON.stringify({ status: button.dataset.status })
      });
      if (window.Conecta) window.Conecta.toast('Situação da denúncia atualizada.');
      await loadReports();
    } catch (error) {
      if (window.Conecta) window.Conecta.toast(error.message);
      button.disabled = false;
    }
  });

  if (api) loadReports();
  else showMessage('Não foi possível iniciar a área de moderação. Atualize a página.');
})();
