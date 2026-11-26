(() => {
  const form = document.getElementById('directory-search-form');
  if (!form) return;
  const input = document.getElementById('directory-search-input');
  input.value = new URLSearchParams(window.location.search).get('q') || '';
  const resultsNode = document.getElementById('directory-results');
  const summary = document.getElementById('directory-result-summary');
  const filters = [...document.querySelectorAll('[data-directory-filter]')];
  let filter = 'todos';
  let currentUser = null;
  let requestId = 0;
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const initials = value => String(value || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
  const avatar = (url, name, company = false) => url
    ? '<img class="directory-avatar" src="' + escapeHTML(url) + '" alt="" loading="lazy">'
    : '<span class="directory-avatar directory-avatar-fallback' + (company ? ' is-company' : '') + '" aria-hidden="true">' + escapeHTML(initials(name)) + '</span>';

  async function loadResults() {
    const id = ++requestId;
    const query = input.value.trim();
    Conecta.renderSkeleton(resultsNode, 'directory');
    try {
      const data = await Conecta.api('/api/pesquisar?q=' + encodeURIComponent(query) + '&tipo=' + encodeURIComponent(filter));
      if (id !== requestId) return;
      const people = data.pessoas || [];
      const companies = data.empresas || [];
      const count = people.length + companies.length;
      summary.textContent = count + (count === 1 ? ' resultado encontrado' : ' resultados encontrados');
      const cards = [];
      people.forEach(person => {
        const description = person.titulo_profissional || 'Profissional';
        const profileUrl = 'candidato-perfil.html?id=' + encodeURIComponent(person.id);
        cards.push('<article class="directory-card"><div class="directory-card-identity"><a class="directory-profile-link directory-avatar-link" href="' + profileUrl + '" aria-label="Ver perfil de ' + escapeHTML(person.nome) + '">' + avatar(person.foto_perfil, person.nome) + '</a>' +
          '<div class="directory-card-copy"><span class="directory-card-type">Pessoa</span><h2><a class="directory-profile-link" href="' + profileUrl + '">' + escapeHTML(person.nome) + '</a></h2><p>' + escapeHTML(description) + '</p><small><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ' + escapeHTML(person.cidade || 'Localização não informada') + '</small></div></div>' +
          '<a class="button button-outline button-small" href="' + profileUrl + '">Ver perfil</a></article>');
      });
      companies.forEach(company => {
        const name = company.nome || 'Empresa';
        const description = company.empresa_descricao_curta || company.empresa_setor || 'Empresa cadastrada';
        const followAction = currentUser?.tipo === 'candidato'
          ? '<button type="button" class="button ' + (company.seguindo ? 'button-outline is-following' : 'button-primary') + ' button-small" data-follow-company="' + escapeHTML(company.id) + '" aria-pressed="' + String(Boolean(company.seguindo)) + '">' + (company.seguindo ? 'Seguindo' : 'Seguir') + '</button>'
          : '';
        const profileUrl = 'empresa-perfil.html?id=' + encodeURIComponent(company.id);
        cards.push('<article class="directory-card"><div class="directory-card-identity"><a class="directory-profile-link directory-avatar-link" href="' + profileUrl + '" aria-label="Ver empresa ' + escapeHTML(name) + '">' + avatar(company.foto_perfil, name, true) + '</a>' +
          '<div class="directory-card-copy"><span class="directory-card-type">Empresa</span><h2><a class="directory-profile-link" href="' + profileUrl + '">' + escapeHTML(name) + '</a></h2><p>' + escapeHTML(description) + '</p><small><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ' + escapeHTML(company.cidade || 'Localização não informada') + '</small><small>' + Number(company.total_seguidores || 0).toLocaleString('pt-BR') + ' seguidores · ' + Number(company.vagas_abertas || 0).toLocaleString('pt-BR') + ' vagas abertas</small></div></div>' +
          '<div class="directory-card-actions"><a class="button button-outline button-small" href="' + profileUrl + '">Ver empresa</a>' + followAction + '</div></article>');
      });
      resultsNode.innerHTML = cards.length ? cards.join('') : '<div class="directory-empty"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><h2>Nenhum resultado encontrado</h2><p>Tente pesquisar por outro nome, profissão, setor ou cidade.</p></div>';
      resultsNode.classList.remove('ct-skeleton-container');
      resultsNode.removeAttribute('aria-busy');
      resultsNode.querySelectorAll('[data-follow-company]').forEach(button => button.addEventListener('click', async () => {
        if (!currentUser) return window.location.href = 'login.html';
        const following = button.getAttribute('aria-pressed') === 'true';
        button.disabled = true;
        try {
          const result = await Conecta.api('/api/empresas/' + encodeURIComponent(button.dataset.followCompany) + '/seguir', { method: following ? 'DELETE' : 'POST' });
          button.setAttribute('aria-pressed', String(result.seguindo));
          button.textContent = result.seguindo ? 'Seguindo' : 'Seguir';
          button.classList.toggle('button-primary', !result.seguindo);
          button.classList.toggle('button-outline', result.seguindo);
          const countLine = button.closest('.directory-card').querySelector('.directory-card-copy small:last-child');
          if (countLine) countLine.textContent = Number(result.total_seguidores).toLocaleString('pt-BR') + ' seguidores · ' + countLine.textContent.split('·').pop().trim();
        } catch (error) {
          Conecta.toast(error.message);
        } finally { button.disabled = false; }
      }));
    } catch (error) {
      if (id !== requestId) return;
      summary.textContent = 'Não foi possível concluir a pesquisa.';
      resultsNode.classList.remove('ct-skeleton-container');
      resultsNode.removeAttribute('aria-busy');
      resultsNode.innerHTML = '<div class="directory-empty"><p>' + escapeHTML(error.message) + '</p><button type="button" class="button button-outline" id="directory-retry">Tentar novamente</button></div>';
      document.getElementById('directory-retry')?.addEventListener('click', loadResults);
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const term = input.value.trim().slice(0, 100);
    if (term.length >= 2) {
      try {
        const session = await Conecta.api('/api/me');
        const key = 'conecta-search-recent-' + String(session.usuario?.id || 'visitante');
        let recent = [];
        try { recent = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
        if (!Array.isArray(recent)) recent = [];
        recent = [term, ...recent.filter(item => typeof item === 'string' && item.toLocaleLowerCase('pt-BR') !== term.toLocaleLowerCase('pt-BR'))].slice(0, 6);
        try { localStorage.setItem(key, JSON.stringify(recent)); } catch {}
        await Conecta.api('/api/pesquisas/registrar', { method: 'POST', body: JSON.stringify({ termo: term }) });
      } catch (error) {
        console.warn('Não foi possível registrar a pesquisa:', error);
      }
    }
    loadResults();
  });
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(loadResults, 280);
  });
  filters.forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.directoryFilter;
    filters.forEach(item => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    loadResults();
  }));
  Conecta.api('/api/me').then(data => { currentUser = data.usuario || null; loadResults(); }).catch(() => loadResults());
})();