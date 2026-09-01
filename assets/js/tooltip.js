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

  const getParts = (tip) => {
    if (!tip) return {};
    return {
      button: tip.querySelector('button'),
      pop: tip.querySelector('.info-pop'),
    };
  };

  const storeOriginalPosition = (pop) => {
    if (state.original.has(pop)) return;
    state.original.set(pop, {
      parent: pop.parentNode,
      next: pop.nextSibling,
    });
  };

  const portalToBody = (pop) => {
    storeOriginalPosition(pop);
    if (pop.parentNode !== document.body) {
      document.body.appendChild(pop);
    }
    pop.classList.add('info-pop-portal');
  };

  const restoreFromPortal = (pop) => {
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

  const measureAndPlace = (tip, button, pop) => {
    if (!tip || !button || !pop || !pop.classList.contains('is-open')) return;

    const buttonRect = button.getBoundingClientRect();

    // Width must fit the viewport and remain readable.
    const maxWidth = Math.max(180, Math.min(MAX_WIDTH, window.innerWidth - EDGE * 2));
    pop.style.width = px(maxWidth);

    const popRect = pop.getBoundingClientRect();

    const roomAbove = buttonRect.top;
    const roomBelow = window.innerHeight - buttonRect.bottom;
    const preferAbove = roomAbove >= popRect.height + GAP || roomAbove >= roomBelow;
    const placement = preferAbove ? 'top' : 'bottom';

    let top = placement === 'top'
      ? buttonRect.top - popRect.height - GAP
      : buttonRect.bottom + GAP;

    top = Math.max(EDGE, Math.min(top, window.innerHeight - popRect.height - EDGE));

    let left = buttonRect.left + buttonRect.width / 2 - popRect.width / 2;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - popRect.width - EDGE));

    const buttonCenter = buttonRect.left + buttonRect.width / 2;
    const arrowLeft = Math.max(14, Math.min(buttonCenter - left, popRect.width - 14));

    pop.style.left = px(left);
    pop.style.top = px(top);
    pop.style.setProperty('--tooltip-arrow-left', px(arrowLeft));
    pop.dataset.placement = placement;
  };

  const close = ({ restore = true } = {}) => {
    clearTimeout(state.hideTimer);

    const tip = state.openTip;
    if (!tip) return;

    const { button, pop } = getParts(tip);

    if (button) {
      button.setAttribute('aria-expanded', 'false');
    }

    if (pop) {
      pop.classList.remove('is-open');
      pop.setAttribute('aria-hidden', 'true');

      if (restore) {
        restoreFromPortal(pop);
      }
    }

    state.openTip = null;
    state.openButton = null;
  };

  const open = (tip) => {
    if (!tip) return;

    if (state.openTip && state.openTip !== tip) {
      close();
    }

    const { button, pop } = getParts(tip);
    if (!button || !pop) return;

    clearTimeout(state.hideTimer);

    const popId = ensureId(pop);
    pop.setAttribute('role', 'tooltip');
    pop.setAttribute('aria-hidden', 'false');

    button.setAttribute('aria-describedby', popId);
    button.setAttribute('aria-expanded', 'true');

    portalToBody(pop);

    // Reset positioning before measuring.
    pop.style.left = '0px';
    pop.style.top = '0px';
    pop.classList.add('is-open');

    state.openTip = tip;
    state.openButton = button;

    requestAnimationFrame(() => measureAndPlace(tip, button, pop));
  };

  const scheduleClose = (tip, delay = 90) => {
    clearTimeout(state.hideTimer);
    state.hideTimer = window.setTimeout(() => {
      if (state.openTip === tip) {
        close();
      }
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

    tip.addEventListener('mouseenter', () => open(tip));
    tip.addEventListener('mouseleave', () => scheduleClose(tip));

    tip.addEventListener('focusin', () => open(tip));
    tip.addEventListener('focusout', (event) => {
      if (!tip.contains(event.relatedTarget)) {
        scheduleClose(tip, 0);
      }
    });

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (state.openTip === tip) {
        close();
      } else {
        open(tip);
      }
    });

    // Touch/pointer users should be able to tap the i icon.
    button.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') {
        event.stopPropagation();
      }
    });
  };

  const bindAll = (root = document) => {
    root.querySelectorAll?.(SELECTOR).forEach(bind);
  };

  const reposition = () => {
    if (!state.openTip) return;
    const { button, pop } = getParts(state.openTip);
    if (!button || !pop) {
      close();
      return;
    }
    requestAnimationFrame(() => measureAndPlace(state.openTip, button, pop));
  };

  document.addEventListener('click', (event) => {
    if (!state.openTip) return;
    if (state.openTip.contains(event.target)) return;
    if (event.target.closest?.('.info-pop-portal')) return;
    close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close();
      state.openButton?.focus?.();
    }
  });

  window.addEventListener('resize', reposition, { passive: true });
  window.addEventListener('scroll', reposition, { passive: true, capture: true });

  // Future-proof dynamically inserted contextual help.
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
    bindAll();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
