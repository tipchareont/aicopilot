'use strict';

(() => {
  const SELECTOR = '.info-tip';
  const EDGE = 12;
  const GAP = 10;
  const MAX_WIDTH = 340;

  const state = {
    openTip: null,
    openButton: null,
    original: new WeakMap(),
    hideTimer: 0,
  };

  const px = (n) => `${Math.round(n)}px`;

  const ensureId = (el) => {
    if (el.id) return el.id;
    el.id = `tooltip-${Math.random().toString(36).slice(2, 10)}`;
    return el.id;
  };

  const getParts = (tip) => ({
    button: tip?.querySelector('button'),
    pop: tip?.querySelector('.info-pop'),
  });

  const storeOriginal = (pop) => {
    if (state.original.has(pop)) return;
    state.original.set(pop, {
      parent: pop.parentNode,
      next: pop.nextSibling,
    });
  };

  const portalToBody = (pop) => {
    storeOriginal(pop);
    if (pop.parentNode !== document.body) {
      document.body.appendChild(pop);
    }
    pop.classList.add('info-pop-portal');
  };

  const restore = (pop) => {
    const original = state.original.get(pop);
    if (!original?.parent) return;

    pop.classList.remove('info-pop-portal', 'is-open');
    pop.removeAttribute('data-placement');
    pop.style.removeProperty('left');
    pop.style.removeProperty('top');
    pop.style.removeProperty('width');
    pop.style.removeProperty('--tooltip-arrow-left');

    if (original.next && original.next.parentNode === original.parent) {
      original.parent.insertBefore(pop, original.next);
    } else {
      original.parent.appendChild(pop);
    }
  };

  const hardCloseAll = () => {
    document.querySelectorAll('.info-pop-portal.is-open').forEach((pop) => {
      pop.classList.remove('is-open');
      pop.setAttribute('aria-hidden', 'true');
      restore(pop);
    });
  };

  const place = (button, pop) => {
    if (!button || !pop || !pop.classList.contains('is-open')) return;

    const b = button.getBoundingClientRect();
    const width = Math.max(180, Math.min(MAX_WIDTH, window.innerWidth - EDGE * 2));
    pop.style.width = px(width);

    const p = pop.getBoundingClientRect();
    const roomAbove = b.top;
    const roomBelow = window.innerHeight - b.bottom;
    const placement =
      roomAbove >= p.height + GAP || roomAbove >= roomBelow
        ? 'top'
        : 'bottom';

    let top =
      placement === 'top'
        ? b.top - p.height - GAP
        : b.bottom + GAP;

    top = Math.max(EDGE, Math.min(top, window.innerHeight - p.height - EDGE));

    let left = b.left + b.width / 2 - p.width / 2;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - p.width - EDGE));

    const buttonCenter = b.left + b.width / 2;
    const arrowLeft = Math.max(14, Math.min(buttonCenter - left, p.width - 14));

    pop.style.left = px(left);
    pop.style.top = px(top);
    pop.style.setProperty('--tooltip-arrow-left', px(arrowLeft));
    pop.dataset.placement = placement;
  };

  const close = () => {
    clearTimeout(state.hideTimer);

    const tip = state.openTip;
    if (tip) {
      const { button, pop } = getParts(tip);

      if (button) button.setAttribute('aria-expanded', 'false');

      if (pop) {
        pop.classList.remove('is-open');
        pop.setAttribute('aria-hidden', 'true');
        restore(pop);
      }
    }

    state.openTip = null;
    state.openButton = null;

    // Defensive cleanup: never allow stale black boxes to remain.
    hardCloseAll();
  };

  const open = (tip) => {
    clearTimeout(state.hideTimer);

    if (state.openTip && state.openTip !== tip) {
      close();
    } else {
      hardCloseAll();
    }

    const { button, pop } = getParts(tip);
    if (!button || !pop) return;

    const id = ensureId(pop);

    button.setAttribute('aria-describedby', id);
    button.setAttribute('aria-expanded', 'true');

    pop.setAttribute('role', 'tooltip');
    pop.setAttribute('aria-hidden', 'false');

    portalToBody(pop);

    pop.style.left = '0px';
    pop.style.top = '0px';
    pop.classList.add('is-open');

    state.openTip = tip;
    state.openButton = button;

    requestAnimationFrame(() => place(button, pop));
  };

  const closeSoon = (tip, delay = 35) => {
    clearTimeout(state.hideTimer);
    state.hideTimer = window.setTimeout(() => {
      if (state.openTip === tip) close();
    }, delay);
  };

  const bind = (tip) => {
    if (!tip || tip.dataset.tooltipBound === '1') return;

    const { button, pop } = getParts(tip);
    if (!button || !pop) return;

    tip.dataset.tooltipBound = '1';
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');
    pop.setAttribute('aria-hidden', 'true');

    /*
     * V5.8.7:
     * The popup is portaled out of `.info-tip`, so hover lifetime must be
     * attached to the button that never moves in the DOM.
     */
    button.addEventListener('pointerenter', () => open(tip));
    button.addEventListener('pointerleave', () => closeSoon(tip, 35));

    button.addEventListener('focus', () => open(tip));
    button.addEventListener('blur', () => closeSoon(tip, 0));

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (state.openTip === tip) close();
      else open(tip);
    });
  };

  const bindAll = (root = document) => {
    root.querySelectorAll?.(SELECTOR).forEach(bind);
  };

  document.addEventListener('pointerdown', (event) => {
    if (!state.openTip) return;
    if (state.openButton?.contains(event.target)) return;
    close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const button = state.openButton;
      close();
      button?.focus?.();
    }
  });

  window.addEventListener('resize', () => {
    if (!state.openTip) return;
    const { button, pop } = getParts(state.openTip);
    requestAnimationFrame(() => place(button, pop));
  }, { passive: true });

  window.addEventListener('scroll', () => {
    if (state.openTip) close();
  }, { passive: true, capture: true });

  window.addEventListener('blur', close);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) close();
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.(SELECTOR)) bind(node);
        bindAll(node);
      }
    }
  });

  const init = () => {
    hardCloseAll();
    bindAll();
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
