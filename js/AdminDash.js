// CampusLens admin dashboard overview. Needs AdminShared.js loaded first.
(function () {
    'use strict';

    var A = window.CampusLensAdmin;
    if (!A) return;

    var escapeHTML = A.escapeHTML;
    var toastTimer = null;

    function byId(id) { return document.getElementById(id); }

    function showToast(message) {
        var toast = byId('adminToast');
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3200);
    }

    /* ---------- summary cards ---------- */

    function renderStats() {
        var now = Date.now();
        var day = A.getDayStats(new Date());
        var pending = A.getPendingStats(now);
        var health = A.getHealth(now);

        byId('statClasses').textContent = String(day.total);
        byId('statClassesFoot').textContent = day.active.length + ' in session now · ' + day.completed + ' completed';

        var rateValue = byId('statRate');
        var rateTrack = byId('statRateTrack');
        var rateFoot = byId('statRateFoot');
        if (day.enrolled === 0) {
            rateValue.textContent = '—';
            rateTrack.style.width = '0%';
            rateFoot.textContent = 'No classes have started yet';
        } else {
            var rate = Math.round((day.present / day.enrolled) * 100);
            rateValue.innerHTML = rate + '<span class="value-percent">%</span>';
            rateTrack.style.width = rate + '%';
            rateFoot.textContent = rate >= 85 ? 'Above the 85% requirement' : 'Below the 85% requirement';
        }

        byId('statPending').textContent = String(pending.count).padStart(2, '0');
        byId('statPendingCard').classList.toggle('alert-card', pending.breached > 0);
        var pendingFoot = byId('statPendingFoot');
        if (pending.breached > 0) {
            pendingFoot.innerHTML = '<span class="sla-pill breached">' + pending.breached + ' SLA breached</span>' +
                (pending.warning > 0 ? '<span>' + pending.warning + ' at risk</span>' : '');
        } else if (pending.warning > 0) {
            pendingFoot.innerHTML = '<span class="sla-pill warning">' + pending.warning + ' nearing SLA</span>';
        } else {
            pendingFoot.innerHTML = '<span class="tiny-dot green"></span>All within the ' + A.SLA_HOURS + '-hour SLA';
        }

        byId('statHealth').innerHTML = '<span class="health-dot state-' + escapeHTML(health.state) + '"></span>' + escapeHTML(health.label);
        var healthFoot = byId('statHealthFoot');
        healthFoot.textContent = health.online + '/' + health.total + ' cameras online · ' + health.latency + ' ms';
        healthFoot.title = health.offlineRooms.length ? 'Offline: ' + health.offlineRooms.join(', ') : 'All cameras online';

        var urgent = pending.breached + pending.warning;
        var badge = byId('urgentBadge');
        badge.textContent = String(urgent);
        badge.hidden = urgent === 0;

        byId('liveSyncLabel').textContent = 'Live · updated ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    /* ---------- active classes right now ---------- */

    function renderActiveClasses() {
        var date = new Date();
        var day = A.getDayStats(date);
        var rowsElement = byId('activeRows');
        var emptyElement = byId('activeEmpty');

        rowsElement.innerHTML = day.active.map(function (course) {
            var present = A.presentCount(course, date);
            var percent = Math.round((present / course.enrolled) * 100);
            var minutesLeft = Math.max(0, Math.round(A.toMinutes(course.end) - A.minutesNow(date)));
            return '<tr>' +
                '<td class="course-cell"><strong><span class="code-chip">' + escapeHTML(course.code) + '</span>' + escapeHTML(course.name) + '</strong><small>' + escapeHTML(course.instructor) + '</small></td>' +
                '<td>' + escapeHTML(course.room) + '</td>' +
                '<td class="time-cell">' + escapeHTML(A.formatClock(course.start)) + ' – ' + escapeHTML(A.formatClock(course.end)) + '<small class="cell-note">Ends in ' + minutesLeft + ' min</small></td>' +
                '<td><div class="attend-cell"><strong class="time-cell">' + present + ' / ' + course.enrolled + '</strong>' +
                '<span class="mini-track' + (percent < 85 ? ' low' : '') + '"><span style="width:' + percent + '%"></span></span><small>' + percent + '%</small></div></td>' +
                '<td><a class="feed-btn" href="MarkAtt.html?course=' + encodeURIComponent(course.code) + '"><span class="live-pulse"></span>View live feed</a></td>' +
                '</tr>';
        }).join('');

        byId('activeCountPill').textContent = day.active.length + ' in session';
        byId('activeTableWrap').hidden = day.active.length === 0;
        emptyElement.hidden = day.active.length > 0;

        if (day.active.length === 0) {
            var next = day.upcoming[0];
            byId('activeEmptyText').textContent = next
                ? 'Next up: ' + next.name + ' (' + next.code + ') starts at ' + A.formatClock(next.start) + ' in ' + next.room + '.'
                : 'All of today\u2019s classes have finished.';
        }
    }

    /* ---------- SLA watchlist and system activity ---------- */

    function renderSlaWatch() {
        var pending = A.getPendingStats(Date.now());
        var list = byId('slaList');
        var empty = byId('slaEmpty');

        list.innerHTML = pending.items.slice(0, 4).map(function (item) {
            var request = item.request;
            var name = A.studentOf(request);
            var label = item.sla.state === 'breached'
                ? 'Breached ' + A.formatDuration(item.sla.remaining) + ' ago'
                : A.formatDuration(item.sla.remaining) + ' left';
            return '<li><a class="sla-item" href="AdminCorr.html?id=' + encodeURIComponent(request.id) + '">' +
                '<span class="sla-avatar">' + escapeHTML(A.initialsOf(name)) + '</span>' +
                '<span class="sla-copy"><strong>' + escapeHTML(name) + '</strong><small>' + escapeHTML(request.course) + ' · ' + escapeHTML(A.formatShortDate(request.date)) + ' → ' + escapeHTML(request.requestedStatus) + '</small></span>' +
                '<span class="sla-pill ' + escapeHTML(item.sla.state) + '">' + escapeHTML(label) + '</span></a></li>';
        }).join('');

        empty.hidden = pending.count > 0;
        byId('slaCountPill').textContent = pending.count + ' pending';
    }

    function renderActivity() {
        byId('activityList').innerHTML = A.getLogs().slice(0, 6).map(function (log) {
            return '<li class="activity-item"><span class="activity-dot level-' + escapeHTML(log.level) + '"></span>' +
                '<span class="activity-copy"><strong>' + escapeHTML(log.message) + '</strong><small>' + escapeHTML(log.source) + ' · ' + escapeHTML(A.timeAgo(log.time)) + '</small></span></li>';
        }).join('');
    }

    function renderAll() {
        renderStats();
        renderActiveClasses();
        renderSlaWatch();
        renderActivity();
    }

    /* ---------- quick action: export CSV ---------- */

    function csvCell(value) {
        var text = String(value == null ? '' : value);
        if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;   // stop spreadsheet formula injection
        return '"' + text.replace(/"/g, '""') + '"';
    }

    function exportCsv() {
        var date = new Date();
        var header = ['Date', 'Course Code', 'Course', 'Room', 'Instructor', 'Start', 'End', 'Status', 'Enrolled', 'Present', 'Attendance %'];
        var rows = A.getCourses().map(function (course) {
            var state = A.sessionState(course, date);
            var present = A.presentCount(course, date);
            return [A.localDateValue(), course.code, course.name, course.room, course.instructor, course.start, course.end, state,
                course.enrolled, present, state === 'upcoming' ? '' : Math.round((present / course.enrolled) * 1000) / 10];
        });
        var csv = '\ufeff' + [header].concat(rows).map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'campuslens-attendance-' + A.localDateValue() + '.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

        A.addLog('info', 'Reports', 'Daily attendance CSV exported (' + rows.length + ' sessions)');
        renderActivity();
        showToast('Attendance CSV downloaded (' + rows.length + ' sessions).');
    }

    /* ---------- quick action: broadcast announcement ---------- */

    var dialog = byId('broadcastDialog');
    var form = byId('broadcastForm');
    var titleInput = byId('announceTitle');
    var messageInput = byId('announceMessage');
    var priorityInput = byId('announcePriority');

    function clearBroadcastErrors() {
        [titleInput, messageInput].forEach(function (input) {
            input.closest('.field-control').classList.remove('has-error');
            input.closest('.field-control').querySelector('.field-error').textContent = '';
        });
    }

    function setBroadcastError(input, message) {
        input.closest('.field-control').classList.add('has-error');
        input.closest('.field-control').querySelector('.field-error').textContent = message;
    }

    function openBroadcast() {
        form.reset();
        byId('announceCount').textContent = '0';
        clearBroadcastErrors();
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        titleInput.focus();
    }

    function closeBroadcast() {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    }

    byId('actionBroadcast').addEventListener('click', openBroadcast);
    byId('actionExport').addEventListener('click', exportCsv);
    document.querySelectorAll('[data-close-dialog]').forEach(function (button) {
        button.addEventListener('click', closeBroadcast);
    });

    // Clicking the dim backdrop closes the dialog.
    dialog.addEventListener('click', function (event) {
        if (event.target === dialog) closeBroadcast();
    });

    messageInput.addEventListener('input', function () {
        byId('announceCount').textContent = String(messageInput.value.length);
        messageInput.closest('.field-control').classList.remove('has-error');
    });
    titleInput.addEventListener('input', function () {
        titleInput.closest('.field-control').classList.remove('has-error');
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        clearBroadcastErrors();
        var title = titleInput.value.trim();
        var message = messageInput.value.trim();
        var hasError = false;

        if (title.length < 3) {
            setBroadcastError(titleInput, 'Add a short title (at least 3 characters).');
            hasError = true;
        }
        if (message.length < 10) {
            setBroadcastError(messageInput, 'Write a little more detail (at least 10 characters).');
            hasError = true;
        }
        if (hasError) {
            var firstInvalid = form.querySelector('.has-error input, .has-error textarea');
            if (firstInvalid) firstInvalid.focus();
            return;
        }

        A.publishAnnouncement({ title: title, message: message, priority: priorityInput.value });
        closeBroadcast();
        renderActivity();
        showToast('Announcement sent. Students will see it in their Alerts.');
    });

    /* ---------- start ---------- */

    A.init();
    A.onChange(renderAll);
    renderAll();
}());