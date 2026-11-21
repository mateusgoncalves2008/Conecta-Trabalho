(() => {
  const SELECTOR = 'button[data-efeito~="icone-curtir"]';
  const HEART = 'M12 20.4C12 20.4 3 14.9 3 8.9 3 6.1 5.1 4 7.7 4c1.8 0 3.4 1 4.3 2.6C12.9 5 14.5 4 16.3 4 18.9 4 21 6.1 21 8.9c0 6-9 11.5-9 11.5Z';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!document.getElementById('ef-icone-curtir')) {
    const style = document.createElement('style');
    style.id = 'ef-icone-curtir';
    style.textContent = `
      .like-toggle-button[data-efeito~="icone-curtir"] {
        position: relative;
        overflow: visible;
        --icone-curtir-cor: #e53950;
        --icone-curtir-contorno: currentColor;
        --icone-curtir-faisca: #f08a9b;
        -webkit-tap-highlight-color: transparent;
      }
      .like-toggle-button[data-efeito~="icone-curtir"] .ef-curtir-alvo {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 27px;
        width: 27px;
        height: 27px;
      }
      .like-toggle-button[data-efeito~="icone-curtir"] .ef-curtir-svg {
        display: block;
        width: 27px;
        height: 27px;
        flex: 0 0 27px;
        overflow: visible;
      }
      .like-toggle-button[data-efeito~="icone-curtir"] .ef-curtir-contorno {
        fill: none;
        stroke: var(--icone-curtir-contorno);
        stroke-width: 1.8;
        stroke-linejoin: round;
      }
      .like-toggle-button[data-efeito~="icone-curtir"] .ef-curtir-cheio {
        fill: var(--icone-curtir-cor);
        transform-box: fill-box;
        transform-origin: 50% 60%;
        transform: scale(0);
        transition: transform .18s ease-in;
      }
      .like-toggle-button[data-efeito~="icone-curtir"][aria-pressed="true"] .ef-curtir-contorno {
        stroke: var(--icone-curtir-cor);
      }
      .like-toggle-button[data-efeito~="icone-curtir"][aria-pressed="true"] .ef-curtir-cheio {
        transform: scale(1);
        transition: transform .45s cubic-bezier(.3,1.7,.5,1);
      }
      .like-toggle-button[data-efeito~="icone-curtir"].ef-curtir-pulo .ef-curtir-svg {
        animation: ef-curtir-pulo .5s cubic-bezier(.3,.7,.4,1);
      }
      @keyframes ef-curtir-pulo {
        0% { transform: scale(1); }
        22% { transform: scale(.78); }
        55% { transform: scale(1.22); }
        78% { transform: scale(.95); }
        100% { transform: scale(1); }
      }
      .like-toggle-button[data-efeito~="icone-curtir"] .ef-curtir-anel,
      .like-toggle-button[data-efeito~="icone-curtir"] .ef-curtir-faisca {
        position: absolute;
        left: 50%;
        top: 50%;
        pointer-events: none;
        border-radius: 50%;
      }
      .like-toggle-button[data-efeito~="icone-curtir"] .ef-curtir-anel {
        width: 2.2em;
        height: 2.2em;
        margin: -1.1em 0 0 -1.1em;
        border: .14em solid var(--icone-curtir-cor);
        box-sizing: border-box;
      }
      .like-toggle-button[data-efeito~="icone-curtir"] .ef-curtir-faisca {
        width: .3em;
        height: .3em;
        margin: -.15em 0 0 -.15em;
        background: var(--icone-curtir-faisca);
      }
      @media (prefers-reduced-motion: reduce) {
        .like-toggle-button[data-efeito~="icone-curtir"] .ef-curtir-cheio {
          transition: none !important;
        }
        .like-toggle-button[data-efeito~="icone-curtir"].ef-curtir-pulo .ef-curtir-svg {
          animation: none;
        }
      }`;
    document.head.appendChild(style);
  }

  function prepare(button) {
    const svg = button.querySelector('svg.like-icon');
    if (!svg || svg.classList.contains('ef-curtir-svg')) return;
    const target = document.createElement('span');
    target.className = 'ef-curtir-alvo';
    svg.parentNode.insertBefore(target, svg);
    target.appendChild(svg);
    svg.classList.add('ef-curtir-svg');
    svg.innerHTML = '<path class="ef-curtir-cheio" d="' + HEART + '"></path>' +
      '<path class="ef-curtir-contorno" d="' + HEART + '"></path>';
  }

  function burst(target) {
    const remove = element => {
      element.getAnimations().forEach(animation => animation.cancel());
      element.remove();
    };
    const ring = document.createElement('span');
    ring.className = 'ef-curtir-anel';
    target.appendChild(ring);
    ring.animate(
      [
        { transform: 'scale(.2)', opacity: 1, borderWidth: '.5em' },
        { transform: 'scale(1.15)', opacity: 0, borderWidth: '0' }
      ],
      { duration: 450, easing: 'cubic-bezier(.2,.7,.3,1)' }
    ).finished.then(() => remove(ring), () => remove(ring));

    const em = parseFloat(getComputedStyle(target).fontSize) || 16;
    for (let i = 0; i < 16; i++) {
      const pair = i % 2;
      const angle = (Math.floor(i / 2) / 8) * Math.PI * 2 - Math.PI / 2 + (pair ? .28 : 0);
      const spark = document.createElement('span');
      spark.className = 'ef-curtir-faisca';
      if (pair) spark.style.background = 'var(--icone-curtir-cor)';
      target.appendChild(spark);
      const start = em * 1.05;
      const end = em * (pair ? 1.6 : 1.95);
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      const move = (radius, scale) => 'translate(' + (x * radius) + 'px, ' + (y * radius) + 'px) scale(' + scale + ')';
      spark.animate(
        [
          { transform: move(start, pair ? .7 : 1), opacity: 0 },
          { transform: move(start + (end - start) * .35, pair ? .7 : 1), opacity: 1, offset: .2 },
          { transform: move(end, .15), opacity: 0 }
        ],
        { duration: 520 + pair * 80, delay: 150, easing: 'cubic-bezier(.2,.6,.35,1)', fill: 'backwards' }
      ).finished.then(() => remove(spark), () => remove(spark));
    }
  }

  // O estado aria-pressed é atualizado pela lógica de curtidas do próprio site.
  // A animação só é executada depois que essa lógica confirma visualmente a nova seleção.
  document.addEventListener('click', event => {
    const button = event.target.closest(SELECTOR);
    if (!button) return;
    queueMicrotask(() => {
      prepare(button);
      const liked = button.getAttribute('aria-pressed') === 'true';
      button.classList.remove('ef-curtir-pulo');
      if (!liked || reduceMotion.matches || !button.isConnected) return;
      void button.offsetWidth;
      button.classList.add('ef-curtir-pulo');
      const target = button.querySelector('.ef-curtir-alvo');
      if (target) burst(target);
    });
  });

  document.addEventListener('animationend', event => {
    if (event.target.matches(SELECTOR)) event.target.classList.remove('ef-curtir-pulo');
  });
})();