(() => {
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const dateLabel = value => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));
  const card = vaga => {
    const description = vaga.descricao || 'Confira os detalhes desta oportunidade.';
    return `<a class="job-card job-card-link" href="/pages/vaga-detalhes.html?id=${encodeURIComponent(vaga.id)}" aria-label="Ver detalhes da vaga ${escapeHTML(vaga.titulo)}">
      <div class="job-card-top">
        <span class="job-company">${escapeHTML(vaga.nome_empresa || 'Empresa')}</span>
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

  async function loadJobs({ busca = '', cidade = '' } = {}) {
    const homeContainer = document.getElementById('featured-jobs');
    const listContainer = document.getElementById('all-jobs');
    const container = listContainer || homeContainer;
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Buscando oportunidades...</div>';
    const params = new URLSearchParams();
    if (busca) params.set('busca', busca);
    if (cidade) params.set('cidade', cidade);
    try {
      const result = await Conecta.api('/api/vagas?' + params.toString());
      const vagas = result.vagas || [];
      if (listContainer) {
        document.getElementById('results-count').textContent = vagas.length + (vagas.length === 1 ? ' vaga encontrada' : ' vagas encontradas');
      }
      const shown = listContainer ? vagas : vagas.slice(0, 3);
      container.innerHTML = shown.length ? shown.map(card).join('') : '<div class="empty-state">Nenhuma vaga encontrada com esses filtros.</div>';
      container.querySelectorAll('[data-apply]').forEach(button => {
        button.addEventListener('click', () => applyToJob(button.dataset.apply, button));
      });
    } catch (error) {
      container.innerHTML = '<div class="empty-state">' + escapeHTML(error.message) + '</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const homeForm = document.getElementById('home-search');
    if (homeForm) homeForm.addEventListener('submit', event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(homeForm));
      const params = new URLSearchParams();
      if (values.busca) params.set('busca', values.busca.trim());
      if (values.cidade) params.set('cidade', values.cidade.trim());
      window.location.href = '/pages/vagas.html?' + params.toString();
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