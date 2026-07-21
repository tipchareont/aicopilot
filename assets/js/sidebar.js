'use strict';

(() => {
  const normalize = (value) => String(value ?? '').trim().toLowerCase();
  const path = normalize(window.location.pathname);
  const view = normalize(new URLSearchParams(window.location.search).get('view'));

  const page = (() => {
    if (path.includes('/creative-weekly/')) return 'creative-weekly';
    if (path.includes('/scale-advisor/')) return 'scale-advisor';
    if (path.includes('/ai-chat/')) return 'ai-chat';
    if (path.includes('/campaign/')) return 'campaign';
    if (path.includes('/creative/')) return 'creative';
    if (path.includes('/workspace/')) return 'workspace';
    return 'dashboard';
  })();

  const dataViews = new Set(['health', 'repair', 'activity']);
  const isDataView = page === 'workspace' && dataViews.has(view);

  document.querySelectorAll('[data-nav-page]').forEach((link) => {
    const active = link.dataset.navPage === page && !(page === 'workspace' && isDataView);
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  document.querySelectorAll('[data-workspace-view]').forEach((link) => {
    const active = isDataView && link.dataset.workspaceView === view;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const group = document.querySelector('[data-nav-group="data-management"]');
  const toggle = group?.querySelector('.sidebar-nav-toggle');
  const subnav = group?.querySelector('.sidebar-subnav');

  const setExpanded = (expanded) => {
    if (!group || !toggle || !subnav) return;
    group.classList.toggle('expanded', expanded);
    group.classList.toggle('active', isDataView);
    toggle.setAttribute('aria-expanded', String(expanded));
    subnav.hidden = !expanded;
  };

  setExpanded(isDataView);

  toggle?.addEventListener('click', () => {
    setExpanded(toggle.getAttribute('aria-expanded') !== 'true');
  });
})();
