(() => {
 const root=document.getElementById('company-public-content');
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const initials=value=>String(value||'EMP').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase()||'EMP';
 const dateLabel=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(d)};
 const jobCard=job=>`<a class="company-public-job" href="/pages/vaga-detalhes.html?id=${encodeURIComponent(job.id)}"><div><h3>${esc(job.titulo)}</h3><p>${esc(job.cidade)} · ${esc(job.modalidade)} · ${esc(job.tipo_contrato)}</p></div><span class="company-public-job-arrow">Ver vaga <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></span><strong>${esc(job.salario||'A combinar')}</strong></a>`;
 async function load(){
  const id=new URLSearchParams(location.search).get('id');
  if(!id||!/^\d+$/.test(id)){root.textContent='Identificador da empresa inválido.';return}
  try{
   const data=await Conecta.api('/api/empresas/'+encodeURIComponent(id));
   const c=data.empresa,jobs=data.vagas||[];
   const logo=c.foto_perfil?`<img class="company-public-logo" src="${esc(c.foto_perfil)}" alt="Logotipo de ${esc(c.nome_empresa)}">`:`<div class="company-public-logo company-public-logo-fallback" aria-hidden="true">${esc(initials(c.nome_empresa))}</div>`;
   const cover=c.banner_perfil?`style="background-image:url('${esc(c.banner_perfil)}')"`:'';
   root.className='company-public-layout';
   root.innerHTML=`<section class="company-public-hero"><div class="company-public-cover" ${cover}></div><div class="company-public-identity">${logo}<div class="company-public-heading"><h1>${esc(c.nome_empresa||c.nome_fantasia||'Empresa')}</h1><p>${esc(c.empresa_setor||'Empresa')} ${c.cidade?'· '+esc(c.cidade):''}</p></div></div><div class="company-public-stats"><div><strong>${Number(c.vagas_abertas)||0}</strong><span>Vagas abertas</span></div><div><strong>${Number(c.total_candidaturas)||0}</strong><span>Candidaturas recebidas</span></div><div><strong>${esc(dateLabel(c.criado_em)||'—')}</strong><span>No ConectaTrabalho desde</span></div></div></section>
   <div class="company-public-columns"><section class="company-public-panel"><h2>Sobre a empresa</h2><p class="company-public-description">${esc(c.descricao||'Esta empresa ainda não adicionou uma apresentação institucional.')}</p><div class="company-public-info">${c.empresa_setor?'<div><strong>Setor</strong><span>'+esc(c.empresa_setor)+'</span></div>':''}${c.empresa_porte?'<div><strong>Porte</strong><span>'+esc(c.empresa_porte)+'</span></div>':''}${c.cidade?'<div><strong>Localização</strong><span>'+esc(c.cidade)+'</span></div>':''}${c.empresa_site?'<div><strong>Site oficial</strong><a href="'+esc(c.empresa_site)+'" target="_blank" rel="noopener noreferrer">'+esc(c.empresa_site.replace(/^https?:\/\//i,''))+'</a></div>':''}</div></section>
   <aside class="company-public-panel company-public-jobs-panel"><div class="company-public-jobs-heading"><h2>Oportunidades</h2><span>${jobs.length}</span></div>${jobs.length?'<div class="company-public-jobs">'+jobs.map(jobCard).join('')+'</div>':'<p class="company-public-empty">Esta empresa não possui vagas abertas no momento.</p>'}</aside></div>`;
   document.title=(c.nome_empresa||'Empresa')+' | ConectaTrabalho';
  }catch(error){root.className='empty-state';root.textContent=error.message}
 }
 document.addEventListener('DOMContentLoaded',load);
})();