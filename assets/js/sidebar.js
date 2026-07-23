'use strict';

(() => {
  const normalize = (value) => String(value ?? '').trim().toLowerCase();
  const upper = (value) => String(value ?? '').trim().toUpperCase();
  const path = normalize(window.location.pathname);
  const view = normalize(new URLSearchParams(window.location.search).get('view'));
  const username = normalize(localStorage.getItem('username') || 'user');
  const initialRole = upper(localStorage.getItem('role'));
  const GLOBAL_TOOL_ROLES = new Set(['ADMIN', 'DEVELOPER', 'DEV', 'MANAGER']);
  const CACHE_VERSION = 5;
  const cacheKey = `ai_marketing_copilot_workspace_cache_v5_${username}`;

  const page = (() => {
    if (path.includes('/creative-weekly/')) return 'creative-weekly';
    if (path.includes('/scale-advisor/')) return 'scale-advisor';
    if (path.includes('/action-center/')) return 'action-center';
    if (path.includes('/ai-chat/')) return 'ai-chat';
    if (path.includes('/campaign/')) return 'campaign';
    if (path.includes('/creative/')) return 'creative';
    if (path.includes('/workspace/')) return 'workspace';
    return 'dashboard';
  })();

  const dataViews = new Set(['health', 'repair', 'activity']);
  const isDataView = page === 'workspace' && dataViews.has(view);
  const isWorkspace = page === 'workspace';

  const readCachedPermission = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (Number(parsed?.cache_version || 0) !== CACHE_VERSION) return null;
      const access = Array.isArray(parsed?.data?.access) ? parsed.data.access : [];
      const role = upper(parsed?.data?.profile?.role || initialRole);
      return { known: true, access, role };
    } catch {
      return null;
    }
  };

  const cached = readCachedPermission();
  let permissionState = cached || {
    known: GLOBAL_TOOL_ROLES.has(initialRole),
    access: [],
    role: initialRole,
  };

  const permissionSnapshot = () => {
    const role = upper(permissionState.role || initialRole);
    const access = Array.isArray(permissionState.access) ? permissionState.access : [];
    const global = GLOBAL_TOOL_ROLES.has(role);
    return {
      known: Boolean(permissionState.known || global),
      canHealth: global || access.some((row) => row?.permissions?.can_view === true),
      canRepair: global || access.some((row) =>
        row?.permissions?.can_repair_missing === true ||
        row?.permissions?.can_force_refresh === true
      ),
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

    // Hide tools until permission is resolved. This prevents a flash of unauthorized menu items.
    if (healthLink) healthLink.hidden = !permission.known || !permission.canHealth;
    if (repairLink) repairLink.hidden = !permission.known || !permission.canRepair;
    if (activityLink) activityLink.hidden = !permission.known || !permission.canRepair;

    const hasVisibleTool = permission.known && (permission.canHealth || permission.canRepair);
    if (dataGroup) dataGroup.hidden = !hasVisibleTool;

    if (!hasVisibleTool) {
      setGroup(dataGroup, dataToggle, dataSubnav, false, false);
    }

    return permission;
  };

  const permission = applyToolVisibility();
  setGroup(workspaceGroup, workspaceToggle, workspaceSubnav, isWorkspace, isWorkspace);
  setGroup(
    dataGroup,
    dataToggle,
    dataSubnav,
    Boolean(permission.known && isDataView && !dataGroup?.hidden),
    Boolean(permission.known && isDataView && !dataGroup?.hidden)
  );

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

  window.addEventListener('workspace-permissions-updated', (event) => {
    const detail = event?.detail || {};
    permissionState = {
      known: true,
      access: Array.isArray(detail.access) ? detail.access : [],
      role: upper(detail.role || initialRole),
    };

    const updated = applyToolVisibility();
    if (isWorkspace) setGroup(workspaceGroup, workspaceToggle, workspaceSubnav, true, true);
    if (isDataView && !dataGroup?.hidden) {
      setGroup(dataGroup, dataToggle, dataSubnav, true, true);
    } else if (!updated.canHealth && !updated.canRepair) {
      setGroup(dataGroup, dataToggle, dataSubnav, false, false);
    }
  });
})();
