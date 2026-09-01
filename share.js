/* The share button in the header bar: native share sheet where the platform
   has one (phones), copy-the-link with a "COPIED" flash where it doesn't.
   The URL shared is the live address bar, so pages that track state in the
   query string (the observatory, the wave instrument) share exactly the view
   on screen. */
(function () {
  'use strict';
  var btn = document.getElementById('shareBtn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var url = location.href;
    if (navigator.share) {
      navigator.share({ title: document.title, url: url }).catch(function () {});
      return;
    }
    var done = function () {
      var old = btn.textContent;
      btn.textContent = 'COPIED!';
      setTimeout(function () { btn.textContent = old; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, done);
    } else {
      var ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove(); done();
    }
  });
})();
