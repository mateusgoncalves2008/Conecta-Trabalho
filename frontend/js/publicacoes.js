(() => {
  const feed = document.getElementById('publication-feed');
  if (!feed) return;

  const api = window.Conecta && window.Conecta.api;
  const toast = message => window.Conecta && window.Conecta.toast(message);
  const composer = document.getElementById('publication-composer');
  const createEntry = document.getElementById('create-publication-entry');
  const openComposerButton = document.getElementById('open-publication-composer');
  const closeComposerButton = document.getElementById('close-publication-composer');
  const profileAvatar = document.getElementById('composer-profile-avatar');
  const photoPicker = document.getElementById('publication-photo-picker');
  const videoPicker = document.getElementById('publication-video-picker');
  const form = document.getElementById('publication-form');
  const descriptionInput = document.getElementById('publication-description');
  const titleInput = document.getElementById('publication-title');
  const editorLayout = document.getElementById('composer-editor-layout');
  const phoneMedia = document.getElementById('composer-phone-media');
  const phoneTitle = document.getElementById('composer-phone-title');
  const phoneDescription = document.getElementById('composer-phone-description');
  const mediaHeading = document.getElementById('composer-media-heading');
  const mediaCount = document.getElementById('composer-media-count');
  const mediaHelp = document.getElementById('composer-media-help');
  const addMediaButton = document.getElementById('composer-add-media');
  const titleCount = document.getElementById('publication-title-count');
  const descriptionCount = document.getElementById('publication-description-count');
  const descriptionField = document.getElementById('composer-description-field');
  const fileInput = document.getElementById('publication-files');
  const preview = document.getElementById('upload-preview');
  const dropzone = document.getElementById('composer-dropzone');
  const dropzoneTitle = document.getElementById('composer-dropzone-title');
  const dropzoneDescription = document.getElementById('composer-dropzone-description');
  const photoGuidelines = document.getElementById('composer-photo-guidelines');
  const videoGuidelines = document.getElementById('composer-video-guidelines');
  const publishButton = document.getElementById('publish-button');
  const progress = document.getElementById('upload-progress');
  const progressText = document.getElementById('upload-progress-text');
  const mediaFeedback = document.getElementById('composer-media-feedback');
  const loadMoreButton = document.getElementById('load-more');
  const reportDialog = document.getElementById('report-dialog');
  const reportForm = document.getElementById('report-form');
  const reportReason = document.getElementById('report-reason');
  const reportDetail = document.getElementById('report-detail');
  const reportDetailLabel = document.getElementById('report-detail-label');
  let currentUser = null;
  let selectedFiles = [];
  let uploadedMedia = [];
  let cursor = 0;
  let reportTarget = null;
  let loading = false;

  const videoLoader = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const video = entry.target;
          videoLoader.unobserve(video);
          const source = video.dataset.lazySrc;
          if (!source) return;
          video.src = source;
          video.removeAttribute('data-lazy-src');
          video.load();
        });
      }, { rootMargin: '1000px 0px' })
    : null;

  function observeLazyVideos(root) {
    const videos = root.querySelectorAll('video[data-lazy-src]');
    videos.forEach(video => {
      if (videoLoader) videoLoader.observe(video);
      else {
        video.src = video.dataset.lazySrc;
        video.removeAttribute('data-lazy-src');
      }
    });
  }

  const escapeHTML = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const initials = name => String(name || 'CT').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
  const formatDate = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };
  const formatBytes = bytes => bytes >= 1024 * 1024
    ? (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB'
    : Math.ceil(bytes / 1024) + ' KB';

  async function loadUser() {
    try {
      const result = await api('/api/me');
      currentUser = result.usuario || null;
    } catch {
      currentUser = null;
    }
    if (currentUser) {
      createEntry.hidden = false;
      composer.hidden = true;
      const accountName = currentUser.nomeEmpresa || currentUser.nome || currentUser.nome_empresa || 'Minha conta';
      document.getElementById('composer-account').textContent = accountName;
      const avatarUrl = currentUser.fotoPerfil || currentUser.foto_perfil || currentUser.foto || currentUser.avatar || '';
      profileAvatar.innerHTML = avatarUrl ? '<img src="' + escapeHTML(avatarUrl) + '" alt="">' : '<span>' + escapeHTML(initials(accountName)) + '</span>';
      void api('/api/publicacoes/moderacao/acesso').then(moderation => {
        if (!moderation.autorizado) return;
        const shortcut = document.createElement('a');
        shortcut.className = 'moderation-shortcut';
        shortcut.href = '/pages/moderacao-publicacoes.html';
        shortcut.textContent = 'Analisar denúncias';
        document.querySelector('.publicacoes-heading').appendChild(shortcut);
      }).catch(() => {});
    } else {
      createEntry.hidden = true;
      composer.hidden = true;
    }
  }

  function renderMedia(media, prioritizeFirstPost) {
    if (!media.length) return '';
    const classes = media.length === 1 ? 'publication-media single' : 'publication-media';
    return '<div class="' + classes + '">' + media.map((item, index) => {
      const more = index === 3 && media.length > 4
        ? '<span class="publication-media-more">+' + (media.length - 4) + '</span>'
        : '';
      const prioritize = prioritizeFirstPost && index === 0;
      if (item.tipo === 'video') {
        return '<div class="publication-media-item"><video controls playsinline preload="metadata" ' +
          (prioritize ? 'fetchpriority="high" ' : '') +
          'data-lazy-src="' + escapeHTML(item.url) + '" aria-label="Vídeo publicado"></video></div>';
      }
      return '<div class="publication-media-item"><img loading="' + (prioritize ? 'eager' : 'lazy') + '" ' +
        (prioritize ? 'fetchpriority="high" ' : '') +
        'src="' + escapeHTML(item.url) + '" alt="Foto da publicação">' + more + '</div>';
    }).join('') + '</div>';
  }

  function renderReactions(post) {
    const total = (post.reacoes || []).reduce((sum, item) => sum + Number(item.total || 0), 0);
    const liked = Boolean(post.minhaCurtida);
    return '<div class="publication-actions">' +
      '<div class="reaction-control">' +
        '<button type="button" class="like-toggle-button' + (liked ? ' liked' : '') + '" data-action="like" data-efeito="icone-curtir" data-id="' + post.id + '" aria-pressed="' + liked + '" aria-label="' + (liked ? 'Remover curtida' : 'Curtir publicação') + '">' +
          '<svg class="like-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
          '<strong data-reaction-total>' + total.toLocaleString('pt-BR') + '</strong>' +
        '</button>' +
      '</div>' +
      (post.minha ? '<button type="button" class="report-button" data-action="delete" data-id="' + post.id + '">Excluir</button>' :
        '<button type="button" class="report-button" data-action="report" data-id="' + post.id + '">Denunciar</button>') +
      '</div>';
  }

  function renderPost(post, postIndex) {
    const longDescription = (post.descricao || '').length > 260;
    const description = post.descricao
      ? '<div class="publication-description' + (longDescription ? ' is-collapsed' : '') + '" data-description>' + escapeHTML(post.descricao) + '</div>' +
        (longDescription ? '<button type="button" class="description-toggle" data-action="expand">Ver mais...</button>' : '')
      : '';
    const avatar = post.autor.foto
      ? '<img src="' + escapeHTML(post.autor.foto) + '" alt="">'
      : escapeHTML(initials(post.autor.nome));
    const authorDetail = post.autor.tipo === 'empresa'
      ? '<span data-followers-count>' + Number(post.autor.totalSeguidores || 0).toLocaleString('pt-BR') + '</span> seguidores'
      : escapeHTML(post.autor.tituloProfissional || 'Título profissional não informado');
    const authorProfileUrl = post.autor.tipo === 'empresa'
      ? '/pages/empresa-perfil.html?id=' + encodeURIComponent(post.autor.id)
      : '/pages/candidato-perfil.html?id=' + encodeURIComponent(post.autor.id);
    const authorName = escapeHTML(post.autor.nome);
    return '<article class="publication-card" data-post-id="' + post.id + '">' +
      '<header class="publication-card-header"><a class="publication-avatar publication-author-link" href="' + escapeHTML(authorProfileUrl) + '" aria-label="Ver perfil de ' + authorName + '">' + avatar + '</a>' +
      '<div class="publication-author"><a class="publication-author-name-link" href="' + escapeHTML(authorProfileUrl) + '">' + authorName + '</a><small>' + authorDetail + ' · ' + escapeHTML(formatDate(post.criadaEm)) + '</small></div>' +
      (currentUser && currentUser.tipo === 'candidato' && post.autor.tipo === 'empresa' && !post.minha
        ? '<button type="button" class="follow-company-button' + (post.autor.seguindo ? ' is-following' : '') + '" data-action="follow-company" data-id="' + post.autor.id + '" aria-pressed="' + Boolean(post.autor.seguindo) + '">' + (post.autor.seguindo ? 'Seguindo' : 'Seguir') + '</button>'
        : '') +
      '</header>' + description + renderMedia(post.midias || [], postIndex === 0) +
      '<footer class="publication-card-footer">' + renderReactions(post) + '</footer></article>';
  }

  function updateLikeUI(card, liked, total) {
    const button = card.querySelector('[data-action="like"]');
    const totalElement = card.querySelector('[data-reaction-total]');
    if (!button || !totalElement) return;
    button.classList.toggle('liked', liked);
    button.setAttribute('aria-pressed', String(liked));
    button.setAttribute('aria-label', liked ? 'Remover curtida' : 'Curtir publicação');
    totalElement.textContent = Math.max(0, total).toLocaleString('pt-BR');
  }

  async function loadPosts(reset) {
    if (loading) return;
    loading = true;
    loadMoreButton.disabled = true;
    if (reset) {
      cursor = 0;
      feed.innerHTML = '<div class="feed-loading">Carregando publicações...</div>';
    }
    try {
      const query = '?limit=10&cursor=' + cursor;
      const result = await api('/api/publicacoes' + query);
      const posts = result.publicacoes || [];
      if (reset) feed.innerHTML = '';
      if (!posts.length && reset) {
        feed.innerHTML = '<div class="feed-empty">Ainda não há publicações. Volte em breve para conferir as novidades.</div>';
      } else {
        feed.insertAdjacentHTML('beforeend', posts.map((post, index) => renderPost(post, index)).join(''));
        observeLazyVideos(feed);
      }
      cursor = result.proximoCursor;
      loadMoreButton.hidden = cursor === null;
      document.getElementById('feed-count-label').textContent = posts.length
        ? 'Novidades de candidatos e empresas'
        : 'Publicações da comunidade';
    } catch (error) {
      if (reset) feed.innerHTML = '<div class="feed-empty">Não foi possível carregar as publicações. Atualize a página para tentar novamente.</div>';
      toast(error.message);
    } finally {
      loading = false;
      loadMoreButton.disabled = false;
    }
  }


  async function compressImage(file) {
    if (!window.createImageBitmap) return file;
    let bitmap;
    try { bitmap = await createImageBitmap(file); } catch { return file; }
    const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { alpha: true });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const toBlob = quality => new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    let blob = await toBlob(0.88);
    if (!blob) return file;
    if (blob.size > 20 * 1024 * 1024) blob = await toBlob(0.78);
    if (!blob || blob.size > 20 * 1024 * 1024) return file;
    if (blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return new File([blob], name, { type: 'image/webp', lastModified: Date.now() });
  }

  async function compressVideo(file) {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return file;
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let stream = null;
    let audioContext = null;
    let frameHandle = 0;
    video.preload = 'auto';
    video.playsInline = true;
    video.src = url;
    try {
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('Não foi possível preparar o vídeo.'));
      });
      const scale = Math.min(1, 1920 / video.videoWidth, 1080 / video.videoHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d');
      const videoStream = canvas.captureStream(30);
      let audioTracks = [];
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
        const source = audioContext.createMediaElementSource(video);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        await audioContext.resume();
        audioTracks = destination.stream.getAudioTracks();
      } else if (typeof video.captureStream === 'function') {
        video.muted = true;
        audioTracks = video.captureStream().getAudioTracks();
      }
      stream = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks]);
      const drawFrame = () => {
        if (video.readyState >= 2) context.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (!video.ended) frameHandle = requestAnimationFrame(drawFrame);
      };
      drawFrame();

      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) return file;
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2200000,
        audioBitsPerSecond: 128000
      });
      const chunks = [];
      const finished = new Promise((resolve, reject) => {
        recorder.ondataavailable = event => { if (event.data && event.data.size) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error('Não foi possível comprimir o vídeo neste navegador.'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });
      const playbackEnded = new Promise((resolve, reject) => {
        video.onended = resolve;
        video.onerror = () => reject(new Error('Falha durante a leitura do vídeo.'));
      });
      recorder.start(1000);
      await video.play();
      await playbackEnded;
      if (recorder.state !== 'inactive') recorder.stop();
      const blob = await finished;
      if (!blob.size || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webm', {
        type: 'video/webm',
        lastModified: Date.now()
      });
    } catch {
      return file;
    } finally {
      if (frameHandle) cancelAnimationFrame(frameHandle);
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (audioContext) {
        try { await audioContext.close(); } catch {}
      }
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    }
  }

  function discardStagedMedia() {
    const staged = uploadedMedia.splice(0, uploadedMedia.length);
    if (!api) return;
    staged.forEach(media => {
      if (!media || !media.id) return;
      api('/api/publicacoes/upload/' + encodeURIComponent(media.id), { method: 'DELETE' }).catch(() => {});
    });
  }

  function clearPreview() {
    selectedFiles.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
    selectedFiles = [];
    discardStagedMedia();
    preview.innerHTML = '';
    preview.hidden = true;
    editorLayout.hidden = true;
    photoGuidelines.hidden = false;
    videoGuidelines.hidden = true;
    composer.querySelector('.composer-media-tabs').hidden = false;
    titleInput.value = '';
    phoneMedia.innerHTML = '<i class="fa-regular fa-image"></i>';
    phoneTitle.textContent = 'Seu título aparecerá aqui';
    phoneDescription.textContent = 'Sua descrição aparecerá aqui.';
    titleCount.textContent = '0/90';
    descriptionCount.textContent = '0/4000';
    dropzone.hidden = false;
    descriptionField.hidden = true;
    publishButton.disabled = true;
    fileInput.value = '';
    photoPicker.value = '';
    videoPicker.value = '';
  }

  function renderPreview() {
    const isVideo = selectedFiles[0]?.kind === 'video';
    preview.innerHTML = selectedFiles.map((item, index) => {
      const media = item.kind === 'video'
        ? '<div class="upload-video-placeholder"><i class="fa-solid fa-film" aria-hidden="true"></i></div>'
        : '<img src="' + item.previewUrl + '" alt="">';
      return '<div class="upload-preview-item' + (index === 0 ? ' is-cover' : '') + '">' + media +
        (index === 0 ? '<strong class="upload-cover-label">Capa</strong>' : '') +
        '<button type="button" data-remove-file="' + index + '" aria-label="Remover arquivo">×</button></div>';
    }).join('') + (!isVideo && selectedFiles.length < 10 ? '<button type="button" class="upload-add-tile" data-add-media aria-label="Adicionar fotos"><i class="fa-solid fa-plus"></i></button>' : '');
    preview.hidden = !selectedFiles.length;
    dropzone.hidden = selectedFiles.length > 0;
    editorLayout.hidden = !selectedFiles.length;
    photoGuidelines.hidden = selectedFiles.length > 0;
    videoGuidelines.hidden = true;
    composer.querySelector('.composer-media-tabs').hidden = selectedFiles.length > 0;
    descriptionField.hidden = !selectedFiles.length;
    mediaHeading.textContent = isVideo ? 'Vídeo' : 'Fotos';
    mediaCount.textContent = isVideo ? '1 vídeo carregado' : selectedFiles.length + (selectedFiles.length === 1 ? ' foto carregada' : ' fotos carregadas');
    mediaHelp.textContent = isVideo ? 'Pré-visualização do vídeo selecionado.' : 'Arraste e solte para reordenar.';
    addMediaButton.hidden = isVideo || selectedFiles.length >= 10;
    phoneMedia.innerHTML = isVideo
      ? '<div class="composer-phone-video"><i class="fa-solid fa-play"></i><span>Prévia do vídeo</span></div>'
      : '<img src="' + selectedFiles[0].previewUrl + '" alt="Prévia da foto">';
    phoneTitle.textContent = titleInput.value || 'Seu título aparecerá aqui';
    phoneDescription.textContent = descriptionInput.value || 'Sua descrição aparecerá aqui.';
    publishButton.disabled = !selectedFiles.length;
  }

  function getSupportedVideoFile(file) {
    const extension = String(file.name || '').split('.').pop().toLowerCase();
    const mimeByExtension = {
      mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
      mkv: 'video/x-matroska', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv',
      flv: 'video/x-flv', mpeg: 'video/mpeg', mpg: 'video/mpeg',
      m4v: 'video/x-m4v', '3gp': 'video/3gpp', ogv: 'video/ogg', ts: 'video/mp2t'
    };
    const mime = mimeByExtension[extension];
    if (!mime) return null;
    if (file.type === mime) return file;
    return new File([file], file.name, { type: mime, lastModified: file.lastModified || Date.now() });
  }

  async function processSelectedFiles(files) {
    clearPreview();
    mediaFeedback.hidden = true;
    mediaFeedback.textContent = '';
    if (!files.length) return;
    const original = files[0];
    const extension = String(original.name || '').split('.').pop().toLowerCase();
    const isVideo = original.type.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi', 'wmv', 'flv', 'mpeg', 'mpg', 'm4v', '3gp', 'ogv', 'ts'].includes(extension);
    if (isVideo && files.length !== 1) {
      mediaFeedback.textContent = 'Escolha somente um vídeo por publicação.';
      mediaFeedback.hidden = false;
      return;
    }
    if (!isVideo && files.length > 10) {
      mediaFeedback.textContent = 'Você pode selecionar até 10 fotos por publicação.';
      mediaFeedback.hidden = false;
      return;
    }
    fileInput.disabled = true;
    progress.hidden = false;
    progressText.textContent = 'Preparando vídeo...';
    try {
      for (let index = 0; index < files.length; index++) {
        const source = files[index];
        const sourceExtension = String(source.name || '').split('.').pop().toLowerCase();
        const kind = source.type.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'avi', 'wmv', 'flv', 'mpeg', 'mpg', '3gp', 'ogv', 'ts'].includes(sourceExtension) ? 'video' : 'image';
        let file = source;
        let duration = null;
        if (kind === 'image') {
          const allowed = ['image/jpeg', 'image/png', 'image/webp'];
          if (!allowed.includes(file.type)) throw new Error('Formato de foto não permitido. Use JPG, PNG ou WebP.');
          if (file.size > 20 * 1024 * 1024) throw new Error('Cada foto deve ter no máximo 20 MB.');
          file = await compressImage(file);
        } else {
          file = getSupportedVideoFile(file);
          if (!file) throw new Error('Formato de vídeo não permitido. Confira a lista de formatos aceitos.');
          if (file.size > 150 * 1024 * 1024) throw new Error('O vídeo deve ter no máximo 150 MB.');
          progressText.textContent = 'Vídeo pronto para conversão no servidor...';
          duration = null;
        }
        selectedFiles.push({ file, kind, duration, previewUrl: kind === 'image' ? URL.createObjectURL(file) : null });
      }
      renderPreview();
      mediaFeedback.hidden = true;
      mediaFeedback.textContent = '';
    } catch (error) {
      clearPreview();
      mediaFeedback.textContent = error && error.message ? error.message : 'Não foi possível carregar este arquivo.';
      mediaFeedback.hidden = false;
    } finally {
      fileInput.disabled = false;
      progress.hidden = true;
    }
  }

  fileInput.addEventListener('change', () => processSelectedFiles([...(fileInput.files || [])]));
  photoPicker.addEventListener('change', () => {
    const addedFiles = [...(photoPicker.files || [])];
    const existingFiles = selectedFiles.filter(item => item.kind === 'image').map(item => item.file);
    processSelectedFiles([...existingFiles, ...addedFiles]);
  });
  videoPicker.addEventListener('change', () => processSelectedFiles([...(videoPicker.files || [])]));
  composer.addEventListener('click', event => {
    const button = event.target.closest('[data-open-picker]');
    if (!button) return;

    if (button.classList.contains('composer-media-tab')) {
      const selectedType = button.dataset.openPicker;
      composer.querySelectorAll('.composer-media-tab').forEach(tab => {
        tab.classList.toggle('is-active', tab === button);
      });
      composer.querySelectorAll('.composer-dropzone-actions [data-open-picker]').forEach(option => {
        option.hidden = option.dataset.openPicker !== selectedType;
      });
      const selectingPhotos = selectedType === 'photos';
      photoGuidelines.hidden = !selectingPhotos;
      videoGuidelines.hidden = selectingPhotos;
      if (selectingPhotos) {
        dropzoneTitle.textContent = 'Selecione fotos para carregar';
        dropzoneDescription.textContent = 'Ou arraste e solte-as aqui. Carregue até 10 fotos por publicação.';
      } else {
        dropzoneTitle.textContent = 'Selecione o vídeo a enviar';
        dropzoneDescription.textContent = 'Ou arraste e solte aqui';
      }
      return;
    }

    if (button.dataset.openPicker === 'photos') photoPicker.click();
    if (button.dataset.openPicker === 'video') videoPicker.click();
  });

  function openComposer() { composer.hidden = false; document.body.classList.add('publication-composer-open'); closeComposerButton.focus(); }
  function closeComposer() {
    composer.hidden = true; document.body.classList.remove('publication-composer-open');
    if (!progress.hidden) return;
    clearPreview(); descriptionInput.value = ''; titleInput.value = ''; openComposerButton.focus();
  }
  openComposerButton.addEventListener('click', openComposer);
  closeComposerButton.addEventListener('click', closeComposer);
  composer.addEventListener('keydown', event => { if (event.key === 'Escape' && progress.hidden) closeComposer(); });

  preview.addEventListener('click', event => {
    if (event.target.closest('[data-add-media]')) { photoPicker.click(); return; }
    const button = event.target.closest('[data-remove-file]');
    if (!button) return;
    const index = Number(button.dataset.removeFile);
    const item = selectedFiles[index];
    if (item && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    selectedFiles.splice(index, 1);
    if (!selectedFiles.length) clearPreview(); else renderPreview();
  });

  addMediaButton.addEventListener('click', () => photoPicker.click());
  titleInput.addEventListener('input', () => {
    titleCount.textContent = titleInput.value.length + '/90';
    phoneTitle.textContent = titleInput.value || 'Seu título aparecerá aqui';
  });
  descriptionInput.addEventListener('input', () => {
    descriptionCount.textContent = descriptionInput.value.length + '/4000';
    phoneDescription.textContent = descriptionInput.value || 'Sua descrição aparecerá aqui.';
  });
  composer.addEventListener('click', event => {
    const tokenButton = event.target.closest('[data-insert-token]');
    if (tokenButton) {
      const token = tokenButton.dataset.insertToken;
      descriptionInput.setRangeText(token, descriptionInput.selectionStart, descriptionInput.selectionEnd, 'end');
      descriptionInput.dispatchEvent(new Event('input', { bubbles: true }));
      descriptionInput.focus();
    }
    const previewTab = event.target.closest('[data-preview-mode]');
    if (previewTab) {
      composer.querySelectorAll('[data-preview-mode]').forEach(tab => tab.classList.toggle('is-active', tab === previewTab));
      composer.querySelector('.composer-phone').dataset.previewMode = previewTab.dataset.previewMode;
    }
  });

  async function uploadOne(item) {
    const response = await fetch('/api/publicacoes/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Media-Kind': item.kind,
        'X-Media-Mime': item.file.type,
        ...(item.duration ? { 'X-Media-Duration': String(item.duration) } : {})
      },
      body: item.file
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.erro || 'Não foi possível enviar um dos arquivos.');
    return data.midia;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentUser || !selectedFiles.length || publishButton.disabled) return;
    publishButton.disabled = true;
    fileInput.disabled = true;
    progress.hidden = false;
    const mediaIds = [];
    try {
      for (let index = 0; index < selectedFiles.length; index++) {
        progressText.textContent = 'Enviando arquivo ' + (index + 1) + ' de ' + selectedFiles.length + '...';
        const media = await uploadOne(selectedFiles[index]);
        uploadedMedia.push(media);
        mediaIds.push(media.id);
      }
      progressText.textContent = 'Publicando...';
      await api('/api/publicacoes', {
        method: 'POST',
        body: JSON.stringify({
          descricao: [titleInput.value.trim(), descriptionInput.value.trim()].filter(Boolean).join('\\n\\n'),
          midias: mediaIds
        })
      });
      descriptionInput.value = '';
      uploadedMedia = [];
      clearPreview();
      toast('Publicação criada com sucesso.');
      closeComposer();
      await loadPosts(true);
    } catch (error) {
      discardStagedMedia();
      toast(error.message);
      publishButton.disabled = false;
    } finally {
      fileInput.disabled = false;
      progress.hidden = true;
    }
  });

  loadMoreButton.addEventListener('click', () => loadPosts(false));

  feed.addEventListener('click', async event => {
    const expandButton = event.target.closest('[data-action="expand"]');
    if (expandButton) {
      const description = expandButton.parentElement.querySelector('[data-description]');
      const expanded = description.classList.toggle('is-collapsed') === false;
      expandButton.textContent = expanded ? 'Ver menos' : 'Ver mais...';
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const id = button.dataset.id;
    if (action === 'follow-company') {
      if (!currentUser || currentUser.tipo !== 'candidato') {
        window.location.href = '/pages/login.html';
        return;
      }
      const card = button.closest('.publication-card');
      if (!card || button.disabled) return;
      const wasFollowing = button.getAttribute('aria-pressed') === 'true';
      const followerCount = card.querySelector('[data-followers-count]');
      const previousCount = Number((followerCount?.textContent || '0').replace(/\\D/g, '')) || 0;
      button.disabled = true;
      button.textContent = wasFollowing ? 'Seguindo...' : 'Seguindo';
      try {
        const result = await api('/api/empresas/' + encodeURIComponent(id) + '/seguir', {
          method: wasFollowing ? 'DELETE' : 'POST'
        });
        const following = Boolean(result.seguindo);
        button.classList.toggle('is-following', following);
        button.setAttribute('aria-pressed', String(following));
        button.textContent = following ? 'Seguindo' : 'Seguir';
        if (followerCount) followerCount.textContent = Number(result.total_seguidores ?? previousCount + (following ? 1 : -1)).toLocaleString('pt-BR');
      } catch (error) {
        button.textContent = wasFollowing ? 'Seguindo' : 'Seguir';
        toast(error.message);
      } finally {
        button.disabled = false;
      }
      return;
    }
    if (action === 'like') {
      if (!currentUser) {
        window.location.href = '/pages/login.html';
        return;
      }
      const card = button.closest('.publication-card');
      if (!card) return;
      const totalElement = card.querySelector('[data-reaction-total]');
      const currentTotal = Number((totalElement?.textContent || '0').replace(/\\D/g, '')) || 0;
      const wasLiked = button.getAttribute('aria-pressed') === 'true';

      if (card.dataset.reacting === 'true') {
        const confirmedLiked = card.dataset.likeConfirmed === 'true';
        const desiredLiked = ! (card.dataset.likeDesired === 'true');
        card.dataset.likeDesired = String(desiredLiked);
        const confirmedTotal = Number(card.dataset.likeConfirmedTotal || currentTotal);
        updateLikeUI(card, desiredLiked, Math.max(0, confirmedTotal + (desiredLiked === confirmedLiked ? 0 : desiredLiked ? 1 : -1)));
        return;
      }

      card.dataset.reacting = 'true';
      card.dataset.likeConfirmed = String(wasLiked);
      card.dataset.likeDesired = String(!wasLiked);
      card.dataset.likeConfirmedTotal = String(currentTotal);

      const syncLike = async () => {
        try {
          while (card.dataset.likeDesired !== card.dataset.likeConfirmed) {
            const targetLiked = card.dataset.likeDesired === 'true';
            if (targetLiked) {
              await api('/api/publicacoes/' + id + '/reacao', {
                method: 'PUT',
                body: JSON.stringify({ emoji: '❤️' })
              });
            } else {
              await api('/api/publicacoes/' + id + '/reacao', { method: 'DELETE' });
            }
            const previousConfirmed = card.dataset.likeConfirmed === 'true';
            let confirmedTotal = Number(card.dataset.likeConfirmedTotal || 0);
            if (targetLiked !== previousConfirmed) confirmedTotal = Math.max(0, confirmedTotal + (targetLiked ? 1 : -1));
            card.dataset.likeConfirmed = String(targetLiked);
            card.dataset.likeConfirmedTotal = String(confirmedTotal);
            const desiredLiked = card.dataset.likeDesired === 'true';
            updateLikeUI(card, desiredLiked, Math.max(0, confirmedTotal + (desiredLiked === targetLiked ? 0 : desiredLiked ? 1 : -1)));
          }
        } catch (error) {
          const confirmedLiked = card.dataset.likeConfirmed === 'true';
          const confirmedTotal = Number(card.dataset.likeConfirmedTotal || 0);
          card.dataset.likeDesired = String(confirmedLiked);
          updateLikeUI(card, confirmedLiked, confirmedTotal);
          toast(error.message);
        } finally {
          delete card.dataset.reacting;
          delete card.dataset.likeConfirmed;
          delete card.dataset.likeDesired;
          delete card.dataset.likeConfirmedTotal;
        }
      };
      updateLikeUI(card, !wasLiked, Math.max(0, currentTotal + (wasLiked ? -1 : 1)));
      void syncLike();
      return;
    }
    if (action === 'delete') {
      if (!window.confirm('Deseja excluir esta publicação? As fotos ou o vídeo e todas as reações também serão excluídos.')) return;
      try {
        await api('/api/publicacoes/' + id, { method: 'DELETE' });
        toast('Publicação excluída.');
        await loadPosts(true);
      } catch (error) { toast(error.message); }
    }
    if (action === 'report') {
      if (!currentUser) {
        window.location.href = '/pages/login.html';
        return;
      }
      reportTarget = id;
      reportForm.reset();
      reportDetail.hidden = true;
      reportDetail.required = false;
      reportDetailLabel.hidden = true;
      reportDialog.showModal();
    }
  });





  reportReason.addEventListener('change', () => {
    const show = reportReason.value === 'Outro motivo';
    reportDetail.hidden = !show;
    reportDetailLabel.hidden = !show;
    reportDetail.required = show;
  });
  const closeReport = () => {
    reportDialog.close();
    reportTarget = null;
  };
  document.getElementById('report-close').addEventListener('click', closeReport);
  document.getElementById('report-cancel').addEventListener('click', closeReport);
  reportForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!reportTarget) return;
    const submit = reportForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const result = await api('/api/publicacoes/' + reportTarget + '/denuncias', {
        method: 'POST',
        body: JSON.stringify({
          motivo: reportReason.value,
          detalhe: reportDetail.value
        })
      });
      closeReport();
      toast(result.mensagem || 'Denúncia enviada.');
    } catch (error) {
      toast(error.message);
    } finally {
      submit.disabled = false;
    }
  });

  (async () => {
    if (!api) {
      document.body.classList.remove('publicacoes-auth-pending');
      feed.innerHTML = '<div class="feed-empty">Não foi possível iniciar a página. Atualize para tentar novamente.</div>';
      return;
    }
    await loadUser();
    if (!currentUser || !['candidato', 'empresa'].includes(currentUser.tipo)) {
      document.body.classList.remove('publicacoes-auth-pending');
      document.body.classList.add('publicacoes-access-denied');
      const accessMessage = document.getElementById('publicacoes-access-message');
      const backLink = document.getElementById('publicacoes-back-link');
      if (accessMessage) accessMessage.hidden = false;
      if (backLink) {
        let previousPage = '/';
        try {
          const referrer = new URL(document.referrer);
          if (referrer.origin === window.location.origin && !/\\/pages\\/publicacoes\\.html$/i.test(referrer.pathname)) {
            previousPage = referrer.pathname + referrer.search + referrer.hash;
          }
        } catch {}
        backLink.href = previousPage;
      }
      return;
    }
    document.body.classList.remove('publicacoes-auth-pending');
    if (new URLSearchParams(location.search).get('criar') === '1') openComposer();
    await loadPosts(true);
  })();
})();
