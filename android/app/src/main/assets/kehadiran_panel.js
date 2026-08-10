(function () {
  'use strict';

  var WAIT = function (cond, timeout, done, fail) {
    var start = Date.now();
    var iv = setInterval(function () {
      if (cond()) { clearInterval(iv); done(); }
      else if (Date.now() - start > timeout) { clearInterval(iv); fail(); }
    }, 250);
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
    if (btn) { btn.click(); return true; }
    return false;
  };

  var setMsg = function (text, kind) {
    var box = document.querySelector('#moeis-ka-msg');
    if (!box) return;
    box.textContent = text;
    box.className = 'moeis-ka-msg ' + (kind || 'info');
  };

  var setButtonsDisabled = function (disabled) {
    var btns = document.querySelectorAll('#moeis-ka-btns button');
    btns.forEach(function (b) { b.disabled = !!disabled; });
  };

  var doKemaskini = function (mode) {
    var btn = document.querySelector('#kemaskiniKehadiran');
    if (!btn) { setMsg('找不到 Kemaskini 按钮，请刷新页面', 'err'); return; }
    setButtonsDisabled(true);
    setMsg('⏳ 处理中…', 'info');
    btn.click();
    WAIT(function () {
      var sw = document.querySelector('.sweet-alert');
      return sw && !!(sw.offsetWidth || sw.offsetHeight || sw.getClientRects().length);
    }, 4000, function () {
      var target = mode === 'sah'
        ? document.querySelector('.simpansah')
        : document.querySelector('.simpan');
      if (!target) {
        setButtonsDisabled(false);
        setMsg('被系统拦截：缺勤学生原因不完整（见页面弹窗）', 'warn');
        return;
      }
      target.click();
      WAIT(function () {
        var sw = document.querySelector('.sweet-alert');
        if (!sw) return false;
        var txt = sw.textContent.toLowerCase();
        return txt.indexOf('berjaya') !== -1 || txt.indexOf('disahkan') !== -1 || txt.indexOf('kemaskini') !== -1;
      }, 9000, function () {
        while (closeSwal()) {}
        setButtonsDisabled(false);
        setMsg('✓ 已' + (mode === 'sah' ? '保存并确认' : '保存') + ' ' + getTarikh(), 'ok');
        refreshStats();
      }, function () {
        while (closeSwal()) {}
        setButtonsDisabled(false);
        setMsg('提交已完成，请核对页面状态', 'info');
        refreshStats();
      });
    }, function () {
      setButtonsDisabled(false);
      setMsg('确认弹窗未出现，请检查页面', 'warn');
    });
  };

  var isConfirmed = function () {
    return document.body && document.body.textContent.indexOf('TELAH DISAHKAN') !== -1;
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
    var msgBox = document.querySelector('#moeis-ka-msg');
    if (msgBox && (msgBox.textContent === '就绪' || msgBox.textContent.indexOf('已确认') !== -1)) {
      if (isConfirmed()) {
        setMsg('✓ 今日点名已确认 (TELAH DISAHKAN)', 'ok');
      }
    }
  };

  var init = function () {
    if (document.getElementById('moeis-ka-fab') || !document.querySelector('#kehadiran')) {
      return false;
    }

    var objSel = document.createElement('div');
    objSel.id = 'moeis-ka-fab';
    objSel.innerHTML =
      '<style>' +
      '/* Option B: Clean Proportional Mobile UI */' +
      '.cui-topbar, .cui-breadcrumbs, .breadcrumb, footer, .cui-footer{display:none !important;}' +
      'body{background-color:#f4f6f9 !important;padding:2px !important;margin:0 !important;}' +
      '.cui-layout-content{padding:4px !important;}' +
      '#kehadiran_wrapper{padding:0 !important;}' +
      '#kehadiran_length, #kehadiran_filter, #kehadiran_info, #kehadiran_paginate{display:none !important;}' +
      '#kehadiran{width:100% !important;margin-top:4px !important;}' +
      '#kehadiran th, #kehadiran td, #kehadiran th.dtr-hidden, #kehadiran td.dtr-hidden{display:table-cell !important;visibility:visible !important;opacity:1 !important;}' +
      '#kehadiran th{padding:6px 4px !important;font-size:12px !important;}' +
      '#kehadiran tbody td{padding:6px 4px !important;font-size:12px !important;vertical-align:middle !important;}' +
      '#kehadiran tbody td.sorting_1{font-weight:500 !important;color:#1a202c !important;font-size:12px !important;word-break:break-word !important;}' +
      '#kehadiran .case-hadir{width:18px !important;height:18px !important;transform:scale(1.1) !important;margin:2px !important;cursor:pointer !important;}' +
      '#moeis-ka-fab{position:fixed;right:10px;bottom:14px;z-index:99999;width:215px;background:#fff;border:1px solid #ddd;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.25);font-family:-apple-system,"Segoe UI",Arial,sans-serif;padding:10px;}' +
      '#moeis-ka-fab h4{margin:0 0 4px;font-size:13px;color:#1565c0;}' +
      '#moeis-ka-stats{font-size:11.5px;color:#333;margin-bottom:6px;}' +
      '#moeis-ka-btns{display:flex;flex-direction:column;gap:5px;}' +
      '#moeis-ka-btns button{border:none;border-radius:5px;padding:7.5px;font-size:12.5px;font-weight:600;cursor:pointer;color:#fff;transition:opacity 0.2s;}' +
      '#moeis-ka-btns button:disabled{opacity:.45;cursor:not-allowed;}' +
      '.moeis-ka-msg{margin-top:6px;font-size:10.5px;border-radius:4px;padding:4px 6px;}' +
      '.moeis-ka-msg.ok{background:#e8f5e9;color:#2e7d32;}' +
      '.moeis-ka-msg.err{background:#ffebee;color:#c62828;}' +
      '.moeis-ka-msg.warn{background:#fff8e1;color:#f57f17;}' +
      '/* Unhide Select2 dropdowns */' +
      'select.selectsebab, select.selectkategori, select.selectsebab.select2-hidden-accessible, select.selectkategori.select2-hidden-accessible{display:block !important;visibility:visible !important;opacity:1 !important;pointer-events:auto !important;-webkit-appearance:menulist !important;appearance:menulist !important;position:static !important;clip:auto !important;-webkit-clip-path:none !important;clip-path:none !important;height:34px !important;width:100% !important;min-width:130px !important;max-width:220px !important;overflow:visible !important;white-space:normal !important;background-color:#ffffff !important;color:#333333 !important;border:1px solid #2b6cb0 !important;border-radius:5px !important;padding:3px 6px !important;font-size:12px !important;margin:3px 0 !important;z-index:99999 !important;}' +
      '.select2-container{display:none !important;}' +
      '</style>' +
      '<h4>📋 点名快捷面板 <span id="moeis-ka-toggle" style="float:right;font-size:11px;cursor:pointer;color:#1565c0;font-weight:normal">▲ 收起</span></h4>' +
      '<div id="moeis-ka-body">' +
      '<div id="moeis-ka-stats"></div>' +
      '<div id="moeis-ka-btns">' +
      '<button id="moeis-ka-all" style="background:#2e7d32">✔ 全勤一键确认</button>' +
      '<button id="moeis-ka-sah" style="background:#1565c0">✅ 保存并确认</button>' +
      '<button id="moeis-ka-save" style="background:#607d8b">💾 仅保存</button>' +
      '</div>' +
      '<div id="moeis-ka-msg" class="moeis-ka-msg info">就绪</div>' +
      '</div>';
    document.body.appendChild(objSel);

    document.getElementById('moeis-ka-toggle').addEventListener('click', function () {
      var body = document.getElementById('moeis-ka-body');
      if (body.style.display === 'none') {
        body.style.display = 'block';
        this.textContent = '▲ 收起';
      } else {
        body.style.display = 'none';
        this.textContent = '▼ 展开';
      }
    });

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

    document.addEventListener('change', function (e) {
      if (e.target && (e.target.classList.contains('selectkategori') || e.target.classList.contains('selectsebab'))) {
        if (window.jQuery) {
          window.jQuery(e.target).trigger('change');
        }
      }
    });

    var table = document.querySelector('#kehadiran');
    if (window.MutationObserver && table) {
      new MutationObserver(function () { refreshStats(); }).observe(table, { childList: true, subtree: true });
    }
    refreshStats();
    setTimeout(refreshStats, 1200);
    setTimeout(refreshStats, 3500);
    return true;
  };

  if (!init()) {
    var checkCount = 0;
    var iv = setInterval(function () {
      if (init() || ++checkCount > 40) {
        clearInterval(iv);
      }
    }, 500);
  }
})();