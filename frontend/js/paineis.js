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

  function showImageGuidelines(type, onChoose) {
    const isBanner = type === 'banner';
    const title = isBanner ? 'Requisitos do banner' : 'Requisitos da foto de perfil';
    const eyebrow = isBanner ? 'IMAGEM DE CAPA' : 'FOTO DE PERFIL';
    const dimension = isBanner ? '1600 × 600 pixels (proporção 8:3)' : '600 × 600 pixels (formato quadrado)';
    const note = isBanner
      ? 'A imagem será ajustada automaticamente para se adaptar à área do banner. Para um melhor resultado, use uma imagem horizontal.'
      : 'A imagem será ajustada automaticamente para se adaptar ao espaço circular ou quadrado do perfil. Para um melhor resultado, use uma imagem quadrada, com o rosto ou logotipo centralizado.';
    let modal = document.getElementById('banner-guidelines-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'banner-guidelines-modal';
      modal.className = 'banner-guidelines-backdrop';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <section class="banner-guidelines-dialog" role="dialog" aria-modal="true" aria-labelledby="banner-guidelines-title">
          <button type="button" class="banner-guidelines-close" data-banner-guidelines-close aria-label="Fechar">×</button>
          <span class="banner-guidelines-eyebrow" data-guidelines-eyebrow></span>
          <h2 id="banner-guidelines-title" data-guidelines-title></h2>
          <p>Para garantir uma boa apresentação do seu perfil, escolha uma imagem com estas características:</p>
          <div class="banner-guidelines-list">
            <div><i class="fa-regular fa-image" aria-hidden="true"></i><span><strong>Formatos permitidos</strong><small>PNG, JPG/JPEG ou WEBP</small></span></div>
            <div><i class="fa-solid fa-expand" aria-hidden="true"></i><span><strong>Dimensão recomendada</strong><small data-guidelines-dimension></small></span></div>
            <div><i class="fa-solid fa-file-arrow-up" aria-hidden="true"></i><span><strong>Tamanho máximo</strong><small>5 MB por imagem</small></span></div>
          </div>
          <p class="banner-guidelines-note" data-guidelines-note></p>
          <div class="banner-guidelines-actions">
            <button type="button" class="button button-outline" data-banner-guidelines-close>Cancelar</button>
            <button type="button" class="button button-primary" data-banner-guidelines-choose>Escolher imagem</button>
          </div>
        </section>`;
      document.body.appendChild(modal);
      const close = () => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('banner-guidelines-open');
      };
      modal.querySelectorAll('[data-banner-guidelines-close]').forEach(button => button.addEventListener('click', close));
      modal.addEventListener('click', event => { if (event.target === modal) close(); });
      modal.querySelector('[data-banner-guidelines-choose]').addEventListener('click', () => {
        close();
        if (typeof modal._onChoose === 'function') modal._onChoose();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && modal.classList.contains('is-open')) close();
      });
    }
    modal.querySelector('[data-guidelines-eyebrow]').textContent = eyebrow;
    modal.querySelector('[data-guidelines-title]').textContent = title;
    modal.querySelector('[data-guidelines-dimension]').textContent = dimension;
    modal.querySelector('[data-guidelines-note]').textContent = note;
    modal._onChoose = onChoose;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('banner-guidelines-open');
    modal.querySelector('[data-banner-guidelines-choose]').focus();
  }

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
      if (userName) {
        userName.textContent = session.usuario.tipo === 'empresa' ? '' : session.usuario.nome;
        userName.hidden = session.usuario.tipo === 'empresa';
      }
      if (page === 'empresa') { await loadCompanyProfile(); await loadCompany(); }
      else await loadCandidate();
    } catch (error) {
      Conecta.toast(error.message);
    }
  }

  async function migrateLegacySavedJobs() {
    const key = 'conecta-vagas-salvas';
    try {
      const legacy = JSON.parse(localStorage.getItem(key) || '[]');
      const ids = Array.isArray(legacy) ? [...new Set(legacy.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))] : [];
      if (!ids.length) return;
      await Conecta.api('/api/vagas-salvas/importar', {
        method: 'POST',
        body: JSON.stringify({ ids })
      });
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Não foi possível sincronizar as vagas salvas antigas:', error.message);
    }
  }

  async function loadSavedJobs() {
    const container = document.getElementById('candidate-saved-jobs');
    if (!container) return;
    try {
      const data = await Conecta.api('/api/vagas-salvas');
      const jobs = data.vagas || [];
      if (!jobs.length) {
        container.innerHTML = '<div class="dashboard-empty">Você ainda não salvou nenhuma vaga. <a class="text-link" href="vagas.html">Explore as oportunidades disponíveis</a> e guarde as que deseja consultar depois.</div>';
        return;
      }
      container.innerHTML = jobs.map(item => {
        const isOpen = item.status === 'aberta';
        const details = isOpen
          ? '<a class="button button-outline button-small" href="vaga-detalhes.html?id=' + encodeURIComponent(item.id) + '">Ver vaga</a>'
          : '<span class="status-label">' + escapeHTML(statusText(item.status)) + '</span>';
        return '<article class="dashboard-item"><div><h3>' + escapeHTML(item.titulo) + '</h3><p>' +
          escapeHTML(item.nome_empresa || 'Empresa') + ' · ' + escapeHTML(item.cidade || 'Local não informado') +
          '</p><p>Salva em ' + escapeHTML(dateLabel(item.salva_em)) + '</p></div><div class="dashboard-item-actions">' +
          details + '<button type="button" class="button button-outline button-small" data-remove-saved="' +
          escapeHTML(item.id) + '">Remover</button></div></article>';
      }).join('');
      container.querySelectorAll('[data-remove-saved]').forEach(button => {
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            await Conecta.api('/api/vagas/' + encodeURIComponent(button.dataset.removeSaved) + '/salvar', { method: 'DELETE' });
            Conecta.toast('Vaga removida dos itens salvos.');
            await loadSavedJobs();
          } catch (error) {
            Conecta.toast(error.message);
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      container.innerHTML = '<div class="dashboard-empty">' + escapeHTML(error.message) + '</div>';
    }
  }

  async function loadFollowedCompanies() {
    const container = document.getElementById('candidate-followed-companies');
    if (!container) return;
    try {
      const data = await Conecta.api('/api/empresas-seguidas');
      const companies = data.empresas || [];
      if (!companies.length) {
        container.innerHTML = '<div class="dashboard-empty">Você ainda não segue nenhuma empresa. Visite os perfis empresariais e selecione Seguir para acompanhá-los.</div>';
        return;
      }
      container.innerHTML = companies.map(company => {
        const name = company.nome_empresa || company.nome_fantasia || 'Empresa';
        const logo = company.foto_perfil
          ? '<img class="followed-company-logo" src="' + escapeHTML(company.foto_perfil) + '" alt="" loading="lazy">'
          : '<span class="followed-company-logo followed-company-initials" aria-hidden="true">' + escapeHTML(name.trim().slice(0, 2).toUpperCase()) + '</span>';
        const description = company.empresa_descricao_curta || company.empresa_setor || company.cidade || 'Perfil empresarial';
        return '<article class="dashboard-item followed-company-item"><div class="followed-company-identity">' + logo + '<div><h3>' + escapeHTML(name) + '</h3><p>' + escapeHTML(description) + '</p><small>' + Number(company.total_seguidores || 0).toLocaleString('pt-BR') + ' seguidores · ' + Number(company.vagas_abertas || 0).toLocaleString('pt-BR') + ' vagas abertas</small></div></div><div class="dashboard-item-actions"><a class="button button-outline button-small" href="empresa-perfil.html?id=' + encodeURIComponent(company.id) + '">Ver perfil</a><button type="button" class="button button-outline button-small" data-unfollow-company="' + escapeHTML(company.id) + '">Deixar de seguir</button></div></article>';
      }).join('');
      container.querySelectorAll('[data-unfollow-company]').forEach(button => button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await Conecta.api('/api/empresas/' + encodeURIComponent(button.dataset.unfollowCompany) + '/seguir', { method: 'DELETE' });
          await loadFollowedCompanies();
        } catch (error) { Conecta.toast(error.message); button.disabled = false; }
      }));
    } catch (error) {
      container.innerHTML = '<div class="dashboard-empty">' + escapeHTML(error.message) + '</div>';
    }
  }

  async function loadCompanyNotifications() {
    const container = document.getElementById('candidate-company-notifications');
    if (!container) return;
    try {
      const data = await Conecta.api('/api/notificacoes-empresas');
      const notifications = data.notificacoes || [];
      if (!notifications.length) {
        container.innerHTML = '<div class="dashboard-empty">Ainda não há novas vagas das empresas que você segue.</div>';
        return;
      }
      container.innerHTML = notifications.map(item => {
        const companyName = item.nome_empresa || item.nome_fantasia || 'Empresa';
        const readAction = item.lida_em
          ? '<span class="status-label">Lida</span>'
          : '<button type="button" class="button button-outline button-small" data-read-company-notification="' + escapeHTML(item.id) + '">Marcar como lida</button>';
        return '<article class="dashboard-item company-notification-item ' + (item.lida_em ? 'is-read' : 'is-unread') + '"><div><h3>' + escapeHTML(item.vaga_titulo) + '</h3><p>' + escapeHTML(companyName) + ' publicou uma nova vaga.</p><small>' + escapeHTML(dateLabel(item.criada_em)) + '</small></div><div class="dashboard-item-actions"><a class="button button-primary button-small" href="vaga-detalhes.html?id=' + encodeURIComponent(item.vaga_id) + '">Ver vaga</a>' + readAction + '</div></article>';
      }).join('');
      container.querySelectorAll('[data-read-company-notification]').forEach(button => button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await Conecta.api('/api/notificacoes-empresas/' + encodeURIComponent(button.dataset.readCompanyNotification) + '/lida', { method: 'PATCH' });
          await loadCompanyNotifications();
        } catch (error) { Conecta.toast(error.message); button.disabled = false; }
      }));
    } catch (error) {
      container.innerHTML = '<div class="dashboard-empty">' + escapeHTML(error.message) + '</div>';
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
    const publicProfileToggle = document.getElementById('candidate-public-profile-toggle');
    if (publicProfileToggle) {
      publicProfileToggle.checked = Boolean(profileData.perfil?.perfil_publico);
      updatePublicProfileStatus(publicProfileToggle.checked);
    }
    await migrateLegacySavedJobs();
    await loadSavedJobs();
    await loadFollowedCompanies();
    const photoVisibility = profileData.perfil?.visibilidade_foto || 'todos';
    const visibilityLabel = document.getElementById('candidate-photo-visibility-label');
    const visibilityNames = { conexoes: 'Conexões', rede: 'Sua rede', usuarios: 'Todos os usuários', todos: 'Todos' };
    if (visibilityLabel) visibilityLabel.textContent = visibilityNames[photoVisibility] || 'Todos';
    document.querySelectorAll('input[name="candidate-photo-visibility-choice"]').forEach(input => { input.checked = input.value === photoVisibility; });
    if (!applications.length) {
      container.innerHTML = '<div class="dashboard-empty">Você ainda não se candidatou a nenhuma vaga. <a class="text-link" href="vagas.html">Explore as oportunidades disponíveis.</a></div>';
    } else {
      container.innerHTML = applications.map(item => {
        const answers = Array.isArray(item.respostas) ? item.respostas : [];
        const answerSummary = answers.length ? '<p>' + answers.length + ' pergunta(s) respondida(s)</p>' : '';
        return '<article class="dashboard-item"><div><h3>' + escapeHTML(item.titulo) + '</h3><p>' + escapeHTML(item.nome_empresa || 'Empresa') + ' · ' + escapeHTML(item.cidade) + '</p><p>Candidatura enviada em ' + dateLabel(item.criada_em) + '</p>' + answerSummary + '</div><div class="dashboard-item-actions"><span class="status-label">' + statusText(item.status) + '</span></div></article>';
      }).join('');
    }
  }

  let candidatePhotoData = null;
  let candidateProfileCache = {};

  async function prepareCandidateImage(file, maxDimension) {
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Formato não permitido. Escolha PNG, JPG/JPEG ou WEBP.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Escolha uma imagem de até 5 MB.');
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      bitmap = await new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);
        image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
        image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Este formato de imagem não é compatível com o navegador.')); };
        image.src = objectUrl;
      });
    }
    const width = bitmap.width || bitmap.naturalWidth;
    const height = bitmap.height || bitmap.naturalHeight;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    let quality = 0.9;
    let converted = canvas.toDataURL('image/jpeg', quality);
    while (converted.length > 1400000 && quality > 0.45) {
      quality -= 0.1;
      converted = canvas.toDataURL('image/jpeg', quality);
    }
    if (converted.length > 1400000) throw new Error('Não foi possível reduzir essa imagem para o tamanho permitido.');
    return converted;
  }

  async function saveCandidateImage(field, imageData) {
    await Conecta.api('/api/perfil/imagem', {
      method: 'PUT',
      body: JSON.stringify({ campo: field, imagem: imageData })
    });
    await loadCandidate();
    Conecta.toast(field === 'foto_perfil' ? 'Foto de perfil atualizada.' : 'Banner atualizado.');
  }
  const candidateInitials = name => String(name || 'CT').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'CT';
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
    const cover = document.getElementById('candidate-cover');
    cover.style.backgroundImage = profile.banner_perfil ? `url(\"${profile.banner_perfil}\")` : '';
    cover.classList.toggle('has-image', Boolean(profile.banner_perfil));
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

  function updatePublicProfileStatus(isPublic) {
    const status = document.getElementById('candidate-public-profile-status');
    if (status) status.textContent = isPublic
      ? 'Seu perfil pode aparecer nas pesquisas de pessoas e empresas.'
      : 'Seu perfil não aparece nas pesquisas.';
  }

  function setupCandidatePrivacySettings() {
    const toggle = document.getElementById('candidate-public-profile-toggle');
    if (!toggle) return;
    toggle.addEventListener('change', async () => {
      const requestedValue = toggle.checked;
      toggle.disabled = true;
      try {
        const result = await Conecta.api('/api/perfil/visibilidade-publica', {
          method: 'PUT',
          body: JSON.stringify({ publico: requestedValue })
        });
        toggle.checked = Boolean(result.perfil_publico);
        updatePublicProfileStatus(toggle.checked);
        Conecta.toast(toggle.checked ? 'Seu perfil agora está público nas pesquisas.' : 'Seu perfil não aparece mais nas pesquisas.');
      } catch (error) {
        toggle.checked = !requestedValue;
        updatePublicProfileStatus(toggle.checked);
        Conecta.toast(error.message || 'Não foi possível salvar a configuração.');
      } finally {
        toggle.disabled = false;
      }
    });
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
    document.getElementById('candidate-photo-input').addEventListener('change', async event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        candidatePhotoData = await prepareCandidateImage(file, 600);
        const preview = document.getElementById('candidate-photo-preview');
        preview.src = candidatePhotoData;
        preview.hidden = false;
        document.getElementById('candidate-photo-placeholder').hidden = true;
      } catch (error) {
        Conecta.toast(error.message || 'Não foi possível processar essa imagem.');
        event.target.value = '';
      }
    });

    const quickPhotoInput = document.getElementById('candidate-quick-photo-input');
    const quickCoverInput = document.getElementById('candidate-quick-cover-input');
    const photoViewer = document.getElementById('candidate-photo-viewer');
    const photoViewerImage = document.getElementById('candidate-photo-viewer-image');
    const openPhotoViewer = () => {
      const photo = candidateProfileCache.foto_perfil;
      if (!photo) return quickPhotoInput.click();
      photoViewerImage.src = photo;
      photoViewer.classList.add('is-open');
      photoViewer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('candidate-photo-viewer-open');
    };
    const closePhotoViewer = () => {
      photoViewer.classList.remove('is-open');
      photoViewer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('candidate-photo-viewer-open');
    };
    document.getElementById('candidate-change-photo').addEventListener('click', () => {
      if (!candidateProfileCache.foto_perfil) return showImageGuidelines('profile', () => quickPhotoInput.click());
      openPhotoViewer();
    });
    document.getElementById('candidate-profile-avatar').addEventListener('click', openPhotoViewer);
    document.getElementById('candidate-profile-initials').addEventListener('click', openPhotoViewer);
    document.getElementById('candidate-photo-viewer-close').addEventListener('click', closePhotoViewer);
    const visibilityButton = document.getElementById('candidate-photo-visibility');
    const visibilityPopover = document.getElementById('candidate-photo-visibility-popover');
    const visibilityLabel = document.getElementById('candidate-photo-visibility-label');
    const visibilityFeedback = document.getElementById('candidate-photo-visibility-feedback');
    const visibilitySave = document.getElementById('candidate-photo-visibility-save');
    const visibilityNames = {
      conexoes: 'Somente conexões de 1° grau (em breve)',
      rede: 'Sua rede (em breve)',
      usuarios: 'Todos os usuários',
      todos: 'Todos'
    };
    let savedPhotoVisibility = 'todos';
    let selectedPhotoVisibility = 'todos';
    const setVisibilityPopover = open => {
      visibilityPopover.hidden = !open;
      visibilityButton.setAttribute('aria-expanded', String(open));
      visibilityFeedback.textContent = '';
      if (open) {
        const checked = visibilityPopover.querySelector('input[name="candidate-photo-visibility-choice"]:checked');
        if (checked) selectedPhotoVisibility = checked.value;
      }
    };
    if (visibilityButton && visibilityPopover) {
      visibilityButton.addEventListener('click', () => setVisibilityPopover(visibilityPopover.hidden));
      visibilityPopover.querySelectorAll('input[name="candidate-photo-visibility-choice"]').forEach(input => {
        input.addEventListener('change', () => { selectedPhotoVisibility = input.value; });
      });
      document.addEventListener('click', event => {
        if (!visibilityPopover.hidden && !event.target.closest('.candidate-photo-visibility-wrap')) setVisibilityPopover(false);
      });
      visibilitySave.addEventListener('click', async () => {
        if (selectedPhotoVisibility === 'conexoes' || selectedPhotoVisibility === 'rede') {
          visibilityFeedback.textContent = 'Essa opção ficará disponível quando o sistema de conexões estiver pronto.';
          return;
        }
        visibilitySave.disabled = true;
        visibilityFeedback.textContent = '';
        try {
          await Conecta.api('/api/perfil/visibilidade-foto', {
            method: 'PUT',
            body: JSON.stringify({ visibilidade: selectedPhotoVisibility })
          });
          savedPhotoVisibility = selectedPhotoVisibility;
          visibilityLabel.textContent = visibilityNames[savedPhotoVisibility] === 'Somente conexões de 1° grau' ? 'Conexões' : visibilityNames[savedPhotoVisibility];
          setVisibilityPopover(false);
        } catch (error) {
          visibilityFeedback.textContent = error.message || 'Não foi possível salvar a visibilidade.';
          selectedPhotoVisibility = savedPhotoVisibility;
          const selected = visibilityPopover.querySelector('input[value="' + savedPhotoVisibility + '"]');
          if (selected) selected.checked = true;
        } finally {
          visibilitySave.disabled = false;
        }
      });
    }

    photoViewer.addEventListener('click', event => { if (event.target === photoViewer) closePhotoViewer(); });
    const imageEditor = document.getElementById('candidate-image-editor');
    const editorCanvas = document.getElementById('candidate-image-editor-canvas');
    const editorContext = editorCanvas.getContext('2d');
    const editorInput = document.getElementById('candidate-image-editor-input');
    const editorState = { image: null, previewSource: '', angle: 0, zoom: 1, flipX: 1, flipY: 1, filter: 'none', brightness: 100, contrast: 100, saturation: 100, vignette: 0 };
    function updateImageFilterPreviews() {
      if (!editorState.image) return;
      const source = editorState.previewSource || editorState.image.currentSrc || editorState.image.src;
      if (!source) return;
      document.querySelectorAll('[data-image-filter]').forEach(button => {
        const preview = button.querySelector('.candidate-filter-preview');
        if (!preview) return;
        preview.src = source;
        preview.style.filter = button.dataset.imageFilter === 'none' ? 'none' : button.dataset.imageFilter;
      });
    }
    function renderImageEditor() {
      const image = editorState.image;
      if (!image) return;
      updateImageFilterPreviews();
      const size = editorCanvas.width;
      const radians = editorState.angle * Math.PI / 180;
      const cos = Math.abs(Math.cos(radians));
      const sin = Math.abs(Math.sin(radians));
      const rotatedWidth = image.width * cos + image.height * sin;
      const rotatedHeight = image.width * sin + image.height * cos;
      const scale = Math.max(size / rotatedWidth, size / rotatedHeight) * editorState.zoom;
      editorContext.clearRect(0, 0, size, size);
      editorContext.save();
      editorContext.translate(size / 2, size / 2);
      editorContext.rotate(radians);
      editorContext.scale(editorState.flipX * scale, editorState.flipY * scale);
      const brightnessEffect = Math.max(0, 100 + (editorState.brightness - 100) * 1.8);
      const contrastEffect = Math.max(0, 100 + (editorState.contrast - 100) * 1.8);
      const saturationEffect = Math.max(0, 100 + (editorState.saturation - 100) * 1.8);
      editorContext.filter = `brightness(${brightnessEffect}%) contrast(${contrastEffect}%) saturate(${saturationEffect}%) ${editorState.filter}`;
      editorContext.drawImage(image, -image.width / 2, -image.height / 2, image.width, image.height);
      editorContext.restore();
      if (editorState.vignette > 0) {
        const gradient = editorContext.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.72);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${Math.min(0.95, editorState.vignette / 100 * 1.25)})`);
        editorContext.save(); editorContext.fillStyle = gradient; editorContext.fillRect(0, 0, size, size); editorContext.restore();
      }
    }
    function openImageEditor() {
      const current = candidateProfileCache.foto_perfil;
      if (!current) return editorInput.click();
      const image = new Image();
      image.onload = () => {
        editorState.image = image;
        editorState.angle = 0; editorState.zoom = 1; editorState.flipX = 1; editorState.flipY = 1; editorState.filter = 'none';
        editorState.brightness = 100; editorState.contrast = 100; editorState.saturation = 100; editorState.vignette = 0;
        ['brightness','contrast','saturation'].forEach(key => { document.getElementById(`candidate-image-${key}`).value = '100'; document.getElementById(`candidate-image-${key}-value`).textContent = '100%'; });
        document.getElementById('candidate-image-vignette').value = '0';
        document.getElementById('candidate-image-vignette-value').textContent = '0%';
        document.getElementById('candidate-image-zoom').value = '1';
        document.getElementById('candidate-image-angle').value = '0';
        document.querySelectorAll('[data-image-filter]').forEach(button => button.classList.toggle('active', button.dataset.imageFilter === 'none'));
        renderImageEditor();
        imageEditor.classList.add('is-open');
        imageEditor.setAttribute('aria-hidden', 'false');
        document.body.classList.add('candidate-image-editor-open');
      };
      image.onerror = () => Conecta.toast('Não foi possível abrir esta foto para edição.');
      image.src = current;
    }
    function openCompanyImageEditorFromImage(image) {
      editorState.image = image;
      editorState.angle = 0; editorState.zoom = 1; editorState.flipX = 1; editorState.flipY = 1; editorState.filter = 'none';
      editorState.brightness = 100; editorState.contrast = 100; editorState.saturation = 100; editorState.vignette = 0;
      ['brightness','contrast','saturation'].forEach(key => { document.getElementById(`company-image-${key}`).value = '100'; document.getElementById(`company-image-${key}-value`).textContent = '100%'; });
      document.getElementById('company-image-vignette').value = '0';
      document.getElementById('company-image-vignette-value').textContent = '0%';
      document.getElementById('company-image-zoom').value = '1';
      document.getElementById('company-image-angle').value = '0';
      document.querySelectorAll('[data-image-filter]').forEach(button => button.classList.toggle('active', button.dataset.imageFilter === 'none'));
      renderImageEditor();
      imageEditor.classList.add('is-open');
      imageEditor.setAttribute('aria-hidden', 'false');
      document.body.classList.add('candidate-image-editor-open');
    }
    function closeImageEditor() {
      imageEditor.classList.remove('is-open');
      imageEditor.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('candidate-image-editor-open');
      editorState.image?.close?.();
      editorState.image = null;
      editorState.previewSource = '';
      editorContext.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
    }
    document.getElementById('candidate-photo-edit').addEventListener('click', () => {
      closePhotoViewer();
      openImageEditor();
    });
    document.getElementById('candidate-image-editor-close').addEventListener('click', closeImageEditor);
    imageEditor.addEventListener('click', event => { if (event.target === imageEditor) closeImageEditor(); });
    document.querySelectorAll('[data-editor-tab]').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('[data-editor-tab]').forEach(item => item.classList.toggle('active', item === tab));
      document.querySelectorAll('[data-editor-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.editorPanel === tab.dataset.editorTab));
    }));
    document.getElementById('candidate-image-editor-choose')?.addEventListener('click', () => editorInput.click());
    const openImageInEditor = (image, previewSource = '') => {
      if (editorState.image && editorState.image !== image) editorState.image.close?.();
      editorState.image = image;
      editorState.previewSource = previewSource || image.currentSrc || image.src || '';
      editorState.angle = 0; editorState.zoom = 1; editorState.flipX = 1; editorState.flipY = 1; editorState.filter = 'none';
      editorState.brightness = 100; editorState.contrast = 100; editorState.saturation = 100; editorState.vignette = 0;
      ['brightness','contrast','saturation'].forEach(key => { document.getElementById(`candidate-image-${key}`).value = '100'; document.getElementById(`candidate-image-${key}-value`).textContent = '100%'; });
      document.getElementById('candidate-image-vignette').value = '0';
      document.getElementById('candidate-image-vignette-value').textContent = '0%';
      document.getElementById('candidate-image-zoom').value = '1';
      document.getElementById('candidate-image-angle').value = '0';
      document.querySelectorAll('[data-image-filter]').forEach(button => button.classList.toggle('active', button.dataset.imageFilter === 'none'));
      renderImageEditor();
      imageEditor.classList.add('is-open'); imageEditor.setAttribute('aria-hidden','false'); document.body.classList.add('candidate-image-editor-open');
    };
    const loadImageIntoEditor = async file => {
      if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        Conecta.toast('Formato não permitido. Escolha PNG, JPG/JPEG ou WEBP.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        Conecta.toast('Escolha uma imagem de até 5 MB.');
        return;
      }
      try {
        let image;
        let previewSource = '';
        try {
          image = await createImageBitmap(file);
          const previewCanvas = document.createElement('canvas');
          const previewScale = Math.min(1, 320 / Math.max(image.width, image.height));
          previewCanvas.width = Math.max(1, Math.round(image.width * previewScale));
          previewCanvas.height = Math.max(1, Math.round(image.height * previewScale));
          const previewContext = previewCanvas.getContext('2d');
          if (!previewContext) throw new Error('Não foi possível preparar a pré-visualização.');
          previewContext.drawImage(image, 0, 0, previewCanvas.width, previewCanvas.height);
          previewSource = previewCanvas.toDataURL('image/png');
        } catch (bitmapError) {
          image?.close?.();
          image = await new Promise((resolve, reject) => {
            const element = new Image();
            const objectUrl = URL.createObjectURL(file);
            element.onload = () => {
              URL.revokeObjectURL(objectUrl);
              resolve(element);
            };
            element.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              reject(new Error('O navegador não conseguiu decodificar esse arquivo. Verifique se a imagem PNG/JPG/WEBP não está danificada.'));
            };
            element.src = objectUrl;
          });
          previewSource = image.currentSrc || image.src;
        }
        if (!image || !(image.width || image.naturalWidth) || !(image.height || image.naturalHeight)) {
          image?.close?.();
          throw new Error('A imagem não possui dimensões válidas ou não pôde ser decodificada.');
        }
        openImageInEditor(image, previewSource);
      } catch (error) {
        Conecta.toast(error.message || 'Não foi possível abrir essa imagem. Tente selecionar outro arquivo.');
      }
    };
    editorInput.addEventListener('change', event => {
      editorInput.removeAttribute('capture');
      loadImageIntoEditor(event.target.files[0]);
      event.target.value = '';
    });
    document.getElementById('candidate-image-rotate-left').addEventListener('click', () => { editorState.angle = ((editorState.angle - 90 + 180) % 360 + 360) % 360 - 180; document.getElementById('candidate-image-angle').value = String(editorState.angle); renderImageEditor(); });
    document.getElementById('candidate-image-rotate-right').addEventListener('click', () => { editorState.angle = ((editorState.angle + 90 + 180) % 360 + 360) % 360 - 180; document.getElementById('candidate-image-angle').value = String(editorState.angle); renderImageEditor(); });
    document.getElementById('candidate-image-flip-horizontal').addEventListener('click', () => { editorState.flipX *= -1; renderImageEditor(); });
    document.getElementById('candidate-image-flip-vertical').addEventListener('click', () => { editorState.flipY *= -1; renderImageEditor(); });
    document.getElementById('candidate-image-zoom').addEventListener('input', event => { editorState.zoom = Number(event.target.value); renderImageEditor(); });
    document.getElementById('candidate-image-angle').addEventListener('input', event => { editorState.angle = Number(event.target.value); renderImageEditor(); });
    document.querySelectorAll('[data-image-filter]').forEach(button => button.addEventListener('click', () => {
      editorState.filter = button.dataset.imageFilter === 'none' ? 'none' : button.dataset.imageFilter;
      document.querySelectorAll('[data-image-filter]').forEach(item => item.classList.toggle('active', item === button));
      renderImageEditor();
    }));
    ['brightness','contrast','saturation','vignette'].forEach(key => {
      document.getElementById(`candidate-image-${key}`).addEventListener('input', event => {
        editorState[key] = Number(event.target.value);
        document.getElementById(`candidate-image-${key}-value`).textContent = `${event.target.value}${key === 'vignette' ? '%' : '%'}`;
        renderImageEditor();
      });
    });
    document.getElementById('candidate-image-editor-save').addEventListener('click', async () => {
      const button = document.getElementById('candidate-image-editor-save');
      const feedback = document.getElementById('candidate-image-editor-feedback');
      button.disabled = true; feedback.textContent = 'Salvando...';
      try {
        let quality = 0.9;
        let imageData = editorCanvas.toDataURL('image/jpeg', quality);
        while (imageData.length > 1400000 && quality > 0.45) {
          quality -= 0.1;
          imageData = editorCanvas.toDataURL('image/jpeg', quality);
        }
        if (imageData.length > 1400000) throw new Error('Não foi possível reduzir a imagem para o tamanho permitido.');
        await saveCandidateImage('foto_perfil', imageData);
        closeImageEditor();
        closePhotoViewer();
      } catch (error) {
        feedback.textContent = error.message || 'Não foi possível salvar a imagem.';
      } finally { button.disabled = false; }
    });
    const photoUpdateModal = document.getElementById('candidate-photo-update-modal');
    const photoUpdatePreview = document.getElementById('candidate-photo-update-preview');
    const closePhotoUpdateModal = () => {
      photoUpdateModal.classList.remove('is-open');
      photoUpdateModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('candidate-photo-update-open');
    };
    document.getElementById('candidate-photo-update').addEventListener('click', () => {
      photoUpdatePreview.src = candidateProfileCache.foto_perfil || '';
      document.getElementById('candidate-photo-update-greeting').textContent =
        candidateProfileCache.nome ? candidateProfileCache.nome.split(/\s+/)[0] + '_, ajude outras pessoas a reconhecer você.' : 'Ajude outras pessoas a reconhecer você.';
      closePhotoViewer();
      photoUpdateModal.classList.add('is-open');
      photoUpdateModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('candidate-photo-update-open');
    });
    document.getElementById('candidate-photo-update-close').addEventListener('click', closePhotoUpdateModal);
    photoUpdateModal.addEventListener('click', event => { if (event.target === photoUpdateModal) closePhotoUpdateModal(); });
    const cameraModal = document.getElementById('candidate-camera-modal');
    const cameraVideo = document.getElementById('candidate-camera-video');
    const cameraFeedback = document.getElementById('candidate-camera-feedback');
    let cameraStream = null;
    const stopCandidateCamera = () => {
      if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
      cameraVideo.srcObject = null;
    };
    const closeCandidateCamera = () => {
      stopCandidateCamera();
      cameraModal.classList.remove('is-open');
      cameraModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('candidate-camera-open');
    };
    document.getElementById('candidate-photo-use-camera').addEventListener('click', async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        Conecta.toast('Seu navegador não permite acessar a câmera aqui. Acesse pelo HTTPS ou localhost e tente novamente.');
        return;
      }
      const cameraButton = document.getElementById('candidate-photo-use-camera');
      cameraButton.disabled = true;
      try {
        cameraFeedback.textContent = 'Aguardando autorização para acessar a câmera...';
        cameraStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 960 } }
        });
        cameraVideo.srcObject = cameraStream;
        await cameraVideo.play();
        closePhotoUpdateModal();
        cameraModal.classList.add('is-open');
        cameraModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('candidate-camera-open');
        cameraFeedback.textContent = 'Posicione seu rosto dentro da área da câmera.';
      } catch (error) {
        stopCandidateCamera();
        const message = error && error.name === 'NotAllowedError'
          ? 'Permita o acesso à câmera nas configurações do navegador e tente novamente.'
          : error && error.name === 'NotFoundError'
            ? 'Nenhuma câmera foi encontrada neste dispositivo.'
            : 'Não foi possível iniciar a câmera. Verifique se ela está disponível e tente novamente.';
        Conecta.toast(message);
      } finally {
        cameraButton.disabled = false;
      }
    });
    const cameraTitle = document.getElementById('candidate-camera-title');
    const cameraPreview = document.getElementById('candidate-camera-preview');
    const cameraCountdown = document.getElementById('candidate-camera-countdown');
    const cameraFlash = document.getElementById('candidate-camera-flash');
    const cameraCaptureButton = document.getElementById('candidate-camera-capture');
    const cameraCancelButton = document.getElementById('candidate-camera-cancel');
    const cameraPreviewActions = document.getElementById('candidate-camera-preview-actions');
    let capturedCameraCanvas = null;
    let cameraCountdownTimer = null;
    const resetCameraView = () => {
      if (cameraCountdownTimer) window.clearTimeout(cameraCountdownTimer);
      cameraCountdownTimer = null;
      capturedCameraCanvas = null;
      cameraTitle.textContent = 'Tirar foto';
      cameraVideo.hidden = false;
      cameraPreview.hidden = true;
      cameraPreview.removeAttribute('src');
      cameraCountdown.textContent = '';
      cameraCountdown.classList.remove('is-visible');
      cameraFlash.classList.remove('is-visible');
      cameraCaptureButton.hidden = false;
      cameraCancelButton.hidden = false;
      cameraPreviewActions.hidden = true;
      cameraFeedback.textContent = 'Posicione seu rosto dentro da área da câmera.';
    };
    const closeCameraPreview = () => {
      resetCameraView();
      closeCandidateCamera();
    };
    document.getElementById('candidate-camera-close').addEventListener('click', closeCameraPreview);
    cameraCancelButton.addEventListener('click', closeCameraPreview);
    cameraModal.addEventListener('click', event => { if (event.target === cameraModal) closeCameraPreview(); });
    const captureCameraFrame = () => {
      if (!cameraStream || !cameraVideo.videoWidth || !cameraVideo.videoHeight) {
        cameraFeedback.textContent = 'A câmera ainda está iniciando. Aguarde um instante.';
        return;
      }
      const canvas = document.createElement('canvas');
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(cameraVideo.videoWidth, cameraVideo.videoHeight));
      canvas.width = Math.round(cameraVideo.videoWidth * scale);
      canvas.height = Math.round(cameraVideo.videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) {
        cameraFeedback.textContent = 'Não foi possível preparar a foto. Tente novamente.';
        return;
      }
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
      capturedCameraCanvas = canvas;
      cameraPreview.src = canvas.toDataURL('image/jpeg', .92);
      cameraVideo.hidden = true;
      cameraPreview.hidden = false;
      cameraTitle.textContent = 'Pré-visualização da foto';
      cameraFeedback.textContent = 'Confira sua foto. Você pode tirar novamente ou usar esta imagem.';
      cameraCaptureButton.hidden = true;
      cameraCancelButton.hidden = true;
      cameraPreviewActions.hidden = false;
      cameraFlash.classList.add('is-visible');
      window.setTimeout(() => cameraFlash.classList.remove('is-visible'), 260);
    };
    cameraCaptureButton.addEventListener('click', () => {
      if (cameraCaptureButton.disabled || cameraCountdownTimer) return;
      if (!cameraStream || !cameraVideo.videoWidth || !cameraVideo.videoHeight) {
        cameraFeedback.textContent = 'A câmera ainda está iniciando. Aguarde um instante.';
        return;
      }
      cameraCaptureButton.disabled = true;
      cameraCancelButton.disabled = true;
      let count = 3;
      cameraFeedback.textContent = 'A foto será tirada em...';
      const tick = () => {
        cameraCountdown.classList.remove('is-visible');
        cameraCountdown.textContent = String(count);
        void cameraCountdown.offsetWidth;
        cameraCountdown.classList.add('is-visible');
        if (count > 1) {
          count -= 1;
          cameraCountdownTimer = window.setTimeout(tick, 1000);
          return;
        }
        cameraCountdownTimer = window.setTimeout(() => {
          cameraCountdownTimer = null;
          cameraCountdown.classList.remove('is-visible');
          cameraCountdown.textContent = '';
          captureCameraFrame();
          cameraCaptureButton.disabled = false;
          cameraCancelButton.disabled = false;
        }, 850);
      };
      tick();
    });
    document.getElementById('candidate-camera-retake').addEventListener('click', () => {
      capturedCameraCanvas = null;
      cameraTitle.textContent = 'Tirar foto';
      cameraVideo.hidden = false;
      cameraPreview.hidden = true;
      cameraPreview.removeAttribute('src');
      cameraPreviewActions.hidden = true;
      cameraCancelButton.hidden = false;
      cameraCaptureButton.hidden = false;
      cameraFeedback.textContent = 'Posicione seu rosto dentro da área da câmera.';
    });
    document.getElementById('candidate-camera-use').addEventListener('click', () => {
      if (!capturedCameraCanvas) return;
      const photo = capturedCameraCanvas;
      closeCandidateCamera();
      resetCameraView();
      openImageInEditor(photo);
    });
    document.getElementById('candidate-photo-upload').addEventListener('click', () => {
      closePhotoUpdateModal();
      editorInput.removeAttribute('capture');
      editorInput.click();
    });
    const candidatePhotoInput = document.getElementById('candidate-photo-input');
    const candidatePhotoLabel = document.querySelector('label[for="candidate-photo-input"]');
    if (candidatePhotoLabel && candidatePhotoInput) {
      candidatePhotoLabel.addEventListener('click', event => {
        event.preventDefault();
        showImageGuidelines('profile', () => candidatePhotoInput.click());
      });
    }
    document.getElementById('candidate-photo-delete').addEventListener('click', async () => {
      if (!window.confirm('Tem certeza de que deseja excluir sua foto de perfil?')) return;
      const button = document.getElementById('candidate-photo-delete');
      button.disabled = true;
      try {
        await Conecta.api('/api/perfil/imagem', {
          method: 'PUT',
          body: JSON.stringify({ campo: 'foto_perfil', imagem: null })
        });
        await loadCandidate();
        closePhotoViewer();
        Conecta.toast('Foto de perfil excluída.');
      } catch (error) {
        Conecta.toast(error.message || 'Não foi possível excluir a foto.');
      } finally {
        button.disabled = false;
      }
    });
    document.getElementById('candidate-change-cover').addEventListener('click', () => showImageGuidelines('banner', () => quickCoverInput.click()));

    async function handleQuickImage(input, field, maxDimension) {
      input.addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) return;
        const trigger = field === 'foto_perfil'
          ? document.getElementById('candidate-change-photo')
          : document.getElementById('candidate-change-cover');
        trigger.disabled = true;
        try {
          if (field === 'banner_perfil' && !['image/png','image/jpeg','image/webp'].includes(file.type)) {
            throw new Error('Formato não permitido. Escolha PNG, JPG/JPEG ou WEBP.');
          }
          const imageData = await prepareCandidateImage(file, maxDimension);
          await saveCandidateImage(field, imageData);
        } catch (error) {
          Conecta.toast(error.message || 'Não foi possível atualizar a imagem.');
        } finally {
          trigger.disabled = false;
          input.value = '';
        }
      });
    }
    handleQuickImage(quickPhotoInput, 'foto_perfil', 600);
    handleQuickImage(quickCoverInput, 'banner_perfil', 1600);
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
  let companyProfileCache = {};
  let companyProfileEditModeSetter = null;
  const companyInitials = name => String(name || 'EMP').trim().split(/\s+/).slice(0,2).map(part => part[0] || '').join('').toUpperCase() || 'EMP';

  function renderCompanyInstitutionalInfo(profile) {
    const values = {
      'company-view-name': profile.nome_empresa,
      'company-view-city': profile.cidade,
      'company-view-sector': profile.empresa_setor,
      'company-view-size': profile.empresa_porte,
      'company-view-phone': profile.telefone,
      'company-view-site': profile.empresa_site,
      'company-view-description': profile.descricao
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value || (id === 'company-view-description' ? 'Nenhuma apresentação institucional cadastrada.' : 'Não informado');
    });
  }

  async function loadCompanyProfile() {
    const data = await Conecta.api('/api/empresa/perfil');
    companyProfileCache = data.perfil || {};
    const profile = companyProfileCache;
    const companyPhotoVisibility = profile.visibilidade_foto || 'todos';
    const companyVisibilityNames = { usuarios: 'Todos os usuários', todos: 'Todos' };
    const companyVisibilityLabel = document.getElementById('company-photo-visibility-label');
    if (companyVisibilityLabel) companyVisibilityLabel.textContent = companyVisibilityNames[companyPhotoVisibility] || 'Todos';
    document.querySelectorAll('input[name="company-photo-visibility-choice"]').forEach(input => {
      input.checked = input.value === companyPhotoVisibility;
    });
    renderCompanyInstitutionalInfo(profile);
    const publicPreview = document.getElementById('company-public-preview');
    if (publicPreview) publicPreview.href = '/pages/empresa-perfil.html?id=' + encodeURIComponent(profile.id) + '&origem=meu-perfil';
    const form = document.getElementById('company-profile-form');
    ['nome_empresa','cidade','telefone','empresa_setor','empresa_descricao_curta','empresa_porte','empresa_site','descricao'].forEach(key => {
      if (form.elements[key]) form.elements[key].value = profile[key] || '';
    });
    companyProfileEditModeSetter?.(false);
    document.getElementById('company-profile-name').textContent = profile.nome_empresa || 'Sua empresa';
    document.getElementById('company-profile-location').textContent = profile.cidade || 'Localização não informada';
    document.getElementById('company-logo-initials').textContent = companyInitials(profile.nome_empresa);
    const logo = document.getElementById('company-logo-preview');
    if (profile.foto_perfil) { logo.src = profile.foto_perfil; logo.hidden = false; document.getElementById('company-logo-initials').hidden = true; }
    else { logo.removeAttribute('src'); logo.hidden = true; document.getElementById('company-logo-initials').hidden = false; }
    const cover = document.getElementById('company-cover');
    cover.style.backgroundImage = profile.banner_perfil ? 'url("' + profile.banner_perfil + '")' : '';
    cover.classList.toggle('has-image', Boolean(profile.banner_perfil));
  }

  async function prepareCompanyProfileImage(file, width, height) {
    const formats = {
      'image/png': 'image/png',
      'image/jpeg': 'image/jpeg',
      'image/webp': 'image/webp'
    };
    const outputType = file && formats[file.type];
    if (!outputType) throw new Error('Formato não permitido. Escolha PNG, JPG/JPEG ou WEBP.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Escolha uma imagem de até 5 MB.');
    let image;
    try { image = await createImageBitmap(file); }
    catch {
      image = await new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const element = new Image();
        element.onload = () => { URL.revokeObjectURL(objectUrl); resolve(element); };
        element.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Não foi possível abrir essa imagem.')); };
        element.src = objectUrl;
      });
    }
    const sourceWidth = image.width || image.naturalWidth;
    const sourceHeight = image.height || image.naturalHeight;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const cropWidth = width / scale;
    const cropHeight = height / scale;
    const sx = (sourceWidth - cropWidth) / 2;
    const sy = (sourceHeight - cropHeight) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (outputType === 'image/jpeg') {
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(image, sx, sy, cropWidth, cropHeight, 0, 0, width, height);
    image.close?.();
    let quality = .9;
    let result = canvas.toDataURL(outputType, quality);
    if (!result.startsWith('data:' + outputType + ';base64,')) {
      throw new Error('Seu navegador não conseguiu processar esse formato. Tente PNG, JPG/JPEG ou WEBP.');
    }
    while (result.length > 1400000 && outputType !== 'image/png' && quality > .45) {
      quality -= .1;
      result = canvas.toDataURL(outputType, quality);
    }
    if (result.length > 1400000) throw new Error('A imagem processada ficou grande demais. Escolha uma imagem menor.');
    return result;
  }

  async function prepareCompanyImage(file, width, height) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem válido.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Escolha uma imagem de até 5 MB.');
    let image;
    try { image = await createImageBitmap(file); }
    catch {
      image = await new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const element = new Image();
        element.onload = () => { URL.revokeObjectURL(objectUrl); resolve(element); };
        element.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Não foi possível abrir essa imagem.')); };
        element.src = objectUrl;
      });
    }
    const sourceWidth = image.width || image.naturalWidth;
    const sourceHeight = image.height || image.naturalHeight;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const cropWidth = width / scale;
    const cropHeight = height / scale;
    const sx = (sourceWidth - cropWidth) / 2;
    const sy = (sourceHeight - cropHeight) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff'; context.fillRect(0,0,width,height);
    context.drawImage(image,sx,sy,cropWidth,cropHeight,0,0,width,height);
    image.close?.();
    let quality = .9;
    let result = canvas.toDataURL('image/jpeg',quality);
    while (result.length > 1400000 && quality > .45) { quality -= .1; result = canvas.toDataURL('image/jpeg',quality); }
    if (result.length > 1400000) throw new Error('Não foi possível reduzir essa imagem ao tamanho permitido.');
    return result;
  }

  function setupCompanyProfileEditor() {
    const form = document.getElementById('company-profile-form');
    if (!form) return;
    const feedback = document.getElementById('company-profile-feedback');
    const editButton = document.getElementById('company-profile-edit');
    const editModal = document.getElementById('company-profile-edit-modal');
    const cancelButton = document.getElementById('company-profile-cancel');
    const closeButton = document.getElementById('company-profile-edit-close');
    const closeEditor = () => {
      editModal.classList.remove('is-open');
      editModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('company-profile-editor-open');
    };
    const setEditMode = editing => {
      form.querySelectorAll('input, select, textarea').forEach(field => { field.disabled = !editing; });
      form.classList.toggle('is-editing', editing);
      if (editing) {
        editModal.classList.add('is-open');
        editModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('company-profile-editor-open');
        setTimeout(() => form.elements.nome_empresa?.focus(), 0);
      } else {
        closeEditor();
        feedback.textContent = '';
        feedback.classList.remove('success');
      }
    };
    companyProfileEditModeSetter = setEditMode;
    editButton.addEventListener('click', () => setEditMode(true));
    [cancelButton, closeButton].forEach(button => button.addEventListener('click', () => {
      ['nome_empresa','cidade','telefone','empresa_setor','empresa_descricao_curta','empresa_porte','empresa_site','descricao'].forEach(key => {
        if (form.elements[key]) form.elements[key].value = companyProfileCache[key] || '';
      });
      setEditMode(false);
    }));
    editModal.addEventListener('click', event => {
      if (event.target.closest('[data-close-company-editor]')) cancelButton.click();
    });
    setEditMode(false);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true; button.textContent = 'Salvando...'; feedback.textContent = '';
      try {
        const profile = await Conecta.api('/api/empresa/perfil', { method: 'PUT', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
        companyProfileCache = { ...companyProfileCache, ...profile.perfil };
        renderCompanyInstitutionalInfo(companyProfileCache);
        document.getElementById('company-profile-name').textContent = profile.perfil.nome_empresa;
        document.getElementById('company-profile-location').textContent = profile.perfil.cidade;
        document.getElementById('company-logo-initials').textContent = companyInitials(profile.perfil.nome_empresa);
        const welcome = document.getElementById('welcome-name');
        const user = document.getElementById('user-name');
        if (welcome) welcome.textContent = profile.perfil.nome_empresa;
        if (user) user.textContent = profile.perfil.nome_empresa;
        feedback.textContent = 'Perfil atualizado com sucesso.';
        feedback.classList.add('success');
        setEditMode(false);
      } catch (error) { feedback.textContent = error.message; feedback.classList.remove('success'); }
      finally { button.disabled = false; button.textContent = 'Salvar alterações'; }
    });
    const bindImage = (buttonId,inputId,field,width,height,label) => {
      const button = document.getElementById(buttonId);
      const input = document.getElementById(inputId);
      button.addEventListener('click', () => field === 'foto_perfil'
        ? showImageGuidelines('profile', () => input.click())
        : input.click());
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        button.disabled = true;
        try {
          const image = await prepareCompanyProfileImage(file,width,height);
          await Conecta.api('/api/empresa/perfil/imagem',{method:'PUT',body:JSON.stringify({campo:field,imagem:image})});
          await loadCompanyProfile();
          Conecta.toast(label + ' atualizada com sucesso.');
        } catch (error) { Conecta.toast(error.message); }
        finally { button.disabled = false; input.value = ''; }
      });
    };
    const companyPhotoViewer = document.getElementById('company-photo-viewer');
    const companyPhotoViewerImage = document.getElementById('company-photo-viewer-image');
    const closeCompanyPhotoViewer = () => {
      companyPhotoViewer.classList.remove('is-open');
      companyPhotoViewer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('candidate-photo-viewer-open');
    };
    const openCompanyPhotoViewer = () => {
      const image = companyProfileCache.foto_perfil;
      if (image) {
        companyPhotoViewerImage.src = image;
        companyPhotoViewerImage.hidden = false;
      } else {
        companyPhotoViewerImage.removeAttribute('src');
        companyPhotoViewerImage.hidden = true;
      }
      companyPhotoViewer.classList.add('is-open');
      companyPhotoViewer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('candidate-photo-viewer-open');
    };
    document.getElementById('company-logo-edit').addEventListener('click', openCompanyPhotoViewer);
    document.getElementById('company-photo-viewer-close').addEventListener('click', closeCompanyPhotoViewer);
    const companyVisibilityButton = document.getElementById('company-photo-visibility');
    const companyVisibilityPopover = document.getElementById('company-photo-visibility-popover');
    const companyVisibilityLabel = document.getElementById('company-photo-visibility-label');
    const companyVisibilityFeedback = document.getElementById('company-photo-visibility-feedback');
    const companyVisibilitySave = document.getElementById('company-photo-visibility-save');
    const companyVisibilityNames = { usuarios: 'Todos os usuários', todos: 'Todos' };
    let savedCompanyPhotoVisibility = companyProfileCache.visibilidade_foto || 'todos';
    let selectedCompanyPhotoVisibility = savedCompanyPhotoVisibility;
    const setCompanyVisibilityPopover = open => {
      companyVisibilityPopover.hidden = !open;
      companyVisibilityButton.setAttribute('aria-expanded', String(open));
      companyVisibilityFeedback.textContent = '';
      if (open) {
        const checked = companyVisibilityPopover.querySelector('input[name="company-photo-visibility-choice"]:checked');
        if (checked) selectedCompanyPhotoVisibility = checked.value;
      }
    };
    companyVisibilityButton.addEventListener('click', () => setCompanyVisibilityPopover(companyVisibilityPopover.hidden));
    companyVisibilityPopover.querySelectorAll('input[name="company-photo-visibility-choice"]').forEach(input => {
      input.addEventListener('change', () => { selectedCompanyPhotoVisibility = input.value; });
    });
    document.addEventListener('click', event => {
      if (!companyVisibilityPopover.hidden && !event.target.closest('#company-photo-visibility-popover') && !event.target.closest('#company-photo-visibility')) {
        setCompanyVisibilityPopover(false);
      }
    });
    companyVisibilitySave.addEventListener('click', async () => {
      if (!['usuarios', 'todos'].includes(selectedCompanyPhotoVisibility)) {
        companyVisibilityFeedback.textContent = 'As opções de conexões estarão disponíveis quando o sistema de conexões for implementado.';
        return;
      }
      companyVisibilitySave.disabled = true;
      companyVisibilityFeedback.textContent = '';
      try {
        await Conecta.api('/api/empresa/perfil/visibilidade-foto', {
          method: 'PUT',
          body: JSON.stringify({ visibilidade: selectedCompanyPhotoVisibility })
        });
        savedCompanyPhotoVisibility = selectedCompanyPhotoVisibility;
        companyProfileCache.visibilidade_foto = savedCompanyPhotoVisibility;
        companyVisibilityLabel.textContent = companyVisibilityNames[savedCompanyPhotoVisibility];
        setCompanyVisibilityPopover(false);
      } catch (error) {
        companyVisibilityFeedback.textContent = error.message || 'Não foi possível salvar a visibilidade.';
        selectedCompanyPhotoVisibility = savedCompanyPhotoVisibility;
        const selected = companyVisibilityPopover.querySelector('input[value="' + savedCompanyPhotoVisibility + '"]');
        if (selected) selected.checked = true;
      } finally {
        companyVisibilitySave.disabled = false;
      }
    });
    companyPhotoViewer.addEventListener('click', event => { if (event.target === companyPhotoViewer) closeCompanyPhotoViewer(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && companyPhotoViewer.classList.contains('is-open')) closeCompanyPhotoViewer(); });
    document.getElementById('company-photo-edit').addEventListener('click', () => {
      closeCompanyPhotoViewer();
      openCompanyImageEditor();
    });
    const companyPhotoUpdateModal = document.getElementById('company-photo-update-modal');
    const companyPhotoUpdatePreview = document.getElementById('company-photo-update-preview');
    const closeCompanyPhotoUpdateModal = () => {
      companyPhotoUpdateModal.classList.remove('is-open');
      companyPhotoUpdateModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('candidate-photo-update-open');
    };
    const openCompanyPhotoUpdateModal = () => {
      companyPhotoUpdatePreview.src = companyProfileCache.foto_perfil || '';
      document.getElementById('company-photo-update-greeting').textContent =
        companyProfileCache.nome ? companyProfileCache.nome + ', ajude outras pessoas a reconhecer sua empresa.' : 'Ajude outras pessoas a reconhecer sua empresa.';
      closeCompanyPhotoViewer();
      companyPhotoUpdateModal.classList.add('is-open');
      companyPhotoUpdateModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('candidate-photo-update-open');
    };
    document.getElementById('company-photo-update').addEventListener('click', openCompanyPhotoUpdateModal);
    document.getElementById('company-photo-update-close').addEventListener('click', closeCompanyPhotoUpdateModal);
    companyPhotoUpdateModal.addEventListener('click', event => { if (event.target === companyPhotoUpdateModal) closeCompanyPhotoUpdateModal(); });
    const companyCameraModal = document.getElementById('company-camera-modal');
    const companyCameraVideo = document.getElementById('company-camera-video');
    const companyCameraPreview = document.getElementById('company-camera-preview');
    const companyCameraFeedback = document.getElementById('company-camera-feedback');
    const companyCameraCountdown = document.getElementById('company-camera-countdown');
    const companyCameraCapture = document.getElementById('company-camera-capture');
    const companyCameraCancel = document.getElementById('company-camera-cancel');
    const companyCameraPreviewActions = document.getElementById('company-camera-preview-actions');
    const companyCameraFlash = document.getElementById('company-camera-flash');
    let companyCameraStream = null;
    let companyCapturedCanvas = null;
    let companyCameraTimer = null;
    const stopCompanyCamera = () => {
      if (companyCameraStream) companyCameraStream.getTracks().forEach(track => track.stop());
      companyCameraStream = null;
      companyCameraVideo.srcObject = null;
    };
    const closeCompanyCamera = () => {
      if (companyCameraTimer) window.clearTimeout(companyCameraTimer);
      companyCameraTimer = null;
      stopCompanyCamera();
      companyCameraModal.classList.remove('is-open');
      companyCameraModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('candidate-camera-open');
      companyCapturedCanvas = null;
      companyCameraVideo.hidden = false;
      companyCameraPreview.hidden = true;
      companyCameraPreview.removeAttribute('src');
      companyCameraCountdown.textContent = '';
      companyCameraCountdown.classList.remove('is-visible');
      companyCameraFlash.classList.remove('is-visible');
      companyCameraCapture.hidden = false;
      companyCameraCancel.hidden = false;
      companyCameraPreviewActions.hidden = true;
      companyCameraFeedback.textContent = 'Posicione a imagem dentro da área da câmera.';
      companyCameraCapture.disabled = false;
      companyCameraCancel.disabled = false;
    };
    document.getElementById('company-photo-use-camera').addEventListener('click', async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        Conecta.toast('O acesso à câmera exige HTTPS ou localhost e um navegador compatível.');
        return;
      }
      const button = document.getElementById('company-photo-use-camera');
      button.disabled = true;
      companyCameraFeedback.textContent = 'Aguardando autorização para acessar a câmera...';
      try {
        companyCameraStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }
        });
        companyCameraVideo.srcObject = companyCameraStream;
        await companyCameraVideo.play();
        closeCompanyPhotoUpdateModal();
        companyCameraModal.classList.add('is-open');
        companyCameraModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('candidate-camera-open');
        companyCameraFeedback.textContent = 'Posicione o logotipo ou a imagem dentro da área da câmera.';
      } catch (error) {
        stopCompanyCamera();
        const message = error && error.name === 'NotAllowedError'
          ? 'Permita o acesso à câmera nas configurações do navegador e tente novamente.'
          : error && error.name === 'NotFoundError'
            ? 'Nenhuma câmera foi encontrada neste dispositivo.'
            : 'Não foi possível iniciar a câmera. Verifique se ela está disponível e tente novamente.';
        Conecta.toast(message);
      } finally { button.disabled = false; }
    });
    const captureCompanyCameraFrame = () => {
      if (!companyCameraStream || !companyCameraVideo.videoWidth || !companyCameraVideo.videoHeight) {
        companyCameraFeedback.textContent = 'A câmera ainda está iniciando. Aguarde um instante.';
        return;
      }
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(companyCameraVideo.videoWidth, companyCameraVideo.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(companyCameraVideo.videoWidth * scale);
      canvas.height = Math.round(companyCameraVideo.videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) { companyCameraFeedback.textContent = 'Não foi possível preparar a imagem. Tente novamente.'; return; }
      context.drawImage(companyCameraVideo, 0, 0, canvas.width, canvas.height);
      companyCapturedCanvas = canvas;
      companyCameraPreview.src = canvas.toDataURL('image/jpeg', .92);
      companyCameraVideo.hidden = true;
      companyCameraPreview.hidden = false;
      companyCameraCapture.hidden = true;
      companyCameraCancel.hidden = true;
      companyCameraPreviewActions.hidden = false;
      companyCameraFeedback.textContent = 'Confira a imagem. Você pode tirar novamente ou usar esta foto.';
      companyCameraFlash.classList.add('is-visible');
      window.setTimeout(() => companyCameraFlash.classList.remove('is-visible'), 260);
    };
    companyCameraCapture.addEventListener('click', () => {
      if (companyCameraTimer || companyCameraCapture.disabled) return;
      companyCameraCapture.disabled = true;
      companyCameraCancel.disabled = true;
      let count = 3;
      const tick = () => {
        companyCameraCountdown.classList.remove('is-visible');
        companyCameraCountdown.textContent = String(count);
        void companyCameraCountdown.offsetWidth;
        companyCameraCountdown.classList.add('is-visible');
        if (count > 1) {
          count -= 1;
          companyCameraTimer = window.setTimeout(tick, 1000);
          return;
        }
        companyCameraTimer = window.setTimeout(() => {
          companyCameraTimer = null;
          companyCameraCountdown.classList.remove('is-visible');
          companyCameraCountdown.textContent = '';
          captureCompanyCameraFrame();
          companyCameraCapture.disabled = false;
          companyCameraCancel.disabled = false;
        }, 850);
      };
      tick();
    });
    document.getElementById('company-camera-retake').addEventListener('click', () => {
      companyCapturedCanvas = null;
      companyCameraVideo.hidden = false;
      companyCameraPreview.hidden = true;
      companyCameraPreview.removeAttribute('src');
      companyCameraPreviewActions.hidden = true;
      companyCameraCapture.hidden = false;
      companyCameraCancel.hidden = false;
      companyCameraFeedback.textContent = 'Posicione o logotipo ou a imagem dentro da área da câmera.';
    });
    document.getElementById('company-camera-use').addEventListener('click', () => {
      if (!companyCapturedCanvas) return;
      const capturedImage = companyCapturedCanvas;
      closeCompanyCamera();
      openCompanyImageEditorFromImage(capturedImage);
    });
    document.getElementById('company-camera-close').addEventListener('click', closeCompanyCamera);
    companyCameraCancel.addEventListener('click', closeCompanyCamera);
    companyCameraModal.addEventListener('click', event => { if (event.target === companyCameraModal) closeCompanyCamera(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && companyCameraModal.classList.contains('is-open')) closeCompanyCamera(); });
    document.getElementById('company-photo-upload').addEventListener('click', () => {
      const input = document.getElementById('company-logo-input');
      input.removeAttribute('capture');
      closeCompanyPhotoUpdateModal();
      showImageGuidelines('profile', () => input.click());
    });
    document.getElementById('company-photo-delete').addEventListener('click', async () => {
      if (!companyProfileCache.foto_perfil) return;
      if (!window.confirm('Tem certeza de que deseja excluir o logotipo da empresa?')) return;
      const button = document.getElementById('company-photo-delete');
      button.disabled = true;
      try {
        await Conecta.api('/api/empresa/perfil/imagem', { method: 'PUT', body: JSON.stringify({ campo: 'foto_perfil', imagem: null }) });
        await loadCompanyProfile();
        closeCompanyPhotoViewer();
        Conecta.toast('Logotipo excluído.');
      } catch (error) {
        Conecta.toast(error.message || 'Não foi possível excluir o logotipo.');
      } finally { button.disabled = false; }
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && companyPhotoUpdateModal.classList.contains('is-open')) closeCompanyPhotoUpdateModal(); });
    const bindCompanyLogoImage = () => {
      const input = document.getElementById('company-logo-input');
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const image = await prepareCompanyProfileImage(file,600,600);
          await Conecta.api('/api/empresa/perfil/imagem',{method:'PUT',body:JSON.stringify({campo:'foto_perfil',imagem:image})});
          await loadCompanyProfile();
          Conecta.toast('Logotipo atualizado com sucesso.');
        } catch (error) { Conecta.toast(error.message); }
        finally { input.value = ''; input.removeAttribute('capture'); }
      });
    };
    bindCompanyLogoImage();
    const imageEditor = document.getElementById('company-image-editor');
    const editorCanvas = document.getElementById('company-image-editor-canvas');
    const editorContext = editorCanvas.getContext('2d');
    const editorInput = document.getElementById('company-image-editor-input');
    const editorState = { image: null, angle: 0, zoom: 1, flipX: 1, flipY: 1, filter: 'none', brightness: 100, contrast: 100, saturation: 100, vignette: 0 };
    function updateImageFilterPreviews() {
      if (!editorState.image) return;
      const source = editorState.previewSource || editorState.image.currentSrc || editorState.image.src;
      if (!source) return;
      document.querySelectorAll('[data-image-filter]').forEach(button => {
        const preview = button.querySelector('.candidate-filter-preview');
        if (!preview) return;
        preview.src = source;
        preview.style.filter = button.dataset.imageFilter === 'none' ? 'none' : button.dataset.imageFilter;
      });
    }
    function renderImageEditor() {
      const image = editorState.image;
      if (!image) return;
      updateImageFilterPreviews();
      const size = editorCanvas.width;
      const radians = editorState.angle * Math.PI / 180;
      const cos = Math.abs(Math.cos(radians));
      const sin = Math.abs(Math.sin(radians));
      const rotatedWidth = image.width * cos + image.height * sin;
      const rotatedHeight = image.width * sin + image.height * cos;
      const scale = Math.max(size / rotatedWidth, size / rotatedHeight) * editorState.zoom;
      editorContext.clearRect(0, 0, size, size);
      editorContext.save();
      editorContext.translate(size / 2, size / 2);
      editorContext.rotate(radians);
      editorContext.scale(editorState.flipX * scale, editorState.flipY * scale);
      const brightnessEffect = Math.max(0, 100 + (editorState.brightness - 100) * 1.8);
      const contrastEffect = Math.max(0, 100 + (editorState.contrast - 100) * 1.8);
      const saturationEffect = Math.max(0, 100 + (editorState.saturation - 100) * 1.8);
      editorContext.filter = `brightness(${brightnessEffect}%) contrast(${contrastEffect}%) saturate(${saturationEffect}%) ${editorState.filter}`;
      editorContext.drawImage(image, -image.width / 2, -image.height / 2, image.width, image.height);
      editorContext.restore();
      if (editorState.vignette > 0) {
        const gradient = editorContext.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.72);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${Math.min(0.95, editorState.vignette / 100 * 1.25)})`);
        editorContext.save(); editorContext.fillStyle = gradient; editorContext.fillRect(0, 0, size, size); editorContext.restore();
      }
    }
    function openCompanyImageEditor() {
      const current = companyProfileCache.foto_perfil;
      if (!current) return editorInput.click();
      const image = new Image();
      image.onload = () => {
        editorState.image = image;
        editorState.angle = 0; editorState.zoom = 1; editorState.flipX = 1; editorState.flipY = 1; editorState.filter = 'none';
        editorState.brightness = 100; editorState.contrast = 100; editorState.saturation = 100; editorState.vignette = 0;
        ['brightness','contrast','saturation'].forEach(key => { document.getElementById(`company-image-${key}`).value = '100'; document.getElementById(`company-image-${key}-value`).textContent = '100%'; });
        document.getElementById('company-image-vignette').value = '0';
        document.getElementById('company-image-vignette-value').textContent = '0%';
        document.getElementById('company-image-zoom').value = '1';
        document.getElementById('company-image-angle').value = '0';
        document.querySelectorAll('[data-image-filter]').forEach(button => button.classList.toggle('active', button.dataset.imageFilter === 'none'));
        renderImageEditor();
        imageEditor.classList.add('is-open');
        imageEditor.setAttribute('aria-hidden', 'false');
        document.body.classList.add('candidate-image-editor-open');
      };
      image.onerror = () => Conecta.toast('Não foi possível abrir esta foto para edição.');
      image.src = current;
    }
    function closeImageEditor() {
      imageEditor.classList.remove('is-open');
      imageEditor.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('candidate-image-editor-open');
    }
    document.getElementById('company-image-editor-close').addEventListener('click', closeImageEditor);
    imageEditor.addEventListener('click', event => { if (event.target === imageEditor) closeImageEditor(); });
    document.querySelectorAll('[data-editor-tab]').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('[data-editor-tab]').forEach(item => item.classList.toggle('active', item === tab));
      document.querySelectorAll('[data-editor-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.editorPanel === tab.dataset.editorTab));
    }));
    document.getElementById('company-image-editor-choose')?.addEventListener('click', () => editorInput.click());
    const openImageInEditor = (image, previewSource = '') => {
      editorState.image?.close?.();
      editorState.image = image;
      editorState.previewSource = previewSource || image.currentSrc || image.src || '';
      editorState.angle = 0; editorState.zoom = 1; editorState.flipX = 1; editorState.flipY = 1; editorState.filter = 'none';
      editorState.brightness = 100; editorState.contrast = 100; editorState.saturation = 100; editorState.vignette = 0;
      ['brightness','contrast','saturation'].forEach(key => { document.getElementById(`company-image-${key}`).value = '100'; document.getElementById(`company-image-${key}-value`).textContent = '100%'; });
      document.getElementById('company-image-vignette').value = '0';
      document.getElementById('company-image-vignette-value').textContent = '0%';
      document.getElementById('company-image-zoom').value = '1';
      document.getElementById('company-image-angle').value = '0';
      document.querySelectorAll('[data-image-filter]').forEach(button => button.classList.toggle('active', button.dataset.imageFilter === 'none'));
      renderImageEditor();
      imageEditor.classList.add('is-open'); imageEditor.setAttribute('aria-hidden','false'); document.body.classList.add('candidate-image-editor-open');
    };
    const loadImageIntoEditor = async file => {
      if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        Conecta.toast('Formato não permitido. Escolha PNG, JPG/JPEG ou WEBP.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        Conecta.toast('Escolha uma imagem de até 5 MB.');
        return;
      }
      let image = null;
      try {
        let previewSource = '';
        try {
          image = await createImageBitmap(file);
          const previewCanvas = document.createElement('canvas');
          const scale = Math.min(1, 320 / Math.max(image.width, image.height));
          previewCanvas.width = Math.max(1, Math.round(image.width * scale));
          previewCanvas.height = Math.max(1, Math.round(image.height * scale));
          const context = previewCanvas.getContext('2d');
          if (!context) throw new Error('Não foi possível preparar a pré-visualização.');
          context.drawImage(image, 0, 0, previewCanvas.width, previewCanvas.height);
          previewSource = previewCanvas.toDataURL('image/png');
        } catch (bitmapError) {
          image?.close?.();
          image = await new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(file);
            const element = new Image();
            element.onload = () => { URL.revokeObjectURL(objectUrl); resolve(element); };
            element.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              reject(new Error('O navegador não conseguiu decodificar esse arquivo. Verifique se a imagem não está danificada.'));
            };
            element.src = objectUrl;
          });
          previewSource = image.currentSrc || image.src;
        }
        if (!image || !(image.width || image.naturalWidth) || !(image.height || image.naturalHeight)) {
          throw new Error('A imagem não possui dimensões válidas ou não pôde ser decodificada.');
        }
        openImageInEditor(image, previewSource);
      } catch (error) {
        image?.close?.();
        Conecta.toast(error.message || 'Não foi possível abrir essa imagem. Tente selecionar outro arquivo.');
      }
    };
    editorInput.addEventListener('change', event => {
      editorInput.removeAttribute('capture');
      loadImageIntoEditor(event.target.files[0]);
      event.target.value = '';
    });
    document.getElementById('company-image-rotate-left').addEventListener('click', () => { editorState.angle = ((editorState.angle - 90 + 180) % 360 + 360) % 360 - 180; document.getElementById('company-image-angle').value = String(editorState.angle); renderImageEditor(); });
    document.getElementById('company-image-rotate-right').addEventListener('click', () => { editorState.angle = ((editorState.angle + 90 + 180) % 360 + 360) % 360 - 180; document.getElementById('company-image-angle').value = String(editorState.angle); renderImageEditor(); });
    document.getElementById('company-image-flip-horizontal').addEventListener('click', () => { editorState.flipX *= -1; renderImageEditor(); });
    document.getElementById('company-image-flip-vertical').addEventListener('click', () => { editorState.flipY *= -1; renderImageEditor(); });
    document.getElementById('company-image-zoom').addEventListener('input', event => { editorState.zoom = Number(event.target.value); renderImageEditor(); });
    document.getElementById('company-image-angle').addEventListener('input', event => { editorState.angle = Number(event.target.value); renderImageEditor(); });
    document.querySelectorAll('[data-image-filter]').forEach(button => button.addEventListener('click', () => {
      editorState.filter = button.dataset.imageFilter === 'none' ? 'none' : button.dataset.imageFilter;
      document.querySelectorAll('[data-image-filter]').forEach(item => item.classList.toggle('active', item === button));
      renderImageEditor();
    }));
    ['brightness','contrast','saturation','vignette'].forEach(key => {
      document.getElementById(`company-image-${key}`).addEventListener('input', event => {
        editorState[key] = Number(event.target.value);
        document.getElementById(`company-image-${key}-value`).textContent = `${event.target.value}${key === 'vignette' ? '%' : '%'}`;
        renderImageEditor();
      });
    });
    document.getElementById('company-image-editor-save').addEventListener('click', async () => {
      const button = document.getElementById('company-image-editor-save');
      const feedback = document.getElementById('company-image-editor-feedback');
      button.disabled = true; feedback.textContent = 'Salvando...';
      try {
        let imageData = editorCanvas.toDataURL('image/png');
        if (imageData.length > 1400000) {
          let quality = 0.92;
          imageData = editorCanvas.toDataURL('image/webp', quality);
          while (imageData.length > 1400000 && quality > 0.5) {
            quality -= 0.08;
            imageData = editorCanvas.toDataURL('image/webp', quality);
          }
        }
        if (imageData.length > 1400000) throw new Error('A imagem editada ficou grande demais. Tente reduzir um pouco a imagem ou usar um arquivo menor.');
        if (!imageData.startsWith('data:image/png;base64,') && !imageData.startsWith('data:image/webp;base64,')) {
          throw new Error('Seu navegador não conseguiu preservar a transparência desta imagem. Atualize o navegador e tente novamente.');
        }
        await Conecta.api('/api/empresa/perfil/imagem', { method: 'PUT', body: JSON.stringify({ campo: 'foto_perfil', imagem: imageData }) });
        await loadCompanyProfile();
        closeImageEditor();
        closeCompanyPhotoViewer();
      } catch (error) {
        feedback.textContent = error.message || 'Não foi possível salvar a imagem.';
      } finally { button.disabled = false; }
    });
    const coverButton = document.getElementById('company-cover-edit');
    const coverInput = document.getElementById('company-cover-input');
    const coverModal = document.getElementById('company-cover-modal');
    const coverModalImage = document.getElementById('company-cover-modal-image');
    const coverFeedback = document.getElementById('company-cover-modal-feedback');
    const coverEditAction = document.getElementById('company-cover-edit-image');
    const coverChangeAction = document.getElementById('company-cover-change-image');
    const coverDeleteAction = document.getElementById('company-cover-delete-image');
    const closeCoverModal = () => {
      coverModal.classList.remove('is-open');
      coverModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('company-cover-modal-open');
      coverFeedback.textContent = '';
    };
    const openCoverModal = () => {
      const image = companyProfileCache.banner_perfil;
      if (image) {
        coverModalImage.src = image;
        coverModalImage.hidden = false;
        coverEditAction.disabled = false;
        coverDeleteAction.disabled = false;
      } else {
        coverModalImage.removeAttribute('src');
        coverModalImage.hidden = true;
        coverEditAction.disabled = true;
        coverDeleteAction.disabled = true;
      }
      coverModal.classList.add('is-open');
      coverModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('company-cover-modal-open');
    };
    coverButton.addEventListener('click', openCoverModal);
    coverModal.querySelectorAll('[data-close-cover-modal]').forEach(button => button.addEventListener('click', closeCoverModal));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && coverModal.classList.contains('is-open')) closeCoverModal();
    });
    const coverImageEditor = document.getElementById('company-cover-image-editor');
    const coverEditorCanvas = document.getElementById('company-cover-editor-canvas');
    const coverEditorContext = coverEditorCanvas.getContext('2d');
    const coverEditorFeedback = document.getElementById('company-cover-image-editor-feedback');
    const coverEditorSave = document.getElementById('company-cover-image-editor-save');
    const coverEditorState = { image: null, angle: 0, zoom: 1, flipX: 1, flipY: 1, filter: 'none', brightness: 100, contrast: 100, saturation: 100, vignette: 0 };
    const coverEditorTabs = coverImageEditor.querySelectorAll('[data-cover-editor-tab]');
    const coverEditorPanels = coverImageEditor.querySelectorAll('[data-cover-editor-panel]');
    const coverFilterButtons = coverImageEditor.querySelectorAll('[data-cover-image-filter]');
    const resetCoverEditor = () => {
      Object.assign(coverEditorState, { angle: 0, zoom: 1, flipX: 1, flipY: 1, filter: 'none', brightness: 100, contrast: 100, saturation: 100, vignette: 0 });
      ['brightness','contrast','saturation'].forEach(key => {
        document.getElementById('company-cover-' + key).value = '100';
        document.getElementById('company-cover-' + key + '-value').textContent = '100%';
      });
      document.getElementById('company-cover-vignette').value = '0';
      document.getElementById('company-cover-vignette-value').textContent = '0%';
      document.getElementById('company-cover-image-zoom').value = '1';
      document.getElementById('company-cover-image-angle').value = '0';
      coverFilterButtons.forEach(button => button.classList.toggle('active', button.dataset.coverImageFilter === 'none'));
      coverEditorTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.coverEditorTab === 'crop'));
      coverEditorPanels.forEach(panel => panel.classList.toggle('active', panel.dataset.coverEditorPanel === 'crop'));
    };
    const renderCoverEditor = () => {
      const image = coverEditorState.image;
      if (!image) return;
      const width = coverEditorCanvas.width, height = coverEditorCanvas.height;
      const radians = coverEditorState.angle * Math.PI / 180;
      const cos = Math.abs(Math.cos(radians)), sin = Math.abs(Math.sin(radians));
      const rotatedWidth = image.width * cos + image.height * sin;
      const rotatedHeight = image.width * sin + image.height * cos;
      const scale = Math.max(width / rotatedWidth, height / rotatedHeight) * coverEditorState.zoom;
      coverEditorContext.clearRect(0, 0, width, height);
      coverEditorContext.save();
      coverEditorContext.translate(width / 2, height / 2);
      coverEditorContext.rotate(radians);
      coverEditorContext.scale(coverEditorState.flipX * scale, coverEditorState.flipY * scale);
      // Mantém os valores exibidos nos controles, mas torna a variação visual mais perceptível.
      const brightness = Math.max(0, 100 + (coverEditorState.brightness - 100) * 2.4);
      const contrast = Math.max(0, 100 + (coverEditorState.contrast - 100) * 2.4);
      const saturation = Math.max(0, 100 + (coverEditorState.saturation - 100) * 2.0);
      const presetFilter = coverEditorState.filter === 'none' ? '' : ` ${coverEditorState.filter}`;
      coverEditorContext.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)${presetFilter}`;
      coverEditorContext.drawImage(image, -image.width / 2, -image.height / 2, image.width, image.height);
      coverEditorContext.restore();
      if (coverEditorState.vignette > 0) {
        const radius = Math.max(width, height) * .72;
        const gradient = coverEditorContext.createRadialGradient(width / 2, height / 2, radius * .08, width / 2, height / 2, radius);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${Math.min(.98, coverEditorState.vignette / 100 * 1.45)})`);
        coverEditorContext.save();
        coverEditorContext.fillStyle = gradient;
        coverEditorContext.fillRect(0, 0, width, height);
        coverEditorContext.restore();
      }
      coverFilterButtons.forEach(button => {
        const preview = button.querySelector('.candidate-filter-preview');
        if (preview) {
          preview.src = image.src;
          preview.style.filter = button.dataset.coverImageFilter === 'none' ? 'none' : button.dataset.coverImageFilter;
        }
      });
    };
    const closeCoverImageEditor = (reopenCover = true) => {
      coverImageEditor.classList.remove('is-open');
      coverImageEditor.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('candidate-image-editor-open');
      if (reopenCover && companyProfileCache.banner_perfil) openCoverModal();
    };
    const openCoverImageEditor = () => {
      const source = companyProfileCache.banner_perfil || coverModalImage.src;
      if (!source) return;
      const image = new Image();
      image.onload = () => {
        coverEditorState.image = image;
        resetCoverEditor();
        renderCoverEditor();
        closeCoverModal();
        coverEditorFeedback.textContent = '';
        coverImageEditor.classList.add('is-open');
        coverImageEditor.setAttribute('aria-hidden', 'false');
        document.body.classList.add('candidate-image-editor-open');
      };
      image.onerror = () => { coverFeedback.textContent = 'Não foi possível abrir a foto de capa para edição.'; };
      image.src = source;
    };
    coverEditAction.addEventListener('click', openCoverImageEditor);
    document.getElementById('company-cover-image-editor-close').addEventListener('click', () => closeCoverImageEditor(true));
    coverImageEditor.addEventListener('click', event => {
      if (event.target === coverImageEditor) closeCoverImageEditor(true);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && coverImageEditor.classList.contains('is-open')) closeCoverImageEditor(true);
    });
    coverEditorTabs.forEach(tab => tab.addEventListener('click', () => {
      coverEditorTabs.forEach(item => item.classList.toggle('active', item === tab));
      coverEditorPanels.forEach(panel => panel.classList.toggle('active', panel.dataset.coverEditorPanel === tab.dataset.coverEditorTab));
    }));
    document.getElementById('company-cover-rotate-left').addEventListener('click', () => {
      coverEditorState.angle = ((coverEditorState.angle - 90 + 180) % 360 + 360) % 360 - 180;
      document.getElementById('company-cover-image-angle').value = String(coverEditorState.angle);
      renderCoverEditor();
    });
    document.getElementById('company-cover-rotate-right').addEventListener('click', () => {
      coverEditorState.angle = ((coverEditorState.angle + 90 + 180) % 360 + 360) % 360 - 180;
      document.getElementById('company-cover-image-angle').value = String(coverEditorState.angle);
      renderCoverEditor();
    });
    document.getElementById('company-cover-flip-horizontal').addEventListener('click', () => { coverEditorState.flipX *= -1; renderCoverEditor(); });
    document.getElementById('company-cover-flip-vertical').addEventListener('click', () => { coverEditorState.flipY *= -1; renderCoverEditor(); });
    document.getElementById('company-cover-image-zoom').addEventListener('input', event => { coverEditorState.zoom = Number(event.target.value); renderCoverEditor(); });
    document.getElementById('company-cover-image-angle').addEventListener('input', event => { coverEditorState.angle = Number(event.target.value); renderCoverEditor(); });
    coverFilterButtons.forEach(button => button.addEventListener('click', () => {
      coverEditorState.filter = button.dataset.coverImageFilter === 'none' ? 'none' : button.dataset.coverImageFilter;
      coverFilterButtons.forEach(item => item.classList.toggle('active', item === button));
      renderCoverEditor();
    }));
    ['brightness','contrast','saturation','vignette'].forEach(key => {
      document.getElementById('company-cover-' + key).addEventListener('input', event => {
        coverEditorState[key] = Number(event.target.value);
        document.getElementById('company-cover-' + key + '-value').textContent = event.target.value + '%';
        renderCoverEditor();
      });
    });
    coverEditorSave.addEventListener('click', async () => {
      if (!coverEditorState.image) return;
      coverEditorSave.disabled = true;
      coverEditorFeedback.textContent = 'Salvando alterações...';
      try {
        let quality = .9;
        let editedImage = coverEditorCanvas.toDataURL('image/jpeg', quality);
        while (editedImage.length > 1400000 && quality > .45) {
          quality -= .1;
          editedImage = coverEditorCanvas.toDataURL('image/jpeg', quality);
        }
        if (editedImage.length > 1400000) throw new Error('Não foi possível reduzir a imagem para o tamanho permitido.');
        await Conecta.api('/api/empresa/perfil/imagem', { method: 'PUT', body: JSON.stringify({ campo: 'banner_perfil', imagem: editedImage }) });
        await loadCompanyProfile();
        coverModalImage.src = companyProfileCache.banner_perfil;
        coverModalImage.hidden = false;
        coverEditAction.disabled = false;
        coverDeleteAction.disabled = false;
        closeCoverImageEditor(false);
        openCoverModal();
        coverFeedback.textContent = 'Foto de capa atualizada com sucesso.';
      } catch (error) {
        coverEditorFeedback.textContent = error.message || 'Não foi possível salvar a foto de capa.';
      } finally {
        coverEditorSave.disabled = false;
      }
    });
    coverChangeAction.addEventListener('click', () => showImageGuidelines('banner', () => coverInput.click()));
    coverInput.addEventListener('change', async () => {
      const file = coverInput.files[0];
      if (!file) return;
      coverChangeAction.disabled = true;
      coverFeedback.textContent = 'Preparando imagem...';
      try {
        const image = await prepareCompanyProfileImage(file,1600,600);
        await Conecta.api('/api/empresa/perfil/imagem',{method:'PUT',body:JSON.stringify({campo:'banner_perfil',imagem:image})});
        await loadCompanyProfile();
        coverModalImage.src = companyProfileCache.banner_perfil;
        coverModalImage.hidden = false;
        coverEditAction.disabled = false;
        coverDeleteAction.disabled = false;
        coverEditAction.textContent = 'Editar';
        coverFeedback.textContent = 'Foto de capa atualizada com sucesso.';
        Conecta.toast('Imagem de capa atualizada com sucesso.');
      } catch (error) {
        coverFeedback.textContent = error.message;
      } finally {
        coverChangeAction.disabled = false;
        coverInput.value = '';
      }
    });
    coverDeleteAction.addEventListener('click', async () => {
      if (!companyProfileCache.banner_perfil) return;
      if (!window.confirm('Tem certeza de que deseja excluir a foto de capa da empresa?')) return;
      coverDeleteAction.disabled = true;
      coverFeedback.textContent = 'Excluindo imagem...';
      try {
        await Conecta.api('/api/empresa/perfil/imagem',{method:'PUT',body:JSON.stringify({campo:'banner_perfil',imagem:null})});
        await loadCompanyProfile();
        coverModalImage.removeAttribute('src');
        coverModalImage.hidden = true;
        coverEditAction.disabled = true;
        coverDeleteAction.disabled = true;
        coverEditAction.textContent = 'Editar';
        coverFeedback.textContent = 'Foto de capa excluída.';
      } catch (error) {
        coverFeedback.textContent = error.message;
        coverDeleteAction.disabled = false;
      }
    });

    const galleryInput = document.getElementById('company-gallery-input');
    const galleryGrid = document.getElementById('company-gallery-grid');
    const galleryFeedback = document.getElementById('company-gallery-feedback');
    const renderCompanyGallery = async () => {
      const data = await Conecta.api('/api/empresa/fotos');
      const photos = data.fotos;
      galleryGrid.innerHTML = photos.length ? photos.map(photo => {
        const date = new Date(photo.criada_em);
        const dateLabel = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
        return `<figure class="company-gallery-item"><img src="${escapeHTML(photo.url)}" alt="Foto da empresa" loading="lazy"><span class="company-gallery-date">${escapeHTML(dateLabel)}</span><button type="button" data-remove-company-photo="${photo.id}" aria-label="Remover foto">Remover</button></figure>`;
      }).join('') : '<div class="dashboard-empty">Adicione fotos para apresentar sua empresa.</div>';
      const remaining = Math.max(0, 4 - data.fotos.length);
      galleryInput.disabled = remaining === 0;
      const addLabel = document.querySelector('label[for="company-gallery-input"]');
      if (addLabel) { addLabel.classList.toggle('is-disabled', remaining === 0); addLabel.textContent = remaining === 0 ? 'Limite de 4 fotos atingido' : 'Adicionar fotos (' + remaining + ' restantes)'; }
      galleryGrid.querySelectorAll('[data-remove-company-photo]').forEach(button => button.addEventListener('click', async () => {
        if (!window.confirm('Deseja remover esta foto da galeria?')) return;
        button.disabled = true;
        try { await Conecta.api('/api/empresa/fotos/' + button.dataset.removeCompanyPhoto, { method: 'DELETE' }); await renderCompanyGallery(); }
        catch (error) { Conecta.toast(error.message); button.disabled = false; }
      }));
    };
    if (galleryInput) {
      galleryInput.addEventListener('change', async () => {
        const files = Array.from(galleryInput.files || []);
        galleryInput.value = '';
        const current = await Conecta.api('/api/empresa/fotos');
        const remaining = Math.max(0, 4 - current.fotos.length);
        if (!remaining) { galleryFeedback.textContent = 'Sua empresa já publicou as 4 fotos permitidas.'; return; }
        if (files.length > remaining) { galleryFeedback.textContent = 'Você pode adicionar mais ' + remaining + ' foto(s).'; files.splice(remaining); }
        for (const file of files) {
          try {
            const image = await prepareCompanyImage(file, 1200, 900);
            await Conecta.api('/api/empresa/fotos', { method: 'POST', body: JSON.stringify({ imagem: image }) });
          } catch (error) { galleryFeedback.textContent = error.message; break; }
        }
        try { await renderCompanyGallery(); } catch (error) { galleryFeedback.textContent = error.message; }
      });
      renderCompanyGallery().catch(error => { galleryFeedback.textContent = error.message; });
    }

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
    applications.innerHTML = data.candidaturas.length ? data.candidaturas.map(item => {
      const answers = Array.isArray(item.respostas) ? item.respostas : [];
      const answerHtml = answers.length
        ? '<div class="candidate-message"><strong>Respostas às perguntas</strong>' + answers.map(answer => '<p><strong>' + escapeHTML(answer.pergunta) + '</strong><br>' + escapeHTML(answer.resposta) + '</p>').join('') + '</div>'
        : '';
      const resumeLink = item.curriculo_storage_key
        ? '<a class="button button-outline button-small" href="/api/candidaturas/' + encodeURIComponent(item.id) + '/curriculo" target="_blank" rel="noopener">Baixar currículo PDF</a>'
        : item.curriculo_url
          ? '<a class="button button-outline button-small" href="' + escapeHTML(item.curriculo_url) + '" target="_blank" rel="noopener noreferrer">Abrir currículo</a>'
          : '<span class="status-label">Sem currículo</span>';
      return '<article class="dashboard-item"><div><h3>' + escapeHTML(item.candidato_nome) + '</h3><p>' + escapeHTML(item.candidato_email) + ' · ' + escapeHTML(item.telefone || 'Sem telefone') + '</p><p>Vaga: ' + escapeHTML(item.vaga_titulo) + ' · ' + dateLabel(item.criada_em) + '</p>' + (item.mensagem ? '<div class="candidate-message">' + escapeHTML(item.mensagem) + '</div>' : '') + answerHtml + '<div class="dashboard-item-actions">' + resumeLink + '</div></div><div class="dashboard-item-actions"><select aria-label="Atualizar situação da candidatura" data-application-status="' + escapeHTML(item.id) + '"><option value="recebida" ' + (item.status === 'recebida' ? 'selected' : '') + '>Recebida</option><option value="em_analise" ' + (item.status === 'em_analise' ? 'selected' : '') + '>Em análise</option><option value="entrevista" ' + (item.status === 'entrevista' ? 'selected' : '') + '>Entrevista</option><option value="aprovada" ' + (item.status === 'aprovada' ? 'selected' : '') + '>Aprovada</option><option value="rejeitada" ' + (item.status === 'rejeitada' ? 'selected' : '') + '>Não aprovada</option></select></div></article>';
    }).join('') : '<div class="dashboard-empty">Ainda não há candidaturas para suas vagas.</div>';
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
        const dadosVaga = Object.fromEntries(new FormData(form));
        dadosVaga.perguntasCandidatura = String(dadosVaga.perguntasCandidatura || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, 5);
        await Conecta.api('/api/vagas', { method: 'POST', body: JSON.stringify(dadosVaga) });
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
    setupCompanyProfileEditor();
    initPanel();
  });
})();