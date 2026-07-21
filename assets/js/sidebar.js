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
  const isWorkspace = page === 'workspace';

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

  const workspaceGroup = document.querySelector('[data-nav-group="workspace"]');
  const workspaceToggle = workspaceGroup?.querySelector(':scope > .sidebar-nav-toggle');
  const workspaceSubnav = workspaceGroup?.querySelector(':scope > .sidebar-subnav');
  const dataGroup = workspaceGroup?.querySelector('[data-nav-group="data-management"]');
  const dataToggle = dataGroup?.querySelector(':scope > .sidebar-nav-toggle');
  const dataSubnav = dataGroup?.querySelector(':scope > .sidebar-subnav');

  const setGroup = (group, toggle, subnav, expanded, active = false) => {
    if (!group || !toggle || !subnav) return;
    group.classList.toggle('expanded', expanded);
    group.classList.toggle('active', active);
    toggle.setAttribute('aria-expanded', String(expanded));
    subnav.hidden = !expanded;
  };

  setGroup(workspaceGroup, workspaceToggle, workspaceSubnav, isWorkspace, isWorkspace);
  setGroup(dataGroup, dataToggle, dataSubnav, isDataView, isDataView);

  workspaceToggle?.addEventListener('click', () => {
    const next = workspaceToggle.getAttribute('aria-expanded') !== 'true';
    setGroup(workspaceGroup, workspaceToggle, workspaceSubnav, next, isWorkspace);
    if (!next) setGroup(dataGroup, dataToggle, dataSubnav, false, isDataView);
  });

  dataToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    const next = dataToggle.getAttribute('aria-expanded') !== 'true';
    setGroup(dataGroup, dataToggle, dataSubnav, next, isDataView);
  });
})();
