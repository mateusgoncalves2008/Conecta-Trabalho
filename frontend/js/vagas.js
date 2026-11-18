(() => {
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const dateLabel = value => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));
  const card = vaga => {
    const description = vaga.descricao || 'Confira os detalhes desta oportunidade.';
    return `<a class="job-card job-card-link" href="/pages/vaga-detalhes.html?id=${encodeURIComponent(vaga.id)}" aria-label="Ver detalhes da vaga ${escapeHTML(vaga.titulo)}">
      <div class="job-card-top">
        <span class="job-company job-company-identity">${vaga.empresa_logo ? '<img src="' + escapeHTML(vaga.empresa_logo) + '" alt="" loading="lazy">' : '<span class="job-company-initials">' + escapeHTML(String(vaga.nome_empresa || 'EMP').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase()) + '</span>'}<span>${escapeHTML(vaga.nome_empresa || 'Empresa')}</span></span>
        <span class="job-tag">${escapeHTML(vaga.tipo_contrato)}</span>
      </div>
      <div class="job-card-content">
        <h3>${escapeHTML(vaga.titulo)}</h3>
        <p class="job-description">${escapeHTML(description.length > 150 ? description.slice(0, 150) + '...' : description)}</p>
      </div>
      <div class="job-details">
        <span class="job-detail"><strong>Local</strong>${escapeHTML(vaga.cidade || 'Não informado')}</span>
        <span class="job-detail"><strong>Modalidade</strong>${escapeHTML(vaga.modalidade || 'Não informada')}</span>
        <span class="job-detail"><strong>Publicada em</strong>${dateLabel(vaga.criado_em)}</span>
      </div>
      <div class="job-card-bottom">
        <div class="job-salary-block"><span class="job-salary-label">Remuneração</span><strong class="job-salary">${escapeHTML(vaga.salario || 'A combinar')}</strong></div>
        <span class="button button-primary button-small">Ver detalhes</span>
      </div>
    </a>`;
  };

  async function applyToJob(id, button) {
    try {
      const session = await Conecta.api('/api/me');
      if (!session.usuario) return window.location.href = '/pages/login.html';
      if (session.usuario.tipo === 'empresa') return Conecta.toast('Contas de empresa não podem se candidatar a vagas.');
      button.disabled = true;
      button.textContent = 'Enviando...';
      await Conecta.api('/api/vagas/' + id + '/candidatar', {
        method: 'POST',
        body: JSON.stringify({ mensagem: '' })
      });
      button.textContent = 'Candidatura enviada';
      Conecta.toast('Sua candidatura foi enviada com sucesso.');
    } catch (error) {
      Conecta.toast(error.message);
      button.disabled = false;
      button.textContent = 'Candidatar-se';
    }
  }

  const jobsCachePrefix = 'conecta-public-jobs-v1:';
  const readJobsCache = key => {
    try {
      const value = localStorage.getItem(jobsCachePrefix + key);
      const parsed = value ? JSON.parse(value) : null;
      return Array.isArray(parsed?.vagas) ? parsed.vagas : null;
    } catch {
      return null;
    }
  };
  const writeJobsCache = (key, vagas) => {
    try {
      const storageKey = jobsCachePrefix + key;
      localStorage.setItem(storageKey, JSON.stringify({ vagas, savedAt: Date.now() }));
      const keys = [];
      for (let index = 0; index < localStorage.length; index++) {
        const item = localStorage.key(index);
        if (item && item.startsWith(jobsCachePrefix)) keys.push(item);
      }
      keys.filter(item => item !== storageKey).slice(0, Math.max(0, keys.length - 10))
        .forEach(item => localStorage.removeItem(item));
    } catch {}
  };

  function renderJobs(vagas, { homeContainer, listContainer, container, hasFilters }) {
    if (listContainer) {
      const count = document.getElementById('results-count');
      if (count) count.textContent = vagas.length + (vagas.length === 1 ? ' vaga encontrada' : ' vagas encontradas');
    }
    if (homeContainer) {
      const heading = document.querySelector('#vagas-destaque .section-heading h2');
      const description = document.querySelector('#vagas-destaque .section-heading p');
      if (heading) heading.textContent = hasFilters ? 'Resultados da busca' : 'Vagas recentes';
      if (description) description.textContent = hasFilters
        ? (vagas.length ? vagas.length + (vagas.length === 1 ? ' oportunidade encontrada.' : ' oportunidades encontradas.') : 'Não encontramos vagas com esses filtros. Tente outro cargo ou cidade.')
        : 'Confira algumas das oportunidades disponíveis.';
    }
    const shown = listContainer ? vagas : (hasFilters ? vagas : vagas.slice(0, 3));
    container.innerHTML = shown.length ? shown.map(card).join('') : '<div class="empty-state">Nenhuma vaga encontrada com esses filtros.</div>';
    container.querySelectorAll('[data-apply]').forEach(button => {
      button.addEventListener('click', () => applyToJob(button.dataset.apply, button));
    });
  }

  async function loadJobs({ busca = '', cidade = '' } = {}) {
    const homeContainer = document.getElementById('featured-jobs');
    const listContainer = document.getElementById('all-jobs');
    const container = listContainer || homeContainer;
    if (!container) return;
    const params = new URLSearchParams();
    if (busca) params.set('busca', busca);
    if (cidade) params.set('cidade', cidade);
    const query = params.toString();
    const cacheKey = query || 'recentes';
    const hasFilters = Boolean(busca.trim() || cidade.trim());
    const cachedJobs = readJobsCache(cacheKey);

    if (cachedJobs) {
      renderJobs(cachedJobs, { homeContainer, listContainer, container, hasFilters });
    } else {
      container.innerHTML = '<div class="empty-state">Buscando oportunidades...</div>';
    }

    try {
      const result = await Conecta.api('/api/vagas' + (query ? '?' + query : ''));
      const vagas = Array.isArray(result.vagas) ? result.vagas : [];
      writeJobsCache(cacheKey, vagas);
      renderJobs(vagas, { homeContainer, listContainer, container, hasFilters });
    } catch (error) {
      if (!cachedJobs) {
        container.innerHTML = '<div class="empty-state">' + escapeHTML(error.message) + '</div>';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const homeForm = document.getElementById('home-search');
    if (homeForm) homeForm.addEventListener('submit', async event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(homeForm));
      await loadJobs({
        busca: String(values.busca || '').trim(),
        cidade: String(values.cidade || '').trim()
      });
      document.getElementById('vagas-destaque')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const searchForm = document.getElementById('jobs-search');
    if (searchForm) {
      const params = new URLSearchParams(window.location.search);
      searchForm.elements.busca.value = params.get('busca') || '';
      searchForm.elements.cidade.value = params.get('cidade') || '';
      searchForm.addEventListener('submit', event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(searchForm));
        loadJobs({ busca: values.busca.trim(), cidade: values.cidade.trim() });
      });
      loadJobs({ busca: searchForm.elements.busca.value, cidade: searchForm.elements.cidade.value });
    } else {
      loadJobs();
    }
  });
})();