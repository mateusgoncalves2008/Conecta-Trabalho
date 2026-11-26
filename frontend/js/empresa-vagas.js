(() => {
  const root = document.getElementById('company-jobs-content');
  if (!root) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const initials = value => String(value || 'Empresa').trim().split(/\s+/).slice(0, 2)
    .map(part => part[0] || '').join('').toUpperCase() || 'EM';
  const dateLabel = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Data não informada'
      : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  };
  const timeLabel = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data não informada';
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
    if (days === 0) return 'Publicada hoje';
    if (days === 1) return 'Publicada ontem';
    if (days < 30) return 'Publicada há ' + days + ' dias';
    return 'Publicada em ' + dateLabel(value);
  };

  function renderListItem(job, company, selectedId) {
    const logo = company.foto_perfil
      ? '<img src="' + esc(company.foto_perfil) + '" alt="">'
      : '<span>' + esc(initials(company.nome_empresa || company.nome_fantasia)) + '</span>';
    return '<button type="button" class="company-jobs-list-item' +
      (Number(job.id) === Number(selectedId) ? ' is-selected' : '') +
      '" data-select-job="' + esc(job.id) + '" aria-pressed="' + (Number(job.id) === Number(selectedId)) + '">' +
      '<span class="company-jobs-list-logo">' + logo + '</span>' +
      '<span class="company-jobs-list-copy"><strong>' + esc(job.titulo) + '</strong>' +
      '<span>' + esc(company.nome_empresa || company.nome_fantasia || 'Empresa') + '</span>' +
      '<small>' + esc(job.cidade || company.cidade || 'Local não informado') + (job.modalidade ? ' · ' + esc(job.modalidade) : '') + '</small>' +
      '<small>' + esc(timeLabel(job.criado_em)) + '</small></span></button>';
  }

  function renderPhotos(company) {
    const photos = Array.isArray(company.fotos) ? company.fotos : [];
    if (!photos.length) {
      return '<section class="company-jobs-detail-section"><h2>Fotos da empresa</h2><p class="company-jobs-muted">Esta empresa ainda não adicionou fotos ao perfil.</p></section>';
    }
    return '<section class="company-jobs-detail-section"><h2>Fotos da empresa</h2><div class="company-jobs-photo-grid">' +
      photos.map((photo, index) => '<img src="' + esc(photo.url) + '" alt="Foto ' + (index + 1) + ' de ' + esc(company.nome_empresa || company.nome_fantasia) + '" loading="lazy">').join('') +
      '</div></section>';
  }

  function renderDetails(job, company) {
    const companyName = company.nome_empresa || company.nome_fantasia || 'Empresa';
    const logo = company.foto_perfil
      ? '<img src="' + esc(company.foto_perfil) + '" alt="">'
      : '<span>' + esc(initials(companyName)) + '</span>';
    return '<article class="company-jobs-detail">' +
      '<div class="company-jobs-detail-company"><span class="company-jobs-detail-logo">' + logo + '</span>' +
      '<div><strong>' + esc(companyName) + '</strong><span>' + esc(company.cidade || 'Localização não informada') + '</span></div></div>' +
      '<h1>' + esc(job.titulo) + '</h1>' +
      '<p class="company-jobs-detail-meta">' + esc(job.cidade || 'Local não informado') + ' · ' + esc(job.modalidade || 'Modalidade não informada') + ' · ' + esc(timeLabel(job.criado_em)) + '</p>' +
      '<div class="company-jobs-detail-tags"><span>' + esc(job.modalidade || 'Modalidade não informada') + '</span><span>' + esc(job.tipo_contrato || 'Contrato não informado') + '</span></div>' +
      '<div class="company-jobs-detail-actions"><a class="company-jobs-apply" href="/pages/vaga-detalhes.html?id=' + encodeURIComponent(job.id) + '">Ver candidatura e salvar vaga <span aria-hidden="true">↗</span></a>' +
      '<a class="company-jobs-company-link" href="/pages/empresa-perfil.html?id=' + encodeURIComponent(company.id) + '">Perfil da empresa</a></div>' +
      '<section class="company-jobs-detail-section"><h2>Sobre a oportunidade</h2><p>' + esc(job.descricao || 'A empresa não informou uma descrição para esta oportunidade.') + '</p></section>' +
      '<section class="company-jobs-detail-section"><h2>Requisitos</h2><p>' + esc(job.requisitos || 'A empresa não informou requisitos específicos para esta oportunidade.') + '</p></section>' +
      '<section class="company-jobs-detail-section company-jobs-facts"><h2>Informações da vaga</h2><dl>' +
      '<div><dt>Remuneração</dt><dd>' + esc(job.salario || 'A combinar') + '</dd></div>' +
      '<div><dt>Tipo de contrato</dt><dd>' + esc(job.tipo_contrato || 'Não informado') + '</dd></div>' +
      '<div><dt>Modalidade</dt><dd>' + esc(job.modalidade || 'Não informada') + '</dd></div>' +
      '<div><dt>Localização</dt><dd>' + esc(job.cidade || 'Não informada') + '</dd></div>' +
      '<div><dt>Data de publicação</dt><dd>' + esc(dateLabel(job.criado_em)) + '</dd></div>' +
      '</dl></section>' +
      '<section class="company-jobs-detail-section"><h2>Sobre a empresa</h2><p>' + esc(company.descricao || 'A empresa ainda não adicionou uma apresentação institucional.') + '</p>' +
      '<a class="company-jobs-company-link" href="/pages/empresa-perfil.html?id=' + encodeURIComponent(company.id) + '">Conhecer perfil completo</a></section>' +
      renderPhotos(company) + '</article>';
  }

  async function load() {
    const params = new URLSearchParams(location.search);
    const companyId = params.get('empresa');
    const requestedJobId = params.get('vaga');
    if (!companyId || !/^\d+$/.test(companyId)) {
      root.removeAttribute('aria-busy');
      root.textContent = 'Identificador da empresa inválido.';
      return;
    }
    try {
      const data = await Conecta.api('/api/empresas/' + encodeURIComponent(companyId));
      const company = data.empresa;
      const jobs = Array.isArray(data.vagas) ? data.vagas : [];
      if (!company || !jobs.length) {
        root.className = 'company-jobs-empty';
        root.textContent = 'Esta empresa não possui vagas abertas no momento.';
        return;
      }
      let selected = jobs.find(job => Number(job.id) === Number(requestedJobId)) || jobs[0];
      const profileUrl = '/pages/empresa-perfil.html?id=' + encodeURIComponent(company.id);
      document.getElementById('company-jobs-back').href = profileUrl;
      document.getElementById('company-jobs-back').textContent = '← Voltar ao perfil da empresa';
      root.className = 'company-jobs-split';
      root.removeAttribute('aria-busy');
      root.innerHTML = '<aside class="company-jobs-list-pane"><div class="company-jobs-list-heading"><span>' +
        jobs.length + (jobs.length === 1 ? ' vaga disponível' : ' vagas disponíveis') + '</span><a href="' + profileUrl + '">Ver empresa</a></div>' +
        '<div class="company-jobs-list" id="company-jobs-list">' +
        jobs.map(job => renderListItem(job, company, selected.id)).join('') +
        '</div></aside><section class="company-jobs-detail-pane" id="company-jobs-detail" aria-live="polite">' +
        renderDetails(selected, company) + '</section>';

      root.querySelector('#company-jobs-list').addEventListener('click', event => {
        const button = event.target.closest('[data-select-job]');
        if (!button) return;
        const job = jobs.find(item => Number(item.id) === Number(button.dataset.selectJob));
        if (!job) return;
        selected = job;
        root.querySelectorAll('[data-select-job]').forEach(item => {
          const active = Number(item.dataset.selectJob) === Number(selected.id);
          item.classList.toggle('is-selected', active);
          item.setAttribute('aria-pressed', String(active));
        });
        root.querySelector('#company-jobs-detail').innerHTML = renderDetails(selected, company);
        const next = new URL(location.href);
        next.searchParams.set('vaga', selected.id);
        history.replaceState(null, '', next);
      });
      document.title = 'Vagas de ' + (company.nome_empresa || company.nome_fantasia || 'empresa') + ' | ConectaTrabalho';
    } catch (error) {
      root.removeAttribute('aria-busy');
      root.className = 'company-jobs-empty';
      root.textContent = error.message || 'Não foi possível carregar as vagas desta empresa.';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();