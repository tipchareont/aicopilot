'use strict';

(() => {
  const normalize = (value) => String(value ?? '').trim().toLowerCase();
  const upper = (value) => String(value ?? '').trim().toUpperCase();
  const path = normalize(window.location.pathname);
  const view = normalize(new URLSearchParams(window.location.search).get('view'));
  const username = normalize(localStorage.getItem('username') || 'user');
  const role = upper(localStorage.getItem('role'));
  const GLOBAL_TOOL_ROLES = new Set(['ADMIN', 'DEVELOPER', 'DEV', 'MANAGER']);
  const cacheKey = `ai_marketing_copilot_workspace_cache_v3_${username}`;

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

  const readAccess = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (Number(parsed?.cache_version || 0) !== 3) return [];
      return Array.isArray(parsed?.data?.access) ? parsed.data.access : [];
    } catch { return []; }
  };

  const permissionSnapshot = () => {
    const access = readAccess();
    const global = GLOBAL_TOOL_ROLES.has(role);
    return {
      canHealth: global || access.some((row) => row?.permissions?.can_view === true),
      canRepair: global || access.some((row) => row?.permissions?.can_repair_missing === true || row?.permissions?.can_force_refresh === true),
    };
  };

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

  const applyToolVisibility = () => {
    const permission = permissionSnapshot();
    const healthLink = document.querySelector('[data-workspace-view="health"]');
    const repairLink = document.querySelector('[data-workspace-view="repair"]');
    const activityLink = document.querySelector('[data-workspace-view="activity"]');
    if (healthLink) healthLink.hidden = !permission.canHealth;
    if (repairLink) repairLink.hidden = !permission.canRepair;
    if (activityLink) activityLink.hidden = !permission.canRepair;
    const hasVisibleTool = permission.canHealth || permission.canRepair;
    if (dataGroup) dataGroup.hidden = !hasVisibleTool;

    if (isWorkspace && ((view === 'health' && !permission.canHealth) || (['repair', 'activity'].includes(view) && !permission.canRepair))) {
      const target = new URL('./index.html', location.href);
      location.replace(target.href);
      return false;
    }
    return true;
  };

  const visible = applyToolVisibility();
  setGroup(workspaceGroup, workspaceToggle, workspaceSubnav, isWorkspace, isWorkspace);
  if (visible) setGroup(dataGroup, dataToggle, dataSubnav, isDataView && !dataGroup?.hidden, isDataView && !dataGroup?.hidden);

  workspaceToggle?.addEventListener('click', () => {
    const next = workspaceToggle.getAttribute('aria-expanded') !== 'true';
    setGroup(workspaceGroup, workspaceToggle, workspaceSubnav, next, isWorkspace);
    if (!next) setGroup(dataGroup, dataToggle, dataSubnav, false, isDataView);
  });

  dataToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (dataGroup?.hidden) return;
    const next = dataToggle.getAttribute('aria-expanded') !== 'true';
    setGroup(dataGroup, dataToggle, dataSubnav, next, isDataView);
  });

  window.addEventListener('workspace-permissions-updated', () => {
    if (!applyToolVisibility()) return;
    if (isWorkspace) setGroup(workspaceGroup, workspaceToggle, workspaceSubnav, true, true);
    if (isDataView && !dataGroup?.hidden) setGroup(dataGroup, dataToggle, dataSubnav, true, true);
  });
})();
