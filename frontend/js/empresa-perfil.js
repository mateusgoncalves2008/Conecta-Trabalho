(() => {
  const root = document.getElementById('company-public-content');
  if (!root) return;

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
      ? `<div class="company-public-gallery-grid">${photos.map((photo, index) =>
          `<img src="${esc(photo.url)}" alt="Foto ${index + 1} de ${esc(company.nome_empresa)}" loading="lazy">`
        ).join('')}</div>`
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
      return `
        <div class="company-public-section-grid">
          <section class="company-public-panel">
            <span class="company-public-section-kicker">QUEM SOMOS</span>
            <h2>Sobre a empresa</h2>
            <p class="company-public-description">${esc(company.descricao || 'Esta empresa ainda não adicionou uma apresentação institucional.')}</p>
          </section>
          ${details}
          <section class="company-public-panel">
            <span class="company-public-section-kicker">NOSSO ESPAÇO</span>
            <h2>Fotos da empresa</h2>
            ${photoGallery}
          </section>
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
      return `<section class="company-public-panel company-public-jobs-panel">
        <div class="company-public-jobs-heading">
          <div><span class="company-public-section-kicker">OPORTUNIDADES</span><h2>Vagas disponíveis</h2></div>
          <span class="company-public-jobs-count">${jobs.length}</span>
        </div>
        ${jobs.length
          ? `<div class="company-public-jobs">${jobs.map(jobCard).join('')}</div>`
          : '<p class="company-public-empty">Esta empresa não possui vagas abertas no momento. Volte em breve para conferir novas oportunidades.</p>'}
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
              <button class="company-public-text-action" type="button" data-open-section="vagas">Ver todas <span aria-hidden="true">→</span></button>
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
            ${photos.length ? `<div class="company-public-gallery-grid">${photos.slice(0, 4).map((photo, index) =>
              `<img src="${esc(photo.url)}" alt="Foto ${index + 1} de ${esc(company.nome_empresa)}" loading="lazy">`
            ).join('')}</div>` : '<p class="company-public-empty">Esta empresa ainda não adicionou fotos.</p>'}
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
      const data = await Conecta.api('/api/empresas/' + encodeURIComponent(id));
      const company = data.empresa;
      const jobs = Array.isArray(data.vagas) ? data.vagas : [];
      const name = company.nome_empresa || company.nome_fantasia || 'Empresa';
      const logo = company.foto_perfil
        ? `<img class="company-public-logo" src="${esc(company.foto_perfil)}" alt="Logotipo de ${esc(name)}">`
        : `<div class="company-public-logo company-public-logo-fallback" aria-hidden="true">${esc(initials(name))}</div>`;
      const banner = company.banner_perfil
        ? `<img class="company-public-cover-image" src="${esc(company.banner_perfil)}" alt="" aria-hidden="true">`
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
          <div class="company-public-cover">${banner}<span class="company-public-cover-label">CONECTATRABALHO</span></div>
          <div class="company-public-identity">
            ${logo}
            <div class="company-public-heading">
              <h1 id="company-public-name">${esc(name)}</h1>
              <p>${esc(company.empresa_setor || 'Empresa')}${company.cidade ? ' · ' + esc(company.cidade) : ''}</p>
            </div>
            <button class="company-public-primary-action" type="button" data-open-section="vagas">Ver vagas</button>
          </div>
          <div class="company-public-stats">
            <div><strong>${Number(company.vagas_abertas) || 0}</strong><span>Vagas abertas</span></div>
            <div><strong>${esc(dateLabel(company.criado_em))}</strong><span>No ConectaTrabalho desde</span></div>
          </div>
        </section>

        <nav class="company-public-nav" aria-label="Navegação do perfil da empresa">
          <button type="button" data-company-section="inicio" aria-current="page">Início</button>
          <button type="button" data-company-section="sobre">Sobre</button>
          <button type="button" data-company-section="publicacoes">Publicações</button>
          <button type="button" data-company-section="vagas">Vagas</button>
          <button type="button" data-company-section="pessoas">Pessoas</button>
        </nav>

        <div class="company-public-tab-content" id="company-public-tab-content" aria-live="polite">
          ${renderSection('inicio', company, jobs, info, website)}
        </div>`;

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

      root.querySelector('.company-public-nav').addEventListener('click', event => {
        const tab = event.target.closest('[data-company-section]');
        if (tab) showSection(tab.dataset.companySection);
      });
      tabContent.addEventListener('click', event => {
        const action = event.target.closest('[data-open-section]');
        if (action) showSection(action.dataset.openSection);
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