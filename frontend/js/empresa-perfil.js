(() => {
  const root = document.getElementById('company-public-content');
  if (!root) return;
  const profileBackLink = document.getElementById('company-profile-back');
  if (profileBackLink) profileBackLink.hidden = new URLSearchParams(location.search).get('origem') !== 'meu-perfil';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const initials = value => String(value || 'EMP').trim().split(/\s+/).slice(0, 2)
    .map(part => part[0] || '').join('').toUpperCase() || 'EMP';
  const dateLabel = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  };
  const safeWebsite = value => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  };

  const jobCard = job => `
    <a class="company-public-job" href="/pages/vaga-detalhes.html?id=${encodeURIComponent(job.id)}">
      <span class="company-public-job-mark" aria-hidden="true">CT</span>
      <span class="company-public-job-copy">
        <strong>${esc(job.titulo)}</strong>
        <span>${esc(job.cidade)} · ${esc(job.modalidade)} · ${esc(job.tipo_contrato)}</span>
        <small>${esc(job.salario || 'Salário a combinar')}</small>
      </span>
      <span class="company-public-job-arrow">Ver vaga <span aria-hidden="true">→</span></span>
    </a>`;

  const companyJobsUrl = (companyId, jobId) =>
    '/pages/empresa-vagas.html?empresa=' + encodeURIComponent(companyId) +
    (jobId ? '&vaga=' + encodeURIComponent(jobId) : '');

  const companyJobCard = (job, company) => {
    const name = company.nome_empresa || company.nome_fantasia || 'Empresa';
    const mark = company.foto_perfil
      ? `<img src="${esc(company.foto_perfil)}" alt="" loading="lazy">`
      : `<span aria-hidden="true">${esc(initials(name))}</span>`;
    return `
      <a class="company-public-job-card" href="${companyJobsUrl(company.id, job.id)}">
        <div class="company-public-job-card-top">
          <span class="company-public-job-card-logo">${mark}</span>
          <span class="company-public-job-card-open" aria-hidden="true">↗</span>
        </div>
        <strong class="company-public-job-card-title">${esc(job.titulo)}</strong>
        <span class="company-public-job-card-company">${esc(name)}</span>
        <span class="company-public-job-card-location">${esc(job.cidade || company.cidade || 'Local não informado')}${job.modalidade ? ' · ' + esc(job.modalidade) : ''}</span>
        <span class="company-public-job-card-date">Publicada em ${esc(dateLabel(job.criado_em))}</span>
      </a>`;
  };

  function emptyState(title, message) {
    return `
      <div class="company-public-empty-state">
        <span class="company-public-empty-symbol" aria-hidden="true">—</span>
        <h3>${esc(title)}</h3>
        <p>${esc(message)}</p>
      </div>`;
  }

  function renderSection(section, company, jobs, info, website) {
    const photos = Array.isArray(company.fotos) ? company.fotos : [];
    const photoGallery = photos.length
      ? `<div class="company-public-gallery-grid">${photos.slice(0, 4).map((photo, index) => {
          const date = new Date(photo.criada_em);
          const dateLabel = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
          return `<button class="company-public-photo" type="button" data-company-photo-index="${index}" aria-label="Ampliar foto ${index + 1}"><img src="${esc(photo.url)}" alt="Foto ${index + 1} de ${esc(company.nome_empresa)}" loading="lazy"><span class="company-public-photo-date">${esc(dateLabel)}</span></button>`;
        }).join('')}</div>`
      : emptyState('Nenhuma foto publicada', 'Esta empresa ainda não adicionou fotos ao perfil.');

    const details = `
      <section class="company-public-panel" aria-labelledby="company-public-details-title">
        <span class="company-public-section-kicker">PERFIL INSTITUCIONAL</span>
        <h2 id="company-public-details-title">Informações da empresa</h2>
        ${info.length
          ? `<dl class="company-public-info">${info.map(([label, value]) =>
              `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`
            ).join('')}</dl>`
          : '<p class="company-public-empty">A empresa ainda não informou seus dados institucionais.</p>'}
        ${website ? `<a class="company-public-website" href="${esc(website)}" target="_blank" rel="noopener noreferrer">Visitar site oficial <span aria-hidden="true">↗</span></a>` : ''}
        <div class="company-public-member-since"><span>No ConectaTrabalho desde</span><strong>${esc(dateLabel(company.criado_em))}</strong></div>
      </section>`;

    if (section === 'sobre') {
      const description = company.descricao || 'Esta empresa ainda não adicionou uma apresentação institucional.';
      const canExpandDescription = description.length > 420;
      return `
        <div class="company-public-section-grid">
          <div class="company-public-about-column">
            <section class="company-public-panel">
              <span class="company-public-section-kicker">QUEM SOMOS</span>
              <h2>Sobre a empresa</h2>
              <p class="company-public-description${canExpandDescription ? ' is-collapsed' : ''}" id="company-public-full-description">${esc(description)}</p>
              ${canExpandDescription ? '<button class="company-public-text-action" type="button" data-toggle-description aria-expanded="false" aria-controls="company-public-full-description">Ver mais</button>' : ''}
            </section>
            <section class="company-public-panel">
              <span class="company-public-section-kicker">NOSSO ESPAÇO</span>
              <h2>Fotos da empresa</h2>
              ${photoGallery}
            </section>
          </div>
          ${details}
        </div>`;
    }

    if (section === 'publicacoes') {
      return `<section class="company-public-panel company-public-posts-panel">
        <span class="company-public-section-kicker">ATUALIZAÇÕES</span>
        <h2>Publicações</h2>
        <div class="company-public-media-filters" role="group" aria-label="Filtrar publicações">
          <button type="button" data-company-media-filter="todos" class="is-active" aria-pressed="true">Todos</button>
          <button type="button" data-company-media-filter="image" aria-pressed="false">Imagens</button>
          <button type="button" data-company-media-filter="video" aria-pressed="false">Vídeos</button>
        </div>
        <div class="company-public-post-grid" data-company-post-grid>
          <p class="company-public-post-loading">Carregando publicações...</p>
        </div>
      </section>`;
    }

    if (section === 'vagas') {
      const allJobsUrl = companyJobsUrl(company.id);
      return `<section class="company-public-panel company-public-jobs-panel">
        <div class="company-public-jobs-heading">
          <div><span class="company-public-section-kicker">OPORTUNIDADES</span><h2>Vagas anunciadas recentemente</h2></div>
          <div class="company-public-carousel-controls">
            <button type="button" data-job-scroll="prev" aria-label="Vagas anteriores">‹</button>
            <button type="button" data-job-scroll="next" aria-label="Próximas vagas">›</button>
          </div>
        </div>
        ${jobs.length
          ? `<div class="company-public-jobs-carousel" id="company-public-jobs-carousel">${jobs.map(job => companyJobCard(job, company)).join('')}</div>`
          : emptyState('Nenhuma vaga disponível', 'Esta empresa não possui vagas abertas no momento. Volte em breve para conferir novas oportunidades.')}
        <div class="company-public-all-jobs"><a href="${allJobsUrl}">Exibir todas as vagas <span aria-hidden="true">→</span></a></div>
      </section>`;
    }

    if (section === 'pessoas') {
      return `<section class="company-public-panel">
        <span class="company-public-section-kicker">EQUIPE</span>
        <h2>Pessoas</h2>
        ${emptyState('Informações da equipe indisponíveis', 'Esta área será exibida quando a empresa disponibilizar informações públicas sobre sua equipe. Dados de candidatos não são exibidos nesta seção.')}
      </section>`;
    }

    const description = company.descricao || 'Esta empresa ainda não adicionou uma apresentação institucional.';
    return `
      <div class="company-public-home-grid">
        <div class="company-public-home-main">
          <section class="company-public-panel">
            <span class="company-public-section-kicker">VISÃO GERAL</span>
            <h2>Sobre a empresa</h2>
            <p class="company-public-description">${esc(description.length > 420 ? description.slice(0, 420).trimEnd() + '…' : description)}</p>
            <button class="company-public-text-action" type="button" data-open-section="sobre">Exibir todos os detalhes <span aria-hidden="true">→</span></button>
          </section>
          <section class="company-public-panel">
            <div class="company-public-jobs-heading">
              <div><span class="company-public-section-kicker">OPORTUNIDADES</span><h2>Vagas recentes</h2></div>
              <a class="company-public-text-action" href="${companyJobsUrl(company.id)}">Exibir todas as vagas <span aria-hidden="true">→</span></a>
            </div>
            ${jobs.length
              ? `<div class="company-public-jobs">${jobs.slice(0, 3).map(jobCard).join('')}</div>`
              : '<p class="company-public-empty">Esta empresa não possui vagas abertas no momento.</p>'}
          </section>
        </div>
        <aside class="company-public-home-side">
          <section class="company-public-panel">
            <span class="company-public-section-kicker">NOSSO ESPAÇO</span>
            <h2>Fotos da empresa</h2>
            ${photos.length ? `<div class="company-public-gallery-grid">${photos.slice(0, 4).map((photo, index) => {
              const date = new Date(photo.criada_em);
              const dateLabel = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
              return `<button class="company-public-photo" type="button" data-company-photo-index="${index}" aria-label="Ampliar foto ${index + 1}"><img src="${esc(photo.url)}" alt="Foto ${index + 1} de ${esc(company.nome_empresa)}" loading="lazy"><span class="company-public-photo-date">${esc(dateLabel)}</span></button>`;
            }).join('')}</div>` : '<p class="company-public-empty">Esta empresa ainda não adicionou fotos.</p>'}
          </section>
          ${details}
        </aside>
      </div>`;
  }

  async function load() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id || !/^\d+$/.test(id)) {
      root.textContent = 'Identificador da empresa inválido.';
      return;
    }

    try {
      const [data, sessionData] = await Promise.all([
        Conecta.api('/api/empresas/' + encodeURIComponent(id)),
        Conecta.api('/api/me').catch(() => ({ usuario: null }))
      ]);
      const company = data.empresa;
      const currentUser = sessionData.usuario || null;
      const canFollow = !currentUser || String(currentUser.id) !== String(id);
      const jobs = Array.isArray(data.vagas) ? data.vagas : [];
      const name = company.nome_empresa || company.nome_fantasia || 'Empresa';
      const logo = company.foto_perfil
        ? `<img class="company-public-logo" src="${esc(company.foto_perfil)}" alt="Logotipo de ${esc(name)}" loading="eager" fetchpriority="high" decoding="async">`
        : `<div class="company-public-logo company-public-logo-fallback" aria-hidden="true">${esc(initials(name))}</div>`;
      const banner = company.banner_perfil
        ? `<img class="company-public-cover-image" src="${esc(company.banner_perfil)}" alt="" aria-hidden="true" loading="eager" fetchpriority="high" decoding="async">`
        : '';
      const website = safeWebsite(company.empresa_site);
      const info = [
        company.empresa_setor ? ['Setor de atuação', company.empresa_setor] : null,
        company.empresa_porte ? ['Porte da empresa', company.empresa_porte] : null,
        company.cidade ? ['Localização', company.cidade] : null
      ].filter(Boolean);

      root.className = 'company-public-layout';
      root.innerHTML = `
        <section class="company-public-hero" aria-labelledby="company-public-name">
          <div class="company-public-cover">${banner}</div>
          <div class="company-public-identity">
            ${logo}
            <div class="company-public-heading">
              <h1 id="company-public-name">${esc(name)}</h1>
              <p class="company-public-tagline">${esc(company.empresa_descricao_curta || company.empresa_setor || 'Empresa')}</p>
              <p class="company-public-meta">${company.cidade ? esc(company.cidade) : 'Localização não informada'}${jobs.length ? ' · ' + jobs.length + (jobs.length === 1 ? ' vaga aberta' : ' vagas abertas') : ''}</p>
            </div>
            <div class="company-public-actions">
              <a class="company-public-primary-action" href="${esc(website || 'https://conectatrabalho.vercel.app/')}" target="_blank" rel="noopener noreferrer">Visite o site <span aria-hidden="true">↗</span></a>
            </div>
          </div>
          <nav class="company-public-nav" aria-label="Navegação do perfil da empresa">
            <button type="button" data-company-section="inicio" aria-current="page">Início</button>
            <button type="button" data-company-section="sobre">Sobre</button>
            <button type="button" data-company-section="publicacoes">Publicações</button>
            <button type="button" data-company-section="vagas">Vagas</button>
            <button type="button" data-company-section="pessoas">Pessoas</button>
          </nav>
        </section>

        <div class="company-public-tab-content" id="company-public-tab-content" aria-live="polite">
          ${renderSection('inicio', company, jobs, info, website)}
        </div>`;

      const actions = root.querySelector('.company-public-actions');
      if (actions && canFollow) {
        const followButton = document.createElement('button');
        followButton.type = 'button';
        followButton.className = 'company-public-follow-action' + (company.seguindo ? ' is-following' : '');
        followButton.dataset.followCompany = '';
        followButton.setAttribute('aria-pressed', String(Boolean(company.seguindo)));
        followButton.textContent = company.seguindo ? 'Seguindo' : 'Seguir';
        actions.prepend(followButton);
      }
      if (actions) {
        const followers = document.createElement('p');
        followers.className = 'company-public-followers';
        followers.setAttribute('aria-live', 'polite');
        followers.innerHTML = '<i class="fa-solid fa-users" aria-hidden="true"></i><strong data-followers-count>' + Number(company.total_seguidores || 0).toLocaleString('pt-BR') + '</strong><span>seguidores</span>';
        actions.appendChild(followers);
      }

      const lightbox = document.createElement('div');
      lightbox.className = 'company-photo-lightbox';
      lightbox.setAttribute('aria-hidden', 'true');
      lightbox.innerHTML = `<button type="button" class="company-photo-lightbox-close" aria-label="Fechar">&times;</button><button type="button" class="company-photo-lightbox-arrow is-prev" aria-label="Foto anterior">&#10094;</button><img class="company-photo-lightbox-image" alt=""><button type="button" class="company-photo-lightbox-arrow is-next" aria-label="Próxima foto">&#10095;</button><span class="company-photo-lightbox-counter"></span>`;
      document.body.appendChild(lightbox);
      let activePhotoIndex = 0;
      const openPhoto = index => {
        const galleryPhotos = (company.fotos || []).slice(0, 4);
        if (!galleryPhotos.length) return;
        activePhotoIndex = (index + galleryPhotos.length) % galleryPhotos.length;
        const photo = galleryPhotos[activePhotoIndex];
        const image = lightbox.querySelector('.company-photo-lightbox-image');
        image.src = photo.url; image.alt = 'Foto ' + (activePhotoIndex + 1) + ' de ' + name;
        lightbox.querySelector('.company-photo-lightbox-counter').textContent = (activePhotoIndex + 1) + ' / ' + galleryPhotos.length;
        lightbox.classList.add('is-open'); lightbox.setAttribute('aria-hidden', 'false');
        document.body.classList.add('company-photo-lightbox-open');
      };
      const closePhoto = () => { lightbox.classList.remove('is-open'); lightbox.setAttribute('aria-hidden', 'true'); document.body.classList.remove('company-photo-lightbox-open'); };
      const movePhoto = direction => openPhoto(activePhotoIndex + direction);
      lightbox.addEventListener('click', event => {
        if (event.target === lightbox || event.target.closest('.company-photo-lightbox-close')) closePhoto();
        if (event.target.closest('.company-photo-lightbox-arrow.is-prev')) movePhoto(-1);
        if (event.target.closest('.company-photo-lightbox-arrow.is-next')) movePhoto(1);
      });
      document.addEventListener('keydown', event => {
        if (!lightbox.classList.contains('is-open')) return;
        if (event.key === 'Escape') closePhoto();
        if (event.key === 'ArrowLeft') movePhoto(-1);
        if (event.key === 'ArrowRight') movePhoto(1);
      });
      const tabContent = root.querySelector('#company-public-tab-content');
      const tabs = [...root.querySelectorAll('[data-company-section]')];
      let companyPosts = [];
      let companyPostsLoaded = false;
      let companyPostsLoading = false;
      let activeMediaFilter = 'todos';
      let postViewer = null;

      const formatViews = value => Number(value || 0).toLocaleString('pt-BR');
      const postPreview = post => {
        const media = post.midias && post.midias[0];
        if (!media) return '<span class="company-public-post-no-media">Sem mídia</span>';
        if (media.tipo === 'video') return '<video src="' + esc(media.url) + '" muted playsinline preload="metadata"></video><span class="company-public-post-video-mark"><i class="fa-solid fa-play" aria-hidden="true"></i></span>';
        return '<img src="' + esc(media.url) + '" alt="" loading="lazy">';
      };
      const renderCompanyPosts = () => {
        const grid = tabContent.querySelector('[data-company-post-grid]');
        if (!grid) return;
        const filteredPosts = companyPosts
          .map((post, index) => ({ post, index }))
          .filter(({ post }) => activeMediaFilter === 'todos' ||
            (post.midias || []).some(media => activeMediaFilter === 'video' ? media.tipo === 'video' : media.tipo !== 'video'));
        if (!companyPosts.length) {
          grid.innerHTML = emptyState('Nenhuma publicação disponível', 'Esta empresa ainda não publicou fotos ou vídeos.');
          return;
        }
        if (!filteredPosts.length) {
          grid.innerHTML = emptyState(activeMediaFilter === 'video' ? 'Nenhum vídeo publicado' : 'Nenhuma imagem publicada',
            activeMediaFilter === 'video' ? 'Esta empresa ainda não publicou vídeos.' : 'Esta empresa ainda não publicou imagens.');
          return;
        }
        grid.innerHTML = filteredPosts.map(({ post, index }) => {
          const mediaMarkup = (post.midias || []).map(media => media.tipo === 'video'
            ? '<video src="' + esc(media.url) + '" controls playsinline preload="metadata"></video>'
            : '<img src="' + esc(media.url) + '" alt="Imagem da publicação" loading="lazy">').join('');
          const likeTotal = (post.reacoes || []).reduce((sum, item) => sum + Number(item.total || 0), 0);
          const avatarMarkup = company.foto_perfil
            ? '<img src="' + esc(company.foto_perfil) + '" alt="">'
            : esc(initials(name));
          const longDescription = (post.descricao || '').length > 260;
          return `<article class="publication-card company-public-post-detail" data-post-index="${index}" data-post-id="${esc(post.id)}">
            <header class="publication-card-header">
              <span class="publication-avatar publication-author-link">${avatarMarkup}</span>
              <div class="publication-author">
                <strong class="publication-author-name-link">${esc(name)}</strong>
                <small><span data-followers-count>${Number(company.total_seguidores || 0).toLocaleString('pt-BR')}</span> seguidores · ${esc(dateLabel(post.criadaEm))}</small>
              </div>
            </header>
            <div class="company-public-post-detail-media">${mediaMarkup}</div>
            ${post.descricao ? '<div class="publication-description' + (longDescription ? ' is-collapsed' : '') + '" data-description>' + esc(post.descricao) + '</div>' + (longDescription ? '<button type="button" class="description-toggle" data-post-description-toggle>Ver mais...</button>' : '') : ''}
            <div class="company-public-post-detail-stats"><span><i class="fa-solid fa-eye" aria-hidden="true"></i> <strong data-post-view-count>${formatViews(post.visualizacoes)}</strong> visualizações</span></div>
            <footer class="publication-card-footer">
              <div class="publication-actions">
                <div class="reaction-control">
                  <button type="button" class="like-toggle-button${post.minhaCurtida ? ' liked' : ''}" data-action="like" aria-pressed="${Boolean(post.minhaCurtida)}" aria-label="${post.minhaCurtida ? 'Remover curtida' : 'Curtir publicação'}">
                    <svg class="like-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    <strong data-reaction-total>${formatViews(likeTotal)}</strong>
                  </button>
                </div>
                ${post.minha
                  ? '<button type="button" class="report-button" data-action="delete">Excluir</button>'
                  : '<button type="button" class="report-button" data-action="report">Denunciar</button>'}
              </div>
            </footer>
          </article>`;
        }).join('');
        if ('IntersectionObserver' in window) {
          const feedObserver = new IntersectionObserver(entries => {
            entries.forEach(async entry => {
              if (!entry.isIntersecting || entry.intersectionRatio < .65) return;
              const card = entry.target;
              if (card.dataset.viewRegistered === 'true') return;
              card.dataset.viewRegistered = 'true';
              const post = companyPosts[Number(card.dataset.postIndex)];
              if (!post) return;
              try {
                const result = await Conecta.api('/api/publicacoes/' + encodeURIComponent(post.id) + '/visualizacao', { method: 'POST' });
                post.visualizacoes = Number(result.visualizacoes || post.visualizacoes || 0);
                const count = card.querySelector('[data-post-view-count]');
                if (count) count.textContent = formatViews(post.visualizacoes);
              } catch (error) {
                card.dataset.viewRegistered = 'false';
              }
            });
          }, { threshold: [.65] });
          grid.querySelectorAll('[data-post-index]').forEach(card => feedObserver.observe(card));
        }
        grid.querySelectorAll('[data-post-index]').forEach(card => {
          const post = companyPosts[Number(card.dataset.postIndex)];
          if (!post || post._viewRegistered) return;
          post._viewObserver?.disconnect?.();
        });
      };
      const loadCompanyPosts = async () => {
        if (companyPostsLoaded || companyPostsLoading) return;
        companyPostsLoading = true;
        try {
          const result = await Conecta.api('/api/publicacoes/empresa/' + encodeURIComponent(id));
          companyPosts = Array.isArray(result.publicacoes) ? result.publicacoes : [];
          companyPostsLoaded = true;
          renderCompanyPosts();
        } catch (error) {
          const grid = tabContent.querySelector('[data-company-post-grid]');
          if (grid) grid.innerHTML = emptyState('Não foi possível carregar', error.message || 'Tente novamente em instantes.');
        } finally {
          companyPostsLoading = false;
        }
      };
      const ensurePostViewer = () => {
        if (postViewer) return postViewer;
        postViewer = document.createElement('div');
        postViewer.className = 'company-public-post-viewer';
        postViewer.setAttribute('aria-hidden', 'true');
        postViewer.innerHTML = `
          <div class="company-public-post-viewer-top">
            <strong>Publicações</strong>
            <button type="button" data-close-company-post-viewer aria-label="Fechar publicações"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
          </div>
          <div class="company-public-post-stream" data-company-post-stream></div>
          <dialog class="report-dialog company-post-report-dialog" data-company-post-report-dialog aria-labelledby="company-post-report-title">
            <form data-company-post-report-form method="dialog">
              <div class="report-dialog-heading">
                <div><span class="eyebrow">AJUDE A MANTER A COMUNIDADE SEGURA</span><h2 id="company-post-report-title">Denunciar publicação</h2></div>
                <button class="dialog-close" type="button" data-company-report-close aria-label="Fechar">×</button>
              </div>
              <p>Selecione o motivo que melhor descreve o problema. A denúncia será enviada para análise.</p>
              <label for="company-post-report-reason">Motivo da denúncia</label>
              <select id="company-post-report-reason" required>
                <option value="">Selecione um motivo</option>
                <option>Conteúdo ofensivo ou discriminatório</option>
                <option>Informação falsa ou enganosa</option>
                <option>Spam ou publicidade inadequada</option>
                <option>Conteúdo impróprio</option>
                <option>Fraude ou tentativa de golpe</option>
                <option>Outro motivo</option>
              </select>
              <label for="company-post-report-detail" data-company-report-detail-label hidden>Conte o que aconteceu</label>
              <textarea id="company-post-report-detail" maxlength="500" rows="3" placeholder="Explique brevemente o motivo..." hidden></textarea>
              <div class="report-dialog-actions">
                <button class="button button-outline" type="button" data-company-report-cancel>Cancelar</button>
                <button class="button button-primary" type="submit">Enviar denúncia</button>
              </div>
            </form>
          </dialog>`;
        document.body.appendChild(postViewer);
        const detachedReportDialog = postViewer.querySelector('[data-company-post-report-dialog]');
        document.body.appendChild(detachedReportDialog);
        const stream = postViewer.querySelector('[data-company-post-stream]');
        const observer = new IntersectionObserver(entries => {
          entries.forEach(async entry => {
            if (!entry.isIntersecting || entry.intersectionRatio < .65) return;
            const card = entry.target;
            if (card.dataset.viewRegistered === 'true') return;
            card.dataset.viewRegistered = 'true';
            const post = companyPosts[Number(card.dataset.postIndex)];
            if (!post) return;
            try {
              const result = await Conecta.api('/api/publicacoes/' + encodeURIComponent(post.id) + '/visualizacao', { method: 'POST' });
              post.visualizacoes = Number(result.visualizacoes || post.visualizacoes || 0);
              const count = card.querySelector('[data-post-view-count]');
              if (count) count.textContent = formatViews(post.visualizacoes);
              const tile = tabContent.querySelector('[data-company-post-index="' + Number(card.dataset.postIndex) + '"] .company-public-post-views strong');
              if (tile) tile.textContent = formatViews(post.visualizacoes);
            } catch (error) {
              card.dataset.viewRegistered = 'false';
            }
          });
        }, { root: stream, threshold: [.65] });
        let reportTargetId = null;
        const reportDialog = postViewer.querySelector('[data-company-post-report-dialog]');
        const reportForm = postViewer.querySelector('[data-company-post-report-form]');
        const reportReason = postViewer.querySelector('#company-post-report-reason');
        const reportDetail = postViewer.querySelector('#company-post-report-detail');
        const reportDetailLabel = postViewer.querySelector('[data-company-report-detail-label]');
        postViewer._openReportFor = postId => {
          reportTargetId = postId;
          reportForm.reset();
          reportDetail.hidden = true;
          reportDetail.required = false;
          reportDetailLabel.hidden = true;
          reportDialog.showModal();
        };
        const closeReportDialog = () => {
          reportDialog.close();
          reportTargetId = null;
        };
        reportReason.addEventListener('change', () => {
          const showDetail = reportReason.value === 'Outro motivo';
          reportDetail.hidden = !showDetail;
          reportDetailLabel.hidden = !showDetail;
          reportDetail.required = showDetail;
        });
        reportDialog.addEventListener('click', async event => {
          
          if (event.target.closest('[data-company-report-close],[data-company-report-cancel]')) { closeReportDialog(); return; }
          const descriptionToggle = event.target.closest('[data-post-description-toggle]');
          if (descriptionToggle) {
            const description = descriptionToggle.parentElement.querySelector('[data-description]');
            const expanded = description.classList.toggle('is-collapsed') === false;
            descriptionToggle.textContent = expanded ? 'Ver menos' : 'Ver mais...';
            return;
          }
          const actionButton = event.target.closest('[data-action]');
          if (!actionButton) return;
          const card = actionButton.closest('[data-post-index]');
          const post = card && companyPosts[Number(card.dataset.postIndex)];
          if (!post || actionButton.disabled) return;
          const action = actionButton.dataset.action;
          if (action === 'like') {
            if (!currentUser) { window.location.href = '/pages/login.html'; return; }
            const wasLiked = Boolean(post.minhaCurtida);
            const total = (post.reacoes || []).reduce((sum, item) => sum + Number(item.total || 0), 0);
            const nextLiked = !wasLiked;
            actionButton.disabled = true;
            post.minhaCurtida = nextLiked;
            const nextTotal = Math.max(0, total + (nextLiked ? 1 : -1));
            post.reacoes = nextTotal ? [{ emoji: '❤️', total: nextTotal }] : [];
            updatePostLikeButton(card, post, nextTotal);
            try {
              if (nextLiked) {
                await Conecta.api('/api/publicacoes/' + encodeURIComponent(post.id) + '/reacao', {
                  method: 'PUT',
                  body: JSON.stringify({ emoji: '❤️' })
                });
              } else {
                await Conecta.api('/api/publicacoes/' + encodeURIComponent(post.id) + '/reacao', { method: 'DELETE' });
              }
            } catch (error) {
              post.minhaCurtida = wasLiked;
              post.reacoes = total ? [{ emoji: '❤️', total }] : [];
              updatePostLikeButton(card, post, total);
              Conecta.toast(error.message);
            } finally { actionButton.disabled = false; }
            return;
          }
          if (action === 'report') {
            if (!currentUser) { window.location.href = '/pages/login.html'; return; }
            reportTargetId = post.id;
            reportForm.reset();
            reportDetail.hidden = true;
            reportDetail.required = false;
            reportDetailLabel.hidden = true;
            reportDialog.showModal();
            return;
          }
          if (action === 'delete') {
            if (!window.confirm('Deseja excluir esta publicação? As fotos ou o vídeo e todas as reações também serão excluídos.')) return;
            actionButton.disabled = true;
            try {
              await Conecta.api('/api/publicacoes/' + encodeURIComponent(post.id), { method: 'DELETE' });
              companyPosts = companyPosts.filter(item => String(item.id) !== String(post.id));
              closePostViewer();
              renderCompanyPosts();
              Conecta.toast('Publicação excluída.');
            } catch (error) {
              Conecta.toast(error.message);
              actionButton.disabled = false;
            }
          }
        });
        reportForm.addEventListener('submit', async event => {
          event.preventDefault();
          if (!reportTargetId) return;
          const submit = reportForm.querySelector('[type="submit"]');
          submit.disabled = true;
          try {
            const result = await Conecta.api('/api/publicacoes/' + encodeURIComponent(reportTargetId) + '/denuncias', {
              method: 'POST',
              body: JSON.stringify({ motivo: reportReason.value, detalhe: reportDetail.value })
            });
            closeReportDialog();
            Conecta.toast(result.mensagem || 'Denúncia enviada.');
          } catch (error) {
            Conecta.toast(error.message);
          } finally { submit.disabled = false; }
        });
        postViewer._viewObserver = observer;
        return postViewer;
      };
      const updatePostLikeButton = (card, post, total) => {
        const button = card.querySelector('[data-action="like"]');
        const count = card.querySelector('[data-reaction-total]');
        if (!button || !count) return;
        button.classList.toggle('liked', Boolean(post.minhaCurtida));
        button.setAttribute('aria-pressed', String(Boolean(post.minhaCurtida)));
        button.setAttribute('aria-label', post.minhaCurtida ? 'Remover curtida' : 'Curtir publicação');
        count.textContent = formatViews(total);
      };

      const openPostViewer = index => {
        const viewer = ensurePostViewer();
        const stream = viewer.querySelector('[data-company-post-stream]');
        stream.innerHTML = companyPosts.map((post, postIndex) => {
          const mediaMarkup = post.midias.map(media => media.tipo === 'video'
            ? '<video src="' + esc(media.url) + '" controls playsinline preload="metadata"></video>'
            : '<img src="' + esc(media.url) + '" alt="Imagem da publicação" loading="lazy">').join('');
          const likeTotal = (post.reacoes || []).reduce((sum, item) => sum + Number(item.total || 0), 0);
          const avatarMarkup = company.foto_perfil
            ? '<img src="' + esc(company.foto_perfil) + '" alt="">'
            : esc(initials(name));
          const longDescription = (post.descricao || '').length > 260;
          return `<article class="publication-card company-public-post-detail" data-post-index="${postIndex}" data-post-id="${esc(post.id)}">
            <header class="publication-card-header">
              <span class="publication-avatar publication-author-link">${avatarMarkup}</span>
              <div class="publication-author">
                <strong class="publication-author-name-link">${esc(name)}</strong>
                <small><span data-followers-count>${Number(company.total_seguidores || 0).toLocaleString('pt-BR')}</span> seguidores · ${esc(dateLabel(post.criadaEm))}</small>
              </div>
            </header>
            <div class="company-public-post-detail-media">${mediaMarkup}</div>
            ${post.descricao ? '<div class="publication-description' + (longDescription ? ' is-collapsed' : '') + '" data-description>' + esc(post.descricao) + '</div>' + (longDescription ? '<button type="button" class="description-toggle" data-post-description-toggle>Ver mais...</button>' : '') : ''}
            <div class="company-public-post-detail-stats"><span><i class="fa-solid fa-eye" aria-hidden="true"></i> <strong data-post-view-count>${formatViews(post.visualizacoes)}</strong> visualizações</span></div>
            <footer class="publication-card-footer">
              <div class="publication-actions">
                <div class="reaction-control">
                  <button type="button" class="like-toggle-button${post.minhaCurtida ? ' liked' : ''}" data-action="like" aria-pressed="${Boolean(post.minhaCurtida)}" aria-label="${post.minhaCurtida ? 'Remover curtida' : 'Curtir publicação'}">
                    <svg class="like-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    <strong data-reaction-total>${formatViews(likeTotal)}</strong>
                  </button>
                </div>
                ${post.minha
                  ? '<button type="button" class="report-button" data-action="delete">Excluir</button>'
                  : '<button type="button" class="report-button" data-action="report">Denunciar</button>'}
              </div>
            </footer>
          </article>`;
        }).join('');
        [...stream.children].forEach((card, postIndex) => {
          card.dataset.postIndex = String(postIndex);
          viewer._viewObserver.observe(card);
        });
        viewer.classList.add('is-open');
        viewer.setAttribute('aria-hidden', 'false');
        document.body.classList.add('company-public-post-viewer-open');
        const selected = stream.children[index];
        if (selected) selected.scrollIntoView({ block: 'start' });
      };
      const closePostViewer = () => {
        if (!postViewer) return;
        const reportDialog = postViewer.querySelector('[data-company-post-report-dialog]');
        if (reportDialog?.open) reportDialog.close();
        postViewer.classList.remove('is-open');
        postViewer.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('company-public-post-viewer-open');
        postViewer.querySelectorAll('video').forEach(video => video.pause());
      };

      function showSection(section) {
        if (!['inicio', 'sobre', 'publicacoes', 'vagas', 'pessoas'].includes(section)) return;
        tabs.forEach(tab => {
          if (tab.dataset.companySection === section) tab.setAttribute('aria-current', 'page');
          else tab.removeAttribute('aria-current');
        });
        tabContent.innerHTML = renderSection(section, company, jobs, info, website);
        if (section === 'publicacoes') loadCompanyPosts();
      }

      const followButton = root.querySelector('[data-follow-company]');
      if (followButton) {
        followButton.addEventListener('click', async () => {
          if (!currentUser) { window.location.href = '/pages/login.html'; return; }
          if (String(currentUser.id) === String(id) || followButton.disabled) return;
          followButton.disabled = true;
          try {
            const following = followButton.getAttribute('aria-pressed') === 'true';
            const result = await Conecta.api('/api/perfis/' + encodeURIComponent(id) + '/seguir', { method: following ? 'DELETE' : 'POST' });
            company.seguindo = result.seguindo;
            company.total_seguidores = result.total_seguidores;
            followButton.textContent = result.seguindo ? 'Seguindo' : 'Seguir';
            followButton.classList.toggle('is-following', result.seguindo);
            followButton.setAttribute('aria-pressed', String(result.seguindo));
            const count = root.querySelector('[data-followers-count]');
            if (count) count.textContent = Number(result.total_seguidores).toLocaleString('pt-BR');
          } catch (error) { Conecta.toast(error.message); }
          finally { followButton.disabled = false; }
        });
      }

      root.querySelector('.company-public-nav').addEventListener('click', event => {
        const tab = event.target.closest('[data-company-section]');
        if (tab) showSection(tab.dataset.companySection);
      });
      tabContent.addEventListener('click', event => {
        const mediaFilter = event.target.closest('[data-company-media-filter]');
        if (mediaFilter) {
          activeMediaFilter = mediaFilter.dataset.companyMediaFilter;
          tabContent.querySelectorAll('[data-company-media-filter]').forEach(button => {
            const selected = button === mediaFilter;
            button.classList.toggle('is-active', selected);
            button.setAttribute('aria-pressed', String(selected));
          });
          renderCompanyPosts();
          return;
        }
        const postAction = event.target.closest('[data-post-index] [data-action]');
        if (postAction) {
          const card = postAction.closest('[data-post-index]');
          const post = card && companyPosts[Number(card.dataset.postIndex)];
          if (!post || postAction.disabled) return;
          const action = postAction.dataset.action;
          if (action === 'like') {
            if (!currentUser) { window.location.href = '/pages/login.html'; return; }
            const wasLiked = Boolean(post.minhaCurtida);
            const total = (post.reacoes || []).reduce((sum, item) => sum + Number(item.total || 0), 0);
            const nextLiked = !wasLiked;
            postAction.disabled = true;
            post.minhaCurtida = nextLiked;
            const nextTotal = Math.max(0, total + (nextLiked ? 1 : -1));
            post.reacoes = nextTotal ? [{ emoji: '❤️', total: nextTotal }] : [];
            updatePostLikeButton(card, post, nextTotal);
            try {
              await Conecta.api('/api/publicacoes/' + encodeURIComponent(post.id) + '/reacao', {
                method: nextLiked ? 'PUT' : 'DELETE',
                ...(nextLiked ? { body: JSON.stringify({ emoji: '❤️' }) } : {})
              });
            } catch (error) {
              post.minhaCurtida = wasLiked;
              post.reacoes = total ? [{ emoji: '❤️', total }] : [];
              updatePostLikeButton(card, post, total);
              Conecta.toast(error.message);
            } finally { postAction.disabled = false; }
            return;
          }
          if (action === 'report') {
            if (!currentUser) { window.location.href = '/pages/login.html'; return; }
            const viewer = ensurePostViewer();
            viewer._openReportFor(post.id);
            return;
          }
          if (action === 'delete') {
            if (!window.confirm('Deseja excluir esta publicação? As fotos ou o vídeo e todas as reações também serão excluídos.')) return;
            postAction.disabled = true;
            try {
              await Conecta.api('/api/publicacoes/' + encodeURIComponent(post.id), { method: 'DELETE' });
              companyPosts = companyPosts.filter(item => String(item.id) !== String(post.id));
              renderCompanyPosts();
              Conecta.toast('Publicação excluída.');
            } catch (error) {
              Conecta.toast(error.message);
              postAction.disabled = false;
            }
            return;
          }
        }
        const postTile = event.target.closest('[data-company-post-index]');
        if (postTile) { openPostViewer(Number(postTile.dataset.companyPostIndex)); return; }
        const photoButton = event.target.closest('[data-company-photo-index]');
        if (photoButton) { openPhoto(Number(photoButton.dataset.companyPhotoIndex)); return; }
        const descriptionToggle = event.target.closest('[data-toggle-description]');
        if (descriptionToggle) {
          const description = tabContent.querySelector('#company-public-full-description');
          if (description) {
            const expanded = description.classList.toggle('is-expanded');
            description.classList.toggle('is-collapsed', !expanded);
            descriptionToggle.textContent = expanded ? 'Ver menos' : 'Ver mais';
            descriptionToggle.setAttribute('aria-expanded', String(expanded));
          }
        }
        const action = event.target.closest('[data-open-section]');
        if (action) showSection(action.dataset.openSection);
        const scrollButton = event.target.closest('[data-job-scroll]');
        if (scrollButton) {
          const carousel = tabContent.querySelector('#company-public-jobs-carousel');
          if (carousel) carousel.scrollBy({ left: (scrollButton.dataset.jobScroll === 'next' ? 1 : -1) * carousel.clientWidth * 0.8, behavior: 'smooth' });
        }
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && postViewer?.classList.contains('is-open')) closePostViewer();
      });

      root.querySelector('.company-public-hero').addEventListener('click', event => {
        const action = event.target.closest('[data-open-section]');
        if (action) showSection(action.dataset.openSection);
      });

      document.title = name + ' | ConectaTrabalho';
    } catch (error) {
      root.className = 'empty-state';
      root.textContent = error.message || 'Não foi possível carregar o perfil desta empresa.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, { once: true });
  } else {
    load();
  }
})();