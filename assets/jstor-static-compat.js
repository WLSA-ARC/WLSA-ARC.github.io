(() => {
  const LIVE = 'https://www.jstor.org';

  function replaceQueryBuilder() {
    const mount = document.getElementById('query-builder-mount-point');
    if (!mount || mount.dataset.staticCompat === '1') return;

    mount.dataset.staticCompat = '1';
    mount.innerHTML = `
      <div class="jstor-static-query">
        <div class="jstor-static-query__top">
          <a class="jstor-static-query__advanced" href="${LIVE}/action/showAdvancedSearch">Advanced Search</a>
        </div>
        <div class="jstor-static-query__row">
          <button class="jstor-static-query__scope" type="button" aria-label="Content type">All Content</button>
          <div class="jstor-static-query__input-wrap">
            <input class="jstor-static-query__input" type="search" name="Query" maxlength="200" autocomplete="off" placeholder="Search journals, books, images, and primary sources" aria-label="Search all content">
            <button class="jstor-static-query__submit" type="submit" aria-label="Submit search"></button>
          </div>
        </div>
      </div>`;
  }

  function makeHeaderActionsSafe() {
    const login = document.querySelector('.mfe-header__login-button');
    const register = document.querySelector('.mfe-header__register-button');
    const provider = document.querySelector('mfe-provider-designation-statement-pharos-link');
    const logo = document.querySelector('#headerMountPoint .mfe-header__jstor-logo');

    login?.addEventListener('click', () => { window.location.href = `${LIVE}/login`; });
    register?.addEventListener('click', () => { window.location.href = `${LIVE}/register`; });
    provider?.addEventListener('click', () => { window.location.href = `${LIVE}/institution-finder`; });
    logo?.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = '/';
    });

    const browse = document.querySelector('mfe-header-pharos-dropdown-menu-nav-category[data-dropdown-menu-id="browse-menu"]');
    browse?.addEventListener('click', () => { window.location.href = `${LIVE}/subjects`; });

    const workspace = document.querySelector('#headerMountPoint #workspace-link');
    workspace?.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = `${LIVE}/workspace`;
    });
  }

  function removeRuntimeFallbacks() {
    document.getElementById('globalAccessWorkflowMountPoint')?.setAttribute('hidden', '');
    document.querySelectorAll('mfe-header-pharos-dropdown-menu, mfe-query-builder-pharos-dropdown-menu, mfe-header-pharos-coach-mark').forEach(el => {
      el.setAttribute('hidden', '');
    });
    document.getElementById('onetrust-consent-sdk')?.remove();
    document.querySelectorAll('.onetrust-pc-dark-filter').forEach(el => el.remove());
  }

  function fixRelativeLinks() {
    document.querySelectorAll('#headerMountPoint [href^="/"]').forEach(el => {
      const href = el.getAttribute('href');
      if (!href || href === '/') return;
      el.setAttribute('href', LIVE + href);
    });
  }

  function init() {
    removeRuntimeFallbacks();
    replaceQueryBuilder();
    makeHeaderActionsSafe();
    fixRelativeLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
