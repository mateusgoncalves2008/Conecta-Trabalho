(() => {
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const dateLabel = value => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));
  const card = vaga => `<article class="job-card">
    <div class="job-card-top"><span class="job-company">${escapeHTML(vaga.nome_empresa || 'Empresa')}</span><span class="job-tag">${escapeHTML(vaga.tipo_contrato)}</span></div>
    <h3>${escapeHTML(vaga.titulo)}</h3>
    <p class="job-description">${escapeHTML(vaga.descricao.length > 150 ? vaga.descricao.slice(0, 150) + '...' : vaga.descricao)}</p>
    <div class="job-meta"><span>${escapeHTML(vaga.cidade)}</span><span>${escapeHTML(vaga.modalidade)}</span><span>${dateLabel(vaga.criado_em)}</span></div>
    <div class="job-card-bottom"><span class="job-salary">${escapeHTML(vaga.salario || 'Salário a combinar')}</span><button class="button button-primary button-small" type="button" data-apply="${Number(vaga.id)}">Candidatar-se</button></div>
  </article>`;

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