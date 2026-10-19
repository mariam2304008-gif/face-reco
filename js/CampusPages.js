// CampusLens student pages use small demo arrays and localStorage instead of a backend.
(function () {
    'use strict';

    var pageName = document.body.getAttribute('data-page');
    var alertsStorageKey = 'campusLensDemoAlerts';
    var requestsStorageKey = 'campusLensDemoRequests';

    function readSavedList(key, fallback) {
        try {
            var savedItems = JSON.parse(localStorage.getItem(key));
            return Array.isArray(savedItems) ? savedItems : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function saveList(key, items) {
        try {
            localStorage.setItem(key, JSON.stringify(items));
        } catch (error) {
            // The page still works for the current visit if storage is unavailable.
        }
    }

    function escapeHTML(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
            var replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return replacements[character];
        });
    }

    function formatLongDate(dateText) {
        var date = new Date(dateText + 'T12:00:00');
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    function formatShortDate(dateText) {
        var date = new Date(dateText + 'T12:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function showToday() {
        var dateLabel = document.getElementById('todayLabel');
        if (dateLabel) {
            dateLabel.textContent = new Date().toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric'
            }).toUpperCase();
        }
    }

    function updateUnreadBadges(count) {
        document.querySelectorAll('[data-unread-count]').forEach(function (badge) {
            badge.textContent = String(count);
            badge.hidden = count === 0;
        });
        document.querySelectorAll('.top-alert i').forEach(function (dot) {
            dot.hidden = count === 0;
        });
    }

    function localDateValue() {
        var date = new Date();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return date.getFullYear() + '-' + month + '-' + day;
    }

    // Demo data used by more than one student page (the dashboard reads all three lists).
    var historyRecords = [
        { date: '2026-10-16', course: 'Software Engineering', code: 'SWE 320', room: 'Hall NB2', checkIn: '09:02 AM', checkOut: '10:48 AM', status: 'present' },
        { date: '2026-10-14', course: 'Database Systems', code: 'CS 305', room: 'Lab A14', checkIn: '11:08 AM', checkOut: '12:52 PM', status: 'late' },
        { date: '2026-10-12', course: 'Computer Networks', code: 'CS 340', room: 'Hall C03', checkIn: '08:54 AM', checkOut: '10:35 AM', status: 'present' },
        { date: '2026-10-10', course: 'Artificial Intelligence', code: 'AI 410', room: 'Hall NB1', checkIn: '01:02 PM', checkOut: '02:46 PM', status: 'present' },
        { date: '2026-10-08', course: 'Data Structures', code: 'CS 220', room: 'Lab B06', checkIn: '—', checkOut: '—', status: 'absent' },
        { date: '2026-10-06', course: 'Software Engineering', code: 'SWE 320', room: 'Hall NB2', checkIn: '08:57 AM', checkOut: '10:41 AM', status: 'present' },
        { date: '2026-10-04', course: 'Database Systems', code: 'CS 305', room: 'Lab A14', checkIn: '11:01 AM', checkOut: '12:45 PM', status: 'present' },
        { date: '2026-10-02', course: 'Computer Networks', code: 'CS 340', room: 'Hall C03', checkIn: '09:00 AM', checkOut: '10:42 AM', status: 'present' }
    ];

    var defaultAlerts = [
        { id: 1, type: 'late', title: 'Late check-in recorded', message: 'Your Database Systems attendance on October 14 was recorded at 11:08 AM. If this looks incorrect, you can request a review.', tag: 'Database Systems · CS 305', time: 'Oct 14 · 11:10 AM', unread: true, action: 'History' },
        { id: 2, type: 'reminder', title: 'Class starts in 30 minutes', message: 'Software Engineering with Dr. Samir Hassan begins at 9:00 AM in Hall NB2. Have a great class.', tag: 'Software Engineering · SWE 320', time: 'Oct 16 · 8:30 AM', unread: true, action: 'History' },
        { id: 3, type: 'absent', title: 'Attendance marked absent', message: 'You were marked absent for Data Structures on October 8. If you attended class, you can send a correction request.', tag: 'Data Structures · CS 220', time: 'Oct 8 · 10:50 AM', unread: true, action: 'Correction request' },
        { id: 4, type: 'approved', title: 'Correction request approved', message: 'Your attendance correction for Computer Networks on September 28 has been approved by your instructor.', tag: 'Computer Networks · CS 340', time: 'Oct 1 · 2:15 PM', unread: false, action: 'History' },
        { id: 5, type: 'info', title: 'Your weekly summary is ready', message: 'You attended 5 out of 6 scheduled classes last week. Your attendance rate is currently 90%.', tag: 'Weekly summary', time: 'Sep 29 · 9:00 AM', unread: false, action: 'History' },
        { id: 6, type: 'reminder', title: 'Correction request received', message: 'Your request for Database Systems on September 24 is in review. We’ll let you know when it has been updated.', tag: 'Database Systems · CS 305', time: 'Sep 25 · 12:20 PM', unread: false, action: 'Correction request' }
    ];

    var defaultRequests = [
        { id: 1, date: '2026-10-14', course: 'Database Systems', status: 'pending', requestedStatus: 'Present', reason: 'I arrived before the class began, but my scan did not register at the entrance.', detail: 'Submitted October 14, 2026 · Waiting for instructor review.' },
        { id: 2, date: '2026-09-28', course: 'Computer Networks', status: 'approved', requestedStatus: 'Present', reason: 'The attendance system did not recognize my face during the first scan.', detail: 'Approved October 1, 2026 · Your attendance record was updated.' },
        { id: 3, date: '2026-09-24', course: 'Database Systems', status: 'rejected', requestedStatus: 'Present', reason: 'I was present in the class, but I forgot to check the attendance result.', detail: 'Reviewed September 27, 2026 · The instructor could not confirm attendance for this session.' }
    ];

    // Today's timetable, used by the dashboard and Mark attendance.
    // Same rooms, times and instructors as the admin portal's class list (AdminShared.js).
    var todayClasses = [
        { code: 'SWE 320', course: 'Software Engineering', room: 'Hall NB2', instructor: 'Dr. Samir Hassan', start: '09:00', end: '10:45', checkIn: '08:57' },
        { code: 'CS 305', course: 'Database Systems', room: 'Lab A14', instructor: 'Dr. Karim Fathy', start: '11:00', end: '12:45', checkIn: '11:06' },
        { code: 'AI 410', course: 'Artificial Intelligence', room: 'Hall NB1', instructor: 'Dr. Nadia Younes', start: '13:00', end: '14:45', checkIn: '12:56' }
    ];
    var lateAfterMinutes = 5;
    var rosterStorageKey = 'campusLensAdminStudents';   // admin roster (UserMang.js), holds the face ID status
    var studentId = '20230417';

    function minutesOf(timeText) {
        var parts = timeText.split(':');
        return Number(parts[0]) * 60 + Number(parts[1]);
    }

    function formatClock(timeText) {
        var minutes = minutesOf(timeText);
        var hours = Math.floor(minutes / 60);
        return ((hours + 11) % 12 + 1) + ':' + String(minutes % 60).padStart(2, '0') + ' ' + (hours >= 12 ? 'PM' : 'AM');
    }

    function formatWait(minutes) {
        var total = Math.max(1, Math.round(minutes));
        var hours = Math.floor(total / 60);
        if (hours === 0) return total + ' min';
        return hours + 'h' + (total % 60 ? ' ' + (total % 60) + 'm' : '');
    }

    // upcoming / active / completed
    function classPhase(item, nowMinutes) {
        if (nowMinutes < minutesOf(item.start)) return 'upcoming';
        if (nowMinutes >= minutesOf(item.end)) return 'completed';
        return 'active';
    }

    // This student's row in the admin roster, or null if the admin portal has not saved one yet.
    function studentRecord() {
        var record = null;
        readSavedList(rosterStorageKey, []).forEach(function (student) {
            if (student && String(student.id) === studentId) record = student;
        });
        return record;
    }

    function alertIcon(type) {
        var icons = {
            late: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
            absent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/><circle cx="12" cy="12" r="9"/></svg>',
            approved: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="9"/></svg>',
            emergency: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4M12 17h.01"/></svg>',
            reminder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>',
            info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
        };
        return icons[type] || icons.info;
    }

    showToday();

    // On small screens the sidebar turns into a scrolling row, so bring the current page's link into view.
    var sideNav = document.querySelector('.side-nav');
    var activeNavLink = sideNav ? sideNav.querySelector('.nav-link.active') : null;
    if (activeNavLink && sideNav.scrollWidth > sideNav.clientWidth) {
        sideNav.scrollLeft = activeNavLink.offsetLeft - sideNav.offsetLeft - (sideNav.clientWidth - activeNavLink.offsetWidth) / 2;
    }

    var savedAlerts = readSavedList(alertsStorageKey, null);
    var savedUnreadCount = savedAlerts
        ? savedAlerts.filter(function (alert) { return alert.unread; }).length
        : 3;
    updateUnreadBadges(savedUnreadCount);

    
    window.addEventListener('storage', function (event) {
        if (event.key !== alertsStorageKey) return;
        var latest = readSavedList(alertsStorageKey, null);
        if (latest) updateUnreadBadges(latest.filter(function (alert) { return alert.unread; }).length);
    });

    if (pageName === 'history') {
        var searchInput = document.getElementById('historySearch');
        var dateFilter = document.getElementById('dateFilter');
        var statusFilter = document.getElementById('statusFilter');
        var rowsElement = document.getElementById('historyRows');
        var emptyElement = document.getElementById('historyEmpty');
        var resultCount = document.getElementById('historyResultCount');

        function renderHistory() {
            var searchText = searchInput.value.trim().toLowerCase();
            var selectedStatus = statusFilter.value;
            var numberOfDays = dateFilter.value === 'all' ? 0 : Number(dateFilter.value);
            var today = new Date();
            today.setHours(23, 59, 59, 999);

            var visibleRecords = historyRecords.filter(function (record) {
                var matchesSearch = (record.course + ' ' + record.code + ' ' + record.room).toLowerCase().includes(searchText);
                var matchesStatus = selectedStatus === 'all' || record.status === selectedStatus;
                var recordDate = new Date(record.date + 'T12:00:00');
                var daysOld = (today.getTime() - recordDate.getTime()) / 86400000;
                var matchesDate = numberOfDays === 0 || (daysOld >= 0 && daysOld <= numberOfDays);
                return matchesSearch && matchesStatus && matchesDate;
            });

            rowsElement.innerHTML = visibleRecords.map(function (record) {
                var statusName = record.status.charAt(0).toUpperCase() + record.status.slice(1);
                return '<tr>' +
                    '<td class="date-cell">' + escapeHTML(formatShortDate(record.date)) + '<small>' + escapeHTML(new Date(record.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })) + '</small></td>' +
                    '<td class="course-cell"><strong>' + escapeHTML(record.course) + '</strong><small>' + escapeHTML(record.code + ' · ' + record.room) + '</small></td>' +
                    '<td class="time-cell">' + escapeHTML(record.checkIn) + '</td>' +
                    '<td class="time-cell">' + escapeHTML(record.checkOut) + '</td>' +
                    '<td><span class="status-badge status-' + escapeHTML(record.status) + '">' + escapeHTML(statusName) + '</span></td>' +
                    '<td><a class="row-action" href="CorrReq.html?date=' + encodeURIComponent(record.date) + '&course=' + encodeURIComponent(record.course) + '">Request correction</a></td>' +
                    '</tr>';
            }).join('');

            emptyElement.hidden = visibleRecords.length > 0;
            resultCount.textContent = visibleRecords.length === 0
                ? 'No sessions match your filters'
                : 'Showing ' + visibleRecords.length + ' recent session' + (visibleRecords.length === 1 ? '' : 's');
        }

        function clearHistoryFilters() {
            searchInput.value = '';
            dateFilter.value = 'all';
            statusFilter.value = 'all';
            renderHistory();
        }

        searchInput.addEventListener('input', renderHistory);
        dateFilter.addEventListener('change', renderHistory);
        statusFilter.addEventListener('change', renderHistory);
        document.getElementById('clearHistoryFilters').addEventListener('click', clearHistoryFilters);
        document.getElementById('emptyClearFilters').addEventListener('click', clearHistoryFilters);
        renderHistory();
    }

    if (pageName === 'alerts') {
        var alerts = readSavedList(alertsStorageKey, defaultAlerts);
        var activeAlertFilter = 'all';
        var alertList = document.getElementById('notificationList');
        var alertEmpty = document.getElementById('notificationEmpty');

        function renderAlerts() {
            var unreadCount = alerts.filter(function (alert) { return alert.unread; }).length;
            var visibleAlerts = alerts.filter(function (alert) {
                return activeAlertFilter === 'all' || alert.unread;
            });
            var allCount = document.getElementById('allAlertCount');
            var unreadCountElement = document.getElementById('unreadAlertCount');
            var heroCount = document.getElementById('alertHeroCount');
            allCount.textContent = String(alerts.length);
            unreadCountElement.textContent = String(unreadCount);
            heroCount.textContent = String(unreadCount);
            document.getElementById('alertSummary').textContent = unreadCount === 0
                ? 'You have no unread updates. Here’s your recent activity.'
                : 'You have ' + unreadCount + ' unread update' + (unreadCount === 1 ? '' : 's') + '. Here’s what’s happening this week.';
            updateUnreadBadges(unreadCount);

            alertList.innerHTML = visibleAlerts.map(function (alert) {
                var actionLink = alert.action === 'Correction request' ? 'CorrReq.html' : 'History.html';
                var readAction = alert.unread
                    ? '<button type="button" data-mark-read="' + escapeHTML(alert.id) + '">Mark as read</button>'
                    : '<span class="read-label">Read</span>';
                return '<article class="notification-item' + (alert.unread ? ' unread' : '') + '">' +
                    '<span class="notification-icon kind-' + escapeHTML(alert.type) + '">' + alertIcon(alert.type) + '</span>' +
                    '<div class="notification-copy"><div class="notification-titleline"><h3>' + escapeHTML(alert.title) + '</h3>' + (alert.unread ? '<span class="unread-mark" aria-label="Unread"></span>' : '') + '</div>' +
                    '<p>' + escapeHTML(alert.message) + '</p><div class="notification-meta"><span>' + escapeHTML(alert.time) + '</span><span class="notification-tag">' + escapeHTML(alert.tag) + '</span></div></div>' +
                    '<div class="notification-actions">' + readAction + '<a href="' + actionLink + '">View</a></div></article>';
            }).join('');

            alertEmpty.hidden = visibleAlerts.length > 0;
        }

        document.querySelectorAll('[data-alert-filter]').forEach(function (button) {
            button.addEventListener('click', function () {
                activeAlertFilter = button.getAttribute('data-alert-filter');
                document.querySelectorAll('.filter-tab').forEach(function (tab) {
                    tab.classList.toggle('active', tab.getAttribute('data-alert-filter') === activeAlertFilter);
                });
                renderAlerts();
            });
        });

        alertList.addEventListener('click', function (event) {
            var readButton = event.target.closest('[data-mark-read]');
            if (!readButton) return;
            var alertId = Number(readButton.getAttribute('data-mark-read'));
            alerts.forEach(function (alert) {
                if (alert.id === alertId) alert.unread = false;
            });
            saveList(alertsStorageKey, alerts);
            renderAlerts();
        });

        document.getElementById('markAllRead').addEventListener('click', function () {
            alerts.forEach(function (alert) { alert.unread = false; });
            saveList(alertsStorageKey, alerts);
            renderAlerts();
        });

        renderAlerts();
        
        window.addEventListener('storage', function (event) {
            if (event.key !== alertsStorageKey) return;
            alerts = readSavedList(alertsStorageKey, defaultAlerts);
            renderAlerts();
        });
    }

    if (pageName === 'corrections') {
        var requests = readSavedList(requestsStorageKey, defaultRequests);
        function myRequests() {
            return requests.filter(function (request) {
                return !request.student || request.student === 'Ahmed Mohamed';
            });
        }
        var form = document.getElementById('correctionForm');
        var dateInput = document.getElementById('requestDate');
        var courseInput = document.getElementById('requestCourse');
        var reasonInput = document.getElementById('requestReason');
        var feedback = document.getElementById('formFeedback');

        function clearFieldErrors() {
            [dateInput, courseInput, reasonInput].forEach(function (input) {
                input.closest('.field-control').classList.remove('has-error');
            });
            document.getElementById('statusChoice').classList.remove('has-error');
            document.querySelectorAll('.field-error').forEach(function (error) { error.textContent = ''; });
            feedback.classList.remove('success');
            feedback.textContent = '';
        }

        function setFieldError(input, message) {
            input.closest('.field-control').classList.add('has-error');
            input.closest('.field-control').querySelector('.field-error').textContent = message;
        }

        function renderRequests() {
            var requestList = document.getElementById('requestList');
            var requestsEmpty = document.getElementById('requestsEmpty');
            var pendingCount = myRequests().filter(function (request) { return request.status === 'pending'; }).length;
            var headingCount = document.getElementById('pendingHeadingCount');
            headingCount.textContent = pendingCount + ' pending review' + (pendingCount === 1 ? '' : 's');
            document.getElementById('requestTotalCount').textContent = String(myRequests().length);

            requestList.innerHTML = myRequests().map(function (request) {
                var statusName = request.status.charAt(0).toUpperCase() + request.status.slice(1);
                return '<article class="request-item"><div><div class="request-course">' + escapeHTML(request.course) + '</div>' +
                    '<div class="request-date">' + escapeHTML(formatLongDate(request.date)) + ' · Requested as ' + escapeHTML(request.requestedStatus) + '</div>' +
                    '<p class="request-reason">' + escapeHTML(request.reason) + '</p></div>' +
                    '<span class="request-status ' + escapeHTML(request.status) + '">' + escapeHTML(statusName) + '</span>' +
                    '<details class="request-details"><summary>View details</summary><div class="request-detail-copy">' + escapeHTML(request.detail) + '</div></details></article>';
            }).join('');
            requestsEmpty.hidden = myRequests().length > 0;
        }

        var query = new URLSearchParams(window.location.search);
        var requestedDate = query.get('date');
        var requestedCourse = query.get('course');
        if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) dateInput.value = requestedDate;
        if (requestedCourse) {
            Array.prototype.forEach.call(courseInput.options, function (option) {
                if (option.value.toLowerCase() === requestedCourse.toLowerCase()) courseInput.value = option.value;
            });
        }

        reasonInput.addEventListener('input', function () {
            document.getElementById('reasonCount').textContent = String(reasonInput.value.length);
            reasonInput.closest('.field-control').classList.remove('has-error');
            document.getElementById('reasonError').textContent = '';
        });

        [dateInput, courseInput].forEach(function (input) {
            input.addEventListener('change', function () {
                input.closest('.field-control').classList.remove('has-error');
                input.closest('.field-control').querySelector('.field-error').textContent = '';
            });
        });

        document.querySelectorAll('input[name="status"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                document.getElementById('statusChoice').classList.remove('has-error');
                document.getElementById('statusError').textContent = '';
            });
        });

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            clearFieldErrors();
            var hasError = false;
            var selectedStatus = document.querySelector('input[name="status"]:checked');
            var todayText = localDateValue();

            if (!dateInput.value) {
                setFieldError(dateInput, 'Choose the date of your class.');
                hasError = true;
            } else if (dateInput.value > todayText) {
                setFieldError(dateInput, 'Choose today or an earlier class date.');
                hasError = true;
            }
            if (!courseInput.value) {
                setFieldError(courseInput, 'Choose the course you attended.');
                hasError = true;
            }
            if (!selectedStatus) {
                document.getElementById('statusChoice').classList.add('has-error');
                document.getElementById('statusError').textContent = 'Select the correct attendance status.';
                hasError = true;
            }
            if (reasonInput.value.trim().length < 12) {
                setFieldError(reasonInput, 'Please add a little more detail (at least 12 characters).');
                hasError = true;
            }
            if (hasError) {
                var firstInvalid = document.querySelector('.has-error input, .has-error select, .has-error textarea');
                if (firstInvalid) firstInvalid.focus();
                return;
            }

            var newRequest = {
                id: Date.now(),
                student: 'Ahmed Mohamed',
                submittedAt: Date.now(),
                date: dateInput.value,
                course: courseInput.value,
                status: 'pending',
                requestedStatus: selectedStatus.value.charAt(0).toUpperCase() + selectedStatus.value.slice(1),
                reason: reasonInput.value.trim(),
                detail: 'Submitted ' + formatLongDate(localDateValue()) + ' · Waiting for instructor review.'
            };
            requests.unshift(newRequest);
            saveList(requestsStorageKey, requests);
            renderRequests();
            form.reset();
            document.getElementById('reasonCount').textContent = '0';
            feedback.textContent = 'Your request was added. You can follow its status in Your requests below.';
            feedback.classList.add('success');
        });

        renderRequests();
    }

    if (pageName === 'dashboard') {
        // phase: upcoming / active / completed. status: present / late / absent, or null before the check-in.
        function classState(item, nowMinutes) {
            var phase = classPhase(item, nowMinutes);
            var status = phase === 'completed' ? 'absent' : null;
            if (nowMinutes >= minutesOf(item.checkIn)) {
                status = minutesOf(item.checkIn) - minutesOf(item.start) > lateAfterMinutes ? 'late' : 'present';
            }
            return { phase: phase, status: status };
        }

        function renderSchedule() {
            var now = new Date();
            var nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
            var currentClass = null;
            var nextClass = null;
            var finishedCount = 0;

            document.getElementById('todayRows').innerHTML = todayClasses.map(function (item) {
                var state = classState(item, nowMinutes);
                var timeNote = 'Finished';
                if (state.phase === 'upcoming') timeNote = 'Starts in ' + formatWait(minutesOf(item.start) - nowMinutes);
                if (state.phase === 'active') timeNote = 'Ends in ' + formatWait(minutesOf(item.end) - nowMinutes);
                if (state.phase === 'completed') finishedCount += 1;
                if (state.phase === 'active' && !currentClass) currentClass = item;
                if (state.phase === 'upcoming' && !nextClass) nextClass = item;

                var statusCell;
                if (state.status === 'present' || state.status === 'late') {
                    statusCell = '<span class="status-badge status-' + state.status + '">' + (state.status === 'late' ? 'Late' : 'Present') + '</span><small class="slot-note">Checked in ' + escapeHTML(formatClock(item.checkIn)) + '</small>';
                } else if (state.status === 'absent') {
                    statusCell = '<span class="status-badge status-absent">Absent</span><small class="slot-note">No check-in recorded</small>';
                } else if (state.phase === 'active') {
                    statusCell = '<span class="status-badge status-awaiting">Awaiting check-in</span><small class="slot-note">Walk past the door camera</small>';
                } else {
                    statusCell = '<span class="status-badge status-upcoming">Upcoming</span><small class="slot-note">Face scan at the door</small>';
                }

                var action = '';
                if (state.phase === 'active') action = '<span class="live-tag"><span class="live-dot"></span>In session</span>';
                if (state.phase === 'completed') action = '<a class="row-action" href="CorrReq.html?date=' + encodeURIComponent(localDateValue()) + '&course=' + encodeURIComponent(item.course) + '">Request correction</a>';

                return '<tr' + (state.phase === 'active' ? ' class="schedule-live"' : '') + '>' +
                    '<td class="course-cell"><strong><span class="course-code">' + escapeHTML(item.code) + '</span>' + escapeHTML(item.course) + '</strong><small>' + escapeHTML(item.room + ' · ' + item.instructor) + '</small></td>' +
                    '<td class="time-cell">' + escapeHTML(formatClock(item.start) + ' – ' + formatClock(item.end)) + '<small class="slot-note">' + escapeHTML(timeNote) + '</small></td>' +
                    '<td>' + statusCell + '</td>' +
                    '<td>' + action + '</td>' +
                    '</tr>';
            }).join('');

            var headingDot = document.getElementById('nextClassDot');
            var headingLabel = document.getElementById('nextClassLabel');
            if (currentClass) {
                headingDot.className = 'tiny-dot green';
                headingLabel.textContent = 'In class now · ' + currentClass.course;
            } else if (nextClass) {
                headingDot.className = 'tiny-dot blue';
                headingLabel.textContent = 'Next: ' + nextClass.course + ' at ' + formatClock(nextClass.start);
            } else {
                headingDot.className = 'tiny-dot green';
                headingLabel.textContent = 'All classes done for today';
            }

            document.getElementById('statClasses').textContent = String(todayClasses.length);
            document.getElementById('statClassesFoot').textContent = finishedCount === todayClasses.length
                ? 'All done for today'
                : finishedCount + ' done · ' + (todayClasses.length - finishedCount) + ' to go';
            document.getElementById('todayCountPill').textContent = todayClasses.length + ' classes';
        }

        // Points the quick action at the latest late or absent class that has no request yet.
        function renderCorrectionShortcut(ownRequests) {
            var requested = {};
            ownRequests.forEach(function (request) { requested[request.date + '|' + request.course] = true; });
            var flagged = null;
            historyRecords.forEach(function (record) {
                if (!flagged && record.status !== 'present' && !requested[record.date + '|' + record.course]) flagged = record;
            });

            var card = document.getElementById('shortcutCorrection');
            card.classList.toggle('is-flagged', flagged !== null);
            card.href = flagged
                ? 'CorrReq.html?date=' + encodeURIComponent(flagged.date) + '&course=' + encodeURIComponent(flagged.course)
                : 'CorrReq.html';
            document.getElementById('shortcutCorrectionText').textContent = flagged
                ? flagged.course + ' on ' + formatShortDate(flagged.date) + ' was marked ' + flagged.status + '.'
                : 'Something looks wrong? Ask your instructor to review it.';
        }

        // Same rule as the admin portal (submittedAtOf in AdminShared.js).
        function submittedAtOf(request) {
            if (typeof request.submittedAt === 'number') return request.submittedAt;
            if (Number(request.id) > 1e12) return Number(request.id);   // CorrReq.html uses Date.now() ids
            return new Date(request.date + 'T12:00:00').getTime();
        }

        function renderRequests() {
            var ownRequests = readSavedList(requestsStorageKey, defaultRequests).filter(function (request) {
                return request && typeof request === 'object' && (!request.student || request.student === 'Ahmed Mohamed');
            });
            // Requests this student sent that a professor or admin has not approved or rejected yet.
            var pendingRequests = ownRequests.filter(function (request) { return request.status === 'pending'; });
            var statusIcons = { pending: 'late', approved: 'approved', rejected: 'absent' };

            document.getElementById('statPending').textContent = String(pendingRequests.length).padStart(2, '0');
            var pendingFoot = document.getElementById('statPendingFoot');
            if (pendingRequests.length > 0) {
                var sentTimes = pendingRequests.map(submittedAtOf).filter(function (time) { return isFinite(time); });
                var oldestSent = sentTimes.length ? new Date(Math.min.apply(null, sentTimes)) : null;
                var since = '';
                if (oldestSent) {
                    since = oldestSent.toDateString() === new Date().toDateString()
                        ? ' since today'
                        : ' since ' + oldestSent.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }
                pendingFoot.innerHTML = '<span class="tiny-dot amber"></span>' + escapeHTML('Awaiting review' + since);
            } else if (ownRequests.length > 0) {
                pendingFoot.innerHTML = '<span class="tiny-dot green"></span>All requests reviewed';
            } else {
                pendingFoot.innerHTML = '<span class="tiny-dot green"></span>No requests sent yet';
            }
            document.getElementById('requestCountPill').textContent = pendingRequests.length + ' pending';

            // Pending requests first, so the ones counted on the card are always in the list.
            var listedRequests = pendingRequests.concat(ownRequests.filter(function (request) { return request.status !== 'pending'; }));
            document.getElementById('dashRequestList').innerHTML = listedRequests.slice(0, 4).map(function (request) {
                var status = String(request.status);
                var statusName = status.charAt(0).toUpperCase() + status.slice(1);
                return '<li><a class="compact-item" href="CorrReq.html">' +
                    '<span class="notification-icon kind-' + escapeHTML(statusIcons[status] || 'info') + '">' + alertIcon(statusIcons[status]) + '</span>' +
                    '<span class="compact-copy"><strong>' + escapeHTML(request.course) + '</strong><small>' + escapeHTML(formatShortDate(request.date)) + ' · Requested as ' + escapeHTML(request.requestedStatus) + '</small></span>' +
                    '<span class="request-status ' + escapeHTML(status) + '">' + escapeHTML(statusName) + '</span></a></li>';
            }).join('');
            document.getElementById('dashRequestEmpty').hidden = ownRequests.length > 0;

            renderCorrectionShortcut(ownRequests);
        }

        function renderAlerts() {
            var latestAlerts = readSavedList(alertsStorageKey, defaultAlerts).filter(Boolean);
            var unreadCount = latestAlerts.filter(function (alert) { return alert.unread; }).length;
            var badge = document.getElementById('shortcutAlertsBadge');
            badge.textContent = String(unreadCount);
            badge.hidden = unreadCount === 0;
            document.getElementById('shortcutAlertsText').textContent = unreadCount === 0
                ? 'You’re all caught up on your classes.'
                : 'You have ' + unreadCount + ' unread update' + (unreadCount === 1 ? '' : 's') + '.';
            document.getElementById('alertCountPill').textContent = unreadCount + ' unread';

            document.getElementById('dashAlertList').innerHTML = latestAlerts.slice(0, 4).map(function (alert) {
                return '<li><a class="compact-item" href="Alerts.html">' +
                    '<span class="notification-icon kind-' + escapeHTML(alert.type) + '">' + alertIcon(alert.type) + '</span>' +
                    '<span class="compact-copy"><strong>' + escapeHTML(alert.title) + '</strong><small>' + escapeHTML(alert.time + ' · ' + alert.tag) + '</small></span>' +
                    (alert.unread ? '<span class="unread-mark"></span><span class="sr-only">Unread</span>' : '') +
                    '</a></li>';
            }).join('');
            document.getElementById('dashAlertEmpty').hidden = latestAlerts.length > 0;
        }

        function renderFaceStatus() {
            var record = studentRecord();
            var value = document.getElementById('statFace');
            var foot = document.getElementById('statFaceFoot');
            if (record && record.faceStatus === 'pending') {
                value.innerHTML = '<span class="face-dot is-pending"></span>Pending';
                foot.textContent = record.scanRequestedAt ? 'New face scan requested' : 'Face scan not completed';
            } else {
                value.innerHTML = '<span class="face-dot"></span>Enrolled';
                foot.textContent = record && record.enrolledAt
                    ? 'Check-ins active since ' + new Date(record.enrolledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'Face check-ins are active';
            }
        }

        function csvCell(value) {
            var text = String(value == null ? '' : value);
            if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;   // stop spreadsheet formula injection
            return '"' + text.replace(/"/g, '""') + '"';
        }

        function downloadAttendance() {
            var header = ['Date', 'Course Code', 'Course', 'Room', 'Check-in', 'Check-out', 'Status'];
            var rows = historyRecords.map(function (record) {
                return [record.date, record.code, record.course, record.room, record.checkIn, record.checkOut,
                    record.status.charAt(0).toUpperCase() + record.status.slice(1)];
            });
            var csv = '\ufeff' + [header].concat(rows).map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
            var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
            var link = document.createElement('a');
            link.href = url;
            link.download = 'campuslens-my-attendance-' + localDateValue() + '.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        }

        function renderDashboard() {
            renderSchedule();
            renderRequests();
            renderAlerts();
            renderFaceStatus();
        }

        document.getElementById('shortcutExport').addEventListener('click', downloadAttendance);

        // Requests, alerts and the face ID status can change from the admin portal in another tab.
        window.addEventListener('storage', function (event) {
            if (event.key === null || [alertsStorageKey, requestsStorageKey, rosterStorageKey].indexOf(event.key) !== -1) renderDashboard();
        });
        // The Back button can restore this page from memory without running it again, so refresh the counts.
        window.addEventListener('pageshow', function (event) {
            if (event.persisted) renderDashboard();
        });
        setInterval(renderSchedule, 30000);
        renderDashboard();
    }

    if (pageName === 'attendance') {
        // Check-ins made on this page: [{ date, code, course, student, checkIn, checkOut, status }], times in ms.
        var checkinsStorageKey = 'campusLensDemoCheckins';
        var studentName = 'Ahmed Mohamed';
        var classSelect = document.getElementById('classSelect');
        var cameraView = document.getElementById('cameraView');
        var video = document.getElementById('cameraVideo');
        var cameraOverlay = document.getElementById('cameraOverlay');
        var cameraPlaceholder = document.getElementById('cameraPlaceholder');
        var demoFace = document.getElementById('demoFace');
        var scanCaption = document.getElementById('scanCaption');
        var scanProgress = document.getElementById('scanProgress');
        var scanBar = document.getElementById('scanBar');
        var startCameraButton = document.getElementById('startCamera');
        var demoScanButton = document.getElementById('useDemoScan');
        var stopCameraButton = document.getElementById('stopCamera');
        var checkInButton = document.getElementById('checkInButton');
        var checkOutButton = document.getElementById('checkOutButton');
        var scanResult = document.getElementById('scanResult');
        var cameraStream = null;
        var demoMode = false;       // no camera available, so the scan is simulated
        var scanning = false;
        var scanTimer = null;
        var resetTimer = null;
        var frameCanvas = document.createElement('canvas');

        function minutesNow() {
            var now = new Date();
            return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
        }

        function formatTime(timestamp) {
            return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }

        function facePending() {
            var record = studentRecord();
            return Boolean(record && record.faceStatus === 'pending');
        }

        function todaysEntries() {
            var today = localDateValue();
            return readSavedList(checkinsStorageKey, []).filter(function (entry) {
                return entry && entry.date === today;
            });
        }

        function entryFor(code) {
            return todaysEntries().filter(function (entry) { return entry.code === code; })[0] || null;
        }

        // The class the student checked in to and has not checked out of yet.
        function openEntry() {
            return todaysEntries().filter(function (entry) { return !entry.checkOut; })[0] || null;
        }

        function saveEntry(entry) {
            var others = readSavedList(checkinsStorageKey, []).filter(function (saved) {
                return saved && !(saved.date === entry.date && saved.code === entry.code);
            });
            saveList(checkinsStorageKey, others.concat([entry]));
        }

        function selectedClass() {
            return todayClasses[classSelect.selectedIndex] || todayClasses[0];
        }

        // Open the page on the class that matters right now.
        function defaultClassIndex() {
            var now = minutesNow();
            var open = openEntry();
            var rules = [
                function (item) { return open && open.code === item.code; },
                function (item) { return classPhase(item, now) === 'active' && !entryFor(item.code); },
                function (item) { return classPhase(item, now) === 'upcoming'; },
                function (item) { var entry = entryFor(item.code); return !entry || !entry.checkOut; }
            ];
            for (var i = 0; i < rules.length; i += 1) {
                var index = todayClasses.findIndex(rules[i]);
                if (index !== -1) return index;
            }
            return todayClasses.length - 1;
        }

        function idleCaption() {
            return demoMode ? 'Demo mode · no camera needed' : 'Align your face inside the frame';
        }

        function updateControls() {
            var item = selectedClass();
            var entry = entryFor(item.code);
            var open = openEntry();
            var faceOff = facePending();
            checkInButton.disabled = scanning || faceOff || Boolean(entry) || Boolean(open);
            checkOutButton.disabled = scanning || faceOff || !entry || Boolean(entry.checkOut);
            classSelect.disabled = scanning;

            var hint;
            if (faceOff) hint = 'Your Face ID is pending, so face check-in is turned off. Contact the admin office to finish your enrollment.';
            else if (entry && entry.checkOut) hint = 'You checked out of ' + item.course + ' at ' + formatTime(entry.checkOut) + '. Attendance for this class is complete.';
            else if (entry) hint = 'You checked in at ' + formatTime(entry.checkIn) + '. Scan again to check out when class ends.';
            else if (open) hint = 'You’re still checked in to ' + open.course + '. Check out of it before you check in to another class.';
            else if (minutesNow() - minutesOf(item.start) > lateAfterMinutes) hint = item.course + ' started at ' + formatClock(item.start) + ', so checking in now counts as late.';
            else hint = 'Check in within ' + lateAfterMinutes + ' minutes of the ' + formatClock(item.start) + ' start to be marked present.';
            document.getElementById('scanHint').textContent = hint;

            stopCameraButton.hidden = !cameraStream && !demoMode;
            stopCameraButton.disabled = scanning;
            stopCameraButton.textContent = demoMode ? 'Exit demo' : 'Turn off camera';
            document.getElementById('cameraDot').className = 'tiny-dot ' + (cameraStream ? 'green' : demoMode ? 'blue' : 'gray');
            document.getElementById('cameraLabel').textContent = cameraStream ? 'Camera on' : demoMode ? 'Demo scan' : 'Camera off';
        }

        function renderClassCard() {
            var item = selectedClass();
            var entry = entryFor(item.code);
            var now = minutesNow();
            var phase = classPhase(item, now);
            var phaseText = '<span class="tiny-dot gray"></span>Ended ' + escapeHTML(formatClock(item.end));
            if (phase === 'upcoming') phaseText = '<span class="tiny-dot blue"></span>Starts in ' + escapeHTML(formatWait(minutesOf(item.start) - now));
            if (phase === 'active') phaseText = '<span class="tiny-dot green"></span>In session · ' + escapeHTML(formatWait(minutesOf(item.end) - now)) + ' left';

            document.getElementById('classTitle').textContent = item.course;
            document.getElementById('classMeta').textContent = item.code + ' · ' + item.room + ' · ' + item.instructor;
            document.getElementById('factTime').textContent = formatClock(item.start) + ' – ' + formatClock(item.end);
            document.getElementById('factPhase').innerHTML = phaseText;
            document.getElementById('factCheckIn').textContent = entry
                ? formatTime(entry.checkIn) + ' · ' + (entry.status === 'late' ? 'Late' : 'Present')
                : 'Not yet';
            document.getElementById('factCheckOut').textContent = entry && entry.checkOut ? formatTime(entry.checkOut) : '—';
            document.getElementById('factFace').innerHTML = facePending()
                ? '<span class="tiny-dot amber"></span>Pending'
                : '<span class="tiny-dot green"></span>Enrolled';
        }

        function renderLog() {
            var now = minutesNow();
            var checkedIn = 0;
            document.getElementById('checkinRows').innerHTML = todayClasses.map(function (item) {
                var entry = entryFor(item.code);
                var phase = classPhase(item, now);
                var status;
                if (entry) {
                    checkedIn += 1;
                    status = '<span class="status-badge status-' + escapeHTML(entry.status) + '">' + (entry.status === 'late' ? 'Late' : 'Present') + '</span>' +
                        '<small class="slot-note">' + (entry.checkOut ? 'Checked out' : 'Still in class') + '</small>';
                } else if (phase === 'active') {
                    status = '<span class="status-badge status-awaiting">Awaiting check-in</span>';
                } else if (phase === 'upcoming') {
                    status = '<span class="status-badge status-upcoming">Upcoming</span>';
                } else {
                    status = '<span class="status-badge status-absent">Not checked in</span>';
                }
                return '<tr' + (phase === 'active' ? ' class="schedule-live"' : '') + '>' +
                    '<td class="course-cell"><strong><span class="course-code">' + escapeHTML(item.code) + '</span>' + escapeHTML(item.course) + '</strong><small>' + escapeHTML(item.room + ' · ' + item.instructor) + '</small></td>' +
                    '<td class="time-cell">' + escapeHTML(formatClock(item.start) + ' – ' + formatClock(item.end)) + '</td>' +
                    '<td class="time-cell">' + (entry ? escapeHTML(formatTime(entry.checkIn)) : '—') + '</td>' +
                    '<td class="time-cell">' + (entry && entry.checkOut ? escapeHTML(formatTime(entry.checkOut)) : '—') + '</td>' +
                    '<td>' + status + '</td>' +
                    '</tr>';
            }).join('');
            document.getElementById('checkinCountPill').textContent = checkedIn + ' of ' + todayClasses.length + ' checked in';
        }

        function renderHeadingStatus() {
            var open = openEntry();
            document.getElementById('attendanceStatusDot').className = 'tiny-dot ' + (open ? 'green' : 'blue');
            document.getElementById('attendanceStatusLabel').textContent = open ? 'Checked in · ' + open.course : 'Not checked in';
        }

        function renderPage() {
            renderClassCard();
            renderLog();
            renderHeadingStatus();
            updateControls();
        }

        function setViewState(state, caption) {
            var placeholderShown = ['off', 'starting', 'error', 'done'].indexOf(state) !== -1;
            cameraView.setAttribute('data-state', state);
            cameraPlaceholder.hidden = !placeholderShown;
            cameraOverlay.hidden = placeholderShown;
            video.hidden = placeholderShown || demoMode;
            demoFace.toggleAttribute('hidden', !demoMode);   // an <svg> has no .hidden property
            document.getElementById('cameraBadgeText').textContent = demoMode ? 'DEMO' : 'LIVE';
            scanProgress.hidden = ['scanning', 'verified', 'failed'].indexOf(state) === -1;
            if (caption) scanCaption.textContent = caption;
            updateControls();
        }

        function showPlaceholder(state, title, text) {
            document.getElementById('placeholderTitle').textContent = title;
            document.getElementById('placeholderText').textContent = text;
            document.getElementById('startCameraLabel').textContent = state === 'error' ? 'Try again' : 'Start camera';
            startCameraButton.hidden = state === 'starting';
            demoScanButton.hidden = state !== 'error';
            setViewState(state);
        }

        function showCameraOff() {
            showPlaceholder('off', 'Your camera is off', 'Start the camera to preview your face, or press Check in and it will turn on by itself.');
        }

        function stopCamera() {
            if (cameraStream) {
                cameraStream.getTracks().forEach(function (track) { track.stop(); });
                cameraStream = null;
            }
            video.srcObject = null;
        }

        function openCamera() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                return Promise.reject({ name: 'NotSupportedError' });
            }
            showPlaceholder('starting', 'Starting your camera…', 'If your browser asks, allow camera access for this page.');
            return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then(function (stream) {
                cameraStream = stream;
                demoMode = false;
                video.srcObject = stream;
                return video.play().catch(function () { /* muted inline video still shows frames */ });
            }).then(function () {
                setViewState('live', idleCaption());
            });
        }

        function showCameraError(error) {
            var name = error && error.name;
            var title = 'The camera didn’t start';
            var text = 'Try again, or continue with a demo scan.';
            if (name === 'NotAllowedError' || name === 'SecurityError') {
                title = 'Camera access is blocked';
                text = 'Allow camera access from your browser’s address bar and try again, or continue with a demo scan.';
            } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
                title = 'No camera found';
                text = 'Connect a camera and try again, or continue with a demo scan.';
            } else if (name === 'NotReadableError') {
                title = 'Your camera is busy';
                text = 'Another app may be using the camera. Close it and try again, or continue with a demo scan.';
            } else if (name === 'NotSupportedError') {
                title = 'Camera not available here';
                text = 'This browser can’t open the camera on this page. Continue with a demo scan instead.';
            }
            stopCamera();
            showPlaceholder('error', title, text);
        }

        // Stand-in for face detection: a covered or pitch-dark camera fails the scan.
        function frameIsTooDark() {
            if (!cameraStream || !video.videoWidth) return false;
            try {
                frameCanvas.width = 32;
                frameCanvas.height = 24;
                var context = frameCanvas.getContext('2d');
                context.drawImage(video, 0, 0, 32, 24);
                var pixels = context.getImageData(0, 0, 32, 24).data;
                var brightness = 0;
                for (var i = 0; i < pixels.length; i += 4) {
                    brightness += pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
                }
                return brightness / (pixels.length / 4) < 28;
            } catch (error) {
                return false;
            }
        }

        function showResult(kind, title, text) {
            scanResult.innerHTML = '<div class="scan-result kind-' + escapeHTML(kind) + '">' +
                '<span class="notification-icon kind-' + escapeHTML(kind) + '">' + alertIcon(kind) + '</span>' +
                '<div><strong>' + escapeHTML(title) + '</strong><p>' + escapeHTML(text) + '</p></div></div>';
        }

        function recordCheckIn(item) {
            var now = Date.now();
            var late = minutesNow() - minutesOf(item.start) > lateAfterMinutes;
            saveEntry({ date: localDateValue(), code: item.code, course: item.course, student: studentName, checkIn: now, checkOut: null, status: late ? 'late' : 'present' });
            if (late) showResult('late', 'Checked in at ' + formatTime(now), item.course + ' started at ' + formatClock(item.start) + ', so this counts as a late arrival.');
            else showResult('approved', 'Checked in at ' + formatTime(now), 'You’re marked present for ' + item.course + '. Have a great class!');
        }

        function recordCheckOut(item) {
            var entry = entryFor(item.code);
            var now = Date.now();
            if (!entry) return;
            entry.checkOut = now;
            saveEntry(entry);
            showResult('approved', 'Checked out at ' + formatTime(now), 'You were in ' + item.course + ' for ' + formatWait((now - entry.checkIn) / 60000) + '. See you next time!');
        }

        function wait(milliseconds) {
            return new Promise(function (resolve) { scanTimer = setTimeout(resolve, milliseconds); });
        }

        function restartProgress(percent) {
            scanBar.style.transition = 'none';
            scanBar.style.width = '0';
            void scanBar.offsetWidth;   // apply the reset before animating again
            scanBar.style.transition = '';
            scanBar.style.width = percent + '%';
        }

        // After a successful scan the camera turns itself off.
        function finishScan(mode) {
            if (demoMode) {
                setViewState('live', idleCaption());
                return;
            }
            stopCamera();
            if (mode === 'out') showPlaceholder('done', 'You’re checked out', 'The camera turned off for your privacy. See you at your next class.');
            else showPlaceholder('done', 'You’re checked in', 'The camera turned off for your privacy. Press Check out when class ends.');
        }

        function runScan(mode) {
            var item = selectedClass();
            if (scanning) return;
            clearTimeout(resetTimer);
            scanning = true;
            scanResult.innerHTML = '';
            updateControls();

            var cameraReady = cameraStream || demoMode ? Promise.resolve() : openCamera();
            cameraReady.then(function () {
                setViewState('scanning', 'Looking for your face…');
                restartProgress(40);
                return wait(1000);
            }).then(function () {
                if (frameIsTooDark()) return Promise.reject('no-face');
                setViewState('scanning', 'Matching with your Face ID…');
                scanBar.style.width = '85%';
                return wait(1100);
            }).then(function () {
                scanning = false;
                scanBar.style.width = '100%';
                if (mode === 'in') recordCheckIn(item);
                else recordCheckOut(item);
                setViewState('verified', 'Verified · ' + studentName);
                renderPage();
                resetTimer = setTimeout(function () { finishScan(mode); }, 2600);
            }).catch(function (error) {
                scanning = false;
                if (error === 'no-face') {
                    setViewState('failed', 'No face detected');
                    showResult('absent', 'We couldn’t see your face', 'Make sure your face is well lit and not covered, then try again.');
                    resetTimer = setTimeout(function () { setViewState('live', idleCaption()); }, 2200);
                } else {
                    showCameraError(error);
                }
            });
        }

        classSelect.innerHTML = todayClasses.map(function (item) {
            return '<option value="' + escapeHTML(item.code) + '">' + escapeHTML(item.code + ' · ' + item.course) + '</option>';
        }).join('');
        classSelect.selectedIndex = defaultClassIndex();

        classSelect.addEventListener('change', function () {
            scanResult.innerHTML = '';
            renderPage();
        });
        checkInButton.addEventListener('click', function () { runScan('in'); });
        checkOutButton.addEventListener('click', function () { runScan('out'); });
        startCameraButton.addEventListener('click', function () {
            clearTimeout(resetTimer);
            openCamera().catch(showCameraError);
        });
        demoScanButton.addEventListener('click', function () {
            demoMode = true;
            setViewState('live', idleCaption());
        });
        stopCameraButton.addEventListener('click', function () {
            clearTimeout(resetTimer);
            stopCamera();
            demoMode = false;
            showCameraOff();
        });

        // Check-ins and the face ID status can change in another tab (admin portal or a second copy of this page).
        window.addEventListener('storage', function (event) {
            if (event.key === null || event.key === checkinsStorageKey || event.key === rosterStorageKey) renderPage();
        });
        // Never leave the camera running after the student leaves the page.
        window.addEventListener('pagehide', function () {
            clearTimeout(scanTimer);
            clearTimeout(resetTimer);
            stopCamera();
        });
        window.addEventListener('pageshow', function (event) {
            if (!event.persisted) return;
            scanning = false;
            demoMode = false;
            showCameraOff();
            renderPage();
        });
        setInterval(renderPage, 30000);

        showCameraOff();
        renderPage();
    }
}());
