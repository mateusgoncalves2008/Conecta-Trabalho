(() => {
  const container = document.getElementById('public-candidate-content');
  if (!container) return;
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id || !/^\d+$/.test(id)) { container.textContent = 'Perfil não encontrado.'; return; }
  Conecta.api('/api/candidatos/' + encodeURIComponent(id) + '/publico').then(({perfil:p}) => {
    const name = escapeHTML(p.nome);
    const photo = p.foto_perfil ? '<img src="' + escapeHTML(p.foto_perfil) + '" alt="Foto de ' + name + '">' : '<span>' + escapeHTML(p.nome.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase()) + '</span>';
    const sections = [
      ['Sobre',p.resumo_profissional],['Objetivo profissional',p.objetivo_profissional],
      ['Experiência profissional',p.experiencias],['Formação e cursos',p.formacao],['Competências',p.competencias]
    ].filter(([,value])=>value);
    container.className = 'public-candidate-profile';
    container.innerHTML = '<section class="public-candidate-hero"><div class="public-candidate-avatar">' + photo + '</div><div><span class="eyebrow">PERFIL PROFISSIONAL</span><h1>' + name + '</h1><p>' + escapeHTML(p.titulo_profissional || 'Profissional') + '</p><small>' + escapeHTML(p.cidade || 'Localização não informada') + '</small></div></section>' +
      (p.tipo_oportunidade || p.modalidade_preferida ? '<div class="public-candidate-tags">' + [p.tipo_oportunidade,p.modalidade_preferida].filter(Boolean).map(x=>'<span>' + escapeHTML(x) + '</span>').join('') + '</div>' : '') +
      sections.map(([title,value])=>'<section class="public-candidate-section"><h2>' + title + '</h2><p>' + escapeHTML(value).replace(/\n/g,'<br>') + '</p></section>').join('') +
      (p.curriculo_url ? '<p class="public-candidate-cv"><a class="button button-outline" href="' + escapeHTML(p.curriculo_url) + '" target="_blank" rel="noopener noreferrer">Visualizar currículo</a></p>' : '');
  }).catch(error => { container.className='empty-state'; container.textContent=error.message; });
})();