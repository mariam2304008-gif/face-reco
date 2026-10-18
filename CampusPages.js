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

    showToday();

    var savedAlerts = readSavedList(alertsStorageKey, null);
    var savedUnreadCount = savedAlerts
        ? savedAlerts.filter(function (alert) { return alert.unread; }).length
        : 3;
    updateUnreadBadges(savedUnreadCount);

    if (pageName === 'history') {
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
        var defaultAlerts = [
            { id: 1, type: 'late', title: 'Late check-in recorded', message: 'Your Database Systems attendance on October 14 was recorded at 11:08 AM. If this looks incorrect, you can request a review.', tag: 'Database Systems · CS 305', time: 'Oct 14 · 11:10 AM', unread: true, action: 'History' },
            { id: 2, type: 'reminder', title: 'Class starts in 30 minutes', message: 'Software Engineering with Dr. Samir Hassan begins at 9:00 AM in Hall NB2. Have a great class.', tag: 'Software Engineering · SWE 320', time: 'Oct 16 · 8:30 AM', unread: true, action: 'History' },
            { id: 3, type: 'absent', title: 'Attendance marked absent', message: 'You were marked absent for Data Structures on October 8. If you attended class, you can send a correction request.', tag: 'Data Structures · CS 220', time: 'Oct 8 · 10:50 AM', unread: true, action: 'Correction request' },
            { id: 4, type: 'approved', title: 'Correction request approved', message: 'Your attendance correction for Computer Networks on September 28 has been approved by your instructor.', tag: 'Computer Networks · CS 340', time: 'Oct 1 · 2:15 PM', unread: false, action: 'History' },
            { id: 5, type: 'info', title: 'Your weekly summary is ready', message: 'You attended 5 out of 6 scheduled classes last week. Your attendance rate is currently 90%.', tag: 'Weekly summary', time: 'Sep 29 · 9:00 AM', unread: false, action: 'History' },
            { id: 6, type: 'reminder', title: 'Correction request received', message: 'Your request for Database Systems on September 24 is in review. We’ll let you know when it has been updated.', tag: 'Database Systems · CS 305', time: 'Sep 25 · 12:20 PM', unread: false, action: 'Correction request' }
        ];
        var alerts = readSavedList(alertsStorageKey, defaultAlerts);
        var activeAlertFilter = 'all';
        var alertList = document.getElementById('notificationList');
        var alertEmpty = document.getElementById('notificationEmpty');

        function alertIcon(type) {
            var icons = {
                late: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
                absent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/><circle cx="12" cy="12" r="9"/></svg>',
                approved: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="9"/></svg>',
                reminder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>',
                info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
            };
            return icons[type] || icons.info;
        }

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
    }

    if (pageName === 'corrections') {
        var defaultRequests = [
            { id: 1, date: '2026-10-14', course: 'Database Systems', status: 'pending', requestedStatus: 'Present', reason: 'I arrived before the class began, but my scan did not register at the entrance.', detail: 'Submitted October 14, 2026 · Waiting for instructor review.' },
            { id: 2, date: '2026-09-28', course: 'Computer Networks', status: 'approved', requestedStatus: 'Present', reason: 'The attendance system did not recognize my face during the first scan.', detail: 'Approved October 1, 2026 · Your attendance record was updated.' },
            { id: 3, date: '2026-09-24', course: 'Database Systems', status: 'rejected', requestedStatus: 'Present', reason: 'I was present in the class, but I forgot to check the attendance result.', detail: 'Reviewed September 27, 2026 · The instructor could not confirm attendance for this session.' }
        ];
        var requests = readSavedList(requestsStorageKey, defaultRequests);
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
            var pendingCount = requests.filter(function (request) { return request.status === 'pending'; }).length;
            var headingCount = document.getElementById('pendingHeadingCount');
            headingCount.textContent = pendingCount + ' pending review' + (pendingCount === 1 ? '' : 's');
            document.getElementById('requestTotalCount').textContent = String(requests.length);

            requestList.innerHTML = requests.map(function (request) {
                var statusName = request.status.charAt(0).toUpperCase() + request.status.slice(1);
                return '<article class="request-item"><div><div class="request-course">' + escapeHTML(request.course) + '</div>' +
                    '<div class="request-date">' + escapeHTML(formatLongDate(request.date)) + ' · Requested as ' + escapeHTML(request.requestedStatus) + '</div>' +
                    '<p class="request-reason">' + escapeHTML(request.reason) + '</p></div>' +
                    '<span class="request-status ' + escapeHTML(request.status) + '">' + escapeHTML(statusName) + '</span>' +
                    '<details class="request-details"><summary>View details</summary><div class="request-detail-copy">' + escapeHTML(request.detail) + '</div></details></article>';
            }).join('');
            requestsEmpty.hidden = requests.length > 0;
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
}());
