// scroll reveals + index highlighting. everything works without this file.
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduce && 'IntersectionObserver' in window) {
    var targets = document.querySelectorAll('.chapter-head, .plate, .bleed, .sightings > li, .history > li, .sub, .seen, .creds, .prose, .diet, .behaviour, .range, .lesser');
    targets.forEach(function (el, i) {
      el.classList.add('observe');
      el.style.transitionDelay = (i % 6) * 60 + 'ms';
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    targets.forEach(function (el) { io.observe(el); });
  }

  var index = document.querySelector('.index');
  var cover = document.getElementById('top');
  if (index && cover && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      index.classList.toggle('show', !entries[0].isIntersecting);
    }, { threshold: 0.1 }).observe(cover);
  }

  var links = document.querySelectorAll('.index a');
  if (links.length && 'IntersectionObserver' in window) {
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var current = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (a) { a.removeAttribute('aria-current'); });
          var a = map[e.target.id];
          if (a) a.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('.chapter').forEach(function (s) { current.observe(s); });
  }
})();
