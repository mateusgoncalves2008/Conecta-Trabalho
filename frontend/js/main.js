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

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
      document.body.classList.add('page-entry');
    }

    const year = document.getElementById('current-year');
    if (year) year.textContent = new Date().getFullYear();
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
  });

  window.Conecta = { api, toast, redirectByUser };
})();