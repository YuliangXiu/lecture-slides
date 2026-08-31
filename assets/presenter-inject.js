
/* ============================================================
   PRESENTER — 演讲者视图（S 键 / 控件按钮打开 presenter.html）
   仅独立打开时启用；嵌入 compare.html 等场景自动休眠
   ============================================================ */
(function () {
  if (window.top !== window.self) return;
  var TAG = '__hwyqPres';
  var COURSE_SEC = 45 * 60;   /* 课堂总时长 */
  var CHAR_PER_MIN = 220;     /* 中文正常语速：字/分钟 */
  var pwin = null;
  function post(m) {
    if (!pwin || pwin.closed) return;
    m[TAG] = 1;
    try { pwin.postMessage(m, '*'); } catch (e) {}
  }
  function state() {
    var d = window.__deck; if (!d) return;
    post({ cmd: 'state', page: d.page() + 1, total: d.total, notes: d.notes ? d.notes() : '' });
  }
  /* 每页预计时长：备注字数 / 语速，保底 12 秒 */
  function durs() {
    var d = window.__deck, out = [];
    if (!d) return out;
    for (var i = 0; i < d.total; i++) {
      var t = (d.notes ? d.notes(i) : '') || '';
      var chars = t.replace(/\s/g, '').length;
      out.push(Math.max(12, Math.round(chars / CHAR_PER_MIN * 60)));
    }
    return out;
  }
  function meta() { post({ cmd: 'meta', durs: durs(), courseSec: COURSE_SEC }); }
  window.__onPage = state;   // 引擎每次翻页后回调（见 engine.js go()）
  function openPresenter() {
    if (pwin && !pwin.closed) { try { pwin.focus(); } catch (e) {} return; }
    pwin = window.open('presenter.html', 'hwyqPres', 'width=1360,height=860');
    if (pwin) setTimeout(function () { state(); meta(); }, 900);   // 兜底：若错过新窗口的 hello 则补发
  }
  /* meta 幂等重发：讲稿数据不大，演讲者窗口按内容去重，重复包无副作用 */
  setInterval(function () { if (pwin && !pwin.closed) meta(); }, 5000);
  window.addEventListener('keydown', function (e) {
    if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault(); openPresenter();
    }
  });
  document.querySelectorAll('[data-act="pres"]').forEach(function (b) {
    b.addEventListener('click', openPresenter);
  });
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || !d[TAG] || !pwin || e.source !== pwin) return;
    var dk = window.__deck; if (!dk) return;
    if (d.cmd === 'hello') { state(); meta(); }
    else if (d.cmd === 'nav') dk.go(dk.page() + d.dir);
    else if (d.cmd === 'goto') dk.go(d.page - 1);
    else if (d.cmd === 'fs') {
      document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(function () {});
    }
  });
})();
