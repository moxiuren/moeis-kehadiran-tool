(function() {
    'use strict';

    // 1. 检查是否在 tabguru 主页面，且防重复注入
    if (!window.location.href.includes('/sahsiah/kehadiran/tabguru')) {
        return;
    }
    
    // 只要成功抵达点名主页，立刻通知 Android 移出全屏 Loading 遮罩层，展现首屏控制台框架
    if (window.MoxiBridge && window.MoxiBridge.dismissLoader) {
        window.MoxiBridge.dismissLoader();
    }

    if (document.getElementById('moeis-easy-panel')) {
        return;
    }

    console.log("⚡ [MOEIS Easy Panel] Loading high-fidelity full screen attendance console...");

    // 2. 注入 CSS 样式并提供动态补回函数 (解决原生页面 AJAX 局部刷新导致样式丢失的 Bug)
    function injectStylesIfMissing() {
        if (document.getElementById('ep-styles')) {
            return;
        }
        const style = document.createElement('style');
        style.id = 'ep-styles';
        style.innerHTML = `
            /* 强行暴露出被 Select2 隐藏的原生 select，隐藏 Select2 容器 */
            select.selectsebab, select.selectkategori {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
                -webkit-appearance: menulist !important;
                appearance: menulist !important;
                position: static !important;
                clip: auto !important;
                -webkit-clip-path: none !important;
                clip-path: none !important;
                height: 34px !important;
                width: 100% !important;
                min-width: 130px !important;
                max-width: 220px !important;
                overflow: visible !important;
                white-space: normal !important;
                background-color: #ffffff !important;
                color: #333333 !important;
                border: 1px solid #2b6cb0 !important;
                border-radius: 5px !important;
                padding: 3px 6px !important;
                font-size: 12px !important;
                margin: 3px 0 !important;
                z-index: 99999 !important;
            }
            .select2-container {
                display: none !important;
            }
            /* 修复原生页面 Responsive 在窄屏折叠隐藏 sebab 列导致下拉框不可见不可点：
               强制显示第 4 列、屏蔽子行展开与重复内容，并允许表格横向滚动 */
            #kehadiran thead th.sebabthadir,
            #kehadiran tbody td.sebabthadir {
                display: table-cell !important;
                min-width: 150px;
            }
            #kehadiran tbody tr.child,
            #kehadiran ul.dtr-details {
                display: none !important;
            }
            #kehadiran td.dtr-control {
                pointer-events: none;
            }
            .dataTables_wrapper {
                overflow-x: auto;
            }

            :root {
            --ep-primary: #1e88e5;
            --ep-primary-dark: #1565c0;
            --ep-primary-light: #e3f2fd;
            --ep-success: #2e7d32;
            --ep-success-light: #e8f5e9;
            --ep-danger: #d32f2f;
            --ep-danger-light: #ffebee;
            --ep-warning: #f57c00;
            --ep-warning-light: #fff3e0;
            --ep-bg: #f5f7fa;
            --ep-card-bg: #ffffff;
            --ep-text: #2c3e50;
            --ep-text-muted: #7f8c8d;
            --ep-border: #e2e8f0;
        }

        #moeis-easy-panel {
            position: fixed;
            inset: 0;
            z-index: 999999;
            background-color: var(--ep-bg);
            color: var(--ep-text);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow-y: auto;
            padding-bottom: 100px;
        }

        .ep-header {
            background: linear-gradient(135deg, var(--ep-primary-dark), var(--ep-primary));
            color: #fff;
            padding: 16px;
            box-shadow: 0 4px 12px rgba(21, 101, 192, 0.2);
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .ep-header-title {
            font-size: 17px;
            font-weight: 700;
        }

        .ep-header-sub {
            font-size: 11px;
            opacity: 0.8;
            margin-top: 2px;
        }

        .btn-exit-panel {
            background-color: rgba(255, 255, 255, 0.2);
            border: none;
            color: #fff;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: bold;
            cursor: pointer;
        }

        .ep-card {
            background-color: var(--ep-card-bg);
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            margin: 12px;
            padding: 14px;
            border: 1px solid var(--ep-border);
        }

        .ep-cal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
        }

        .ep-cal-title {
            font-size: 15px;
            font-weight: 700;
            color: var(--ep-primary-dark);
        }

        .ep-btn-nav {
            background: none;
            border: none;
            color: var(--ep-primary);
            font-size: 18px;
            padding: 4px 12px;
            cursor: pointer;
            font-weight: bold;
        }

        .ep-cal-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 6px;
            text-align: center;
        }

        .ep-weekday {
            font-size: 11px;
            color: var(--ep-text-muted);
            font-weight: 600;
            padding-bottom: 4px;
        }

        .ep-day-cell {
            aspect-ratio: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            border: 1px solid var(--ep-border);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            position: relative;
            background-color: #fff;
            transition: all 0.2s ease;
        }

        .ep-day-cell:active {
            transform: scale(0.95);
        }

        .ep-day-cell.other-month {
            opacity: 0.2;
            pointer-events: none;
        }

        .ep-day-cell.today {
            border: 2px solid var(--ep-primary);
        }

        .ep-day-cell.selected {
            background-color: var(--ep-primary) !important;
            color: #fff !important;
            border-color: var(--ep-primary) !important;
        }

        .ep-day-cell.selected .ep-day-stat {
            color: rgba(255, 255, 255, 0.9) !important;
        }

        .ep-day-stat {
            font-size: 9px;
            font-weight: normal;
            margin-top: 2px;
        }

        .ep-day-cell.all-present {
            background-color: var(--ep-success-light);
            color: var(--ep-success);
            border-color: rgba(46, 125, 50, 0.15);
        }

        .ep-day-cell.all-present .ep-day-stat {
            color: var(--ep-success);
        }

        .ep-day-cell.has-absents {
            background-color: var(--ep-warning-light);
            color: var(--ep-warning);
            border-color: rgba(245, 124, 0, 0.15);
        }

        .ep-day-cell.has-absents .ep-day-stat {
            color: var(--ep-warning);
        }

        .ep-list-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 16px 12px 6px;
        }

        .ep-list-title {
            font-size: 14px;
            font-weight: 700;
        }

        .ep-btn-all-present {
            background-color: var(--ep-success);
            color: #fff;
            border: none;
            border-radius: 6px;
            padding: 6px 12px;
            font-size: 11px;
            font-weight: bold;
            cursor: pointer;
        }

        .ep-student-item {
            background-color: var(--ep-card-bg);
            border: 1px solid var(--ep-border);
            border-radius: 10px;
            margin: 8px 12px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            transition: all 0.2s ease;
        }

        .ep-student-main {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            cursor: pointer;
        }

        .ep-student-info {
            flex: 1;
        }

        .ep-student-name {
            font-size: 13px;
            font-weight: 600;
        }

        .ep-student-status-badge {
            display: inline-block;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            margin-top: 4px;
            font-weight: bold;
        }

        .ep-student-item.present .ep-student-status-badge {
            background-color: var(--ep-success-light);
            color: var(--ep-success);
        }

        .ep-student-item.absent .ep-student-status-badge {
            background-color: var(--ep-danger-light);
            color: var(--ep-danger);
        }

        .ep-toggle-switch {
            width: 50px;
            height: 28px;
            border-radius: 14px;
            background-color: #cbd5e1;
            position: relative;
            transition: background-color 0.2s;
        }

        .ep-toggle-switch::after {
            content: '';
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: #fff;
            position: absolute;
            top: 2px;
            left: 2px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
            transition: left 0.2s;
        }

        .ep-student-item.present .ep-toggle-switch {
            background-color: var(--ep-success);
        }

        .ep-student-item.present .ep-toggle-switch::after {
            left: 24px;
        }

        .ep-absent-options {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed var(--ep-border);
            display: none;
            flex-direction: column;
            gap: 6px;
        }

        .ep-student-item.absent .ep-absent-options {
            display: flex;
        }

        .ep-absent-options select {
            width: 100%;
            height: 32px;
            border: 1px solid var(--ep-border);
            border-radius: 6px;
            padding: 0 6px;
            font-size: 12px;
            background-color: #fff;
            color: var(--ep-text);
        }

        .ep-bottom-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background-color: #fff;
            border-top: 1px solid var(--ep-border);
            padding: 12px 16px;
            display: flex;
            gap: 10px;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.05);
            z-index: 9999999;
        }

        .ep-btn {
            flex: 1;
            height: 44px;
            border-radius: 8px;
            border: none;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .ep-btn-secondary {
            background-color: #f1f5f9;
            color: #475569;
            flex: 0.4;
        }

        .ep-btn-primary {
            background: linear-gradient(135deg, var(--ep-primary-dark), var(--ep-primary));
            color: #fff;
        }

        .ep-toast {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(0, 0, 0, 0.85);
            color: #fff;
            padding: 12px 24px;
            border-radius: 20px;
            font-size: 13px;
            z-index: 10000000;
            display: none;
            max-width: 80%;
            text-align: center;
        }

        .ep-loading-overlay {
            position: fixed;
            inset: 0;
            background-color: rgba(255,255,255,0.7);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 99999999;
            flex-direction: column;
            gap: 12px;
        }

        .ep-spinner {
            width: 36px;
            height: 36px;
            border: 4px solid var(--ep-border);
            border-top: 4px solid var(--ep-primary);
            border-radius: 50%;
            animation: ep-spin 0.8s linear infinite;
        }

        @keyframes ep-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        `;
        document.head.appendChild(style);
    }

    // 首次运行注入 CSS 并封锁 Select2
    injectStylesIfMissing();
    hijackSelect2();

    // 3. 构建全屏遮罩 DOM
    const panel = document.createElement('div');
    panel.id = 'moeis-easy-panel';
    panel.innerHTML = `
        <div class="ep-header">
            <div>
                <div class="ep-header-title">MOEIS 极简点名控制台</div>
                <div class="ep-header-sub" id="ep-sub-info">正在初始化...</div>
            </div>
            <button class="btn-exit-panel" id="btnExitPanel">返回原生</button>
        </div>

        <!-- 月历卡片 -->
        <div class="ep-card" style="padding: 10px;">
            <div class="ep-cal-header">
                <button class="ep-btn-nav" id="ep-prevMonth">&lt;</button>
                <div class="ep-cal-title" id="ep-calendarTitle"></div>
                <button class="ep-btn-nav" id="ep-nextMonth">&gt;</button>
            </div>
            <div class="ep-cal-grid" id="ep-calendarGrid">
                <div class="ep-weekday">日</div>
                <div class="ep-weekday">一</div>
                <div class="ep-weekday">二</div>
                <div class="ep-weekday">三</div>
                <div class="ep-weekday">四</div>
                <div class="ep-weekday">五</div>
                <div class="ep-weekday">六</div>
            </div>
        </div>

        <!-- 列表操作 -->
        <div class="ep-list-header">
            <div class="ep-list-title" id="ep-listTitle">加载中...</div>
            <button class="ep-btn-all-present" id="ep-btnAllPresent">✔ 全员出席</button>
        </div>

        <!-- 学生列表 -->
        <div id="ep-studentListContainer"></div>

        <!-- 底部控制栏 -->
        <div class="ep-bottom-bar">
            <button class="ep-btn ep-btn-secondary" id="ep-btnSaveOnly">仅保存</button>
            <button class="ep-btn ep-btn-primary" id="ep-btnSaveAndConfirm">✓ 保存并确认全部点名</button>
        </div>

        <div class="ep-loading-overlay" id="ep-loadingOverlay">
            <div class="ep-spinner"></div>
            <div style="font-size: 13px; font-weight: 600;" id="ep-loadingText">处理中...</div>
        </div>
        <div class="ep-toast" id="ep-toast"></div>
    `;
    document.body.appendChild(panel);

    // 4. 解析原因列表字典 (自 window.sebabArray 提纯)
    const CATEGORIES = [
        ['D', 'MASALAH KESIHATAN (生病)'],
        ['N', 'PONTENG (旷课)'],
        ['M', 'KEBENARAN GURU BESAR (准假)'],
        ['A', 'PDPR (线上)'],
        ['B', 'AKTIVITI LUAR SEKOLAH (活动)'],
        ['J', 'MASALAH KELUARGA (家事)'],
        ['I', 'MASALAH PERIBADI (私事)']
    ];

    let rawSebabArray = [];
    try {
        const scripts = document.querySelectorAll('script');
        for (let s of scripts) {
            const text = s.textContent || '';
            if (text.includes('sebabArray = [')) {
                const m = text.match(/sebabArray\s*=\s*\[(\s*\{\s*['"]id_sebab_thadir['\"].*?)\]/s);
                if (m) {
                    rawSebabArray = new Function("return [" + m[1] + "]")();
                    console.log("✅ [MOEIS Easy Panel] Reflectively loaded " + rawSebabArray.length + " sebab items!");
                    break;
                }
            }
        }
    } catch(e) {
        console.error("反射提取 sebabArray 失败:", e);
    }

    if (rawSebabArray.length === 0 && window.sebabArray) {
        rawSebabArray = window.sebabArray;
    }

    const CAUSES = {};
    rawSebabArray.forEach(item => {
        const kat = item.kategori;
        if (!CAUSES[kat]) CAUSES[kat] = [];
        CAUSES[kat].push([item.id_sebab_thadir, item.keterangan]);
    });

    // 5. 状态机
    let currentYear = new Date().getFullYear();
    let currentMonth = new Date().getMonth() + 1;
    let selectedDateStr = "";
    let calendarData = {};
    let studentsList = [];

    // 元数据提取
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || 
                 document.getElementById('_token')?.value || 
                 document.querySelector('input[name="_token"]')?.value;
    const classId = document.getElementById('txtNamakelas')?.value;
    const teacherName = document.querySelector('.cui-avatar img')?.getAttribute('title') || '老师';
    
    document.getElementById('ep-sub-info').textContent = `当前班级: ${classId || '未知'} | 教师: ${teacherName}`;

    // 提示
    const $toast = document.getElementById('ep-toast');
    function showToast(text, duration = 2000) {
        $toast.textContent = text;
        $toast.style.display = 'block';
        setTimeout(() => { $toast.style.display = 'none'; }, duration);
    }

    // Loading
    const $loading = document.getElementById('ep-loadingOverlay');
    const $loadingText = document.getElementById('ep-loadingText');
    function showLoading(show, text = "处理中...") {
        $loadingText.textContent = text;
        $loading.style.display = show ? 'flex' : 'none';
    }

    // 解析月度 HTML 报表生成日历数据
    function parseCalendarHtml(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const table = doc.querySelector('table');
        if (!table) return {};
        
        const rows = table.querySelectorAll('tr');
        if (rows.length < 2) return {};
        
        const header = Array.from(rows[0].querySelectorAll('th, td')).map(cell => cell.textContent.trim());
        const dayIndices = {};
        header.forEach((col, idx) => {
            if (/^\d+$/.test(col) && parseInt(col) >= 1 && parseInt(col) <= 31) {
                dayIndices[col] = idx;
            }
        });
        
        const dayStats = {};
        Object.keys(dayIndices).forEach(d => {
            dayStats[d] = { present: 0, total: 0, active: false };
        });
        
        for (let i = 1; i < rows.length; i++) {
            const tr = rows[i];
            const tds = tr.querySelectorAll('th, td');
            if (tds.length < 33) continue;
            
            const studentNameField = tds[0].textContent.trim();
            if (!/\(\d+\)$/.test(studentNameField)) {
                continue;
            }
            
            Object.keys(dayIndices).forEach(day => {
                const colIdx = dayIndices[day];
                if (colIdx < tds.length) {
                    const val = tds[colIdx].textContent.trim();
                    if (val !== '') {
                        dayStats[day].active = true;
                        dayStats[day].total += 1;
                        if (val === '/') {
                            dayStats[day].present += 1;
                        }
                    }
                }
            });
        }
        
        const result = {};
        Object.keys(dayStats).forEach(day => {
            if (dayStats[day].active) {
                result[day] = {
                    present: dayStats[day].present,
                    total: dayStats[day].total
                };
            }
        });
        return result;
    }

    // 月度日历载入
    function loadMonthCalendar(year, month, autoClickSelected = false) {
        injectStylesIfMissing();
        showLoading(true, "同步月历状态...");
        document.getElementById('ep-calendarTitle').textContent = `${year}年${month}月`;
        
        // 清理旧日期格
        const grid = document.getElementById('ep-calendarGrid');
        grid.querySelectorAll('.ep-day-cell').forEach(c => c.remove());

        const monthStr = String(month).padStart(2, '0');
        
        // 发起网络请求获取月度出勤报表 HTML
        window.jQuery.ajax({
            type: "get",
            url: "laporankehadiranbulanan/" + monthStr + "/" + year,
            success: function(response) {
                try {
                    calendarData = parseCalendarHtml(response);
                    renderCalendarGrid(year, month);
                    
                    if (autoClickSelected) {
                        const targetCell = Array.from(grid.querySelectorAll('.ep-day-cell')).find(c => c.dataset.date === selectedDateStr);
                        if (targetCell) targetCell.click();
                    }
                } catch(e) {
                    console.error(e);
                    showToast("解析日历报表失败");
                }
                showLoading(false);
                
                // 数据渲染完毕，完美移出 Android 顶层加载遮罩
                if (window.MoxiBridge && window.MoxiBridge.dismissLoader) {
                    window.MoxiBridge.dismissLoader();
                }
            },
            error: function() {
                showToast("无法获取月历出勤报表");
                renderCalendarGrid(year, month);
                showLoading(false);
                
                // 网络失败也移出遮罩，以暴露可能的错误或进行重试
                if (window.MoxiBridge && window.MoxiBridge.dismissLoader) {
                    window.MoxiBridge.dismissLoader();
                }
            }
        });
    }

    // 渲染日历网格
    function renderCalendarGrid(year, month) {
        const grid = document.getElementById('ep-calendarGrid');
        const firstDay = new Date(year, month - 1, 1).getDay();
        const totalDays = new Date(year, month, 0).getDate();
        
        // 填充空白
        for (let i = 0; i < firstDay; i++) {
            const cell = document.createElement('div');
            cell.className = 'ep-day-cell other-month';
            grid.appendChild(cell);
        }

        // 填充天
        for (let day = 1; day <= totalDays; day++) {
            const cell = document.createElement('div');
            cell.className = 'ep-day-cell';
            
            const dayStr = String(day).padStart(2, '0');
            const monthStr = String(month).padStart(2, '0');
            const fullDate = `${dayStr}/${monthStr}/${year}`;
            
            cell.dataset.date = fullDate;
            cell.innerHTML = `<div>${day}</div>`;

            if (calendarData[dayStr]) {
                const stat = calendarData[dayStr];
                const statDiv = document.createElement('div');
                statDiv.className = 'ep-day-stat';
                statDiv.textContent = `${stat.present}/${stat.total}`;
                cell.appendChild(statDiv);
                
                if (stat.present === stat.total) {
                    cell.classList.add('all-present');
                } else {
                    cell.classList.add('has-absents');
                }
            } else {
                const statDiv = document.createElement('div');
                statDiv.className = 'ep-day-stat';
                statDiv.textContent = '—';
                cell.appendChild(statDiv);
            }

            const today = new Date();
            if (today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day) {
                cell.classList.add('today');
            }

            if (fullDate === selectedDateStr) {
                cell.classList.add('selected');
            }

            cell.addEventListener('click', () => {
                const sel = grid.querySelector('.ep-day-cell.selected');
                if (sel) sel.classList.remove('selected');
                cell.classList.add('selected');
                
                selectedDateStr = fullDate;
                document.getElementById('ep-listTitle').textContent = `点名名单 (${fullDate})`;
                loadStudentsForDate(fullDate);
            });

            grid.appendChild(cell);
        }
    }

    // 载入学生名单
    function loadStudentsForDate(dateStr) {
        injectStylesIfMissing();
        showLoading(true, `加载 ${dateStr} 名单...`);
        
        window.jQuery.ajax({
            type: "post",
            url: "/sahsiah/kehadiran/ajaxloadkehadiranharian",
            data: {
                _token: csrf,
                tarikhpilihan: dateStr,
                id_profile_kelas: classId
            },
            dataType: "json",
            success: function(res) {
                try {
                    const rawStudents = res.data || [];
                    studentsList = rawStudents.map(s => {
                        const laporan = s.laporan_takhadir || [];
                        let present = true;
                        let kategori = 'D';
                        let sebab = 'D0260001';
                        
                        if (laporan.length > 0) {
                            present = false;
                            const th = laporan[0].thadir || {};
                            kategori = th.id_kat_thadir || 'D';
                            sebab = th.id_sebab_thadir || 'D0260001';
                        }
                        
                        return {
                            idpelajar: s.id_individu,
                            namamurid: s.namamurid,
                            present: present,
                            kategori: kategori,
                            sebab: sebab
                        };
                    });
                    
                    // 按照名字字母顺序 (A-Z) 排序，保证名单排序的“秩序”与官方一致
                    studentsList.sort((a, b) => a.namamurid.localeCompare(b.namamurid));
                    
                    renderStudentsList();
                } catch(e) {
                    console.error("解析学生列表出错:", e);
                    showToast("解析学生数据出错");
                }
                showLoading(false);
            },
            error: function() {
                showToast("无法获取该日学生名单");
                showLoading(false);
            }
        });
    }

    // 渲染名单
    function renderStudentsList() {
        const container = document.getElementById('ep-studentListContainer');
        container.innerHTML = '';
        
        if (studentsList.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--ep-text-muted); padding: 40px 0; font-size: 13px;">无数据</div>`;
            return;
        }

        studentsList.forEach((s, idx) => {
            const item = document.createElement('div');
            item.className = 'ep-student-item ' + (s.present ? 'present' : 'absent');
            
            const main = document.createElement('div');
            main.className = 'ep-student-main';
            main.innerHTML = `
                <div class="ep-student-info">
                    <div class="ep-student-name">${idx + 1}. ${s.namamurid}</div>
                    <span class="ep-student-status-badge">${s.present ? '🟢 出席' : '🔴 缺席'}</span>
                </div>
                <div class="ep-toggle-switch"></div>
            `;
            
            const opts = document.createElement('div');
            opts.className = 'ep-absent-options';
            
            const katSelect = document.createElement('select');
            CATEGORIES.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c[0];
                opt.textContent = `${c[0]} · ${c[1]}`;
                if (s.kategori === c[0]) opt.selected = true;
                katSelect.appendChild(opt);
            });
            
            const sebSelect = document.createElement('select');
            function populateCauses(katVal) {
                sebSelect.innerHTML = '';
                const list = CAUSES[katVal] || [];
                list.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c[0];
                    opt.textContent = c[1];
                    if (s.sebab === c[0]) opt.selected = true;
                    sebSelect.appendChild(opt);
                });
            }
            populateCauses(s.kategori);

            opts.appendChild(katSelect);
            opts.appendChild(sebSelect);
            item.appendChild(main);
            item.appendChild(opts);

            main.addEventListener('click', () => {
                s.present = !s.present;
                item.className = 'ep-student-item ' + (s.present ? 'present' : 'absent');
                item.querySelector('.ep-student-status-badge').textContent = s.present ? '🟢 出席' : '🔴 缺席';
                updateSummaryCount();
            });

            katSelect.addEventListener('click', e => e.stopPropagation());
            katSelect.addEventListener('change', e => {
                s.kategori = e.target.value;
                populateCauses(s.kategori);
                s.sebab = sebSelect.value;
            });

            sebSelect.addEventListener('click', e => e.stopPropagation());
            sebSelect.addEventListener('change', e => {
                s.sebab = e.target.value;
            });

            container.appendChild(item);
        });

        updateSummaryCount();
    }

    function updateSummaryCount() {
        const total = studentsList.length;
        const present = studentsList.filter(s => s.present).length;
        const absent = total - present;
        document.getElementById('ep-listTitle').textContent = `已到 ${present} / 缺席 ${absent} / 全班 ${total}`;
    }

    // 提交动作
    function doSubmit(mode) {
        if (!selectedDateStr) {
            showToast("请先选择日期");
            return;
        }
        if (studentsList.length === 0) {
            showToast("请加载学生名单");
            return;
        }

        const rekodtidakhadir = [];
        studentsList.filter(s => !s.present).forEach(s => {
            rekodtidakhadir.push({
                idpelajar: s.idpelajar,
                namamurid: s.namamurid,
                kategori: s.kategori,
                sebab: s.sebab
            });
        });

        const modeTxt = mode === 'simpansah' ? "保存并确认" : "仅保存";
        showLoading(true, `正在发送${modeTxt}...`);

        window.jQuery.ajax({
            type: "post",
            url: "/sahsiah/kehadiran/tabguru/kemaskiniKehadiranHarian",
            data: {
                _token: csrf,
                rekodtidakhadir: rekodtidakhadir,
                tarikh: selectedDateStr,
                kelas: classId,
                statussimpan: mode
            },
            dataType: "json",
            success: function(response) {
                showToast(`✓ 点名${modeTxt}成功！`);
                loadMonthCalendar(currentYear, currentMonth);
                loadStudentsForDate(selectedDateStr);
            },
            error: function() {
                showToast("提交失败，请重试");
                showLoading(false);
            }
        });
    }

    // 事件绑定
    document.getElementById('ep-prevMonth').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 1) { currentMonth = 12; currentYear--; }
        loadMonthCalendar(currentYear, currentMonth);
    });

    document.getElementById('ep-nextMonth').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 12) { currentMonth = 1; currentYear++; }
        loadMonthCalendar(currentYear, currentMonth);
    });

    document.getElementById('ep-btnAllPresent').addEventListener('click', () => {
        studentsList.forEach(s => s.present = true);
        document.querySelectorAll('.ep-student-item').forEach(item => {
            item.className = 'ep-student-item present';
            item.querySelector('.ep-student-status-badge').textContent = '🟢 出席';
        });
        updateSummaryCount();
        showToast("已设全班出席");
    });

    document.getElementById('ep-btnSaveOnly').addEventListener('click', () => doSubmit('simpan'));
    document.getElementById('ep-btnSaveAndConfirm').addEventListener('click', () => doSubmit('simpansah'));

    // 动态在原生网页中创建悬浮切回控制台的小纽扣 (默认隐藏)
    const toggleBtn = document.createElement('div');
    toggleBtn.id = 'ep-btnShowPanel';
    toggleBtn.style.cssText = `
        position: fixed;
        right: 16px;
        bottom: 80px;
        z-index: 9999999;
        background: linear-gradient(135deg, #1565c0, #1e88e5);
        color: #fff;
        padding: 10px 16px;
        border-radius: 30px;
        font-weight: bold;
        box-shadow: 0 4px 16px rgba(21,101,192,0.4);
        font-size: 11px;
        cursor: pointer;
        display: none;
        letter-spacing: 0.5px;
    `;
    toggleBtn.textContent = '⚡ 极简点名';
    document.body.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', () => {
        toggleBtn.style.display = 'none';
        panel.style.display = 'block';
        showToast("已载入日历点名面板");
    });

    // 终极劫持与解绑 Select2：直接重写 jQuery 的 $.fn.select2 插件方法，从根源掐死任何新 select2 的创建，并销毁旧 select2，同时释放卡死 CPU 算力
    function hijackSelect2() {
        window.onscroll = null;
        if (window.jQuery) {
            window.jQuery(window).off('scroll');
            if (window.jQuery.fn) {
                // 销毁当前页面上已存在的 Select2 实例
                window.jQuery('.selectkategori, .selectsebab').each(function() {
                    try {
                        if (window.jQuery(this).hasClass('select2-hidden-accessible')) {
                            window.jQuery(this).rawSelect2 ? window.jQuery(this).rawSelect2('destroy') : window.jQuery(this).select2('destroy');
                        }
                    } catch(e) {}
                });

                // 彻底封印 select2 构造函数，防止后续任何动态生成
                if (!window.jQuery.fn.rawSelect2) {
                    window.jQuery.fn.rawSelect2 = window.jQuery.fn.select2;
                }
                window.jQuery.fn.select2 = function(options) {
                    console.log("🚫 [MOEIS Easy Panel] Hijacked and blocked select2 call on:", this);
                    return this; // 保持 jQuery 链式调用
                };
            }
        }
    }

    // 返回原生
    document.getElementById('btnExitPanel').addEventListener('click', () => {
        panel.style.display = 'none';
        showToast("已退回原生 MOEIS 网页界面");
        toggleBtn.style.display = 'block'; // 展示悬浮按钮
        hijackSelect2(); // 退出时立即销毁并封锁所有 Select2
    });

    // 转发 change 事件以协助原生网页 jQuery 响应下拉框联动 (包含防死循环锁，捕获阶段优先分发)
    let isForwarding = false;
    document.addEventListener('change', function (e) {
        if (isForwarding) return;
        const target = e.target;
        if (target && (target.classList.contains('selectkategori') || 
                       target.classList.contains('selectsebab') || 
                       target.classList.contains('case-hadir'))) {
            if (window.jQuery) {
                isForwarding = true;
                window.jQuery(target).trigger('change');
                isForwarding = false;
                
                // 【绝妙双保险】由于本地选择类别 change 或者是勾选框 change 后，原生网页会在本地异步重建下拉框并将其初始化为 Select2
                // 我们在 50 毫秒后强行收网，将其再次彻底摧毁并还原，保证一级类别和二级原因下拉框都彻底可用！
                setTimeout(hijackSelect2, 50);
            }
        }
    }, true);

    // 监听原生 jQuery AJAX 完成事件，一旦局部刷新，立即强行补回 Select2 样式重置并销毁多余 Select2 (保障原生下拉框点击永久可靠)
    if (window.jQuery) {
        window.jQuery(document).ajaxComplete(function() {
            injectStylesIfMissing();
            hijackSelect2();
        });
    }

    // 默认执行
    const today = new Date();
    const formattedDay = String(today.getDate()).padStart(2, '0');
    const formattedMonth = String(today.getMonth() + 1).padStart(2, '0');
    selectedDateStr = `${formattedDay}/${formattedMonth}/${today.getFullYear()}`;
    
    loadMonthCalendar(currentYear, currentMonth, true);

})();