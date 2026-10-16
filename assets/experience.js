/* Progressive enhancements only. Analysis works without this file. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {threshold: 0.07, rootMargin: '0px 0px 35px 0px'});
    document.querySelectorAll('.section-reveal').forEach(section => observer.observe(section));
    document.documentElement.classList.add('motion-enabled');
    reduced.addEventListener('change', () => {
      if (reduced.matches) document.documentElement.classList.remove('motion-enabled');
    });
  }
})();
