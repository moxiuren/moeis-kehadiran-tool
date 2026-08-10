// ==UserScript==
// @name         MOEIS Kehadiran 一键点名
// @namespace    moeis-kehadiran-tool
// @version      1.0.0
// @description  在 MOEIS 点名页 (tabguru) 右下角注入一键点名面板：全勤一键确认 / 保存并确认 / 仅保存
// @match        https://moeispel.moe.gov.my/sahsiah/kehadiran/tabguru
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  var WAIT = function (cond, timeout, done, fail) {
    var start = Date.now();
    var iv = setInterval(function () {
      if (cond()) { clearInterval(iv); done(); }
      else if (Date.now() - start > timeout) { clearInterval(iv); fail(); }
    }, 250);
  };

  var getKelas = function () {
    var el = document.querySelector('#txtNamakelas');
    return el ? el.value : '';
  };

  var getTarikh = function () {
    var el = document.querySelector('#tkh_HH');
    return el ? el.value : '';
  };

  var getRows = function () {
    var trs = document.querySelectorAll('#kehadiran tbody tr');
    var rows = [];
    trs.forEach(function (tr) {
      var cb = tr.querySelector('.case-hadir');
      if (cb) {
        rows.push({
          idpelajar: cb.getAttribute('data-idpelajar'),
          namamurid: cb.getAttribute('data-namapelajar'),
          hadir: cb.checked,
          kategori: (tr.querySelector('.selectkategori') || {}).value || '',
          sebab: (tr.querySelector('.selectsebab') || {}).value || '',
          row: tr
        });
      }
    });
    return rows;
  };

  var closeSwal = function () {
    var btn = document.querySelector('.sweet-alert .confirm') ||
      document.querySelector('.sweet-alert button:not(.sa-cancel)') ||
      document.querySelector('.swal2-confirm');
    if (btn) btn.click();
  };

  var doKemaskini = function (mode) {
    var btn = document.querySelector('#kemaskiniKehadiran');
    if (!btn) { setMsg('找不到 Kemaskini 按钮，请刷新页面', 'err'); return; }
    setMsg('处理中…', 'info');
    btn.click();
    WAIT(function () {
      var sw = document.querySelector('.sweet-alert');
      return sw && !!(sw.offsetWidth || sw.offsetHeight || sw.getClientRects().length);
    }, 4000, function () {
      var target = mode === 'sah'
        ? document.querySelector('.simpansah')
        : document.querySelector('.simpan');
      if (!target) {
        closeSwal();
        setMsg('被打断：系统提示需要补充缺勤原因（请查看页面弹窗）', 'warn');
        return;
      }
      target.click();
      WAIT(function () {
        var sw = document.querySelector('.sweet-alert');
        return sw && sw.textContent.indexOf('Berjaya') !== -1;
      }, 9000, function () {
        closeSwal();
        setMsg('✓ 已' + (mode === 'sah' ? '保存并确认' : '保存') + ' ' + getTarikh(), 'ok');
        refreshStats();
      }, function () {
        closeSwal();
        setMsg('提交超时，请手动确认页面状态', 'err');
      });
    }, function () {
      setMsg('确认弹窗未出现，请检查缺勤学生是否已填原因', 'warn');
    });
  };

  var setMsg = function (text, kind) {
    var box = document.querySelector('#moeis-ka-msg');
    if (!box) return;
    box.textContent = text;
    box.className = 'moeis-ka-msg ' + (kind || 'info');
  };

  var lastStats = '';

  var refreshStats = function () {
    var rows = getRows();
    var hadir = 0, tak = 0;
    rows.forEach(function (r) { r.hadir ? hadir++ : tak++; });
    var box = document.querySelector('#moeis-ka-stats');
    if (!box) return;
    var html =
      '已到 <b>' + hadir + '</b> / 缺勤 <b style="color:#e74c3c">' + tak + '</b> / 共 ' + rows.length +
      ' <span style="color:#999;font-size:11px">(' + (getTarikh() || '') + ')</span>';
    if (html !== lastStats) {
      lastStats = html;
      box.innerHTML = html;
    }
  };

  var objSel = document.createElement('div');
  objSel.id = 'moeis-ka-fab';
  objSel.innerHTML =
    '<style>' +
    '#moeis-ka-fab{position:fixed;right:16px;bottom:16px;z-index:99999;width:230px;background:#fff;border:1px solid #ddd;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.18);font-family:-apple-system,"Segoe UI",Arial,sans-serif;padding:12px;}' +
    '#moeis-ka-fab h4{margin:0 0 4px;font-size:13px;color:#1565c0;}' +
    '#moeis-ka-stats{font-size:12px;color:#333;margin-bottom:8px;}' +
    '#moeis-ka-btns{display:flex;flex-direction:column;gap:6px;}' +
    '#moeis-ka-btns button{border:none;border-radius:6px;padding:8px;font-size:13px;font-weight:600;cursor:pointer;color:#fff;}' +
    '#moeis-ka-btns button:disabled{opacity:.5;cursor:not-allowed;}' +
    '.moeis-ka-msg{margin-top:8px;font-size:11px;border-radius:5px;padding:5px 8px;}' +
    '.moeis-ka-msg.ok{background:#e8f5e9;color:#2e7d32;}' +
    '.moeis-ka-msg.err{background:#ffebee;color:#c62828;}' +
    '.moeis-ka-msg.warn{background:#fff8e1;color:#f57f17;}' +
    '.moeis-ka-msg.info{background:#e3f2fd;color:#1565c0;}' +
    '</style>' +
    '<h4>📋 点名快捷面板</h4>' +
    '<div id="moeis-ka-stats"></div>' +
    '<div id="moeis-ka-btns">' +
    '<button id="moeis-ka-all" style="background:#2e7d32">✔ 全勤一键确认</button>' +
    '<button id="moeis-ka-sah" style="background:#1565c0">✅ 保存并确认</button>' +
    '<button id="moeis-ka-save" style="background:#607d8b">💾 仅保存</button>' +
    '</div>' +
    '<div id="moeis-ka-msg" class="moeis-ka-msg info">就绪</div>';
  document.body.appendChild(objSel);

  document.getElementById('moeis-ka-all').addEventListener('click', function () {
    var tak = getRows().filter(function (r) { return !r.hadir; });
    if (tak.length > 0) {
      setMsg('有 ' + tak.length + ' 名学生未勾选出席，请用「保存并确认」', 'warn');
      return;
    }
    doKemaskini('sah');
  });

  document.getElementById('moeis-ka-sah').addEventListener('click', function () {
    var tak = getRows().filter(function (r) { return !r.hadir; });
    var unready = tak.filter(function (r) { return !r.kategori || !r.sebab; });
    if (unready.length > 0) {
      setMsg('以下缺勤学生未选原因: ' + unready.map(function (r) { return r.namamurid; }).join('、'), 'warn');
      return;
    }
    doKemaskini('sah');
  });

  document.getElementById('moeis-ka-save').addEventListener('click', function () {
    doKemaskini('simpan');
  });

  if (window.MutationObserver) {
    new MutationObserver(function () { refreshStats(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['checked'] });
  }
  setTimeout(refreshStats, 800);
})();