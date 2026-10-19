// CampusLens admin: correction requests with SLA tracking. Needs AdminShared.js loaded first.
// Reads and writes the same localStorage list the student portal uses ('campusLensDemoRequests').
(function () {
    'use strict';

    var A = window.CampusLensAdmin;
    if (!A) return;

    var esc = A.escapeHTML;
    var HOUR = 3600000;

    // The student portal does not store IDs yet, so the admin side looks them up by name.
    var STUDENT_IDS = {
        'Ahmed Mohamed': '20230417',
        'Sara Khaled': '20230562',
        'Omar Hassan': '20230188',
        'Mariam Adel': '20230731'
    };
    var STATE_LABELS = { ok: 'On Track', warning: 'Due Soon', breached: 'SLA Breached' };

    var activeFilter = 'all';
    var searchText = '';
    var openId = null;
    var toastTimer = null;

    function byId(id) { return document.getElementById(id); }

    function showToast(message) {
        var toast = byId('adminToast');
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 4200);
    }

    function longDate(timestamp) {
        return new Date(timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    function capitalize(text) {
        text = String(text || '');
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    function studentIdOf(request) {
        if (request.studentId) return String(request.studentId);
        var name = A.studentOf(request);
        if (STUDENT_IDS[name]) return STUDENT_IDS[name];
        var sum = 0;
        for (var i = 0; i < name.length; i += 1) sum = (sum * 31 + name.charCodeAt(i)) % 10000;
        return '2023' + String(sum).padStart(4, '0');
    }

    function slaPill(state) {
        return '<span class="sla-pill ' + esc(state) + '">' + esc(STATE_LABELS[state]) + '</span>';
    }

    function slaNote(sla) {
        return sla.state === 'breached'
            ? 'Overdue by ' + A.formatDuration(sla.remaining)
            : 'Breaches in ' + A.formatDuration(sla.remaining);
    }

    function requestedBadge(status) {
        return '<span class="status-badge status-' + esc(String(status).toLowerCase()) + '">' + esc(status) + '</span>';
    }

    /* ---------- data ---------- */

    function buildRows(now) {
        var rows = A.getRequests().map(function (request) {
            var pending = request.status === 'pending';
            return {
                request: request,
                pending: pending,
                submitted: A.submittedAtOf(request),
                sla: pending ? A.slaInfo(request, now) : null
            };
        });
        rows.sort(function (a, b) {
            if (a.pending !== b.pending) return a.pending ? -1 : 1;
            if (a.pending) return a.sla.remaining - b.sla.remaining;   // closest to breach first
            return (b.request.resolvedAt || b.submitted) - (a.request.resolvedAt || a.submitted);
        });
        return rows;
    }

    function matchesFilter(row) {
        if (activeFilter === 'urgent') return row.pending && row.sla.state !== 'ok';
        if (activeFilter === 'pending') return row.pending;
        if (activeFilter === 'resolved') return !row.pending;
        return true;
    }

    function matchesSearch(row) {
        if (!searchText) return true;
        var haystack = (A.studentOf(row.request) + ' ' + studentIdOf(row.request) + ' ' + row.request.course).toLowerCase();
        return haystack.indexOf(searchText) !== -1;
    }

    /* ---------- rendering ---------- */

    function render() {
        var now = Date.now();
        var rows = buildRows(now);
        var pendingRows = rows.filter(function (row) { return row.pending; });
        var counts = { ok: 0, warning: 0, breached: 0 };
        pendingRows.forEach(function (row) { counts[row.sla.state] += 1; });

        byId('sumPending').textContent = String(pendingRows.length).padStart(2, '0');
        byId('sumOk').textContent = String(counts.ok).padStart(2, '0');
        byId('sumSoon').textContent = String(counts.warning).padStart(2, '0');
        byId('sumBreached').textContent = String(counts.breached).padStart(2, '0');
        byId('sumBreachedCard').classList.toggle('alert-card', counts.breached > 0);

        var tabCounts = {
            all: rows.length,
            urgent: counts.warning + counts.breached,
            pending: pendingRows.length,
            resolved: rows.length - pendingRows.length
        };
        document.querySelectorAll('[data-count]').forEach(function (element) {
            element.textContent = String(tabCounts[element.getAttribute('data-count')]);
        });
        document.querySelectorAll('[data-corr-filter]').forEach(function (tab) {
            var isActive = tab.getAttribute('data-corr-filter') === activeFilter;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-pressed', String(isActive));
        });

        var visible = rows.filter(function (row) { return matchesFilter(row) && matchesSearch(row); });

        byId('requestRows').innerHTML = visible.map(function (row) {
            var request = row.request;
            var name = A.studentOf(request);
            var statusName = capitalize(request.status);

            var slaCell;
            if (row.pending) {
                slaCell = slaPill(row.sla.state) + '<small class="cell-note">' + esc(slaNote(row.sla)) + '</small>';
            } else if (typeof request.resolvedAt === 'number') {
                var took = request.resolvedAt - row.submitted;
                var met = took <= A.SLA_HOURS * HOUR;
                slaCell = '<span class="sla-pill ' + (met ? 'ok' : 'breached') + '">' + (met ? 'Met SLA' : 'Missed SLA') + '</span>' +
                    '<small class="cell-note">Resolved in ' + esc(A.formatDuration(took)) + '</small>';
            } else {
                slaCell = '<small class="cell-note">Not tracked</small>';
            }

            return '<tr>' +
                '<td class="course-cell"><strong>' + esc(name) + '</strong><small>ID ' + esc(studentIdOf(request)) + '</small></td>' +
                '<td class="course-cell"><strong>' + esc(request.course) + '</strong><small>Class on ' + esc(A.formatShortDate(request.date)) + '</small></td>' +
                '<td>' + requestedBadge(request.requestedStatus) + '</td>' +
                '<td class="date-cell">' + esc(A.formatDateTime(row.submitted)) + '<small>' + esc(A.formatDuration(now - row.submitted)) + ' ago</small></td>' +
                '<td><span class="request-status ' + esc(request.status) + '">' + esc(statusName) + '</span></td>' +
                '<td>' + slaCell + '</td>' +
                '<td><button class="feed-btn" type="button" data-review="' + esc(request.id) + '">' + (row.pending ? 'Review' : 'View') + '</button></td>' +
                '</tr>';
        }).join('');

        byId('requestsEmpty').hidden = visible.length > 0;
        byId('requestsTableWrap').hidden = visible.length === 0;
        byId('requestsFooter').textContent = 'Showing ' + visible.length + ' of ' + rows.length + ' request' + (rows.length === 1 ? '' : 's');
        byId('liveSyncLabel').textContent = 'Live · updated ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    /* ---------- review dialog ---------- */

    var dialog = byId('reviewDialog');
    var noteInput = byId('reviewNote');

    function clearNoteError() {
        noteInput.closest('.field-control').classList.remove('has-error');
        noteInput.closest('.field-control').querySelector('.field-error').textContent = '';
    }

    function findRow(id) {
        var rows = buildRows(Date.now());
        for (var i = 0; i < rows.length; i += 1) {
            if (String(rows[i].request.id) === String(id)) return rows[i];
        }
        return null;
    }

    function openReview(id) {
        var row = findRow(id);
        if (!row) return;
        var request = row.request;
        var name = A.studentOf(request);
        var now = Date.now();
        openId = String(request.id);

        byId('reviewKicker').textContent = row.pending ? 'REVIEW REQUEST' : 'REQUEST DETAILS';
        byId('reviewHeading').textContent = name;
        byId('reviewSub').textContent = request.course + ' · ' + A.formatShortDate(request.date);

        var requestedDot = { present: 'present-dot', late: 'late-dot', absent: 'absent-dot' }[String(request.requestedStatus).toLowerCase()] || 'present-dot';
        var items = [
            ['Student', esc(name)],
            ['Student ID', '<span class="mono">' + esc(studentIdOf(request)) + '</span>'],
            ['Course', esc(request.course)],
            ['Class date', esc(longDate(new Date(request.date + 'T12:00:00').getTime()))],
            ['Requested status', '<span class="choice-dot ' + requestedDot + '"></span>' + esc(request.requestedStatus)],
            ['Submitted', esc(A.formatDateTime(row.submitted))]
        ];
        byId('reviewDetails').innerHTML = items.map(function (item) {
            return '<div><dt>' + item[0] + '</dt><dd>' + item[1] + '</dd></div>';
        }).join('');
        byId('reviewReason').textContent = request.reason || 'No reason was provided.';

        var slaBox = byId('reviewSla');
        var outcomeBox = byId('reviewOutcome');
        var pending = row.pending;

        if (pending) {
            slaBox.innerHTML = slaPill(row.sla.state) +
                '<span class="review-sla-text">Submitted ' + esc(A.formatDuration(now - row.submitted)) + ' ago. ' + esc(slaNote(row.sla)) + '.</span>';
            slaBox.hidden = false;
            outcomeBox.hidden = true;
        } else {
            slaBox.hidden = true;
            var approved = request.status === 'approved';
            var by = request.resolvedBy ? ' by ' + esc(request.resolvedBy) : '';
            var when = typeof request.resolvedAt === 'number' ? ' on ' + esc(A.formatDateTime(request.resolvedAt)) : '';
            outcomeBox.className = 'outcome-box ' + request.status;
            outcomeBox.innerHTML = '<strong>' + (approved ? 'Approved' : 'Rejected') + by + when + '</strong>' +
                '<p>' + esc(request.reviewNote || request.detail || '') + '</p>';
            outcomeBox.hidden = false;
        }

        byId('noteField').hidden = !pending;
        byId('approveBtn').hidden = !pending;
        byId('rejectBtn').hidden = !pending;
        noteInput.value = '';
        byId('noteCount').textContent = '0';
        clearNoteError();

        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
    }

    function closeReview() {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    }

    dialog.addEventListener('close', function () {
        openId = null;
        noteInput.value = '';
        clearNoteError();
    });
    dialog.addEventListener('click', function (event) {
        if (event.target === dialog) closeReview();
    });
    document.querySelectorAll('[data-close-dialog]').forEach(function (button) {
        button.addEventListener('click', closeReview);
    });
    noteInput.addEventListener('input', function () {
        byId('noteCount').textContent = String(noteInput.value.length);
        clearNoteError();
    });

    /* ---------- approve / reject ---------- */

    // Re-reads storage so a request already handled elsewhere is never overwritten.
    function resolveRequest(id, decision, note) {
        var list = A.readSavedList(A.KEYS.requests, []);
        var target = null;
        list.forEach(function (request) {
            if (String(request.id) === String(id)) target = request;
        });
        if (!target || target.status !== 'pending') return null;

        var now = Date.now();
        var approved = decision === 'approved';
        var name = A.studentOf(target);

        target.status = decision;
        target.resolvedAt = now;
        target.resolvedBy = 'Dr. Admin';
        target.reviewNote = note;
        // "detail" is what the student sees under "View details" on their Correction requests page.
        target.detail = approved
            ? 'Approved ' + longDate(now) + ' · Your attendance record was updated to ' + target.requestedStatus + '.' + (note ? ' Note: ' + note : '')
            : 'Reviewed ' + longDate(now) + ' · The instructor could not confirm attendance for this session. Note: ' + note;
        A.saveList(A.KEYS.requests, list);

        // The admin alerts that were raised for this request are now handled.
        var adminAlerts = A.readSavedList(A.KEYS.adminAlerts, []);
        adminAlerts.forEach(function (alert) {
            if (alert.refId === 'req-' + id || alert.refId === 'sla-' + id) alert.unread = false;
        });
        A.saveList(A.KEYS.adminAlerts, adminAlerts);

        // Student inbox: the demo student portal only has one inbox (Ahmed Mohamed).
        var delivered = false;
        if (name === A.STUDENT_NAME) {
            var classDay = longDate(new Date(target.date + 'T12:00:00').getTime());
            A.pushStudentAlert({
                type: approved ? 'approved' : 'absent',
                title: approved ? 'Correction request approved' : 'Correction request rejected',
                message: approved
                    ? 'Your attendance correction for ' + target.course + ' on ' + classDay + ' was approved. Your record now shows ' + target.requestedStatus + '.'
                    : 'Your attendance correction for ' + target.course + ' on ' + classDay + ' was not approved. Instructor note: ' + note,
                tag: target.course,
                action: approved ? 'History' : 'Correction request'
            });
            delivered = true;
        }

        A.addLog(approved ? 'success' : 'warn', 'Corrections',
            name + '\u2019s request for ' + target.course + ' ' + (approved ? 'approved' : 'rejected') + (delivered ? ' · student notified' : ''));

        return { request: target, delivered: delivered, name: name };
    }

    function submitDecision(decision) {
        clearNoteError();
        var note = noteInput.value.trim();
        if (decision === 'rejected' && note.length < 5) {
            noteInput.closest('.field-control').classList.add('has-error');
            noteInput.closest('.field-control').querySelector('.field-error').textContent = 'Add a short reason for the student (at least 5 characters).';
            noteInput.focus();
            return;
        }

        var result = resolveRequest(openId, decision, note);
        closeReview();
        if (!result) {
            showToast('That request was already resolved.');
            A.notifyChange();
            return;
        }

        var verb = decision === 'approved' ? 'Approved' : 'Rejected';
        showToast(result.delivered
            ? verb + ' ' + result.name + '\u2019s request. The student was notified in their Alerts.'
            : verb + ' ' + result.name + '\u2019s request. This demo only has an inbox for ' + A.STUDENT_NAME + ', so no alert was delivered.');
        A.notifyChange();   // re-renders this page and refreshes the sidebar badges
    }

    byId('approveBtn').addEventListener('click', function () { submitDecision('approved'); });
    byId('rejectBtn').addEventListener('click', function () { submitDecision('rejected'); });

    /* ---------- filters, search, row actions ---------- */

    document.querySelectorAll('[data-corr-filter]').forEach(function (tab) {
        tab.addEventListener('click', function () {
            activeFilter = tab.getAttribute('data-corr-filter');
            render();
        });
    });

    byId('requestSearch').addEventListener('input', function (event) {
        searchText = event.target.value.trim().toLowerCase();
        render();
    });

    byId('clearRequestFilters').addEventListener('click', function () {
        activeFilter = 'all';
        searchText = '';
        byId('requestSearch').value = '';
        render();
    });

    byId('requestRows').addEventListener('click', function (event) {
        var button = event.target.closest('[data-review]');
        if (button) openReview(button.getAttribute('data-review'));
    });

    /* ---------- start ---------- */

    var query = new URLSearchParams(window.location.search);
    var filterParam = query.get('filter');
    if (['all', 'urgent', 'pending', 'resolved'].indexOf(filterParam) !== -1) activeFilter = filterParam;

    A.init();
    A.onChange(render);
    render();

    var idParam = query.get('id');
    if (idParam) openReview(idParam);   // used by the dashboard's SLA watchlist links
}());