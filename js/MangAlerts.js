// CampusLens admin: broadcasts, admin alerts and system event log. Needs AdminShared.js loaded first.
// Broadcasts go through A.publishAnnouncement(), which writes the student's alert list in localStorage.
(function () {
    'use strict';

    var A = window.CampusLensAdmin;
    if (!A) return;

    var esc = A.escapeHTML;
    var MINUTE = 60000;
    var HOUR = 3600000;
    var SIM_KEY = 'campusLensAdminLogSim';
    var SEED_KEY = 'campusLensAdminLogSamples';
    var LEVELS = { success: 'Success', info: 'Info', warn: 'Warning', error: 'Error' };
    var LEVEL_CLASS = { success: 'status-present', info: 'status-info', warn: 'status-late', error: 'status-absent' };
    var PRIORITY_PILL = { normal: ['ok', 'Normal'], urgent: ['warning', 'Urgent'], emergency: ['breached', 'Emergency'] };
    var PRIORITY_HINT = {
        normal: 'Shown to students as a standard update.',
        urgent: 'Shown as a reminder-style alert students should read soon.',
        emergency: 'Shown with a red warning icon. You will be asked to confirm before it is sent.'
    };
    var ALERT_DOT = { sla: 'level-error', system: 'level-warn', info: 'level-success', request: '' };
    var LIVE_EVENTS = [
        ['success', 'Tablets', 'Tablets at Hall NB2 synced successfully'],
        ['success', 'Tablets', 'Tablets at Hall C03 synced successfully'],
        ['warn', 'Recognition', 'Facial recognition confidence drop detected in Lab A14'],
        ['info', 'Sync', 'Roster changes synced with the registrar (SIS)'],
        ['success', 'Cameras', 'Hall NB1 camera heartbeat restored'],
        ['warn', 'Cameras', 'High latency (480 ms) on the Library Entrance camera'],
        ['info', 'Attendance', 'CS 305 attendance window closed'],
        ['error', 'Recognition', 'Face model timed out in Lab C11, retry scheduled'],
        ['success', 'Backup', 'Nightly attendance backup completed'],
        ['info', 'Auth', 'Dr. Admin session refreshed']
    ];

    var logFilter = 'all';
    var logSearch = '';
    var simTimer = null;
    var toastTimer = null;

    var form = document.getElementById('broadcastForm');
    var titleInput = document.getElementById('announceTitle');
    var messageInput = document.getElementById('announceMessage');

    function byId(id) { return document.getElementById(id); }
    function pad2(number) { return String(number).padStart(2, '0'); }

    function showToast(message) {
        var toast = byId('adminToast');
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 4200);
    }

    /* ---------- sample + simulated log events ---------- */

    // Adds a few realistic events once per browser so the log viewer is not empty on first visit.
    function seedSampleLogs() {
        try {
            if (localStorage.getItem(SEED_KEY) === '1') return;
            localStorage.setItem(SEED_KEY, '1');
        } catch (error) { return; }
        var now = Date.now();
        var samples = [
            ['success', 'Tablets', 'Tablets at Hall NB2 synced successfully', 4],
            ['warn', 'Recognition', 'Facial recognition confidence drop detected in Lab A14', 18],
            ['success', 'Tablets', 'Tablets at Hall C03 synced successfully', 33],
            ['error', 'Cameras', 'Lab B06 camera unreachable after 3 retries', 97],
            ['info', 'Sync', 'Face embeddings backed up (12 students)', 140],
            ['warn', 'Recognition', 'Low light reduced the match rate at Library Entrance', 210],
            ['success', 'Attendance', 'AI 410 attendance window closed: 79 / 85 present', 300],
            ['info', 'Auth', 'Dr. Admin signed in', 420]
        ];
        var logs = A.readSavedList(A.KEYS.logs, []);
        samples.forEach(function (sample, index) {
            logs.push({ id: 'sample-' + index, level: sample[0], source: sample[1], message: sample[2], time: now - sample[3] * MINUTE });
        });
        logs.sort(function (a, b) { return b.time - a.time; });
        A.saveList(A.KEYS.logs, logs.slice(0, 100));
    }

    function emitLiveEvent() {
        var event = LIVE_EVENTS[Math.floor(Math.random() * LIVE_EVENTS.length)];
        A.addLog(event[0], event[1], event[2]);
        A.notifyChange();
    }

    function readSim() {
        try { return localStorage.getItem(SIM_KEY) !== '0'; } catch (error) { return true; }
    }

    function setSim(on) {
        try { localStorage.setItem(SIM_KEY, on ? '1' : '0'); } catch (error) { /* ignore */ }
        clearInterval(simTimer);
        simTimer = on ? setInterval(emitLiveEvent, 15000) : null;
        byId('liveToggle').setAttribute('aria-pressed', String(on));
        byId('liveToggle').classList.toggle('is-paused', !on);
        byId('liveToggleText').textContent = on ? 'Live feed on' : 'Live feed paused';
    }

    /* ---------- rendering ---------- */

    function renderSummary() {
        var now = Date.now();
        var sent = A.getAnnouncements();
        var alerts = A.getAdminAlerts();
        var unread = alerts.filter(function (alert) { return alert.unread; }).length;
        var recent = A.getLogs().filter(function (log) { return now - log.time < 24 * HOUR; });
        var warnings = recent.filter(function (log) { return log.level === 'warn'; }).length;
        var errors = recent.filter(function (log) { return log.level === 'error'; }).length;
        var health = A.getHealth(now);

        byId('sumSent').textContent = pad2(sent.length);
        byId('sumSentFoot').textContent = sent.length ? 'Last sent ' + A.timeAgo(sent[0].time) : 'Nothing sent yet';
        byId('sumUnread').textContent = pad2(unread);
        byId('sumUnreadFoot').textContent = alerts.length + ' alert' + (alerts.length === 1 ? '' : 's') + ' in total';
        byId('sumIssues').textContent = pad2(warnings + errors);
        byId('sumIssuesFoot').textContent = errors + ' error' + (errors === 1 ? '' : 's') + ' · ' + warnings + ' warning' + (warnings === 1 ? '' : 's');
        byId('sumIssuesCard').classList.toggle('alert-card', errors > 0);
        byId('sumCams').innerHTML = health.online + '<span class="summary-total">/ ' + health.total + '</span>';
        byId('sumCamsFoot').textContent = health.offlineRooms.length ? 'Offline: ' + health.offlineRooms.join(', ') : 'All cameras online';
    }

    function renderSent() {
        var list = A.getAnnouncements();
        byId('sentList').innerHTML = list.slice(0, 6).map(function (item) {
            var pill = PRIORITY_PILL[item.priority] || PRIORITY_PILL.normal;
            return '<li class="sent-item"><div class="sent-top"><strong>' + esc(item.title) + '</strong><span class="sla-pill ' + pill[0] + '">' + pill[1] + '</span></div>' +
                '<p>' + esc(item.message) + '</p><small>' + esc(A.formatDateTime(item.time)) + ' · by ' + esc(item.author || 'Admin') + '</small></li>';
        }).join('');
        byId('sentEmpty').hidden = list.length > 0;
    }

    function renderAlerts() {
        var alerts = A.getAdminAlerts();
        byId('alertFeed').innerHTML = alerts.slice(0, 8).map(function (alert) {
            var ref = /^(req|sla)-(.+)$/.exec(alert.refId || '');
            var review = ref ? '<a class="feed-btn" href="AdminCorr.html?id=' + encodeURIComponent(ref[2]) + '">Review</a>' : '';
            var mark = alert.unread
                ? '<button class="feed-btn" type="button" data-mark-read="' + esc(alert.id) + '">Mark read</button>'
                : '<span class="read-tag">Read</span>';
            return '<li class="activity-item feed-item' + (alert.unread ? '' : ' is-read') + '">' +
                '<span class="activity-dot ' + (ALERT_DOT[alert.type] || '') + '"></span>' +
                '<span class="activity-copy"><strong>' + esc(alert.title) + '</strong><span class="feed-msg">' + esc(alert.message) + '</span><small>' + esc(A.timeAgo(alert.time)) + '</small></span>' +
                '<span class="feed-actions">' + review + mark + '</span></li>';
        }).join('');
        byId('alertEmpty').hidden = alerts.length > 0;
        byId('markAllRead').disabled = !alerts.some(function (alert) { return alert.unread; });
    }

    function renderLogs() {
        var logs = A.getLogs();
        var counts = { all: logs.length, error: 0, warn: 0, success: 0, info: 0 };
        logs.forEach(function (log) { if (counts[log.level] !== undefined) counts[log.level] += 1; });
        document.querySelectorAll('[data-log-count]').forEach(function (element) {
            element.textContent = String(counts[element.getAttribute('data-log-count')]);
        });
        document.querySelectorAll('[data-log-filter]').forEach(function (tab) {
            var active = tab.getAttribute('data-log-filter') === logFilter;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-pressed', String(active));
        });

        var visible = logs.filter(function (log) {
            if (logFilter !== 'all' && log.level !== logFilter) return false;
            return !logSearch || (String(log.message) + ' ' + String(log.source)).toLowerCase().indexOf(logSearch) !== -1;
        });
        byId('logRows').innerHTML = visible.map(function (log) {
            return '<tr><td class="date-cell">' + esc(A.formatDateTime(log.time)) + '<small>' + esc(A.timeAgo(log.time)) + '</small></td>' +
                '<td><span class="status-badge ' + (LEVEL_CLASS[log.level] || 'status-info') + '">' + esc(LEVELS[log.level] || 'Info') + '</span></td>' +
                '<td class="msg">' + esc(log.message) + '</td>' +
                '<td>' + esc(log.source) + '</td></tr>';
        }).join('');
        byId('logWrap').hidden = visible.length === 0;
        byId('logEmpty').hidden = visible.length > 0;
        byId('logFooter').textContent = 'Showing ' + visible.length + ' of ' + logs.length + ' event' + (logs.length === 1 ? '' : 's');
    }

    function renderAll() {
        renderSummary();
        renderSent();
        renderAlerts();
        renderLogs();
        byId('liveSyncLabel').textContent = 'Live · updated ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    /* ---------- broadcast form ---------- */

    function selectedPriority() { return form.querySelector('input[name="priority"]:checked').value; }
    function updateHint() { byId('prioHint').textContent = PRIORITY_HINT[selectedPriority()]; }

    function setError(input, message) {
        input.closest('.field-control').classList.add('has-error');
        input.closest('.field-control').querySelector('.field-error').textContent = message;
    }

    function clearErrors() {
        [titleInput, messageInput].forEach(function (input) {
            input.closest('.field-control').classList.remove('has-error');
            input.closest('.field-control').querySelector('.field-error').textContent = '';
        });
    }

    form.querySelectorAll('input[name="priority"]').forEach(function (radio) { radio.addEventListener('change', updateHint); });
    titleInput.addEventListener('input', function () { titleInput.closest('.field-control').classList.remove('has-error'); });
    messageInput.addEventListener('input', function () {
        byId('announceCount').textContent = String(messageInput.value.length);
        messageInput.closest('.field-control').classList.remove('has-error');
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        clearErrors();
        var title = titleInput.value.trim();
        var message = messageInput.value.trim();
        var priority = selectedPriority();
        var hasError = false;

        if (title.length < 3) { setError(titleInput, 'Add a short title (at least 3 characters).'); hasError = true; }
        if (message.length < 10) { setError(messageInput, 'Write a little more detail (at least 10 characters).'); hasError = true; }
        if (hasError) {
            var firstInvalid = form.querySelector('.has-error input, .has-error textarea');
            if (firstInvalid) firstInvalid.focus();
            return;
        }
        if (priority === 'emergency' && !window.confirm('Send this EMERGENCY alert to every student now?')) return;

        A.publishAnnouncement({ title: title, message: message, priority: priority });
        form.reset();
        byId('announceCount').textContent = '0';
        updateHint();
        A.notifyChange();
        showToast((priority === 'emergency' ? 'Emergency alert' : 'Announcement') + ' sent. Students will see it in their Alerts.');
    });

    /* ---------- admin alerts + log actions ---------- */

    function markRead(id) {
        var list = A.readSavedList(A.KEYS.adminAlerts, []);
        list.forEach(function (alert) { if (id === 'all' || alert.id === id) alert.unread = false; });
        A.saveList(A.KEYS.adminAlerts, list);
        A.notifyChange();
    }

    byId('alertFeed').addEventListener('click', function (event) {
        var button = event.target.closest('[data-mark-read]');
        if (button) markRead(button.getAttribute('data-mark-read'));
    });
    byId('markAllRead').addEventListener('click', function () { markRead('all'); });

    document.querySelectorAll('[data-log-filter]').forEach(function (tab) {
        tab.addEventListener('click', function () { logFilter = tab.getAttribute('data-log-filter'); renderLogs(); });
    });
    byId('logSearch').addEventListener('input', function (event) {
        logSearch = event.target.value.trim().toLowerCase();
        renderLogs();
    });
    byId('liveToggle').addEventListener('click', function () { setSim(byId('liveToggle').getAttribute('aria-pressed') !== 'true'); });
    byId('clearLogs').addEventListener('click', function () {
        if (!window.confirm('Clear the whole system event log? This also empties the dashboard activity list.')) return;
        A.saveList(A.KEYS.logs, []);
        A.addLog('info', 'Logs', 'Event log cleared by Dr. Admin');
        A.notifyChange();
    });

    /* ---------- start ---------- */

    A.init();
    seedSampleLogs();
    A.onChange(renderAll);
    updateHint();
    renderAll();
    setSim(readSim());
}());