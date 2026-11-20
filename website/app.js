// LynqDrop Official Website Interactive Scripts
document.addEventListener('DOMContentLoaded', () => {
  // 1. Theme Toggle
  const themeBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');
  const htmlEl = document.documentElement;

  // Read saved or system theme
  const savedTheme = localStorage.getItem('lynqdrop-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

  setTheme(initialTheme);

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const currentTheme = htmlEl.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    });
  }

  function setTheme(theme) {
    htmlEl.setAttribute('data-theme', theme);
    localStorage.setItem('lynqdrop-theme', theme);

    if (themeIcon) {
      if (theme === 'dark') {
        // Sun icon (click to switch to light)
        themeIcon.innerHTML = '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>';
      } else {
        // Moon icon (click to switch to dark)
        themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
      }
    }
  }

  // 2. FAQ Accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const toggle = item.querySelector('.faq-toggle');

    if (question) {
      question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');

        // Close all
        faqItems.forEach(i => {
          i.classList.remove('active');
          const t = i.querySelector('.faq-toggle');
          if (t) t.textContent = '+';
        });

        // Toggle clicked
        if (!isActive) {
          item.classList.add('active');
          if (toggle) toggle.textContent = '−';
        }
      });
    }
  });

  // 3. Dynamic GitHub Release Fetcher
  const REPO_OWNER = 'Tcode-Motion';
  const REPO_NAME = 'lynqdrop';
  const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
  const GITHUB_FALLBACK_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

  async function fetchLatestRelease() {
    try {
      const res = await fetch(GITHUB_API_URL);
      if (!res.ok) throw new Error('Release fetch status: ' + res.status);
      const data = await res.json();
      
      const apkAsset = data.assets?.find(a => a.name.endsWith('.apk'));
      const winAsset = data.assets?.find(a => a.name.endsWith('.zip') || a.name.endsWith('.exe'));
      const macAsset = data.assets?.find(a => a.name.endsWith('.dmg'));
      const linuxAsset = data.assets?.find(a => a.name.endsWith('.AppImage') || a.name.endsWith('.tar.gz'));

      const androidBtn = document.getElementById('download-android-btn');
      if (androidBtn) {
        androidBtn.href = apkAsset ? apkAsset.browser_download_url : (data.html_url || GITHUB_FALLBACK_URL);
        if (apkAsset) androidBtn.setAttribute('download', apkAsset.name);
      }

      const winBtn = document.getElementById('download-windows-btn');
      if (winBtn) {
        winBtn.href = winAsset ? winAsset.browser_download_url : (data.html_url || GITHUB_FALLBACK_URL);
        if (winAsset) winBtn.setAttribute('download', winAsset.name);
      }

      const macBtn = document.getElementById('download-macos-btn');
      if (macBtn) {
        macBtn.href = macAsset ? macAsset.browser_download_url : (data.html_url || GITHUB_FALLBACK_URL);
        if (macAsset) macBtn.setAttribute('download', macAsset.name);
      }

      const linuxBtn = document.getElementById('download-linux-btn');
      if (linuxBtn) {
        linuxBtn.href = linuxAsset ? linuxAsset.browser_download_url : (data.html_url || GITHUB_FALLBACK_URL);
        if (linuxAsset) linuxBtn.setAttribute('download', linuxAsset.name);
      }
    } catch (e) {
      console.log('Using direct GitHub release fallback links:', e);
    }
  }

  fetchLatestRelease();

  // 4. Service Worker registration if available
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
});
