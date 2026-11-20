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
      return `<section class="company-public-panel">
        <span class="company-public-section-kicker">ATUALIZAÇÕES</span>
        <h2>Publicações</h2>
        ${emptyState('Nenhuma publicação disponível', 'As publicações desta empresa aparecerão aqui quando esse recurso estiver disponível.')}
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
      function showSection(section) {
        if (!['inicio', 'sobre', 'publicacoes', 'vagas', 'pessoas'].includes(section)) return;
        tabs.forEach(tab => {
          if (tab.dataset.companySection === section) tab.setAttribute('aria-current', 'page');
          else tab.removeAttribute('aria-current');
        });
        tabContent.innerHTML = renderSection(section, company, jobs, info, website);
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