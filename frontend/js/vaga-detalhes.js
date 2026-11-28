(() => {
  const root = document.getElementById('job-detail-content');
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const dateLabel = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data não informada';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date);
  };
  const photoDateLabel = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data não informada';
    const elapsed = Date.now() - date.getTime();
    if (elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000) {
      if (elapsed < 60 * 60 * 1000) {
        const minutes = Math.max(1, Math.floor(elapsed / 60000));
        return 'Há ' + minutes + (minutes === 1 ? ' minuto' : ' minutos');
      }
      const hours = Math.floor(elapsed / 3600000);
      return 'Há ' + hours + (hours === 1 ? ' hora' : ' horas');
    }
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  };
  const initials = value => String(value || 'Empresa').trim().split(/\s+/).slice(0,2).map(part => part[0] || '').join('').toUpperCase();
  const phoneDigits = value => {
    const raw = String(value || '').trim();
    let digits = raw.replace(/\D/g, '');
    if (raw.startsWith('+55') || (digits.length > 11 && digits.startsWith('55'))) digits = digits.slice(2);
    return digits.slice(0, 11);
  };
  const formatBrazilPhone = value => {
    const digits = phoneDigits(value);
    if (!digits) return '';
    const ddd = digits.slice(0, 2);
    const number = digits.slice(2);
    if (digits.length < 2) return '+55 (' + ddd;
    if (digits.length === 2) return '+55 (' + ddd + ')';
    if (number.length <= 4) return '+55 (' + ddd + ') ' + number;
    if (number.length <= 8) return '+55 (' + ddd + ') ' + number.slice(0, 4) + '-' + number.slice(4);
    return '+55 (' + ddd + ') ' + number.slice(0, 5) + '-' + number.slice(5);
  };
  const normalizeBrazilPhone = value => {
    const digits = phoneDigits(value);
    return digits.length === 10 || digits.length === 11 ? '+55' + digits : '';
  };
  const savedKey = 'conecta-vagas-salvas';
  const getLegacySaved = () => {
    try {
      const value = JSON.parse(localStorage.getItem(savedKey) || '[]');
      return Array.isArray(value) ? [...new Set(value.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))] : [];
    } catch { return []; }
  };
  const readFileAsDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler o currículo selecionado.'));
    reader.readAsDataURL(file);
  });

  async function apply(id, button, vaga) {
    try {
      const session = await Conecta.api('/api/me');
      if (!session.usuario) { window.location.href = '/pages/login.html'; return; }
      if (session.usuario.tipo !== 'candidato') { Conecta.toast('Somente contas de candidato podem se candidatar.'); return; }
      const profileResult = await Conecta.api('/api/perfil');
      const profile = profileResult.perfil || {};
      const questions = Array.isArray(vaga.perguntas_candidatura) ? vaga.perguntas_candidatura : [];
      const modal = document.createElement('div');
      modal.className = 'application-modal';
      modal.setAttribute('aria-hidden', 'false');
      modal.innerHTML = `
        <section class="application-dialog" role="dialog" aria-modal="true" aria-labelledby="application-title">
          <header class="application-header">
            <div><span class="application-eyebrow">CONECTATRABALHO</span><h2 id="application-title">Candidatar-se</h2><p>${escapeHTML(vaga.titulo)} · ${escapeHTML(vaga.nome_empresa || 'Empresa')}</p></div>
            <button type="button" class="application-close" aria-label="Fechar">&times;</button>
          </header>
          <div class="application-progress"><span class="is-active" data-step-indicator="1">1. Seus dados</span>${questions.length ? '<span data-step-indicator="2">2. Perguntas</span>' : ''}<span data-step-indicator="${questions.length ? 3 : 2}">${questions.length ? '3. Revisão' : '2. Revisão'}</span></div>
          <form class="application-form">
            <section class="application-step is-active" data-step="1">
              <h3>Confirme seus dados</h3><p>Confira as informações que serão enviadas à empresa.</p>
              <label>Nome completo<input name="nome" maxlength="120" required value="${escapeHTML(profile.nome || session.usuario.nome || '')}"></label>
              <label>E-mail<input name="email" type="email" maxlength="160" required value="${escapeHTML(profile.email || session.usuario.email || '')}"></label>
              <label>WhatsApp para contato<input name="telefone" type="tel" maxlength="20" autocomplete="tel" required value="${escapeHTML(formatBrazilPhone(profile.telefone || ''))}" placeholder="+55 (33) 99999-9999"><small>Informe o DDD e o número. O código +55 será incluído automaticamente. A empresa poderá iniciar uma conversa pelo WhatsApp.</small></label>
              <div class="application-resume">
                <div class="application-resume-heading">
                  <span class="application-resume-icon" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg></span>
                  <div><strong>Adicione seu currículo</strong><p>Envie seu currículo em PDF para a empresa conhecer sua experiência.</p></div>
                  <span class="application-resume-required">Recomendado</span>
                </div>
                ${profile.curriculo_url ? '<label class="application-resume-option"><input type="checkbox" name="usarCurriculoPerfil" checked><span>Usar currículo salvo no meu perfil <a href="' + escapeHTML(profile.curriculo_url) + '" target="_blank" rel="noopener noreferrer">Visualizar</a></span></label>' : '<p class="application-muted">Ainda não há currículo cadastrado no seu perfil. Você pode anexar um arquivo abaixo.</p>'}
                <div class="application-upload-zone">
                  <input class="application-file-input" id="application-resume-file" type="file" name="curriculo" accept="application/pdf,.pdf">
                  <label class="application-upload-label" for="application-resume-file">
                    <span class="application-upload-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a4 4 0 1 1 .7-7.94A5.5 5.5 0 0 1 18.5 12a3 3 0 0 1-.5 6M12 16V8m0 0L9 11m3-3 3 3" /></svg></span>
                    <span class="application-upload-copy"><strong>Arraste seu PDF até aqui</strong><small>ou clique para escolher um arquivo no dispositivo</small></span>
                    <span class="application-upload-button">Escolher arquivo</span>
                  </label>
                  <div class="application-selected-file" data-resume-selected hidden>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 0v6h5M8 14h8M8 18h6" /></svg>
                    <span data-resume-filename></span>
                    <button type="button" data-resume-remove aria-label="Remover currículo selecionado"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
                  </div>
                  <small class="application-upload-hint">Formato PDF · Tamanho máximo: 5 MB</small>
                  <p class="application-upload-error" data-resume-error role="alert" aria-live="polite" hidden></p>
                </div>
                <small class="application-private-note"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3" /></svg> Seu currículo será enviado com segurança e ficará disponível somente para você e para a empresa desta vaga.</small>
              </div>
            </section>
            ${questions.length ? '<section class="application-step" data-step="2"><h3>Perguntas da empresa</h3><p>Responda às perguntas para concluir sua candidatura.</p>' + questions.map((question,index) => '<label>' + (index+1) + '. ' + escapeHTML(question) + '<textarea name="resposta-' + index + '" maxlength="1000" rows="3" required placeholder="Digite sua resposta"></textarea></label>').join('') + '</section>' : ''}
            <section class="application-step" data-step="${questions.length ? 3 : 2}">
              <h3>Revise sua candidatura</h3><p>Confira tudo antes de enviar para a empresa.</p>
              <div class="application-review" data-application-review></div>
              <p class="application-consent">Ao enviar, você confirma que as informações estão corretas e autoriza o compartilhamento delas com a empresa responsável pela vaga.</p>
            </section>
            <p class="application-feedback" role="alert" aria-live="polite"></p>
            <footer class="application-actions">
              <button type="button" class="button button-outline" data-application-back hidden>Voltar</button>
              <button type="button" class="button button-primary" data-application-next>Continuar</button>
              <button type="submit" class="button button-primary" data-application-submit hidden>Enviar candidatura</button>
            </footer>
          </form>
        </section>`;
      document.body.appendChild(modal);
      document.body.classList.add('application-modal-open');
      const form = modal.querySelector('form');
      const feedback = modal.querySelector('.application-feedback');
      const resumeInput = form.elements.curriculo;
      const phoneInput = form.elements.telefone;
      phoneInput.addEventListener('focus', () => { if (!phoneInput.value.trim()) phoneInput.value = '+55 (33) '; });
      phoneInput.addEventListener('input', () => { phoneInput.value = formatBrazilPhone(phoneInput.value); });
      const selectedFile = modal.querySelector('[data-resume-selected]');
      const selectedFilename = modal.querySelector('[data-resume-filename]');
      const resumeError = modal.querySelector('[data-resume-error]');
      const showResumeError = message => {
        resumeError.textContent = message || '';
        resumeError.hidden = !message;
        feedback.textContent = message || '';
      };
      const updateSelectedResume = () => {
        const file = resumeInput.files[0];
        selectedFile.hidden = !file;
        selectedFilename.textContent = file ? file.name : '';
      };
      const validateResumeFile = async file => {
        if (!file) return '';
        if (!/\.pdf$/i.test(file.name)) return 'O arquivo selecionado não é um PDF. Escolha um arquivo com extensão .pdf.';
        if (file.type && file.type !== 'application/pdf') return 'O navegador identificou esse arquivo como ' + file.type + ', não como PDF. Exporte ou salve o documento no formato PDF.';
        if (file.size === 0) return 'O arquivo está vazio. Escolha outro PDF.';
        if (file.size > 5 * 1024 * 1024) return 'O PDF ultrapassa o limite de 5 MB. Escolha um arquivo menor.';
        try {
          const signature = await file.slice(0, 5).arrayBuffer();
          if (new TextDecoder().decode(signature) !== '%PDF-') return 'O arquivo tem extensão PDF, mas seu conteúdo não parece ser um PDF válido. Gere o PDF novamente e tente outra vez.';
        } catch {
          return 'Não foi possível verificar a leitura do arquivo. Tente selecionar o PDF novamente.';
        }
        return '';
      };
      const handleResumeSelection = async file => {
        showResumeError('');
        if (!file) { updateSelectedResume(); return; }
        const error = await validateResumeFile(file);
        if (error) {
          resumeInput.value = '';
          updateSelectedResume();
          showResumeError(error);
          return;
        }
        updateSelectedResume();
      };
      resumeInput.addEventListener('change', () => handleResumeSelection(resumeInput.files[0]));
      modal.querySelector('[data-resume-remove]').addEventListener('click', () => {
        resumeInput.value = '';
        updateSelectedResume();
        showResumeError('');
      });
      const uploadZone = modal.querySelector('.application-upload-zone');
      ['dragenter','dragover'].forEach(type => uploadZone.addEventListener(type, event => {
        event.preventDefault();
        uploadZone.classList.add('is-dragging');
      }));
      ['dragleave','drop'].forEach(type => uploadZone.addEventListener(type, event => {
        event.preventDefault();
        uploadZone.classList.remove('is-dragging');
      }));
      uploadZone.addEventListener('drop', event => {
        const file = event.dataTransfer?.files?.[0];
        if (!file) return;
        if (typeof DataTransfer !== 'undefined') {
          const transfer = new DataTransfer();
          transfer.items.add(file);
          resumeInput.files = transfer.files;
          handleResumeSelection(file);
        }
      });
      const back = modal.querySelector('[data-application-back]');
      const next = modal.querySelector('[data-application-next]');
      const submit = modal.querySelector('[data-application-submit]');
      const steps = [...modal.querySelectorAll('.application-step')];
      const stepCount = steps.length;
      let currentStep = 1;
      const close = () => {
        modal.remove();
        document.body.classList.remove('application-modal-open');
      };
      const renderStep = () => {
        steps.forEach(step => step.classList.toggle('is-active', Number(step.dataset.step) === currentStep));
        modal.querySelectorAll('[data-step-indicator]').forEach(item => item.classList.toggle('is-active', Number(item.dataset.stepIndicator) === currentStep));
        back.hidden = currentStep === 1;
        next.hidden = currentStep === stepCount;
        submit.hidden = currentStep !== stepCount;
        feedback.textContent = '';
        if (currentStep === stepCount) {
          const values = new FormData(form);
          const file = form.elements.curriculo.files[0];
          const usingProfileResume = Boolean(form.elements.usarCurriculoPerfil?.checked && profile.curriculo_url && !file);
          const answersHtml = questions.map((question,index) => '<div><strong>' + escapeHTML(question) + '</strong><p>' + escapeHTML(values.get('resposta-' + index) || '') + '</p></div>').join('');
          modal.querySelector('[data-application-review]').innerHTML =
            '<div><strong>Nome</strong><p>' + escapeHTML(values.get('nome')) + '</p></div>' +
            '<div><strong>E-mail</strong><p>' + escapeHTML(values.get('email')) + '</p></div>' +
            '<div><strong>Telefone</strong><p>' + escapeHTML(values.get('telefone') || 'Não informado') + '</p></div>' +
            '<div><strong>Currículo</strong><p>' + escapeHTML(file?.name || (usingProfileResume ? 'Currículo do perfil' : 'Não anexado')) + '</p></div>' + answersHtml;
        }
      };
      modal.querySelector('.application-close').addEventListener('click', close);
      modal.addEventListener('click', event => { if (event.target === modal) close(); });
      const escapeHandler = event => { if (event.key === 'Escape' && document.body.classList.contains('application-modal-open')) { close(); document.removeEventListener('keydown', escapeHandler); } };
      document.addEventListener('keydown', escapeHandler);
      back.addEventListener('click', () => { currentStep = Math.max(1, currentStep - 1); renderStep(); });
      next.addEventListener('click', async () => {
        const active = steps.find(step => Number(step.dataset.step) === currentStep);
        const fields = [...active.querySelectorAll('input,textarea')].filter(field => field.type !== 'checkbox' && field.type !== 'file');
        const invalid = fields.find(field => !field.checkValidity());
        if (invalid) { invalid.reportValidity(); return; }
        if (!normalizeBrazilPhone(phoneInput.value)) {
          phoneInput.setCustomValidity('Informe DDD e um número brasileiro válido com 10 ou 11 dígitos.');
          phoneInput.reportValidity();
          phoneInput.setCustomValidity('');
          return;
        }
        const file = form.elements.curriculo.files[0];
        const resumeValidationError = await validateResumeFile(file);
        if (resumeValidationError) {
          showResumeError(resumeValidationError);
          return;
        }
        currentStep = Math.min(stepCount, currentStep + 1);
        renderStep();
      });
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        submit.disabled = true;
        submit.textContent = 'Enviando...';
        feedback.textContent = '';
        try {
          const values = new FormData(form);
          const file = form.elements.curriculo.files[0];
          let curriculo = null;
          if (file) {
            const dataUrl = await readFileAsDataUrl(file);
            const encoded = dataUrl.split(',')[1] || '';
            if (!encoded) throw new Error('O navegador não conseguiu ler o conteúdo do PDF. Tente selecionar o arquivo novamente.');
            curriculo = { nome: file.name, conteudo: encoded };
          }
          const respostas = questions.map((pergunta,index) => ({ pergunta, resposta: String(values.get('resposta-' + index) || '').trim() }));
          await Conecta.api('/api/vagas/' + id + '/candidatar', {
            method: 'POST',
            body: JSON.stringify({
              nome: String(values.get('nome') || '').trim(),
              email: String(values.get('email') || '').trim(),
              telefone: normalizeBrazilPhone(values.get('telefone')),
              curriculoUrl: !file && form.elements.usarCurriculoPerfil?.checked ? profile.curriculo_url : '',
              curriculo,
              respostas,
              mensagem: ''
            })
          });
          close();
          button.textContent = 'Você já se candidatou';
          button.disabled = true;
          Conecta.toast('Sua candidatura foi enviada com sucesso. Acompanhe o andamento em Minhas candidaturas.');
        } catch (error) {
          const message = error?.message || 'Ocorreu um erro inesperado ao enviar sua candidatura.';
          feedback.textContent = message;
          showResumeError(message.toLowerCase().includes('currículo') || message.toLowerCase().includes('pdf') || message.toLowerCase().includes('arquivo') ? message : '');
          submit.disabled = false;
          submit.textContent = 'Enviar candidatura';
        }
      });
      renderStep();
      modal.querySelector('input[name="nome"]').focus();
    } catch (error) {
      Conecta.toast(error.message);
    }
  }
  async function load() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id || !/^\d+$/.test(id)) { root.removeAttribute('aria-busy'); root.textContent = 'Identificador da vaga inválido.'; return; }
    try {
      const result = await Conecta.api('/api/vagas/' + encodeURIComponent(id));
      const vaga = result.vaga;
      const company = vaga.nome_empresa || 'Empresa';
      const session = await Conecta.api('/api/me');
      let saved = false;
      let alreadyApplied = false;
      if (session.usuario?.tipo === 'candidato') {
        const applicationResult = await Conecta.api('/api/vagas/' + encodeURIComponent(id) + '/minha-candidatura');
        alreadyApplied = applicationResult.jaCandidatou === true;
        const legacyIds = getLegacySaved();
        if (legacyIds.length) {
          await Conecta.api('/api/vagas-salvas/importar', {
            method: 'POST',
            body: JSON.stringify({ ids: legacyIds })
          });
          localStorage.removeItem(savedKey);
        }
        const savedResult = await Conecta.api('/api/vagas-salvas');
        saved = (savedResult.vagas || []).some(item => Number(item.id) === Number(vaga.id));
      }
      root.className = 'job-detail-layout';
      root.removeAttribute('aria-busy');
      root.innerHTML = `
        <div class="job-detail-primary">
          <section class="job-detail-panel">
            <div class="job-detail-company">
              <a class="job-detail-company-mark-link" href="/pages/empresa-perfil.html?id=${encodeURIComponent(vaga.empresa_id)}" aria-label="Ver perfil de ${escapeHTML(company)}"><div class="job-detail-company-mark" aria-hidden="true">${vaga.empresa_logo ? '<img src="' + escapeHTML(vaga.empresa_logo) + '" alt="">' : escapeHTML(initials(company))}</div></a>
              <div><a class="job-detail-company-name job-detail-company-link" href="/pages/empresa-perfil.html?id=${encodeURIComponent(vaga.empresa_id)}">${escapeHTML(company)}</a><p class="job-detail-company-location">${escapeHTML(vaga.empresa_cidade || 'Localização não informada')}</p><a class="job-detail-company-profile-link" href="/pages/empresa-perfil.html?id=${encodeURIComponent(vaga.empresa_id)}">Conhecer empresa</a></div>
            </div>
            <h1 class="job-detail-title">${escapeHTML(vaga.titulo)}</h1>
            <div class="job-detail-meta">
              <span>${escapeHTML(vaga.cidade || 'Local não informado')}</span><span>·</span>
              <span>${escapeHTML(vaga.modalidade || 'Modalidade não informada')}</span><span>·</span>
              <span>Publicada em ${escapeHTML(dateLabel(vaga.criado_em))}</span>
            </div>
            <div class="job-detail-actions">
              <button class="button button-primary" type="button" id="apply-job" ${alreadyApplied ? 'disabled' : ''}>${alreadyApplied ? 'Você já se candidatou' : 'Candidatar-se'}</button>
              <button class="button button-save" type="button" id="save-job" aria-pressed="${saved}" ${saved ? 'disabled' : ''}>${saved ? 'Vaga salva' : 'Salvar vaga'}</button>
            </div>
          </section>
          <section class="job-detail-panel job-detail-description-panel">
            <h2>Sobre a oportunidade</h2>
            <div class="job-detail-copy">${escapeHTML(vaga.descricao || 'A empresa não informou uma descrição para esta oportunidade.')}</div>
          </section>
          <section class="job-detail-panel job-detail-requirements-panel">
            <h2>Requisitos</h2>
            <div class="job-detail-copy">${escapeHTML(vaga.requisitos || 'A empresa não informou requisitos específicos.')}</div>
          </section>
          <section class="job-detail-panel job-detail-about-company-panel">
            <h2>Sobre a empresa</h2>
            <div class="job-detail-copy">${escapeHTML(vaga.empresa_descricao || 'A empresa ainda não adicionou uma apresentação institucional.')}</div>
            <a class="job-detail-company-profile-link" href="/pages/empresa-perfil.html?id=${encodeURIComponent(vaga.empresa_id)}">Ver perfil completo da empresa</a>
          </section>
          <section class="job-detail-panel job-detail-gallery-panel">
            <div class="job-detail-gallery-heading">
              <div><h2>Fotos da empresa</h2><p>Conheça um pouco mais sobre o ambiente e a equipe.</p></div>
              <a class="job-detail-company-profile-link" href="/pages/empresa-perfil.html?id=${encodeURIComponent(vaga.empresa_id)}">Ver perfil da empresa</a>
            </div>
            ${Array.isArray(vaga.empresa_fotos) && vaga.empresa_fotos.length
              ? `<div class="job-detail-gallery">${vaga.empresa_fotos.slice(0, 4).map((photo, index) => `<button class="job-detail-gallery-photo" type="button" data-job-photo-index="${index}" aria-label="Ampliar foto ${index + 1}"><img src="${escapeHTML(photo.url)}" alt="Foto ${index + 1} de ${escapeHTML(company)}" loading="lazy" decoding="async"><span class="job-detail-gallery-photo-date">${escapeHTML(photoDateLabel(photo.criada_em))}</span></button>`).join('')}</div>`
              : '<p class="job-detail-gallery-empty">Esta empresa ainda não publicou fotos.</p>'}
          </section>
        </div>
        <aside class="job-detail-aside">
          <section class="job-detail-panel job-detail-facts">
            <h2>Informações da vaga</h2>
            <div class="job-detail-fact"><strong>Remuneração</strong><span>${escapeHTML(vaga.salario || 'A combinar')}</span></div>
            <div class="job-detail-fact"><strong>Tipo de contrato</strong><span>${escapeHTML(vaga.tipo_contrato || 'Não informado')}</span></div>
            <div class="job-detail-fact"><strong>Modalidade</strong><span>${escapeHTML(vaga.modalidade || 'Não informada')}</span></div>
            <div class="job-detail-fact"><strong>Local da vaga</strong><span>${escapeHTML(vaga.cidade || 'Não informado')}</span></div>
            <div class="job-detail-fact"><strong>Candidaturas recebidas</strong><span>${Number(vaga.total_candidaturas) || 0}</span></div>
            <p class="job-detail-status">As informações exibidas foram fornecidas pela empresa anunciante.</p>
          </section>
        </aside>
      </div>`;
      document.getElementById('apply-job').addEventListener('click', event => apply(vaga.id, event.currentTarget, vaga));
      document.getElementById('save-job').addEventListener('click', async event => {
        const button = event.currentTarget;
        if (button.getAttribute('aria-pressed') === 'true') return;
        button.disabled = true;
        try {
          const currentSession = await Conecta.api('/api/me');
          if (!currentSession.usuario) {
            window.location.href = '/pages/login.html';
            return;
          }
          if (currentSession.usuario.tipo !== 'candidato') {
            Conecta.toast('Somente contas de candidato podem salvar vagas.');
            return;
          }
          await Conecta.api('/api/vagas/' + encodeURIComponent(vaga.id) + '/salvar', {
            method: 'POST'
          });
          button.textContent = 'Vaga salva';
          button.setAttribute('aria-pressed', 'true');
          button.disabled = true;
          Conecta.toast('Vaga salva na sua conta. Você pode encontrá-la em Vagas salvas no seu painel.');
        } catch (error) {
          Conecta.toast(error.message);
          button.disabled = false;
        }
      });
      const galleryPhotos = (vaga.empresa_fotos || []).slice(0, 4);
      if (galleryPhotos.length) {
        const lightbox = document.createElement('div');
        lightbox.className = 'company-photo-lightbox';
        lightbox.setAttribute('aria-hidden', 'true');
        lightbox.innerHTML = '<button type="button" class="company-photo-lightbox-close" aria-label="Fechar">&times;</button><button type="button" class="company-photo-lightbox-arrow is-prev" aria-label="Foto anterior">&#10094;</button><img class="company-photo-lightbox-image" alt=""><button type="button" class="company-photo-lightbox-arrow is-next" aria-label="Próxima foto">&#10095;</button><span class="company-photo-lightbox-counter"></span>';
        document.body.appendChild(lightbox);
        let activePhotoIndex = 0;
        const openPhoto = index => {
          activePhotoIndex = (index + galleryPhotos.length) % galleryPhotos.length;
          const photo = galleryPhotos[activePhotoIndex];
          const image = lightbox.querySelector('.company-photo-lightbox-image');
          image.src = photo.url;
          image.alt = 'Foto ' + (activePhotoIndex + 1) + ' de ' + company;
          lightbox.querySelector('.company-photo-lightbox-counter').textContent = (activePhotoIndex + 1) + ' / ' + galleryPhotos.length;
          lightbox.classList.add('is-open');
          lightbox.setAttribute('aria-hidden', 'false');
          document.body.classList.add('company-photo-lightbox-open');
        };
        const closePhoto = () => {
          lightbox.classList.remove('is-open');
          lightbox.setAttribute('aria-hidden', 'true');
          document.body.classList.remove('company-photo-lightbox-open');
        };
        lightbox.addEventListener('click', event => {
          if (event.target === lightbox || event.target.closest('.company-photo-lightbox-close')) closePhoto();
          if (event.target.closest('.company-photo-lightbox-arrow.is-prev')) openPhoto(activePhotoIndex - 1);
          if (event.target.closest('.company-photo-lightbox-arrow.is-next')) openPhoto(activePhotoIndex + 1);
        });
        root.querySelectorAll('[data-job-photo-index]').forEach(button => {
          button.addEventListener('click', () => openPhoto(Number(button.dataset.jobPhotoIndex) || 0));
        });
        document.addEventListener('keydown', event => {
          if (!lightbox.classList.contains('is-open')) return;
          if (event.key === 'Escape') closePhoto();
          if (event.key === 'ArrowLeft') openPhoto(activePhotoIndex - 1);
          if (event.key === 'ArrowRight') openPhoto(activePhotoIndex + 1);
        });
      }
      document.title = vaga.titulo + ' | ConectaTrabalho';
    } catch (error) {
      root.removeAttribute('aria-busy');
      root.className = 'empty-state';
      root.textContent = error.message;
    }
  }
  document.addEventListener('DOMContentLoaded', load);
})();