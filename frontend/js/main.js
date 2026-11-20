(() => {
  // Padroniza o cabeçalho da página inicial em todas as páginas públicas e autenticadas.
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const isAuthPage = /\/(login|cadastro)\.html$/i.test(currentPath);
  const isHomePage = currentPath === '/' || /\/index\.html$/i.test(currentPath);

  if (!isAuthPage && !isHomePage) {
    const currentHeader = document.querySelector('.site-header');
    if (currentHeader) {
      const template = document.createElement('template');
      template.innerHTML = `
        <header class="site-header">
          <a class="brand" href="/" aria-label="ConectaTrabalho - início">
            <img class="brand-mark-image" src="/img/logo-conectatrabalho.svg" alt="" width="38" height="38">
            <span>Conecta<span class="brand-light">Trabalho</span></span>
          </a>
          <button class="menu-toggle" id="menu-toggle" aria-label="Abrir menu" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
          <nav class="main-nav" id="main-nav" aria-label="Navegação principal">
            <a href="/">Início</a>
            <a href="/pages/vagas.html">Vagas</a>
            <a href="/pages/publicacoes.html">Publicações</a>
            <a href="/pages/como-funciona.html">Como funciona</a>
            <a href="/pages/sobre.html">Sobre</a>
            <a class="mobile-login-link" href="/pages/login.html">Entrar</a>
            <a class="mobile-register-link" href="/pages/cadastro.html">Cadastrar</a>
          </nav>
          <div class="header-actions">
            <a class="button button-outline button-small" href="/pages/login.html">Entrar</a>
            <a class="button button-primary button-small" href="/pages/cadastro.html">Cadastrar</a>
          </div>
        </header>`;
      currentHeader.replaceWith(template.content.firstElementChild);
    }
  }

  // Evita mostrar os links de visitante antes de confirmar a sessão.
  document.querySelector('.site-header .header-actions')?.classList.add('auth-checking');

  const api = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.erro || 'Não foi possível concluir a solicitação.');
    return data;
  };

  let toastTimer;
  const toast = (message) => {
    const element = document.getElementById('toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 3500);
  };

  const redirectByUser = user => {
    if (!user) return;
    window.location.href = user.tipo === 'empresa' ? '/pages/empresa.html' : '/pages/candidato.html';
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input[type="password"]').forEach(input => {
      const wrapper = document.createElement('span');
      wrapper.className = 'password-field';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const toggleButton = document.createElement('button');
      toggleButton.type = 'button';
      toggleButton.className = 'password-toggle';
      toggleButton.setAttribute('aria-label', 'Mostrar senha');
      toggleButton.setAttribute('aria-pressed', 'false');
      const eyeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
      const hiddenIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a16 16 0 0 1-3 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10 10 0 0 0 4-.8"/></svg>';
      toggleButton.innerHTML = eyeIcon;
      toggleButton.addEventListener('click', () => {
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        toggleButton.innerHTML = visible ? hiddenIcon : eyeIcon;
        toggleButton.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
        toggleButton.setAttribute('aria-pressed', String(visible));
      });
      wrapper.appendChild(toggleButton);
    });

    const year = document.getElementById('current-year');
    if (year) year.textContent = new Date().getFullYear();

    // Tema claro/escuro compartilhado entre todas as páginas
    const authThemeSlot = document.querySelector('.auth-topbar .auth-theme-slot');
    const isMobileAuth = Boolean(authThemeSlot && window.matchMedia('(max-width: 760px)').matches);
    const themeButtonHost = isMobileAuth ? authThemeSlot : document.querySelector('.header-actions, .dashboard-user, .auth-intro');
    const savedTheme = localStorage.getItem('conecta-theme') || 'light';
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const resolveTheme = preference => preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference;
    const applyTheme = preference => {
      const theme = resolveTheme(preference);
      document.documentElement.dataset.theme = theme;
      document.querySelectorAll('img[data-theme-light][data-theme-dark]').forEach(image => {
        image.src = theme === 'dark' ? image.dataset.themeDark : image.dataset.themeLight;
      });
      if (!themeButton) return;
      const dark = theme === 'dark';
      themeButton.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
      themeButton.setAttribute('aria-pressed', String(dark));
      themeButton.innerHTML = dark
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"></path></svg>';
    };
    let themeButton = null;
    if (themeButtonHost) {
      themeButton = document.createElement('button');
      themeButton.type = 'button';
      themeButton.className = 'theme-toggle';
      if (themeButtonHost.classList.contains('auth-theme-slot')) {
        themeButtonHost.appendChild(themeButton);
      } else if (themeButtonHost.classList.contains('auth-intro')) {
        themeButtonHost.insertBefore(themeButton, themeButtonHost.children[1] || null);
      } else {
        themeButtonHost.insertBefore(themeButton, themeButtonHost.firstElementChild);
      }
      themeButton.addEventListener('click', () => {
        const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('conecta-theme', nextTheme);
        applyTheme(nextTheme);
        guardarCoresOriginais();
      });
    }
    applyTheme(savedTheme);
    systemTheme.addEventListener('change', () => {
      if ((localStorage.getItem('conecta-theme') || 'light') === 'system') applyTheme('system');
    });
    window.addEventListener('conecta:theme-change', event => applyTheme(event.detail?.preference || localStorage.getItem('conecta-theme') || 'light'));


    // Central de acessibilidade compartilhada entre os painéis
    const accessibilityDefaults = { font: 'normal', contrast: false, links: false, readable: false, spacing: false, motion: false, focus: false };
    let accessibilitySettings = { ...accessibilityDefaults };
    try { accessibilitySettings = { ...accessibilityDefaults, ...JSON.parse(localStorage.getItem('conecta-accessibility') || '{}') }; } catch {}
    // Disponibiliza a central de acessibilidade em todas as páginas do site.
    if (!document.getElementById('accessibility-open')) {
      const launcher = document.createElement('button');
      launcher.className = 'accessibility-launcher';
      launcher.type = 'button';
      launcher.id = 'accessibility-open';
      launcher.setAttribute('aria-label', 'Abrir opções de acessibilidade');
      launcher.setAttribute('aria-haspopup', 'dialog');
      launcher.setAttribute('aria-controls', 'accessibility-modal');
      launcher.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13" cy="4.5" r="2.5"></circle><path d="M12 9l-2 8h7l3 6h5M12 10l7 2 2 5M10 17l-2 6"></path><circle cx="13" cy="21" r="8" stroke-dasharray="39 12" transform="rotate(25 13 21)"></circle><circle cx="24.5" cy="26" r="2"></circle></svg>';
      document.body.appendChild(launcher);
    }

    if (!document.getElementById('accessibility-modal')) {
      const modal = document.createElement('div');
      modal.className = 'accessibility-backdrop';
      modal.id = 'accessibility-modal';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <section class="accessibility-dialog" role="dialog" aria-modal="true" aria-labelledby="accessibility-title" aria-describedby="accessibility-description">
          <div class="accessibility-dialog-header">
            <div><span class="eyebrow">PERSONALIZE SUA EXPERIÊNCIA</span><h2 id="accessibility-title">Acessibilidade</h2><p id="accessibility-description">Ajuste a página para facilitar a leitura e a navegação.</p></div>
            <button type="button" class="accessibility-close" id="accessibility-close" aria-label="Fechar acessibilidade">×</button>
          </div>
          <div class="accessibility-options">
            <div class="accessibility-option"><div><strong>Tamanho do texto</strong><span>Aumente ou diminua os textos da página.</span></div><div class="accessibility-font-controls" role="group" aria-label="Tamanho do texto"><button type="button" data-a11y-font="normal" aria-pressed="true">Padrão</button><button type="button" data-a11y-font="large" aria-pressed="false">Maior</button><button type="button" data-a11y-font="larger" aria-pressed="false">Muito maior</button></div></div>
            <label class="accessibility-option"><span><strong>Alto contraste</strong><span>Reforce a diferença entre textos e fundos.</span></span><input type="checkbox" data-a11y-toggle="contrast"></label>
            <label class="accessibility-option"><span><strong>Destacar links</strong><span>Adicione sublinhado aos links para identificá-los melhor.</span></span><input type="checkbox" data-a11y-toggle="links"></label>
            <label class="accessibility-option"><span><strong>Fonte de leitura</strong><span>Use uma fonte simples e mais legível.</span></span><input type="checkbox" data-a11y-toggle="readable"></label>
            <label class="accessibility-option"><span><strong>Espaçamento do texto</strong><span>Aumente o espaço entre linhas e letras.</span></span><input type="checkbox" data-a11y-toggle="spacing"></label>
            <label class="accessibility-option"><span><strong>Reduzir animações</strong><span>Desative movimentos e transições da interface.</span></span><input type="checkbox" data-a11y-toggle="motion"></label>
            <label class="accessibility-option"><span><strong>Realçar foco do teclado</strong><span>Deixe mais visível o elemento selecionado ao navegar com Tab.</span></span><input type="checkbox" data-a11y-toggle="focus"></label>
          </div>
          <div class="accessibility-dialog-footer"><button type="button" class="accessibility-reset" id="accessibility-reset">Restaurar configurações</button><button type="button" class="button button-primary" id="accessibility-done">Concluir</button></div>
        </section>`;
      document.body.appendChild(modal);
    }

    const accessibilityModal = document.getElementById('accessibility-modal');
    const accessibilityOpen = document.getElementById('accessibility-open');
    if (accessibilityModal && accessibilityOpen) {
      let accessibilityReturnFocus = null;
      const applyAccessibility = () => {
        const root = document.documentElement;
        const body = document.body;
        body.dataset.a11yFont = accessibilitySettings.font;
        ['contrast','links','readable','spacing','motion','focus'].forEach(key => body.classList.toggle('a11y-' + key, !!accessibilitySettings[key]));
        accessibilityModal.querySelectorAll('[data-a11y-font]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.a11yFont === accessibilitySettings.font)));
        accessibilityModal.querySelectorAll('[data-a11y-toggle]').forEach(input => input.checked = !!accessibilitySettings[input.dataset.a11yToggle]);
        localStorage.setItem('conecta-accessibility', JSON.stringify(accessibilitySettings));
      };
      const closeAccessibility = () => {
        accessibilityModal.classList.remove('is-open');
        accessibilityModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('accessibility-modal-open');
        const returnTarget = accessibilityReturnFocus && accessibilityReturnFocus.isConnected
          ? accessibilityReturnFocus
          : accessibilityOpen;
        returnTarget.focus();
      };
      const openAccessibility = () => {
        accessibilityReturnFocus = document.activeElement;
        accessibilityModal.classList.add('is-open');
        accessibilityModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('accessibility-modal-open');
        document.getElementById('accessibility-close').focus();
      };
      accessibilityOpen.addEventListener('click', openAccessibility);
      document.getElementById('accessibility-close').addEventListener('click', closeAccessibility);
      document.getElementById('accessibility-done').addEventListener('click', closeAccessibility);
      accessibilityModal.addEventListener('click', event => { if (event.target === accessibilityModal) closeAccessibility(); });
      document.addEventListener('keydown', event => {
        if (!accessibilityModal.classList.contains('is-open')) return;
        if (event.key === 'Escape') {
          closeAccessibility();
          return;
        }
        if (event.key !== 'Tab') return;
        const dialog = accessibilityModal.querySelector('.accessibility-dialog');
        const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
          .filter(element => !element.hidden && element.getClientRects().length);
        if (!focusable.length) {
          event.preventDefault();
          dialog.setAttribute('tabindex', '-1');
          dialog.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      });
      accessibilityModal.querySelectorAll('[data-a11y-font]').forEach(button => button.addEventListener('click', () => {
        accessibilitySettings.font = button.dataset.a11yFont;
        applyAccessibility();
      }));
      accessibilityModal.querySelectorAll('[data-a11y-toggle]').forEach(input => input.addEventListener('change', () => {
        accessibilitySettings[input.dataset.a11yToggle] = input.checked;
        applyAccessibility();
      }));
      document.getElementById('accessibility-reset').addEventListener('click', () => {
        accessibilitySettings = { ...accessibilityDefaults };
        applyAccessibility();
      });
      applyAccessibility();

    }


    // Botão global de voltar ao topo: existe em todas as páginas que carregam main.js.
    let backToTop = document.getElementById('back-to-top');

    if (!backToTop) {
      backToTop = document.createElement('button');
      backToTop.type = 'button';
      backToTop.id = 'back-to-top';
      backToTop.className = 'back-to-top';
      backToTop.setAttribute('aria-label', 'Voltar ao topo');
      backToTop.title = 'Voltar ao topo';
      backToTop.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"></path></svg>';
      document.body.appendChild(backToTop);
    }

    // A página precisa permitir pelo menos 300 px de rolagem.
    // A seta só aparece depois que o usuário desce aproximadamente três etapas.
    const scrollThreshold = 300;
    const pageCanScroll = () =>
      document.documentElement.scrollHeight > window.innerHeight + scrollThreshold;

    const updateBackToTop = () => {
      const canScroll = pageCanScroll();
      const shouldShow = canScroll && window.scrollY >= scrollThreshold;
      backToTop.classList.toggle('is-visible', shouldShow);
      backToTop.setAttribute('aria-hidden', String(!shouldShow));
      backToTop.tabIndex = shouldShow ? 0 : -1;
    };

    window.addEventListener('scroll', updateBackToTop, { passive: true });
    window.addEventListener('resize', updateBackToTop);
    updateBackToTop();

    backToTop.addEventListener('click', () => {
      const reduceMotion = document.body.classList.contains('a11y-motion') ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({
        top: 0,
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    });

    // Troca as cores de hover usando a cor original guardada antes da interação.
    const buttonSelector = 'button:not(.menu-toggle):not(.accessibility-launcher):not(.password-toggle), .button:not(.menu-toggle):not(.accessibility-launcher):not(.password-toggle), input[type="submit"], input[type="button"], input[type="reset"]';
    const originalButtonBackgrounds = new WeakMap();

    function guardarCorOriginal(button) {
      const background = window.getComputedStyle(button).backgroundColor;
      const rgb = background.match(/[\d.]+/g);
      if (!rgb || rgb.length < 3 || Number(rgb[3] ?? 1) === 0) return;
      originalButtonBackgrounds.set(button, background);
    }

    function guardarCoresOriginais(root = document) {
      if (root.matches?.(buttonSelector)) guardarCorOriginal(root);
      root.querySelectorAll?.(buttonSelector).forEach(guardarCorOriginal);
    }

    function aplicarCorOposta(button) {
      const background = originalButtonBackgrounds.get(button);
      if (!background) return;
      const rgb = background.match(/[\d.]+/g);
      if (!rgb || rgb.length < 3) return;

      const [r, g, b] = rgb.slice(0, 3).map(Number);
      const isOrange = r > g * 1.2 && r > b * 1.35;
      const isBlue = b > r * 1.15 && b > g * 1.02;

      if (isOrange) {
        button.style.setProperty('--button-hover-fill', '#142b49');
        button.style.setProperty('--button-hover-text', '#ffffff');
      } else if (isBlue) {
        button.style.setProperty('--button-hover-fill', '#f0a078');
        button.style.setProperty('--button-hover-text', '#171717');
      } else {
        button.style.setProperty('--button-hover-fill', '#142b49');
        button.style.setProperty('--button-hover-text', '#ffffff');
      }
    }

    // Captura os botões existentes e também os inseridos dinamicamente.
    guardarCoresOriginais();
    const buttonObserver = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) guardarCoresOriginais(node);
      }));
    });
    buttonObserver.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('pointerover', event => {
      const button = event.target.closest?.(buttonSelector);
      if (!button || button.contains(event.relatedTarget)) return;
      aplicarCorOposta(button);
    });

    document.addEventListener('pointerout', event => {
      const button = event.target.closest?.(buttonSelector);
      if (!button || button.contains(event.relatedTarget)) return;
      button.style.removeProperty('--button-hover-fill');
      button.style.removeProperty('--button-hover-text');
    });

    // Efeito magnético nos links do menu: eles acompanham suavemente o cursor.
    const magneticLinks = document.querySelectorAll('.site-header .main-nav a');
    if (window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      magneticLinks.forEach(link => {
        link.addEventListener('pointermove', event => {
          const rect = link.getBoundingClientRect();
          const dx = event.clientX - (rect.left + rect.width / 2);
          const dy = event.clientY - (rect.top + rect.height / 2);
          link.style.setProperty('--magnetic-x', (dx * 0.16).toFixed(1) + 'px');
          link.style.setProperty('--magnetic-y', (dy * 0.16).toFixed(1) + 'px');
          link.classList.add('is-magnetic');
        });
        link.addEventListener('pointerleave', () => {
          link.classList.remove('is-magnetic');
          link.style.removeProperty('--magnetic-x');
          link.style.removeProperty('--magnetic-y');
        });
      });
    }

    const header = document.querySelector('.site-header');
    if (header) {
      const updateHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
      updateHeader();
      window.addEventListener('scroll', updateHeader, { passive: true });
    }
    const toggle = document.getElementById('menu-toggle');
    const nav = document.getElementById('main-nav');

    const sectionLinks = [...document.querySelectorAll('[data-section-link]')];
    const observedSections = sectionLinks
      .map(link => document.getElementById(link.dataset.sectionLink))
      .filter(Boolean);

    const setActiveSection = id => {
      sectionLinks.forEach(link => {
        const active = link.dataset.sectionLink === id;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };

    if (sectionLinks.length && observedSections.length) {
      const sectionObserver = new IntersectionObserver(entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      }, {
        rootMargin: '-25% 0px -55% 0px',
        threshold: [0, .15, .35, .6]
      });

      observedSections.forEach(section => sectionObserver.observe(section));

      sectionLinks.forEach(link => {
        link.addEventListener('click', () => {
          setActiveSection(link.dataset.sectionLink);
          if (nav && toggle) {
            nav.classList.remove('open');
            toggle.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Abrir menu');
          }
        });
      });
    }
    if (toggle && nav) {
      const closeMenu = () => {
        nav.classList.remove('open');
        toggle.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Abrir menu');
      };
      toggle.addEventListener('click', () => {
        const opened = nav.classList.toggle('open');
        toggle.classList.toggle('is-open', opened);
        toggle.setAttribute('aria-expanded', String(opened));
        toggle.setAttribute('aria-label', opened ? 'Fechar menu' : 'Abrir menu');
      });
      nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeMenu();
      });
    }
    document.querySelectorAll('[data-logout]').forEach(button => {
      button.addEventListener('click', async () => {
        try {
          await api('/api/logout', { method: 'POST' });
          window.location.href = '/';
        } catch (error) { toast(error.message); }
      });
    });

    // Ações da conta no menu superior, em todas as páginas com cabeçalho.
    const publicHeaderActions = document.querySelector('.site-header .header-actions');
    if (publicHeaderActions) {
      api('/api/me').then(async session => {
        const user = session.usuario;
        if (!user) return;

        // A chamada para criar conta é exclusiva de visitantes não autenticados.
        document.getElementById('footer-signup-cta')?.remove();

        // Usuário autenticado não precisa ver opções de entrar ou cadastrar.
        document.querySelectorAll('.site-header a[href*="login.html"], .site-header a[href*="cadastro.html"]').forEach(item => item.remove());

        const isCompany = user.tipo === 'empresa';
        const profileUrl = isCompany
          ? '/pages/empresa.html#company-profile-heading'
          : '/pages/candidato.html#meu-perfil';
        let profilePhoto = user.fotoPerfil || '';
        let profileName = isCompany ? (user.nomeEmpresa || user.nome) : user.nome;
        let profileSummary = isCompany ? 'Perfil da empresa no ConectaTrabalho' : 'Conheça meu perfil profissional';
        let profileDetail = '';

        try {
          if (isCompany) {
            const companyData = await api('/api/empresa/perfil');
            const profile = companyData.perfil || {};
            profilePhoto = profile.foto_perfil || profilePhoto;
            profileName = profile.nome_empresa || profileName;
            profileSummary = profile.empresa_descricao_curta || profile.descricao || profile.empresa_setor || 'Conheça a empresa e suas oportunidades.';
            profileDetail = profile.cidade || '';
          } else {
            const candidateData = await api('/api/perfil');
            const profile = candidateData.perfil || {};
            profilePhoto = profile.foto_perfil || profilePhoto;
            profileName = profile.nome || profileName;
            profileSummary = profile.titulo_profissional || profile.resumo_profissional || 'Complete seu perfil profissional.';
            profileDetail = profile.cidade || '';
          }
        } catch (error) {
          console.warn('Não foi possível carregar o resumo do perfil no menu:', error);
        }

        const initials = String(profileName || 'CT').trim()
          .split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'CT';
        const wrapper = document.createElement('div');
        wrapper.className = 'account-menu';
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'account-menu-trigger';
        trigger.setAttribute('aria-label', 'Abrir menu da conta');
        trigger.setAttribute('aria-haspopup', 'true');
        trigger.setAttribute('aria-expanded', 'false');
        if (profilePhoto) {
          const photo = document.createElement('img');
          photo.src = profilePhoto;
          photo.alt = '';
          photo.loading = 'eager';
          photo.decoding = 'async';
          trigger.appendChild(photo);
        } else {
          trigger.textContent = initials;
        }
        const chevron = document.createElement('span');
        chevron.className = 'account-menu-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.innerHTML = '<svg viewBox="0 0 16 16" focusable="false"><path d="m3.5 6 4.5 4 4.5-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        trigger.appendChild(chevron);

        const dropdown = document.createElement('div');
        dropdown.className = 'account-menu-popover';
        dropdown.hidden = true;
        const profileCard = document.createElement('a');
        profileCard.className = 'account-menu-profile';
        profileCard.href = profileUrl;
        if (profilePhoto) {
          const cardPhoto = document.createElement('img');
          cardPhoto.src = profilePhoto;
          cardPhoto.alt = '';
          cardPhoto.loading = 'lazy';
          profileCard.appendChild(cardPhoto);
        } else {
          const cardInitials = document.createElement('span');
          cardInitials.className = 'account-menu-avatar-fallback';
          cardInitials.textContent = initials;
          profileCard.appendChild(cardInitials);
        }
        const profileCopy = document.createElement('span');
        profileCopy.className = 'account-menu-profile-copy';
        const name = document.createElement('strong');
        name.textContent = profileName || 'Minha conta';
        const summary = document.createElement('small');
        summary.textContent = profileSummary;
        profileCopy.append(name, summary);
        profileCard.appendChild(profileCopy);
        const profileArrow = document.createElement('span');
        profileArrow.className = 'account-menu-profile-arrow';
        profileArrow.setAttribute('aria-hidden', 'true');
        profileArrow.innerHTML = '<svg viewBox="0 0 16 16" focusable="false"><path d="M5 3h8v8M13 3 6 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        profileCard.appendChild(profileArrow);

        const savedLink = document.createElement('a');
        savedLink.className = 'account-menu-item';
        savedLink.href = '/pages/publicacoes-salvas.html';
        savedLink.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.7L6 21V4.75Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg><span>Publicações salvas</span>';

        const settingsLink = document.createElement('a');
        settingsLink.className = 'account-menu-item';
        settingsLink.href = '/pages/configuracoes.html';
        settingsLink.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span>Configurações e privacidade</span>';

        const helpLink = document.createElement('a');
        helpLink.className = 'account-menu-item';
        helpLink.href = '/pages/central-ajuda.html';
        helpLink.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9.7 9a2.4 2.4 0 1 1 4.1 1.7c-1 .9-1.8 1.1-1.8 2.3M12 16.5v.1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span>Ajuda</span>';

        const logout = document.createElement('button');
        logout.type = 'button';
        logout.className = 'account-menu-item account-menu-logout';
        logout.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5.75A1.75 1.75 0 0 0 4 5.75v12.5A1.75 1.75 0 0 0 5.75 20H10M14 8l4 4-4 4m4-4H9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Sair da conta</span>';
        logout.addEventListener('click', async () => {
          logout.disabled = true;
          try {
            await api('/api/logout', { method: 'POST' });
            window.location.href = '/';
          } catch (error) {
            toast(error.message);
            logout.disabled = false;
          }
        });

        dropdown.append(profileCard, savedLink, settingsLink, helpLink, logout);
        trigger.addEventListener('click', () => {
          const opening = dropdown.hidden;
          dropdown.hidden = !opening;
          trigger.setAttribute('aria-expanded', String(opening));
        });
        document.addEventListener('click', event => {
          if (!wrapper.contains(event.target)) {
            dropdown.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
          }
        });
        document.addEventListener('keydown', event => {
          if (event.key === 'Escape') {
            dropdown.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            trigger.focus();
          }
        });
        wrapper.append(trigger, dropdown);
        publicHeaderActions.prepend(wrapper);

        // Barra de pesquisa posicionada entre a navegação e os controles da conta.
        if (!document.querySelector('.site-header-search')) {
          const searchForm = document.createElement('form');
          searchForm.className = 'site-header-search';
          searchForm.setAttribute('role', 'search');
          searchForm.setAttribute('aria-label', 'Pesquisar pessoas e empresas');
          searchForm.innerHTML = '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" name="q" maxlength="100" placeholder="Pesquisar" aria-label="Pesquisar pessoas e empresas" autocomplete="off"><div class="search-suggestions" hidden><section class="search-suggestion-section" data-recent-section><h2><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Pesquisas recentes</h2><div class="search-suggestion-list" data-recent-list></div></section><section class="search-suggestion-section"><h2><i class="fa-solid fa-arrow-trend-up" aria-hidden="true"></i> Mais populares na comunidade CONECTRA</h2><div class="search-suggestion-list" data-popular-list><p class="search-suggestion-empty">Carregando pesquisas...</p></div></section></div>';
          const searchInput = searchForm.querySelector('input');
          const suggestions = searchForm.querySelector('.search-suggestions');
          const recentList = searchForm.querySelector('[data-recent-list]');
          const recentSection = searchForm.querySelector('[data-recent-section]');
          const popularList = searchForm.querySelector('[data-popular-list]');
          const recentKey = 'conecta-search-recent-' + String(user.id || 'visitante');
          const readRecent = () => {
            try {
              const values = JSON.parse(localStorage.getItem(recentKey) || '[]');
              return Array.isArray(values) ? values.filter(value => typeof value === 'string').slice(0, 6) : [];
            } catch { return []; }
          };
          const renderSuggestionList = (host, values, emptyText, icon) => {
            host.replaceChildren();
            if (!values.length) {
              const empty = document.createElement('p');
              empty.className = 'search-suggestion-empty';
              empty.textContent = emptyText;
              host.appendChild(empty);
              return;
            }
            values.forEach(value => {
              const button = document.createElement('button');
              button.type = 'button';
              button.className = 'search-suggestion-item';
              button.innerHTML = '<i class="fa-solid ' + icon + '" aria-hidden="true"></i>';
              const label = document.createElement('span');
              label.textContent = value;
              button.appendChild(label);
              button.addEventListener('click', () => {
                searchInput.value = value;
                searchForm.requestSubmit();
              });
              host.appendChild(button);
            });
          };
          const refreshRecent = () => {
            const recent = readRecent();
            recentSection.hidden = !recent.length;
            renderSuggestionList(recentList, recent, 'Nenhuma pesquisa recente.', 'fa-clock-rotate-left');
          };
          const loadPopular = async () => {
            try {
              const data = await api('/api/pesquisas/populares');
              renderSuggestionList(popularList, data.pesquisas || [], 'Ainda não há pesquisas populares.', 'fa-arrow-trend-up');
            } catch {
              renderSuggestionList(popularList, [], 'Não foi possível carregar as pesquisas populares.', 'fa-arrow-trend-up');
            }
          };
          const openSuggestions = () => {
            refreshRecent();
            suggestions.hidden = false;
            loadPopular();
          };
          searchInput.addEventListener('focus', openSuggestions);
          searchInput.addEventListener('click', () => { if (suggestions.hidden) openSuggestions(); });
          document.addEventListener('pointerdown', event => {
            if (!searchForm.contains(event.target)) suggestions.hidden = true;
          });
          searchInput.addEventListener('keydown', event => {
            if (event.key === 'Escape') suggestions.hidden = true;
          });
          searchForm.addEventListener('submit', async event => {
            event.preventDefault();
            const value = searchInput.value.trim().slice(0, 100);
            if (value) {
              const recent = [value, ...readRecent().filter(item => item.toLocaleLowerCase('pt-BR') !== value.toLocaleLowerCase('pt-BR'))].slice(0, 6);
              try { localStorage.setItem(recentKey, JSON.stringify(recent)); } catch {}
              try { await api('/api/pesquisas/registrar', { method: 'POST', body: JSON.stringify({ termo: value }) }); } catch (error) { console.warn('Não foi possível registrar a pesquisa:', error); }
            }
            window.location.href = '/pages/pesquisar.html' + (value ? '?q=' + encodeURIComponent(value) : '');
          });
          const header = document.querySelector('.site-header');
          header.insertBefore(searchForm, publicHeaderActions.closest('.dashboard-user') || publicHeaderActions);
        }
      }).catch(() => {}).finally(() => {
        publicHeaderActions.classList.remove('auth-checking');
      });
    }

    // Registro do PWA: permite instalar o site e disponibiliza o modo offline básico.
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js', { scope: '/', updateViaCache: 'none' }).then(registration => registration.update())
          .catch(error => console.warn('Não foi possível registrar o PWA:', error));
      });
    }

    // Instalação iniciada pelo próprio usuário na página "Baixe o aplicativo".
    const installButton = document.getElementById('install-pwa-button');
    const installStatus = document.getElementById('install-pwa-status');
    let deferredInstallPrompt = null;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);

    if (installButton && installStatus) {
      if (isStandalone) {
        installButton.hidden = true;
        installStatus.textContent = 'O ConectaTrabalho já está instalado neste dispositivo.';
      } else if (isAppleMobile) {
        installButton.hidden = true;
        installStatus.textContent = 'No iPhone ou iPad: abra esta página no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.';
      } else {
        installButton.hidden = false;
        installStatus.textContent = 'Se o navegador oferecer a instalação, use o botão abaixo para adicionar o ConectaTrabalho ao dispositivo.';
      }

      window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        deferredInstallPrompt = event;
        installButton.hidden = false;
        installStatus.textContent = 'O ConectaTrabalho está pronto para ser instalado neste dispositivo.';
      });

      installButton.addEventListener('click', async () => {
        if (!deferredInstallPrompt) {
          installStatus.textContent = 'A instalação ainda não está disponível neste navegador. Verifique se está usando um navegador compatível e se o site está em HTTPS ou localhost.';
          return;
        }
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        if (choice.outcome === 'accepted') {
          installButton.hidden = true;
          installStatus.textContent = 'Instalação solicitada. Procure o ConectaTrabalho na tela inicial ou na lista de aplicativos.';
        } else {
          installStatus.textContent = 'A instalação não foi concluída. Você pode tentar novamente quando o navegador oferecer essa opção.';
        }
      });

      window.addEventListener('appinstalled', () => {
        installButton.hidden = true;
        installStatus.textContent = 'ConectaTrabalho instalado com sucesso neste dispositivo.';
      });
    }

  });

  window.Conecta = { api, toast, redirectByUser };
})();