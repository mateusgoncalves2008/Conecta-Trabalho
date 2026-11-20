(() => {
  const feed = document.getElementById('publication-feed');
  if (!feed) return;

  const api = window.Conecta && window.Conecta.api;
  const toast = message => window.Conecta && window.Conecta.toast(message);
  const composer = document.getElementById('publication-composer');
  const visitorNote = document.getElementById('visitor-note');
  const form = document.getElementById('publication-form');
  const descriptionInput = document.getElementById('publication-description');
  const fileInput = document.getElementById('publication-files');
  const preview = document.getElementById('upload-preview');
  const publishButton = document.getElementById('publish-button');
  const progress = document.getElementById('upload-progress');
  const progressText = document.getElementById('upload-progress-text');
  const loadMoreButton = document.getElementById('load-more');
  const reportDialog = document.getElementById('report-dialog');
  const reportForm = document.getElementById('report-form');
  const reportReason = document.getElementById('report-reason');
  const reportDetail = document.getElementById('report-detail');
  const reportDetailLabel = document.getElementById('report-detail-label');
  const reactions = ['👍', '❤️', '😂', '👏', '🎉', '💡', '🔥'];
  let currentUser = null;
  let selectedFiles = [];
  let uploadedMedia = [];
  let cursor = 0;
  let reportTarget = null;
  let loading = false;

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
      composer.hidden = false;
      visitorNote.hidden = true;
      document.getElementById('composer-account').textContent = currentUser.nomeEmpresa || currentUser.nome || '';
      try {
        const moderation = await api('/api/publicacoes/moderacao/acesso');
        if (moderation.autorizado) {
          const shortcut = document.createElement('a');
          shortcut.className = 'moderation-shortcut';
          shortcut.href = '/pages/moderacao-publicacoes.html';
          shortcut.textContent = 'Analisar denúncias';
          document.querySelector('.publicacoes-heading').appendChild(shortcut);
        }
      } catch {}
    } else {
      composer.hidden = true;
      visitorNote.hidden = false;
    }
  }

  function renderMedia(media) {
    if (!media.length) return '';
    const classes = media.length === 1 ? 'publication-media single' : 'publication-media';
    return '<div class="' + classes + '">' + media.map((item, index) => {
      const more = index === 3 && media.length > 4
        ? '<span class="publication-media-more">+' + (media.length - 4) + '</span>'
        : '';
      if (item.tipo === 'video') {
        return '<div class="publication-media-item"><video controls playsinline preload="metadata" src="' + escapeHTML(item.url) + '" aria-label="Vídeo publicado"></video></div>';
      }
      return '<div class="publication-media-item"><img loading="lazy" src="' + escapeHTML(item.url) + '" alt="Foto da publicação">' + more + '</div>';
    }).join('') + '</div>';
  }

  function renderReactions(post) {
    const summary = (post.reacoes || []).filter(item => item.total > 0);
    const total = summary.reduce((sum, item) => sum + Number(item.total), 0);
    const reactionButtons = reactions.map(emoji => {
      const active = post.minhaReacao === emoji;
      const count = summary.find(item => item.emoji === emoji);
      return '<button type="button" class="reaction-button' + (active ? ' active' : '') + '" data-action="react" data-id="' + post.id + '" data-emoji="' + emoji + '" data-count="' + (count ? Number(count.total) : 0) + '" aria-pressed="' + active + '" aria-label="Reagir com ' + emoji + '">' + emoji + '</button>';
    }).join('');
    return '<div class="publication-actions">' +
      '<div class="reaction-control">' +
        '<button type="button" class="like-toggle-button" data-action="toggle-reactions" aria-expanded="false" aria-label="Abrir opções de reação">' +
          '<i class="fa-solid fa-thumbs-up" aria-hidden="true"></i><strong data-reaction-total>' + total.toLocaleString('pt-BR') + '</strong>' +
        '</button>' +
        '<div class="reaction-picker" hidden>' + reactionButtons + '</div>' +
      '</div>' +
      (post.minha ? '<button type="button" class="report-button" data-action="delete" data-id="' + post.id + '">Excluir</button>' :
        '<button type="button" class="report-button" data-action="report" data-id="' + post.id + '">Denunciar</button>') +
      '</div>';
  }

  function renderPost(post) {
    const longDescription = (post.descricao || '').length > 260;
    const description = post.descricao
      ? '<div class="publication-description' + (longDescription ? ' is-collapsed' : '') + '" data-description>' + escapeHTML(post.descricao) + '</div>' +
        (longDescription ? '<button type="button" class="description-toggle" data-action="expand">Ver mais...</button>' : '')
      : '';
    const avatar = post.autor.foto
      ? '<img src="' + escapeHTML(post.autor.foto) + '" alt="">'
      : escapeHTML(initials(post.autor.nome));
    const authorDetail = post.autor.tipo === 'empresa'
      ? Number(post.autor.totalSeguidores || 0).toLocaleString('pt-BR') + ' seguidores'
      : (post.autor.tituloProfissional || 'Título profissional não informado');
    return '<article class="publication-card" data-post-id="' + post.id + '">' +
      '<header class="publication-card-header"><div class="publication-avatar">' + avatar + '</div>' +
      '<div class="publication-author"><strong>' + escapeHTML(post.autor.nome) + '</strong><small>' + escapeHTML(authorDetail) + ' · ' + escapeHTML(formatDate(post.criadaEm)) + '</small></div>' +
      '</header>' + description + renderMedia(post.midias || []) +
      '<footer class="publication-card-footer">' + renderReactions(post) + '</footer></article>';
  }

  function updateReactionUI(card, nextEmoji) {
    const buttons = [...card.querySelectorAll('[data-action="react"]')];
    const previous = buttons.find(item => item.getAttribute('aria-pressed') === 'true');
    const previousEmoji = previous ? previous.dataset.emoji : null;
    if (previousEmoji === nextEmoji) return previousEmoji;

    const previousButton = previousEmoji ? buttons.find(item => item.dataset.emoji === previousEmoji) : null;
    const nextButton = nextEmoji ? buttons.find(item => item.dataset.emoji === nextEmoji) : null;
    if (previousButton) previousButton.dataset.count = String(Math.max(0, Number(previousButton.dataset.count || 0) - 1));
    if (nextButton) nextButton.dataset.count = String(Number(nextButton.dataset.count || 0) + 1);

    buttons.forEach(item => {
      const active = item.dataset.emoji === nextEmoji;
      const count = Number(item.dataset.count || 0);
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
      item.textContent = item.dataset.emoji + (count > 0 ? ' ' + count : '');
    });

    const total = buttons.reduce((sum, item) => sum + Number(item.dataset.count || 0), 0);
    const totalElement = card.querySelector('[data-reaction-total]');
    if (totalElement) totalElement.textContent = total.toLocaleString('pt-BR');
    return previousEmoji;
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
      const query = '?limit=15&cursor=' + cursor;
      const result = await api('/api/publicacoes' + query);
      const posts = result.publicacoes || [];
      if (reset) feed.innerHTML = '';
      if (!posts.length && reset) {
        feed.innerHTML = '<div class="feed-empty">Ainda não há publicações. Volte em breve para conferir as novidades.</div>';
      } else {
        feed.insertAdjacentHTML('beforeend', posts.map(renderPost).join(''));
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

  function readVideoDuration(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const duration = video.duration;
        URL.revokeObjectURL(url);
        if (!Number.isFinite(duration) || duration <= 0) reject(new Error('Não foi possível identificar a duração do vídeo.'));
        else if (duration > 60) reject(new Error('O vídeo deve ter no máximo 60 segundos.'));
        else resolve(duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Não foi possível abrir este vídeo.'));
      };
      video.src = url;
    });
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
    selectedFiles.forEach(item => URL.revokeObjectURL(item.previewUrl));
    selectedFiles = [];
    discardStagedMedia();
    preview.innerHTML = '';
    preview.hidden = true;
    publishButton.disabled = true;
    fileInput.value = '';
  }

  function renderPreview() {
    preview.innerHTML = selectedFiles.map((item, index) => {
      const media = item.kind === 'video'
        ? '<video muted playsinline src="' + item.previewUrl + '"></video>'
        : '<img src="' + item.previewUrl + '" alt="">';
      return '<div class="upload-preview-item">' + media +
        '<span>' + escapeHTML(formatBytes(item.file.size)) + '</span>' +
        '<button type="button" data-remove-file="' + index + '" aria-label="Remover arquivo">×</button></div>';
    }).join('');
    preview.hidden = !selectedFiles.length;
    publishButton.disabled = !selectedFiles.length;
  }

  fileInput.addEventListener('change', async () => {
    const files = [...(fileInput.files || [])];
    clearPreview();
    if (!files.length) return;
    const isVideo = file => file.type.startsWith('video/');
    const hasVideo = files.some(isVideo);
    if ((hasVideo && files.length !== 1) || (!hasVideo && files.length > 10)) {
      toast('Escolha somente 1 vídeo ou até 10 fotos por publicação.');
      return;
    }
    fileInput.disabled = true;
    progress.hidden = false;
    try {
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        progressText.textContent = 'Preparando arquivo ' + (fileIndex + 1) + ' de ' + files.length + '...';
        const original = files[fileIndex];
        const kind = isVideo(original) ? 'video' : 'image';
        const allowed = kind === 'video'
          ? ['video/mp4', 'video/webm']
          : ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(original.type)) throw new Error('Formato não permitido. Use JPG, PNG, WebP, MP4 ou WebM.');
        let duration = null;
        let file = original;
        if (kind === 'image') {
          if (file.size > 20 * 1024 * 1024) throw new Error('Cada foto deve ter no máximo 20 MB.');
          file = await compressImage(file);
        } else {
          if (file.size > 150 * 1024 * 1024) throw new Error('O vídeo deve ter no máximo 150 MB.');
          duration = await readVideoDuration(file);
          file = await compressVideo(file);
          if (file.size > 150 * 1024 * 1024) throw new Error('O vídeo deve ter no máximo 150 MB mesmo depois da compressão.');
        }
        selectedFiles.push({
          file,
          kind,
          duration,
          previewUrl: URL.createObjectURL(file)
        });
      }
      renderPreview();
    } catch (error) {
      clearPreview();
      toast(error.message);
    } finally {
      fileInput.disabled = false;
      progress.hidden = true;
    }
  });

  preview.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-file]');
    if (!button) return;
    const index = Number(button.dataset.removeFile);
    const item = selectedFiles[index];
    if (item) URL.revokeObjectURL(item.previewUrl);
    selectedFiles.splice(index, 1);
    renderPreview();
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
          descricao: descriptionInput.value,
          midias: mediaIds
        })
      });
      descriptionInput.value = '';
      uploadedMedia = [];
      clearPreview();
      toast('Publicação criada com sucesso.');
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
    if (action === 'toggle-reactions') {
      const control = button.closest('.reaction-control');
      const picker = control && control.querySelector('.reaction-picker');
      if (picker) {
        picker.hidden = !picker.hidden;
        button.setAttribute('aria-expanded', String(!picker.hidden));
      }
      return;
    }
    if (action === 'react') {
      if (!currentUser) {
        window.location.href = '/pages/login.html';
        return;
      }
      const card = button.closest('.publication-card');
      if (!card || card.dataset.reacting === 'true') return;
      const selectedEmoji = button.getAttribute('aria-pressed') === 'true' ? null : button.dataset.emoji;
      const previousEmoji = card.querySelector('[data-action="react"][aria-pressed="true"]')?.dataset.emoji || null;
      card.dataset.reacting = 'true';
      const reactionButtons = [...card.querySelectorAll('[data-action="react"]')];
      reactionButtons.forEach(item => { item.disabled = true; });
      updateReactionUI(card, selectedEmoji);
      try {
        if (selectedEmoji) {
          await api('/api/publicacoes/' + id + '/reacao', {
            method: 'PUT',
            body: JSON.stringify({ emoji: selectedEmoji })
          });
        } else {
          await api('/api/publicacoes/' + id + '/reacao', { method: 'DELETE' });
        }
      } catch (error) {
        updateReactionUI(card, previousEmoji);
        toast(error.message);
      } finally {
        delete card.dataset.reacting;
        reactionButtons.forEach(item => { item.disabled = false; });
      }
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
      feed.innerHTML = '<div class="feed-empty">Não foi possível iniciar a página. Atualize para tentar novamente.</div>';
      return;
    }
    await loadUser();
    await loadPosts(true);
  })();
})();
