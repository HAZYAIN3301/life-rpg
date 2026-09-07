/* Preview-only presentation preference; never touches task/account storage. */
(() => {
  const key = 'satoru:today-design:theme:v1';
  const choices = ['light', 'dark', 'system'];
  const system = matchMedia('(prefers-color-scheme: dark)');
  const query = new URLSearchParams(location.search).get('theme');
  let saved;
  try { saved = localStorage.getItem(key); } catch {}
  let preference = choices.includes(query) ? query : choices.includes(saved) ? saved : 'system';
  function apply() {
    const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#25262f' : '#f7f6fa';
    document.querySelectorAll('button[data-theme-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preference));
    });
    const den = document.querySelector('.den-art');
    if (den) {
      den.src = theme === 'dark' ? 'assets/den.jpg' : 'assets/den-day.jpg';
      den.alt = theme === 'dark' ? 'Тёплый свет фонаря в логове' : 'Дневной свет в логове';
    }
  }
  window.SatoruTheme = Object.freeze({
    get: () => preference,
    set(value) {
      if (!choices.includes(value)) return false;
      preference = value;
      let persisted = false;
      try { localStorage.setItem(key, value); persisted = localStorage.getItem(key) === value; } catch {}
      const url = new URL(location.href);
      url.searchParams.set('theme', value);
      history.replaceState(null, '', url);
      apply();
      return persisted;
    },
  });
  system.addEventListener('change', () => { if (preference === 'system') apply(); });
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  apply();
})();
