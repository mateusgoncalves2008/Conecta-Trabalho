(() => {
  const updateStatus = isPublic => {
    const status = document.getElementById('candidate-public-profile-status');
    if (status) status.textContent = isPublic
      ? 'Seu perfil pode aparecer nas pesquisas de pessoas e empresas.'
      : 'Seu perfil não aparece nas pesquisas.';
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const candidateSettings = document.getElementById('candidate-privacy-settings');
    const companySettings = document.getElementById('company-settings-placeholder');
    const toggle = document.getElementById('candidate-public-profile-toggle');
    const backLink = document.getElementById('settings-back-link');
    try {
      const session = await Conecta.api('/api/me');
      const user = session.usuario;
      if (!user) return window.location.href = '/pages/login.html';
      if (user.tipo === 'empresa') {
        companySettings.hidden = false;
        backLink.href = '/pages/empresa.html';
        return;
      }
      if (user.tipo !== 'candidato') return Conecta.redirectByUser(user);
      candidateSettings.hidden = false;
      backLink.href = '/pages/candidato.html';
      const data = await Conecta.api('/api/perfil');
      toggle.checked = Boolean(data.perfil?.perfil_publico);
      updateStatus(toggle.checked);
      toggle.addEventListener('change', async () => {
        const requested = toggle.checked;
        toggle.disabled = true;
        try {
          const result = await Conecta.api('/api/perfil/visibilidade-publica', {
            method: 'PUT',
            body: JSON.stringify({ publico: requested })
          });
          toggle.checked = Boolean(result.perfil_publico);
          updateStatus(toggle.checked);
          Conecta.toast(toggle.checked ? 'Seu perfil agora está público nas pesquisas.' : 'Seu perfil não aparece mais nas pesquisas.');
        } catch (error) {
          toggle.checked = !requested;
          updateStatus(toggle.checked);
          Conecta.toast(error.message || 'Não foi possível salvar a configuração.');
        } finally {
          toggle.disabled = false;
        }
      });
    } catch (error) {
      Conecta.toast(error.message || 'Não foi possível carregar suas configurações.');
      if (error.message && /login|sessão/i.test(error.message)) window.location.href = '/pages/login.html';
    }
  });
})();
