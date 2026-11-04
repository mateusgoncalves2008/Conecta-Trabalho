(() => {
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const dateLabel = value => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));
  const statusText = status => ({
    recebida: 'Recebida', em_analise: 'Em análise', entrevista: 'Entrevista',
    aprovada: 'Aprovada', rejeitada: 'Não aprovada',
    aberta: 'Aberta', pausada: 'Pausada', encerrada: 'Encerrada'
  })[status] || status;

  async function initPanel() {
    const page = document.body.dataset.panel;
    if (!page) return;
    try {
      const session = await Conecta.api('/api/me');
      if (!session.usuario) return window.location.href = '/pages/login.html';
      const expected = page === 'empresa' ? 'empresa' : 'candidato';
      if (session.usuario.tipo !== expected) return Conecta.redirectByUser(session.usuario);
      document.getElementById('welcome-name').textContent = session.usuario.nomeEmpresa || session.usuario.nome.split(' ')[0];
      document.getElementById('user-name').textContent = session.usuario.nomeEmpresa || session.usuario.nome;
      if (page === 'empresa') await loadCompany();
      else await loadCandidate();
    } catch (error) {
      Conecta.toast(error.message);
    }
  }

  async function loadCandidate() {
    const container = document.getElementById('candidate-applications');
    const [data, session] = await Promise.all([
      Conecta.api('/api/painel/candidato'),
      Conecta.api('/api/me')
    ]);
    const applications = data.candidaturas || [];
    const active = applications.filter(item => ['recebida', 'em_analise'].includes(item.status)).length;
    const interviews = applications.filter(item => item.status === 'entrevista').length;
    document.getElementById('candidate-total').textContent = applications.length;
    document.getElementById('candidate-active').textContent = active;
    document.getElementById('candidate-interviews').textContent = interviews;
    const user = session.usuario || {};
    document.getElementById('candidate-profile-name').textContent = user.nome || '—';
    document.getElementById('candidate-profile-email').textContent = user.email || '—';
    document.getElementById('candidate-profile-phone').textContent = user.telefone || 'Não informado';
    document.getElementById('candidate-profile-city').textContent = user.cidade || '—';
    if (!applications.length) {
      container.innerHTML = '<div class="dashboard-empty">Você ainda não se candidatou a nenhuma vaga. <a class="text-link" href="vagas.html">Explore as oportunidades disponíveis.</a></div>';
      return;
    }
    container.innerHTML = applications.map(item => `<article class="dashboard-item"><div><h3>${escapeHTML(item.titulo)}</h3><p>${escapeHTML(item.nome_empresa || 'Empresa')} · ${escapeHTML(item.cidade)}</p><p>Candidatura enviada em ${dateLabel(item.criada_em)}</p></div><div class="dashboard-item-actions"><span class="status-label">${statusText(item.status)}</span></div></article>`).join('');
  }

  async function loadCompany() {
    const data = await Conecta.api('/api/painel/empresa');
    const jobs = document.getElementById('company-jobs');
    const applications = document.getElementById('company-applications');
    jobs.innerHTML = data.vagas.length ? data.vagas.map(job => `<article class="dashboard-item"><div><h3>${escapeHTML(job.titulo)}</h3><p>${escapeHTML(job.cidade)} · ${escapeHTML(job.tipo_contrato)} · Publicada em ${dateLabel(job.criado_em)}</p><span class="status-label">${statusText(job.status)}</span></div><div class="dashboard-item-actions"><select aria-label="Status da vaga" data-job-status="${job.id}"><option value="aberta" ${job.status === 'aberta' ? 'selected' : ''}>Aberta</option><option value="pausada" ${job.status === 'pausada' ? 'selected' : ''}>Pausada</option><option value="encerrada" ${job.status === 'encerrada' ? 'selected' : ''}>Encerrada</option></select></div></article>`).join('') : '<div class="dashboard-empty">Você ainda não publicou nenhuma vaga.</div>';
    jobs.querySelectorAll('[data-job-status]').forEach(select => select.addEventListener('change', async () => {
      try {
        await Conecta.api('/api/vagas/' + select.dataset.jobStatus + '/status', { method: 'PATCH', body: JSON.stringify({ status: select.value }) });
        Conecta.toast('Status da vaga atualizado.');
        await loadCompany();
      } catch (error) { Conecta.toast(error.message); }
    }));
    applications.innerHTML = data.candidaturas.length ? data.candidaturas.map(item => `<article class="dashboard-item"><div><h3>${escapeHTML(item.candidato_nome)}</h3><p>${escapeHTML(item.candidato_email)} · ${escapeHTML(item.telefone || 'Sem telefone')}</p><p>Vaga: ${escapeHTML(item.vaga_titulo)} · ${dateLabel(item.criada_em)}</p>${item.mensagem ? '<div class="candidate-message">' + escapeHTML(item.mensagem) + '</div>' : ''}</div><div class="dashboard-item-actions"><select aria-label="Atualizar situação da candidatura" data-application-status="${item.id}"><option value="recebida" ${item.status === 'recebida' ? 'selected' : ''}>Recebida</option><option value="em_analise" ${item.status === 'em_analise' ? 'selected' : ''}>Em análise</option><option value="entrevista" ${item.status === 'entrevista' ? 'selected' : ''}>Entrevista</option><option value="aprovada" ${item.status === 'aprovada' ? 'selected' : ''}>Aprovada</option><option value="rejeitada" ${item.status === 'rejeitada' ? 'selected' : ''}>Não aprovada</option></select></div></article>`).join('') : '<div class="dashboard-empty">Ainda não há candidaturas para suas vagas.</div>';
    applications.querySelectorAll('[data-application-status]').forEach(select => select.addEventListener('change', async () => {
      try {
        await Conecta.api('/api/candidaturas/' + select.dataset.applicationStatus + '/status', { method: 'PATCH', body: JSON.stringify({ status: select.value }) });
        Conecta.toast('Candidatura atualizada.');
      } catch (error) { Conecta.toast(error.message); }
    }));
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('job-form');
    if (form) form.addEventListener('submit', async event => {
      event.preventDefault();
      const feedback = document.getElementById('job-feedback');
      feedback.textContent = '';
      if (!form.reportValidity()) return;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Publicando...';
      try {
        await Conecta.api('/api/vagas', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
        feedback.textContent = 'Vaga publicada com sucesso.';
        feedback.classList.add('success');
        form.reset();
        form.elements.cidade.value = 'Capelinha';
        await loadCompany();
      } catch (error) {
        feedback.textContent = error.message;
      } finally {
        button.disabled = false;
        button.textContent = 'Publicar vaga';
      }
    });
    const fontButtons = [...document.querySelectorAll('[data-font-size]')];
    const savedFontSize = localStorage.getItem('conecta-font-size') || 'normal';
    const applyFontSize = size => {
      document.body.dataset.fontSize = size;
      fontButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.fontSize === size)));
      localStorage.setItem('conecta-font-size', size);
    };
    if (fontButtons.length) {
      applyFontSize(['normal', 'large', 'larger'].includes(savedFontSize) ? savedFontSize : 'normal');
      fontButtons.forEach(button => button.addEventListener('click', () => applyFontSize(button.dataset.fontSize)));
    }
    initPanel();
  });
})();