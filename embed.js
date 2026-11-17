/* Embed helper: when this tool sits inside a web page, the page grows to fit it (one normal scroll, no box-in-a-box),
   and bars and pop-ups stay where the visitor is looking. Works with the matching code in the website embed. */
(function () {
  if (window.parent === window) return;
  var me = document.currentScript, root = document.querySelector(me.getAttribute('data-root') || 'body');
  var docks = (me.getAttribute('data-docks') || '').split(',').filter(Boolean);
  var covers = (me.getAttribute('data-covers') || '').split(',').filter(Boolean);
  var pins = (me.getAttribute('data-pins') || '').split(',').filter(Boolean); // keep these pinned at the top of what the visitor sees, inside their box
  var on = false, vt = 0, vh = window.innerHeight, last = 0, raf = 0;
  function contentHeight() {
    var r = root.getBoundingClientRect(), cs = getComputedStyle(root);
    return Math.ceil(r.bottom + window.scrollY + (parseFloat(cs.marginBottom) || 0));
  }
  function place() {
    if (!on) return;
    docks.forEach(function (s) { document.querySelectorAll(s).forEach(function (el) { el.style.position = 'absolute'; el.style.bottom = 'auto'; el.style.top = Math.max(0, vt + vh - el.offsetHeight) + 'px'; }); });
    pins.forEach(function (s) { document.querySelectorAll(s).forEach(function (el) { var box = el.parentElement; if (!box) return; el.style.top = '0px'; var bt = box.getBoundingClientRect().top + window.scrollY, room = box.offsetHeight - el.offsetHeight; el.style.top = Math.max(0, Math.min(room, vt - bt)) + 'px'; }); });
    covers.forEach(function (s) { document.querySelectorAll(s).forEach(function (el) { el.style.position = 'absolute'; el.style.bottom = 'auto'; el.style.left = '0'; el.style.right = '0'; el.style.top = vt + 'px'; el.style.height = vh + 'px'; }); });
  }
  function update() {
    raf = 0; if (!on) return;
    var h = Math.max(contentHeight(), 480);
    if (Math.abs(h - last) > 2) { last = h; window.parent.postMessage({ type: 'tool-height', h: h }, '*'); }
    place();
  }
  function soon() { if (!raf) raf = requestAnimationFrame(update); }
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d || d.type !== 'tool-view') return;
    if (!on) { on = true; document.documentElement.classList.add('embedded'); var st = document.createElement('style'); st.textContent = 'html.embedded,html.embedded body{height:auto!important;min-height:0!important;overflow:hidden!important}'; document.head.appendChild(st); }
    vt = Math.max(0, +d.top || 0); vh = Math.max(200, +d.height || window.innerHeight);
    place(); soon();
  });
  if (window.ResizeObserver) new ResizeObserver(soon).observe(root);
  new MutationObserver(soon).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', soon);
  window.parent.postMessage({ type: 'tool-ready' }, '*');
})();
