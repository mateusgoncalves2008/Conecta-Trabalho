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

  async function prepareCandidateImage(file, maxDimension) {
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
    document.getElementById('candidate-change-photo').addEventListener('click', openPhotoViewer);
    document.getElementById('candidate-profile-avatar').addEventListener('click', openPhotoViewer);
    document.getElementById('candidate-profile-initials').addEventListener('click', openPhotoViewer);
    document.getElementById('candidate-photo-viewer-close').addEventListener('click', closePhotoViewer);
    photoViewer.addEventListener('click', event => { if (event.target === photoViewer) closePhotoViewer(); });
    const imageEditor = document.getElementById('candidate-image-editor');
    const editorCanvas = document.getElementById('candidate-image-editor-canvas');
    const editorContext = editorCanvas.getContext('2d');
    const editorInput = document.getElementById('candidate-image-editor-input');
    const editorState = { image: null, angle: 0, zoom: 1, flipX: 1, flipY: 1, filter: 'none', brightness: 100, contrast: 100, saturation: 100, vignette: 0 };
    function renderImageEditor() {
      const image = editorState.image;
      if (!image) return;
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
      editorContext.filter = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%) saturate(${editorState.saturation}%) ${editorState.filter}`;
      editorContext.drawImage(image, -image.width / 2, -image.height / 2, image.width, image.height);
      editorContext.restore();
      if (editorState.vignette > 0) {
        const gradient = editorContext.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.72);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${editorState.vignette / 100})`);
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
    function closeImageEditor() {
      imageEditor.classList.remove('is-open');
      imageEditor.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('candidate-image-editor-open');
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
      if (tab.dataset.editorTab === 'change') editorInput.click();
    }));
    document.getElementById('candidate-image-editor-choose')?.addEventListener('click', () => editorInput.click());
    const loadImageIntoEditor = file => {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { Conecta.toast('Escolha uma imagem de até 5 MB.'); return; }
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        editorState.image = image; editorState.angle = 0; editorState.zoom = 1; editorState.flipX = 1; editorState.flipY = 1; editorState.filter = 'none';
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
      image.onerror = () => { URL.revokeObjectURL(url); Conecta.toast('Este formato de imagem não é compatível com o navegador.'); };
      image.src = url;
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
        candidateProfileCache.nome ? candidateProfileCache.nome.split(/\\s+/)[0] + '_, ajude outras pessoas a reconhecer você.' : 'Ajude outras pessoas a reconhecer você.';
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
    document.getElementById('candidate-camera-close').addEventListener('click', closeCandidateCamera);
    cameraModal.addEventListener('click', event => { if (event.target === cameraModal) closeCandidateCamera(); });
    document.getElementById('candidate-camera-capture').addEventListener('click', () => {
      if (!cameraStream || !cameraVideo.videoWidth || !cameraVideo.videoHeight) {
        cameraFeedback.textContent = 'A câmera ainda está iniciando. Aguarde um instante.';
        return;
      }
      const canvas = document.createElement('canvas');
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(cameraVideo.videoWidth, cameraVideo.videoHeight));
      canvas.width = Math.round(cameraVideo.videoWidth * scale);
      canvas.height = Math.round(cameraVideo.videoHeight * scale);
      canvas.getContext('2d').drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) {
          cameraFeedback.textContent = 'Não foi possível capturar a foto. Tente novamente.';
          return;
        }
        const photoFile = new File([blob], 'foto-perfil-camera.jpg', { type: 'image/jpeg' });
        closeCandidateCamera();
        loadImageIntoEditor(photoFile);
      }, 'image/jpeg', 0.92);
    });
    document.getElementById('candidate-photo-upload').addEventListener('click', () => {
      closePhotoUpdateModal();
      editorInput.removeAttribute('capture');
      editorInput.click();
    });
    document.getElementById('candidate-photo-seals').addEventListener('click', () => {
      Conecta.toast('O recurso de selos ainda será disponibilizado.');
    });
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
    document.getElementById('candidate-change-cover').addEventListener('click', () => quickCoverInput.click());

    async function handleQuickImage(input, field, maxDimension) {
      input.addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) return;
        const trigger = field === 'foto_perfil'
          ? document.getElementById('candidate-change-photo')
          : document.getElementById('candidate-change-cover');
        trigger.disabled = true;
        try {
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