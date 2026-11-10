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
      const welcomeName = document.getElementById('welcome-name');
      if (welcomeName) welcomeName.textContent = session.usuario.nomeEmpresa || session.usuario.nome.split(' ')[0];
      const userName = document.getElementById('user-name');
      if (userName) userName.textContent = session.usuario.nomeEmpresa || session.usuario.nome;
      if (page === 'empresa') await loadCompany();
      else await loadCandidate();
    } catch (error) {
      Conecta.toast(error.message);
    }
  }

  async function loadCandidate() {
    const container = document.getElementById('candidate-applications');
    const [data, profileData] = await Promise.all([
      Conecta.api('/api/painel/candidato'),
      Conecta.api('/api/perfil')
    ]);
    const applications = data.candidaturas || [];
    const active = applications.filter(item => ['recebida', 'em_analise'].includes(item.status)).length;
    const interviews = applications.filter(item => item.status === 'entrevista').length;
    document.getElementById('candidate-total').textContent = applications.length;
    document.getElementById('candidate-active').textContent = active;
    document.getElementById('candidate-interviews').textContent = interviews;
    renderCandidateProfile(profileData.perfil || {});
    if (!applications.length) {
      container.innerHTML = '<div class="dashboard-empty">Você ainda não se candidatou a nenhuma vaga. <a class="text-link" href="vagas.html">Explore as oportunidades disponíveis.</a></div>';
    } else {
      container.innerHTML = applications.map(item => `<article class="dashboard-item"><div><h3>${escapeHTML(item.titulo)}</h3><p>${escapeHTML(item.nome_empresa || 'Empresa')} · ${escapeHTML(item.cidade)}</p><p>Candidatura enviada em ${dateLabel(item.criada_em)}</p></div><div class="dashboard-item-actions"><span class="status-label">${statusText(item.status)}</span></div></article>`).join('');
    }
  }

  let candidatePhotoData = null;
  let candidateProfileCache = {};
  const candidateInitials = name => String(name || 'CT').trim().split(/\\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'CT';
  const setCandidateImage = (image, initials, photo, name) => {
    initials.textContent = candidateInitials(name);
    if (photo) { image.src = photo; image.hidden = false; initials.hidden = true; }
    else { image.removeAttribute('src'); image.hidden = true; initials.hidden = false; }
  };
  function renderCandidateProfile(profile) {
    candidateProfileCache = profile;
    const name = profile.nome || 'Seu nome';
    document.getElementById('candidate-profile-name').textContent = name;
    document.getElementById('candidate-profile-title').textContent = profile.titulo_profissional || 'Adicione seu título profissional';
    document.getElementById('candidate-profile-location').textContent = profile.cidade || 'Cidade não informada';
    document.getElementById('candidate-profile-email').textContent = profile.email || '—';
    document.getElementById('candidate-profile-phone').textContent = profile.telefone || 'Telefone não informado';
    document.getElementById('candidate-profile-summary').textContent = profile.resumo_profissional || 'Conte um pouco sobre sua trajetória, seus conhecimentos e seus pontos fortes.';
    document.getElementById('candidate-profile-objective').textContent = profile.objetivo_profissional || 'Adicione seus objetivos profissionais.';
    document.getElementById('candidate-profile-opportunity').textContent = profile.tipo_oportunidade || 'Tipo de oportunidade não informado';
    document.getElementById('candidate-profile-modality').textContent = profile.modalidade_preferida || 'Modalidade não informada';
    document.getElementById('candidate-profile-experience').textContent = profile.experiencias || 'Adicione suas experiências profissionais.';
    document.getElementById('candidate-profile-education').textContent = profile.formacao || 'Adicione sua formação e cursos.';
    document.getElementById('candidate-profile-skills').textContent = profile.competencias || 'Adicione suas habilidades e conhecimentos.';
    const cv = document.getElementById('candidate-profile-cv');
    cv.hidden = !profile.curriculo_url;
    cv.href = profile.curriculo_url || '#';
    document.getElementById('candidate-profile-no-cv').hidden = Boolean(profile.curriculo_url);
    setCandidateImage(document.getElementById('candidate-profile-avatar'), document.getElementById('candidate-profile-initials'), profile.foto_perfil, name);
    setCandidateImage(document.getElementById('candidate-menu-avatar'), document.getElementById('candidate-menu-initials'), profile.foto_perfil, name);
    const values = {
      'candidate-edit-name': name, 'candidate-edit-email': profile.email || '',
      'candidate-edit-phone': profile.telefone || '', 'candidate-edit-city': profile.cidade || '',
      'candidate-edit-title-input': profile.titulo_profissional || '',
      'candidate-edit-summary': profile.resumo_profissional || '',
      'candidate-edit-objective': profile.objetivo_profissional || '',
      'candidate-edit-opportunity': profile.tipo_oportunidade || '',
      'candidate-edit-modality': profile.modalidade_preferida || '',
      'candidate-edit-experience': profile.experiencias || '',
      'candidate-edit-education': profile.formacao || '',
      'candidate-edit-skills': profile.competencias || '',
      'candidate-edit-cv': profile.curriculo_url || ''
    };
    Object.entries(values).forEach(([id, value]) => { document.getElementById(id).value = value; });
    const preview = document.getElementById('candidate-photo-preview');
    const placeholder = document.getElementById('candidate-photo-placeholder');
    if (candidatePhotoData === null) {
      if (profile.foto_perfil) { preview.src = profile.foto_perfil; preview.hidden = false; placeholder.hidden = true; }
      else { preview.removeAttribute('src'); preview.hidden = true; placeholder.hidden = false; }
    }
  }

  function setupCandidateProfileEditor() {
    const modal = document.getElementById('candidate-edit-modal');
    const form = document.getElementById('candidate-profile-form');
    if (!modal || !form) return;
    const open = () => { candidatePhotoData = null; renderCandidateProfile(candidateProfileCache); modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); document.body.classList.add('candidate-edit-open'); };
    const close = () => { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('candidate-edit-open'); };
    ['candidate-edit-profile', 'candidate-edit-profile-side'].forEach(id => document.getElementById(id)?.addEventListener('click', open));
    ['candidate-edit-close', 'candidate-edit-cancel'].forEach(id => document.getElementById(id)?.addEventListener('click', close));
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    document.getElementById('candidate-photo-input').addEventListener('change', event => {
      const file = event.target.files[0];
      if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1.5 * 1024 * 1024) {
        Conecta.toast('Escolha uma imagem JPG, PNG ou WebP de até 1,5 MB.');
        event.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        candidatePhotoData = reader.result;
        document.getElementById('candidate-photo-preview').src = candidatePhotoData;
        document.getElementById('candidate-photo-preview').hidden = false;
        document.getElementById('candidate-photo-placeholder').hidden = true;
      };
      reader.readAsDataURL(file);
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const feedback = document.getElementById('candidate-edit-feedback');
      button.disabled = true;
      button.textContent = 'Salvando...';
      feedback.textContent = '';
      const payload = Object.fromEntries(new FormData(form));
      delete payload.nome;
      delete payload.email;
      if (candidatePhotoData !== null) payload.foto_perfil = candidatePhotoData;
      try {
        await Conecta.api('/api/perfil', { method: 'PUT', body: JSON.stringify(payload) });
        candidatePhotoData = null;
        await loadCandidate();
        close();
        Conecta.toast('Perfil atualizado com sucesso.');
      } catch (error) {
        feedback.textContent = error.message || 'Não foi possível salvar as alterações.';
      } finally {
        button.disabled = false;
        button.textContent = 'Salvar alterações';
      }
    });
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
    setupCandidateProfileEditor();
    initPanel();
  });
})();