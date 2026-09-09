// posthog. cookieless: memory persistence, no banner needed. leave the key
// empty to switch it off.
(function () {
  var KEY = 'phc_yx8iqrPD3K2HwNzTNehFkSLQq4vBtvVXCoMmuv8QnXqf';
  var HOST = 'https://eu.i.posthog.com';
  if (!KEY || navigator.doNotTrack === '1' || location.protocol === 'file:') return;

  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing is_capturing".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  posthog.init(KEY, {
    api_host: HOST,
    defaults: '2025-05-24',
    persistence: 'memory',
    person_profiles: 'identified_only',
    capture_pageleave: true,
    disable_session_recording: true
  });

  // the events worth having by name
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a');
    if (!a) return;
    if (a.matches('.cta a')) posthog.capture('hire_cta_clicked');
    else if (a.classList.contains('mail')) posthog.capture('email_clicked', { where: a.closest('section') ? a.closest('section').id : 'page' });
    else if (a.host && a.host !== location.host) posthog.capture('outbound_clicked', { href: a.href, where: a.closest('section') ? a.closest('section').id : 'page' });
  });
})();

// scroll reveals + index highlighting. everything works without this file.
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('a.mail').forEach(function (a) {
    a.href = 'mailto:' + a.getAttribute('data-u') + '@' + a.getAttribute('data-d');
  });

  if (!reduce && 'IntersectionObserver' in window) {
    var targets = document.querySelectorAll('.chapter-head, .about-photo, .about-text, .hire-text, .hire .diet, .plate, .bleed, .sightings > li, .history > li, .sub, .seen, .creds, .prose, .range, .lesser');
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
