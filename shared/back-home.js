(function () {
  const mainHref = '../../../index.html';

  function init() {
    if (new URLSearchParams(window.location.search).get('embed') === '1') return;
    if (document.getElementById('qontic-back-home')) return;

    const link = document.createElement('a');
    link.id = 'qontic-back-home';
    link.className = 'qontic-back-home';
    link.href = mainHref;
    link.textContent = '← Back to Main Page';
    link.setAttribute('aria-label', 'Back to the Q-Ontic Lab main page');
    document.body.appendChild(link);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();