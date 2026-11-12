(() => {
  const root = document.getElementById('company-public-content');
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
  async function load() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id || !/^\d+$/.test(id)) {
      root.textContent = 'Identificador da empresa inválido.';
      return;
    }
    try {
      const data = await Conecta.api('/api/empresas/' + encodeURIComponent(id));
      const company = data.empresa;
      const jobs = data.vagas || [];
      const logo = company.foto_perfil
        ? `<img class="company-public-logo" src="${esc(company.foto_perfil)}" alt="Logotipo de ${esc(company.nome_empresa)}">`
        : `<div class="company-public-logo company-public-logo-fallback" aria-hidden="true">${esc(initials(company.nome_empresa))}</div>`;
      const cover = company.banner_perfil
        ? `style="background-image:url('${esc(company.banner_perfil)}')"`
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
          <div class="company-public-cover" ${cover}>
            <span class="company-public-cover-label">PERFIL DA EMPRESA</span>
          </div>
          <div class="company-public-identity">
            ${logo}
            <div class="company-public-heading">
              <h1 id="company-public-name">${esc(company.nome_empresa || company.nome_fantasia || 'Empresa')}</h1>
              <p>${esc(company.empresa_setor || 'Empresa')}${company.cidade ? ' <span aria-hidden="true">·</span> ' + esc(company.cidade) : ''}</p>
            </div>
            <a class="company-public-primary-action" href="#company-public-jobs">Ver oportunidades</a>
          </div>
          <div class="company-public-stats">
            <div><strong>${Number(company.vagas_abertas) || 0}</strong><span>Vagas abertas</span></div>
            <div><strong>${esc(dateLabel(company.criado_em))}</strong><span>No ConectaTrabalho desde</span></div>
          </div>
        </section>

        <nav class="company-public-nav" aria-label="Navegação do perfil da empresa">
          <a href="#company-public-about">Sobre</a>
          <a href="#company-public-jobs">Vagas</a>
          <a href="#company-public-details">Informações</a>
        </nav>

        <div class="company-public-content-grid">
          <div class="company-public-main-column">
            <section class="company-public-panel" id="company-public-about" aria-labelledby="company-public-about-title">
              <span class="company-public-section-kicker">QUEM SOMOS</span>
              <h2 id="company-public-about-title">Sobre a empresa</h2>
              <p class="company-public-description">${esc(company.descricao || 'Esta empresa ainda não adicionou uma apresentação institucional.')}</p>
            </section>

            <section class="company-public-panel company-public-jobs-panel" id="company-public-jobs" aria-labelledby="company-public-jobs-title">
              <div class="company-public-jobs-heading">
                <div><span class="company-public-section-kicker">OPORTUNIDADES</span><h2 id="company-public-jobs-title">Vagas disponíveis</h2></div>
                <span class="company-public-jobs-count">${jobs.length}</span>
              </div>
              ${jobs.length
                ? `<div class="company-public-jobs">${jobs.map(jobCard).join('')}</div>`
                : '<p class="company-public-empty">Esta empresa não possui vagas abertas no momento. Volte em breve para conferir novas oportunidades.</p>'}
            </section>
          </div>

          <aside class="company-public-panel company-public-details" id="company-public-details" aria-labelledby="company-public-details-title">
            <span class="company-public-section-kicker">PERFIL INSTITUCIONAL</span>
            <h2 id="company-public-details-title">Informações</h2>
            ${info.length
              ? `<dl class="company-public-info">${info.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`
              : '<p class="company-public-empty">A empresa ainda não informou seus dados institucionais.</p>'}
            ${website ? `<a class="company-public-website" href="${esc(website)}" target="_blank" rel="noopener noreferrer">Visitar site oficial <span aria-hidden="true">↗</span></a>` : ''}
            <div class="company-public-member-since"><span>Presença na plataforma</span><strong>Desde ${esc(dateLabel(company.criado_em))}</strong></div>
          </aside>
        </div>`;
      document.title = (company.nome_empresa || 'Empresa') + ' | ConectaTrabalho';
    } catch (error) {
      root.className = 'empty-state';
      root.textContent = error.message;
    }
  }
  document.addEventListener('DOMContentLoaded', load);
})();
