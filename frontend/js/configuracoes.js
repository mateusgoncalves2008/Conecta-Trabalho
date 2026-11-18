(() => {
  const sections = {
    account: ['Preferências da conta', 'Gerencie as informações e preferências da sua conta.'],
    security: ['Acesso e segurança', 'Cuide do acesso e da proteção da sua conta.'],
    visibility: ['Visibilidade', 'Controle como seu perfil aparece para outras pessoas e empresas.'],
    privacy: ['Privacidade dos dados', 'Consulte as opções relacionadas à privacidade dos seus dados.'],
    notifications: ['Notificações', 'Escolha como acompanhar as novidades da plataforma.'],
    general: ['Preferências gerais', 'Personalize sua experiência no ConectaTrabalho.']
  };

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
    const profileLink = document.getElementById('settings-profile-link');
    const userName = document.getElementById('settings-user-name');
    const avatar = document.getElementById('settings-avatar');
    const nav = document.getElementById('settings-nav');
    const title = document.getElementById('settings-section-title');
    const description = document.getElementById('settings-section-description');

    const activateTab = key => {
      if (!sections[key]) return;
      nav.querySelectorAll('[data-settings-tab]').forEach(button => {
        const active = button.dataset.settingsTab === key;
        button.classList.toggle('is-active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
      document.querySelectorAll('[data-settings-panel]').forEach(panel => {
        panel.hidden = panel.dataset.settingsPanel !== key;
      });
      title.textContent = sections[key][0];
      description.textContent = sections[key][1];
    };

    const darkModeButton = document.getElementById('settings-dark-mode');
    const syncDarkMode = () => {
      const enabled = document.documentElement.dataset.theme === 'dark';
      darkModeButton.setAttribute('aria-checked', String(enabled));
      darkModeButton.classList.toggle('is-enabled', enabled);
    };
    syncDarkMode();
    darkModeButton.addEventListener('click', () => {
      const headerThemeButton = document.querySelector('.theme-toggle');
      if (headerThemeButton) {
        headerThemeButton.click();
      } else {
        const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('conecta-theme', nextTheme);
        document.documentElement.dataset.theme = nextTheme;
      }
      syncDarkMode();
    });

    const settingsHeading = document.querySelector('.settings-content-heading');
    const demographicsPage = document.getElementById('settings-demographics-page');
    const showMainSettings = () => {
      settingsHeading.hidden = false;
      document.querySelectorAll('[data-settings-panel]').forEach(panel => { panel.hidden = panel.dataset.settingsPanel !== 'account'; });
      demographicsPage.hidden = true;
      activateTab('account');
    };

    nav.addEventListener('click', event => {
      const button = event.target.closest('[data-settings-tab]');
      if (button) {
        demographicsPage.hidden = true;
        settingsHeading.hidden = false;
        activateTab(button.dataset.settingsTab);
      }
    });

    document.querySelector('[data-settings-subpage="demographics"]').addEventListener('click', () => {
      settingsHeading.hidden = true;
      document.querySelectorAll('[data-settings-panel]').forEach(panel => { panel.hidden = true; });
      demographicsPage.hidden = false;
      document.getElementById('settings-demographics-back').focus();
    });
    document.getElementById('settings-demographics-back').addEventListener('click', showMainSettings);

    try {
      const session = await Conecta.api('/api/me');
      const user = session.usuario;
      if (!user) return window.location.href = '/pages/login.html';
      const isCompany = user.tipo === 'empresa';
      const name = isCompany ? (user.nomeEmpresa || user.nome) : user.nome;
      userName.textContent = name || 'Sua conta';
      avatar.textContent = String(name || 'CT').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'CT';

      if (isCompany) {
        companySettings.hidden = false;
        backLink.href = '/pages/empresa.html';
        profileLink.href = '/pages/empresa.html#company-profile-heading';
        profileLink.querySelector('span').textContent = 'Dados da empresa';
      } else {
        if (user.tipo !== 'candidato') return Conecta.redirectByUser(user);
        candidateSettings.hidden = false;
        backLink.href = '/pages/candidato.html';
        profileLink.href = '/pages/candidato.html#meu-perfil';
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
      }
    } catch (error) {
      Conecta.toast(error.message || 'Não foi possível carregar suas configurações.');
      if (error.message && /login|sessão/i.test(error.message)) window.location.href = '/pages/login.html';
    }
  });
})();