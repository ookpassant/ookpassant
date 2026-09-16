// note pages: margin sidenotes, and unlocking a locked note.
//
// both are enhancements. with this file blocked the footnotes are still there as
// endnotes at the foot of the page, and a locked note still says plainly that it
// is locked and why. nothing here is load-bearing for reading a public note.

(function () {
  'use strict';

  var WIDE = window.matchMedia('(min-width: 1100px)');

  // ---------- sidenotes ----------
  // markdown-it-footnote gives us refs in the prose and an <ol> at the bottom.
  // on a wide screen we copy each note into the right margin beside the
  // paragraph that mentions it, and hide the list. narrow screens keep the list,
  // because there is no margin to put anything in.

  function buildSidenotes(root) {
    var body = root.querySelector('.note-body');
    var endnotes = root.querySelector('.endnotes');
    if (!body || !endnotes) return null;

    // markdown-it-footnote marks up the <sup>, not the <a> inside it
    var refs = body.querySelectorAll('.footnote-ref a');
    if (!refs.length) return null;

    var notes = [];
    Array.prototype.forEach.call(refs, function (ref) {
      var id = (ref.getAttribute('href') || '').slice(1);
      var source = id && endnotes.querySelector('#' + CSS.escape(id));
      if (!source) return;

      var aside = document.createElement('aside');
      aside.className = 'sidenote';
      aside.setAttribute('role', 'note');

      var n = document.createElement('span');
      n.className = 'sidenote-n';
      n.setAttribute('aria-hidden', 'true');
      n.textContent = ref.textContent.replace(/[^\d]/g, '');
      aside.appendChild(n);

      var text = document.createElement('div');
      text.className = 'sidenote-text';
      text.innerHTML = source.innerHTML;
      // the back-arrow only makes sense when the note is at the foot of the page
      Array.prototype.forEach.call(text.querySelectorAll('.footnote-backref'), function (b) { b.remove(); });
      aside.appendChild(text);

      body.appendChild(aside);
      notes.push({ ref: ref, aside: aside });
    });

    return notes.length ? { body: body, notes: notes } : null;
  }

  // place each sidenote level with its reference, then push any that would
  // overlap far enough down to clear the one above. without this pass, two
  // footnotes in the same paragraph sit on top of each other.
  function layout(state) {
    if (!state) return;
    var wide = WIDE.matches;
    document.body.classList.toggle('has-sidenotes', wide);
    if (!wide) {
      state.notes.forEach(function (n) { n.aside.style.top = ''; });
      return;
    }

    var top = state.body.getBoundingClientRect().top + window.scrollY;
    var floor = 0;
    var GAP = 12;

    state.notes.forEach(function (n) {
      var y = n.ref.getBoundingClientRect().top + window.scrollY - top;
      if (y < floor) y = floor;
      n.aside.style.top = y + 'px';
      floor = y + n.aside.offsetHeight + GAP;
    });
  }

  function startSidenotes(root) {
    var state = buildSidenotes(root || document);
    if (!state) return;

    layout(state);
    var pending;
    function relayout() {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(function () { layout(state); });
    }
    window.addEventListener('resize', relayout);
    if (WIDE.addEventListener) WIDE.addEventListener('change', relayout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    // images and plates change height as they load and shift every note below them
    Array.prototype.forEach.call(document.images, function (img) {
      if (!img.complete) img.addEventListener('load', relayout);
    });
  }

  // ---------- unlocking ----------

  var KEY_CACHE = 'note-pass';
  var b64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };

  async function decrypt(envelope, passphrase) {
    var enc = new TextEncoder();
    var material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    var key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64(envelope.salt), iterations: envelope.iterations, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    var plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(envelope.iv) }, key, b64(envelope.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function reveal(panel, note) {
    var main = document.querySelector('.note-main');
    var body = document.createElement('div');
    body.className = 'note-body';
    body.innerHTML = note.body;

    // a hidden note keeps its title inside the envelope, so the page only learns
    // what it is called once it opens.
    if (note.title) {
      var h1 = main.querySelector('h1');
      if (h1) h1.textContent = note.title;
      document.title = note.title + ' · chelsea hopkins';
      var summary = main.querySelector('.note-summary');
      if (summary && note.summary) summary.textContent = note.summary;
    }

    panel.replaceWith(body);
    startSidenotes(document);
  }

  function startUnlock() {
    var panel = document.querySelector('#locked');
    if (!panel) return;

    var envelope;
    try {
      envelope = JSON.parse(document.querySelector('#envelope').textContent);
    } catch (e) {
      return;
    }

    var form = panel.querySelector('form');
    var input = panel.querySelector('input[type="password"]');
    var status = panel.querySelector('.lock-status');

    async function attempt(passphrase, quiet) {
      if (!passphrase) return false;
      status.textContent = 'unlocking…';
      panel.classList.add('is-working');
      try {
        var note = await decrypt(envelope, passphrase);
        // one passphrase opens the whole site, so hold it for this tab only and
        // let the next locked note open without asking again.
        try { sessionStorage.setItem(KEY_CACHE, passphrase); } catch (e) {}
        reveal(panel, note);
        return true;
      } catch (e) {
        panel.classList.remove('is-working');
        status.textContent = quiet ? '' : 'that passphrase does not open this one.';
        if (!quiet) input.select();
        return false;
      }
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      attempt(input.value, false);
    });

    // already unlocked something else this tab? open quietly.
    var held = null;
    try { held = sessionStorage.getItem(KEY_CACHE); } catch (e) {}
    if (held) attempt(held, true);
  }

  function boot() {
    if (!document.querySelector('#locked')) startSidenotes(document);
    if (window.crypto && crypto.subtle) startUnlock();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
