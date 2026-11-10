(() => {
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
    const themeButtonHost = document.querySelector('.header-actions, .dashboard-user, .auth-intro');
    const savedTheme = localStorage.getItem('conecta-theme');
    const applyTheme = theme => {
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
      if (themeButtonHost.classList.contains('auth-intro')) {
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
    applyTheme(savedTheme === 'dark' ? 'dark' : 'light');


    // Central de acessibilidade compartilhada entre os painéis
    const accessibilityDefaults = { font: 'normal', contrast: false, links: false, readable: false, spacing: false, motion: false, focus: false };
    let accessibilitySettings = { ...accessibilityDefaults };
    try { accessibilitySettings = { ...accessibilityDefaults, ...JSON.parse(localStorage.getItem('conecta-accessibility') || '{}') }; } catch {}
    const accessibilityModal = document.getElementById('accessibility-modal');
    const accessibilityOpen = document.getElementById('accessibility-open');
    if (accessibilityModal && accessibilityOpen) {
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
        accessibilityOpen.focus();
      };
      const openAccessibility = () => {
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
        if (event.key === 'Escape' && accessibilityModal.classList.contains('is-open')) closeAccessibility();
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
            toggle.setAttribute('aria-expanded', 'false');
          }
        });
      });
    }
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const opened = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(opened));
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
      api('/api/me').then(session => {
        const user = session.usuario;
        if (!user) return;

        // A chamada para criar conta é exclusiva de visitantes não autenticados.
        document.getElementById('footer-signup-cta')?.remove();

        // Usuário autenticado não precisa ver opções de entrar ou cadastrar.
        document.querySelectorAll('.site-header a[href*="login.html"], .site-header a[href*="cadastro.html"]').forEach(item => item.remove());

        const link = document.createElement('a');
        link.className = 'candidate-header-profile-link';
        link.href = user.tipo === 'empresa' ? '/pages/empresa.html#company-profile-heading' : '/pages/candidato.html#meu-perfil';
        link.setAttribute('aria-label', 'Abrir meu perfil');
        link.title = 'Meu perfil';
        if (user.fotoPerfil) {
          const photo = document.createElement('img');
          photo.src = user.fotoPerfil;
          photo.alt = '';
          link.appendChild(photo);
        } else {
          const initials = String(user.nomeEmpresa || user.nome || 'CT').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'CT';
          link.textContent = initials;
        }
        publicHeaderActions.prepend(link);

        if (!publicHeaderActions.querySelector('[data-logout]')) {
          const logout = document.createElement('button');
          logout.type = 'button';
          logout.className = 'button button-outline button-small menu-logout';
          logout.textContent = 'Sair da conta';
          logout.addEventListener('click', async () => {
            try {
              await api('/api/logout', { method: 'POST' });
              window.location.href = '/';
            } catch (error) { toast(error.message); }
          });
          publicHeaderActions.appendChild(logout);
        }
      }).catch(() => {});
    }

    // Registro do PWA: permite instalar o site e disponibiliza o modo offline básico.
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
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