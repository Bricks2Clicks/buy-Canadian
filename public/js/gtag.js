(function () {
  const ALLOWED_HOSTS = ['buycanadian.bricks2clicks.online'];
  if (!ALLOWED_HOSTS.includes(location.hostname)) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', 'G-MBNEYVYW3J');

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-MBNEYVYW3J';
  document.head.prepend(script);
})();
