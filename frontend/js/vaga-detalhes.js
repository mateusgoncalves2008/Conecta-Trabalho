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
  const savedKey = 'conecta-vagas-salvas';
  const getLegacySaved = () => {
    try {
      const value = JSON.parse(localStorage.getItem(savedKey) || '[]');
      return Array.isArray(value) ? [...new Set(value.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))] : [];
    } catch { return []; }
  };
  async function apply(id, button) {
    try {
      const session = await Conecta.api('/api/me');
      if (!session.usuario) { window.location.href = '/pages/login.html'; return; }
      if (session.usuario.tipo !== 'candidato') { Conecta.toast('Somente contas de candidato podem se candidatar.'); return; }
      button.disabled = true;
      button.textContent = 'Enviando...';
      await Conecta.api('/api/vagas/' + id + '/candidatar', { method: 'POST', body: JSON.stringify({ mensagem: '' }) });
      button.textContent = 'Candidatura enviada';
      Conecta.toast('Sua candidatura foi enviada com sucesso.');
    } catch (error) {
      Conecta.toast(error.message);
      button.disabled = false;
      button.textContent = 'Candidatar-se';
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
      if (session.usuario?.tipo === 'candidato') {
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
              <button class="button button-primary" type="button" id="apply-job">Candidatar-se</button>
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
      document.getElementById('apply-job').addEventListener('click', event => apply(vaga.id, event.currentTarget));
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