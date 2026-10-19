// CampusLens admin: students and face-recognition management. Needs AdminShared.js loaded first.
// The roster lives in localStorage under 'campusLensAdminStudents'.
(function () {
    'use strict';

    var A = window.CampusLensAdmin;
    if (!A) return;

    var esc = A.escapeHTML;
    var STUDENTS_KEY = 'campusLensAdminStudents';
    var MINUTE = 60000;
    var HOUR = 3600000;
    var DAY = 86400000;
    var PAGE_SIZE = 10;
    var SAMPLES_PER_STUDENT = 5;       // face images that make up one embedding in this demo
    var MAX_IMPORT_BYTES = 1048576;    // 1 MB
    var MAX_IMPORT_ROWS = 500;

    var state = { filter: 'all', search: '', dept: 'all', sort: 'name', limit: PAGE_SIZE };
    var activeId = null;
    var deptSignature = '';
    var toastTimer = null;
    var scanTimers = [];
    var scanMode = 'request';
    var pendingImport = [];

    function byId(id) { return document.getElementById(id); }

    function showToast(message) {
        var toast = byId('adminToast');
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 4200);
    }

    /* ---------- demo data ---------- */

    function emailFor(name) {
        return String(name).toLowerCase().replace(/[^a-z\s-]/g, '').trim().split(/\s+/).join('.') + '@university.edu';
    }

    function seedStudents(now) {
        function make(id, name, department, options) {
            options = options || {};
            var enrolled = options.enrolled !== false;
            var lastActive = 'lastActive' in options ? options.lastActive : 2 * HOUR;
            return {
                id: id, name: name, email: emailFor(name), department: department,
                faceStatus: enrolled ? 'enrolled' : 'pending',
                hadFaceData: enrolled,
                enrolledAt: enrolled ? now - (options.enrolledDays || 30) * DAY : null,
                scanRequestedAt: null,
                lastActive: lastActive === null ? null : now - lastActive,
                active: options.active !== false
            };
        }
   return [
            make('20230417', 'Ahmed Mohamed', 'Computer Science', { lastActive: 35 * MINUTE, enrolledDays: 62 }),
            make('20230562', 'Sara Khaled', 'Mass Communication', { lastActive: 3 * HOUR, enrolledDays: 58 }),
            make('20230188', 'Omar Hassan', 'Dentistry', { lastActive: 26 * HOUR, enrolledDays: 61 }),
            make('20230731', 'Mariam Adel', 'Alsun / Languages', { lastActive: 5 * HOUR, enrolledDays: 49 }),
            make('20230245', 'Youssef Nabil', 'Business Administration', { lastActive: 50 * HOUR, enrolledDays: 55 }),
            make('20230619', 'Nour El-Din', 'Dentistry', { enrolled: false, lastActive: 3 * DAY }),
            make('20230854', 'Hana Mostafa', 'Mass Communication', { lastActive: HOUR, enrolledDays: 40 }),
            make('20230372', 'Karim Samir', 'Business Administration', { lastActive: 9 * DAY, enrolledDays: 60, active: false }),
            make('20230908', 'Laila Fathy', 'Business Administration', { enrolled: false, lastActive: 6 * DAY }),
            make('20230126', 'Tamer Ibrahim', 'Computer Science', { lastActive: 28 * HOUR, enrolledDays: 64 }),
            make('20230497', 'Dina Ashraf', 'Alsun / Languages', { lastActive: 2 * HOUR, enrolledDays: 47 }),
            make('20230683', 'Mostafa Zaki', 'Dentistry', { lastActive: 4 * DAY, enrolledDays: 52 }),
            make('20231015', 'Rana Hesham', 'Mass Communication', { enrolled: false, lastActive: null }),
            make('20230531', 'Adam Salem', 'Alsun / Languages', { lastActive: 12 * HOUR, enrolledDays: 44 })
        ];
    }

    function getStudents() {
        return A.readSavedList(STUDENTS_KEY, []).filter(function (student) {
            return student && typeof student === 'object' && student.id;
        });
    }

    function saveStudents(list) { A.saveList(STUDENTS_KEY, list); }

    function ensureSeeded() {
        if (!A.readSavedList(STUDENTS_KEY, null)) saveStudents(seedStudents(Date.now()));
    }

    function findStudent(id) {
        var list = getStudents();
        for (var i = 0; i < list.length; i += 1) {
            if (String(list[i].id) === String(id)) return list[i];
        }
        return null;
    }

    // Reads fresh data, applies a change, saves, returns the updated student.
    function updateStudent(id, change) {
        var list = getStudents();
        var target = null;
        list.forEach(function (student) { if (String(student.id) === String(id)) target = student; });
        if (!target) return null;
        change(target);
        saveStudents(list);
        return target;
    }

    /* ---------- formatting ---------- */

    function lastActiveParts(timestamp, now) {
        if (!timestamp) return { main: 'Never', sub: 'No sign-in yet' };
        var date = new Date(timestamp);
        var today = new Date(now);
        var startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        var time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        var main;
        if (timestamp >= startOfToday) main = 'Today, ' + time;
        else if (timestamp >= startOfToday - DAY) main = 'Yesterday, ' + time;
        else main = A.formatShortDate(A.localDateValue(timestamp));
        return { main: main, sub: A.formatDuration(now - timestamp) + ' ago' };
    }

    function pad2(number) { return String(number).padStart(2, '0'); }

    function minutesToClock(totalMinutes) {
        var hours = Math.floor(totalMinutes / 60);
        var minutes = totalMinutes % 60;
        return pad2((hours + 11) % 12 + 1) + ':' + pad2(minutes) + ' ' + (hours >= 12 ? 'PM' : 'AM');
    }

    function hash(text) {
        var value = 7;
        for (var i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) >>> 0;
        return value;
    }

    /* ---------- rendering ---------- */

    function matchesFilter(student) {
        if (state.filter === 'enrolled') return student.faceStatus === 'enrolled';
        if (state.filter === 'pending') return student.faceStatus === 'pending';
        if (state.filter === 'suspended') return !student.active;
        return true;
    }

    function matchesSearch(student) {
        if (!state.search) return true;
        var haystack = (student.name + ' ' + student.id + ' ' + student.email + ' ' + student.department).toLowerCase();
        return haystack.indexOf(state.search) !== -1;
    }

    function sortStudents(list) {
        list.sort(function (a, b) {
            if (state.sort === 'active') return (b.lastActive || 0) - (a.lastActive || 0);
            if (state.sort === 'pending') {
                var pendingA = a.faceStatus === 'pending' ? 0 : 1;
                var pendingB = b.faceStatus === 'pending' ? 0 : 1;
                if (pendingA !== pendingB) return pendingA - pendingB;
            }
            return a.name.localeCompare(b.name);
        });
        return list;
    }

    var ICONS = {
        history: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
        scan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="11" r="2.5"/><path d="M8 17c1-2 2.2-2.5 4-2.5s3 .5 4 2.5"/></svg>',
        suspend: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>',
        restore: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/></svg>'
    };

    function actionButton(kind, label, id, extraClass) {
        return '<button class="um-btn ' + (extraClass || '') + '" type="button" data-action="' + kind + '" data-id="' + esc(id) + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' +
            ICONS[kind === 'toggle' ? (extraClass === 'success' ? 'restore' : 'suspend') : kind] + '<span class="um-btn-label">' + esc(label) + '</span></button>';
    }

    function render() {
        var now = Date.now();
        var all = getStudents();

        var enrolled = all.filter(function (student) { return student.faceStatus === 'enrolled'; }).length;
        var pending = all.filter(function (student) { return student.faceStatus === 'pending'; }).length;
        var suspended = all.filter(function (student) { return !student.active; }).length;
        var rate = all.length ? Math.round((enrolled / all.length) * 100) : 0;

        byId('umTotal').textContent = String(all.length);
        byId('umEnrolled').innerHTML = enrolled + '<span class="summary-total">/' + all.length + '</span>';
        byId('umRateTrack').style.width = rate + '%';
        byId('umRateFoot').textContent = rate + '% of students enrolled';
        byId('umPending').textContent = String(pending).padStart(2, '0');
        byId('umSuspended').textContent = String(suspended).padStart(2, '0');

        var latestIndex = 0;
        all.forEach(function (student) { if (student.enrolledAt && student.enrolledAt > latestIndex) latestIndex = student.enrolledAt; });
        byId('dbEmbeddings').textContent = String(enrolled * SAMPLES_PER_STUDENT);
        byId('dbStudents').textContent = String(enrolled);
        byId('dbIndexed').textContent = latestIndex ? A.formatDateTime(latestIndex) : 'Never';

        var tabCounts = { all: all.length, enrolled: enrolled, pending: pending, suspended: suspended };
        document.querySelectorAll('[data-count]').forEach(function (element) {
            element.textContent = String(tabCounts[element.getAttribute('data-count')]);
        });
        document.querySelectorAll('[data-um-filter]').forEach(function (tab) {
            var isActive = tab.getAttribute('data-um-filter') === state.filter;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-pressed', String(isActive));
        });

        // Rebuild the department list only when it changes, so an open dropdown is not reset.
        var departments = [];
        all.forEach(function (student) { if (departments.indexOf(student.department) === -1) departments.push(student.department); });
        departments.sort();
        var signature = departments.join('|');
        var deptSelect = byId('deptFilter');
        if (signature !== deptSignature) {
            deptSignature = signature;
            deptSelect.innerHTML = '<option value="all">All departments</option>' + departments.map(function (department) {
                return '<option value="' + esc(department) + '">' + esc(department) + '</option>';
            }).join('');
        }
        if (state.dept !== 'all' && departments.indexOf(state.dept) === -1) state.dept = 'all';
        deptSelect.value = state.dept;

        var filtered = sortStudents(all.filter(function (student) {
            return matchesFilter(student) && matchesSearch(student) && (state.dept === 'all' || student.department === state.dept);
        }));
        var visible = filtered.slice(0, state.limit);

        byId('studentRows').innerHTML = visible.map(function (student) {
            var activity = lastActiveParts(student.lastActive, now);
            var isEnrolled = student.faceStatus === 'enrolled';
            var faceNote;
            if (isEnrolled) faceNote = 'Enrolled ' + A.formatShortDate(A.localDateValue(student.enrolledAt || now));
            else if (student.scanRequestedAt) faceNote = 'Link sent ' + A.formatDuration(now - student.scanRequestedAt) + ' ago';
            else faceNote = 'Not enrolled yet';

            var tag = student.active ? '' : '<span class="um-tag" title="' + esc(student.suspendReason || 'Suspended by an administrator') + '">Suspended</span>';
            var toggle = student.active
                ? actionButton('toggle', 'Suspend', student.id, 'danger')
                : actionButton('toggle', 'Reactivate', student.id, 'success');

            return '<tr class="' + (student.active ? '' : 'um-suspended') + '">' +
                '<td class="um-student" data-label="Student"><div class="um-person"><span class="sla-avatar">' + esc(A.initialsOf(student.name)) + '</span>' +
                '<span class="um-person-copy"><strong>' + esc(student.name) + tag + '</strong><small>' + esc(student.email) + '</small></span></div></td>' +
                '<td class="time-cell" data-label="ID">' + esc(student.id) + '</td>' +
                '<td data-label="Department">' + esc(student.department) + '</td>' +
                '<td data-label="Face data"><span class="um-cell-stack"><span class="status-badge status-' + (isEnrolled ? 'enrolled' : 'pending') + '">' + (isEnrolled ? 'Enrolled' : 'Pending') + '</span><small class="cell-note">' + esc(faceNote) + '</small></span></td>' +
                '<td data-label="Last active"><span class="um-cell-stack"><span class="um-main">' + esc(activity.main) + '</span><small class="cell-note">' + esc(activity.sub) + '</small></span></td>' +
                '<td class="um-actions-cell" data-label="Actions"><div class="um-actions">' +
                actionButton('history', 'History', student.id) + actionButton('scan', 'Re-scan', student.id) + toggle +
                '</div></td></tr>';
        }).join('');

        byId('studentsEmpty').hidden = filtered.length > 0;
        byId('studentsTableWrap').hidden = filtered.length === 0;
        byId('loadMoreWrap').hidden = visible.length >= filtered.length;
        byId('studentsFooter').textContent = 'Showing ' + visible.length + ' of ' + filtered.length + ' student' + (filtered.length === 1 ? '' : 's') +
            (filtered.length !== all.length ? ' (' + all.length + ' registered)' : '');
        byId('liveSyncLabel').textContent = 'Live · updated ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    /* ---------- dialogs ---------- */

    function openDialog(dialog) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
    }

    function closeDialog(dialog) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    }

    document.addEventListener('click', function (event) {
        var closer = event.target.closest('[data-close-dialog]');
        if (closer) {
            var owner = closer.closest('dialog');
            if (owner) closeDialog(owner);
            return;
        }
        if (event.target.tagName === 'DIALOG') closeDialog(event.target);   // click on the dim backdrop
    });

    /* ---------- attendance history ---------- */

    var CORE_COURSES = [
        { code: 'SWE 320', name: 'Software Engineering', room: 'Hall NB2', start: '09:00', end: '10:45' },
        { code: 'CS 305', name: 'Database Systems', room: 'Lab A14', start: '11:00', end: '12:45' },
        { code: 'CS 340', name: 'Computer Networks', room: 'Hall C03', start: '08:30', end: '10:15' },
        { code: 'AI 410', name: 'Artificial Intelligence', room: 'Hall NB1', start: '13:00', end: '14:45' },
        { code: 'CS 220', name: 'Data Structures', room: 'Lab B06', start: '15:00', end: '16:45' }
    ];
    var HISTORY_DATES = ['2026-10-16', '2026-10-14', '2026-10-12', '2026-10-10', '2026-10-08', '2026-10-06', '2026-10-04', '2026-10-02'];

    // Same sessions the student portal shows for Ahmed Mohamed (see CampusPages.js).
    var AHMED_RECORDS = [
        { date: '2026-10-16', course: 'Software Engineering', code: 'SWE 320', room: 'Hall NB2', checkIn: '09:02 AM', checkOut: '10:48 AM', status: 'present' },
        { date: '2026-10-14', course: 'Database Systems', code: 'CS 305', room: 'Lab A14', checkIn: '11:08 AM', checkOut: '12:52 PM', status: 'late' },
        { date: '2026-10-12', course: 'Computer Networks', code: 'CS 340', room: 'Hall C03', checkIn: '08:54 AM', checkOut: '10:35 AM', status: 'present' },
        { date: '2026-10-10', course: 'Artificial Intelligence', code: 'AI 410', room: 'Hall NB1', checkIn: '01:02 PM', checkOut: '02:46 PM', status: 'present' },
        { date: '2026-10-08', course: 'Data Structures', code: 'CS 220', room: 'Lab B06', checkIn: '—', checkOut: '—', status: 'absent' },
        { date: '2026-10-06', course: 'Software Engineering', code: 'SWE 320', room: 'Hall NB2', checkIn: '08:57 AM', checkOut: '10:41 AM', status: 'present' },
        { date: '2026-10-04', course: 'Database Systems', code: 'CS 305', room: 'Lab A14', checkIn: '11:01 AM', checkOut: '12:45 PM', status: 'present' },
        { date: '2026-10-02', course: 'Computer Networks', code: 'CS 340', room: 'Hall C03', checkIn: '09:00 AM', checkOut: '10:42 AM', status: 'present' }
    ];

    function buildHistory(student) {
        if (!student.hadFaceData) return [];
        var records;
        if (student.name === A.STUDENT_NAME) {
            records = AHMED_RECORDS.map(function (record) { return Object.assign({}, record); });
        } else {
            var offset = hash(student.id) % CORE_COURSES.length;
            records = HISTORY_DATES.map(function (date, index) {
                var course = CORE_COURSES[(index + offset) % CORE_COURSES.length];
                var seed = hash(student.id + date + course.code);
                var roll = seed % 100;
                var status = roll < 10 ? 'absent' : (roll < 24 ? 'late' : 'present');
                var checkIn = '—';
                var checkOut = '—';
                if (status !== 'absent') {
                    var inMinutes = A.toMinutes(course.start) + (status === 'late' ? 8 + (seed % 7) : (seed % 6) - 3);
                    checkIn = minutesToClock(inMinutes);
                    checkOut = minutesToClock(A.toMinutes(course.end) - (seed % 5));
                }
                return { date: date, course: course.name, code: course.code, room: course.room, checkIn: checkIn, checkOut: checkOut, status: status };
            });
        }

        // Approved correction requests override the original status.
        var approved = A.getRequests().filter(function (request) {
            return request.status === 'approved' && A.studentOf(request) === student.name;
        });
        records.forEach(function (record) {
            approved.forEach(function (request) {
                var requested = String(request.requestedStatus).toLowerCase();
                if (request.date === record.date && request.course === record.course && ['present', 'late', 'absent'].indexOf(requested) !== -1) {
                    record.status = requested;
                    record.corrected = true;
                }
            });
        });
        return records;
    }

    function openHistory(id) {
        var student = findStudent(id);
        if (!student) return;
        var records = buildHistory(student);

        byId('historyHeading').textContent = student.name;
        byId('historySub').textContent = 'ID ' + student.id + ' · ' + student.department;

        var present = records.filter(function (record) { return record.status === 'present'; }).length;
        var late = records.filter(function (record) { return record.status === 'late'; }).length;
        var absent = records.filter(function (record) { return record.status === 'absent'; }).length;
        var rate = records.length ? Math.round(((present + late) / records.length) * 100) : 0;

        byId('historyChips').innerHTML = [
            ['Sessions', records.length], ['Present', present], ['Late', late], ['Absent', absent], ['Rate', records.length ? rate + '%' : '—']
        ].map(function (chip) {
            return '<div class="um-chip"><strong>' + esc(chip[1]) + '</strong><span>' + esc(chip[0]) + '</span></div>';
        }).join('');

        byId('historyRows').innerHTML = records.map(function (record) {
            var weekday = new Date(record.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
            var statusName = record.status.charAt(0).toUpperCase() + record.status.slice(1);
            return '<tr>' +
                '<td class="date-cell">' + esc(A.formatShortDate(record.date)) + '<small>' + esc(weekday) + '</small></td>' +
                '<td class="course-cell"><strong>' + esc(record.course) + '</strong><small>' + esc(record.code + ' · ' + record.room) + '</small></td>' +
                '<td class="time-cell">' + esc(record.checkIn) + '</td>' +
                '<td class="time-cell">' + esc(record.checkOut) + '</td>' +
                '<td><span class="status-badge status-' + esc(record.status) + '">' + esc(statusName) + '</span>' + (record.corrected ? '<small class="cell-note">Corrected by admin</small>' : '') + '</td>' +
                '</tr>';
        }).join('');

        byId('historyTableWrap').hidden = records.length === 0;
        byId('historyEmpty').hidden = records.length > 0;
        byId('historyChips').hidden = records.length === 0;
        openDialog(byId('historyDialog'));
    }

    /* ---------- re-trigger face scan / onboarding ---------- */

    var scanDialog = byId('scanDialog');

    function clearScanTimers() {
        scanTimers.forEach(clearTimeout);
        scanTimers = [];
    }

    function setSteps(states) {
        document.querySelectorAll('#scanSteps li').forEach(function (item, index) {
            item.className = states[index] || 'idle';
        });
    }

    function setScanNote(text, isWarning) {
        var note = byId('scanNote');
        note.textContent = text;
        note.classList.toggle('warn', Boolean(isWarning));
    }

    function setScanPrimary(label, mode, disabled) {
        var button = byId('scanPrimary');
        button.textContent = label;
        button.disabled = Boolean(disabled);
        scanMode = mode;
    }

    function openScan(id) {
        var student = findStudent(id);
        if (!student) return;
        activeId = String(student.id);
        clearScanTimers();
        byId('scanHeading').textContent = student.name;
        byId('scanSub').textContent = 'ID ' + student.id + ' · ' + student.department;

        if (!student.active) {
            setScanNote('This account is suspended. Reactivate it before sending an onboarding link.', true);
            setSteps(['idle', 'idle', 'idle']);
            setScanPrimary('Send re-scan request', 'request', true);
        } else if (student.faceStatus === 'enrolled') {
            setScanNote('Sending a re-scan request removes the current face embedding (' + SAMPLES_PER_STUDENT + ' samples) until the student completes a new scan. Face check-ins pause in the meantime.', true);
            setSteps(['idle', 'idle', 'idle']);
            setScanPrimary('Send re-scan request', 'request', false);
        } else if (student.scanRequestedAt) {
            setScanNote('Onboarding link sent ' + A.formatDuration(Date.now() - student.scanRequestedAt) + ' ago. Waiting for the student to finish the scan.', false);
            setSteps(['done', 'done', 'doing']);
            setScanPrimary('Simulate scan complete', 'complete', false);
        } else {
            setScanNote('This student has not enrolled face data yet. Send an onboarding link to start.', false);
            setSteps(['idle', 'idle', 'idle']);
            setScanPrimary('Send onboarding link', 'request', false);
        }
        openDialog(scanDialog);
    }

    function startScanRequest() {
        var student = updateStudent(activeId, function (item) {
            if (!item.active) return;
            item.faceStatus = 'pending';
            item.enrolledAt = null;
            item.scanRequestedAt = Date.now();
        });
        if (!student || !student.active) return;

        if (typeof A.pushStudentAlert === 'function' && student.name === A.STUDENT_NAME) {
            A.pushStudentAlert({
                type: 'reminder',
                title: 'New face scan requested',
                message: 'An administrator asked you to complete a new face scan so your attendance can be recorded by the classroom cameras.',
                tag: 'Face enrollment',
                action: 'History'
            });
        }
        A.addLog('info', 'Face data', 'Onboarding requested for ' + student.name + ' (ID ' + student.id + ')');
        showToast('Onboarding link sent to ' + student.name + '.');
        render();

        // Cosmetic progress simulation; the state change above is already saved.
        clearScanTimers();
        setScanPrimary('Sending...', 'request', true);
        setScanNote('Preparing the onboarding request...', false);
        setSteps(['doing', 'idle', 'idle']);
        scanTimers.push(setTimeout(function () { setSteps(['done', 'doing', 'idle']); }, 800));
        scanTimers.push(setTimeout(function () { setSteps(['done', 'done', 'doing']); }, 1700));
        scanTimers.push(setTimeout(function () {
            setScanNote('Onboarding link sent just now. Waiting for the student to finish the scan.', false);
            setScanPrimary('Simulate scan complete', 'complete', false);
        }, 2300));
    }

    function completeScan() {
        var student = updateStudent(activeId, function (item) {
            item.faceStatus = 'enrolled';
            item.hadFaceData = true;
            item.enrolledAt = Date.now();
            item.scanRequestedAt = null;
        });
        if (!student) return;
        A.addLog('success', 'Face data', 'Face data enrolled for ' + student.name + ' (' + SAMPLES_PER_STUDENT + ' samples)');
        showToast(student.name + ' is now enrolled.');
        closeDialog(scanDialog);
        render();
    }

    byId('scanPrimary').addEventListener('click', function () {
        if (scanMode === 'complete') completeScan();
        else startScanRequest();
    });
    scanDialog.addEventListener('close', clearScanTimers);

    /* ---------- suspend / reactivate ---------- */

    var suspendDialog = byId('suspendDialog');
    var suspendReason = byId('suspendReason');

    function toggleAccount(id) {
        var student = findStudent(id);
        if (!student) return;
        if (student.active) {
            activeId = String(student.id);
            byId('suspendHeading').textContent = 'Suspend ' + student.name + '?';
            byId('suspendText').textContent = 'The account will be marked as suspended. You can reactivate it at any time.';
            suspendReason.value = '';
            byId('suspendCount').textContent = '0';
            openDialog(suspendDialog);
            return;
        }
        updateStudent(id, function (item) {
            item.active = true;
            delete item.suspendedAt;
            delete item.suspendReason;
        });
        A.addLog('success', 'Accounts', student.name + ' (ID ' + student.id + ') reactivated');
        showToast(student.name + ' was reactivated.');
        render();
    }

    suspendReason.addEventListener('input', function () {
        byId('suspendCount').textContent = String(suspendReason.value.length);
    });

    byId('suspendConfirm').addEventListener('click', function () {
        var reason = suspendReason.value.trim();
        var student = updateStudent(activeId, function (item) {
            item.active = false;
            item.suspendedAt = Date.now();
            item.suspendReason = reason;
        });
        closeDialog(suspendDialog);
        if (!student) return;
        A.addLog('warn', 'Accounts', student.name + ' (ID ' + student.id + ') suspended' + (reason ? ': ' + reason : ''));
        showToast(student.name + ' was suspended.');
        render();
    });

    /* ---------- export roster ---------- */

    function csvCell(value) {
        var text = String(value == null ? '' : value);
        if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;   // stop spreadsheet formula injection
        return '"' + text.replace(/"/g, '""') + '"';
    }

    function exportRoster() {
        var students = getStudents().sort(function (a, b) { return a.name.localeCompare(b.name); });
        var header = ['Student ID', 'Name', 'Email', 'Department', 'Face Data Status', 'Account Status', 'Enrolled On', 'Last Active'];
        var rows = students.map(function (student) {
            return [
                student.id, student.name, student.email, student.department,
                student.faceStatus === 'enrolled' ? 'Enrolled' : 'Pending',
                student.active ? 'Active' : 'Suspended',
                student.enrolledAt ? A.localDateValue(student.enrolledAt) : '',
                student.lastActive ? new Date(student.lastActive).toISOString() : ''
            ];
        });
        var csv = '\ufeff' + [header].concat(rows).map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'campuslens-student-roster-' + A.localDateValue() + '.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

        A.addLog('info', 'Reports', 'Student roster exported (' + rows.length + ' students)');
        showToast('Roster downloaded (' + rows.length + ' students).');
    }

    /* ---------- import students (JSON / CSV simulation) ---------- */

    var importDialog = byId('importDialog');
    var importText = byId('importText');
    var importFile = byId('importFile');
    var importConfirm = byId('importConfirm');

    var SAMPLE_IMPORT = JSON.stringify([
        { name: 'Farida Nabil', id: '20231120', department: 'Computer Science' },
        { name: 'Ziad Hamdy', id: '20231121', department: 'Cybersecurity', email: 'ziad.hamdy@university.edu' },
        { name: 'Salma Wael', id: '20231122', department: 'Information Systems' },
        { name: 'Ahmed Mohamed', id: '20230417', department: 'Computer Science' }
    ], null, 2);

    function parseCsv(text) {
        var rows = [];
        var row = [];
        var field = '';
        var inQuotes = false;
        text = text.replace(/^\ufeff/, '');
        for (var i = 0; i < text.length; i += 1) {
            var character = text.charAt(i);
            if (inQuotes) {
                if (character === '"') {
                    if (text.charAt(i + 1) === '"') { field += '"'; i += 1; } else { inQuotes = false; }
                } else {
                    field += character;
                }
            } else if (character === '"') {
                inQuotes = true;
            } else if (character === ',') {
                row.push(field);
                field = '';
            } else if (character === '\n' || character === '\r') {
                if (character === '\r' && text.charAt(i + 1) === '\n') i += 1;
                row.push(field);
                field = '';
                if (row.length > 1 || row[0] !== '') rows.push(row);
                row = [];
            } else {
                field += character;
            }
        }
        row.push(field);
        if (row.length > 1 || row[0] !== '') rows.push(row);
        return rows;
    }

    function headerKey(header) {
        var key = String(header).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (['name', 'studentname', 'fullname'].indexOf(key) !== -1) return 'name';
        if (['id', 'studentid', 'studentnumber'].indexOf(key) !== -1) return 'id';
        if (['department', 'major', 'departmentmajor'].indexOf(key) !== -1) return 'department';
        if (['email', 'emailaddress'].indexOf(key) !== -1) return 'email';
        return null;
    }

    function pickField(item, names) {
        for (var i = 0; i < names.length; i += 1) {
            if (item[names[i]] != null) return item[names[i]];
        }
        return '';
    }

    // Returns { rows: [{name,id,department,email}], error: string|null }
    function parseImport(text) {
        var trimmed = text.trim();
        if (trimmed.charAt(0) === '[' || trimmed.charAt(0) === '{') {
            var data;
            try { data = JSON.parse(trimmed); } catch (error) { return { rows: [], error: 'The data is not valid JSON.' }; }
            if (data && !Array.isArray(data) && Array.isArray(data.students)) data = data.students;
            if (!Array.isArray(data)) return { rows: [], error: 'JSON must be an array of students.' };
            return {
                rows: data.map(function (item) {
                    if (!item || typeof item !== 'object') return { name: '', id: '', department: '', email: '' };
                    return {
                        name: pickField(item, ['name', 'studentName', 'fullName']),
                        id: pickField(item, ['id', 'studentId', 'studentID']),
                        department: pickField(item, ['department', 'major']),
                        email: pickField(item, ['email'])
                    };
                }),
                error: null
            };
        }

        var table = parseCsv(trimmed);
        if (table.length < 2) return { rows: [], error: 'CSV needs a header row and at least one student.' };
        var keys = table[0].map(headerKey);
        if (keys.indexOf('name') === -1 || keys.indexOf('id') === -1) {
            return { rows: [], error: 'CSV must have "name" and "id" columns (department and email are optional).' };
        }
        return {
            rows: table.slice(1).map(function (cells) {
                var item = { name: '', id: '', department: '', email: '' };
                keys.forEach(function (key, index) { if (key) item[key] = cells[index] || ''; });
                return item;
            }),
            error: null
        };
    }

    function validateImport(parsed) {
        var existing = {};
        getStudents().forEach(function (student) { existing[String(student.id)] = true; });
        var seen = {};
        var result = { valid: [], duplicates: 0, issues: [], invalid: 0 };
        var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        parsed.rows.forEach(function (raw, index) {
            var line = 'Row ' + (index + 1);
            var name = String(raw.name || '').trim();
            var id = String(raw.id || '').trim();
            var department = String(raw.department || '').trim() || 'Undeclared';
            var email = String(raw.email || '').trim().toLowerCase();

            if (name.length < 2 || name.length > 60) { result.invalid += 1; result.issues.push(line + ': name must be 2 to 60 characters.'); return; }
            if (!/^\d{6,10}$/.test(id)) { result.invalid += 1; result.issues.push(line + ': ID must be 6 to 10 digits.'); return; }
            if (department.length > 60) { result.invalid += 1; result.issues.push(line + ': department is too long.'); return; }
            if (email && !emailPattern.test(email)) { result.invalid += 1; result.issues.push(line + ': email is not valid.'); return; }
            if (existing[id]) { result.duplicates += 1; result.issues.push(line + ': ID ' + id + ' is already registered (skipped).'); return; }
            if (seen[id]) { result.duplicates += 1; result.issues.push(line + ': ID ' + id + ' appears twice in the file (skipped).'); return; }
            seen[id] = true;
            result.valid.push({ name: name, id: id, department: department, email: email || emailFor(name) });
        });
        return result;
    }

    function resetImportPreview() {
        pendingImport = [];
        importConfirm.disabled = true;
        importConfirm.textContent = 'Import students';
        byId('importResult').hidden = true;
    }

    function previewImport() {
        var text = importText.value;
        var box = byId('importResult');
        box.hidden = false;
        pendingImport = [];
        importConfirm.disabled = true;
        importConfirm.textContent = 'Import students';

        if (!text.trim()) {
            box.innerHTML = '<strong>Nothing to preview.</strong> Choose a file, paste data, or load the sample.';
            return;
        }
        var parsed = parseImport(text);
        if (parsed.error) {
            box.innerHTML = '<strong>Could not read the data.</strong> ' + esc(parsed.error);
            return;
        }
        if (parsed.rows.length > MAX_IMPORT_ROWS) {
            box.innerHTML = '<strong>Too many rows.</strong> Import up to ' + MAX_IMPORT_ROWS + ' students at a time.';
            return;
        }
        var result = validateImport(parsed);
        pendingImport = result.valid;
        var html = '<strong>' + result.valid.length + ' ready to import</strong> · ' + result.duplicates + ' duplicate' + (result.duplicates === 1 ? '' : 's') + ' skipped · ' + result.invalid + ' invalid';
        if (result.issues.length) {
            html += '<ul class="um-issues">' + result.issues.slice(0, 6).map(function (issue) { return '<li>' + esc(issue) + '</li>'; }).join('') +
                (result.issues.length > 6 ? '<li>and ' + (result.issues.length - 6) + ' more</li>' : '') + '</ul>';
        }
        box.innerHTML = html;
        if (result.valid.length > 0) {
            importConfirm.disabled = false;
            importConfirm.textContent = 'Import ' + result.valid.length + ' student' + (result.valid.length === 1 ? '' : 's');
        }
    }

    function openImport() {
        importText.value = '';
        importFile.value = '';
        resetImportPreview();
        openDialog(importDialog);
    }

    importText.addEventListener('input', resetImportPreview);
    byId('importSample').addEventListener('click', function () {
        importText.value = SAMPLE_IMPORT;
        previewImport();
    });
    byId('importPreview').addEventListener('click', previewImport);

    importFile.addEventListener('change', function () {
        var file = importFile.files && importFile.files[0];
        if (!file) return;
        var box = byId('importResult');
        if (file.size > MAX_IMPORT_BYTES) {
            resetImportPreview();
            box.hidden = false;
            box.innerHTML = '<strong>File is too large.</strong> The limit is 1 MB.';
            importFile.value = '';
            return;
        }
        if (!/\.(json|csv)$/i.test(file.name)) {
            resetImportPreview();
            box.hidden = false;
            box.innerHTML = '<strong>Unsupported file.</strong> Choose a .json or .csv file.';
            importFile.value = '';
            return;
        }
        var reader = new FileReader();
        reader.onload = function () {
            importText.value = String(reader.result || '');
            previewImport();
        };
        reader.onerror = function () {
            box.hidden = false;
            box.innerHTML = '<strong>The file could not be read.</strong>';
        };
        reader.readAsText(file);
    });

    importConfirm.addEventListener('click', function () {
        if (pendingImport.length === 0) return;
        var list = getStudents();
        var known = {};
        list.forEach(function (student) { known[String(student.id)] = true; });
        var now = Date.now();
        var added = 0;
        pendingImport.forEach(function (row) {
            if (known[row.id]) return;
            known[row.id] = true;
            added += 1;
            list.push({
                id: row.id, name: row.name, email: row.email, department: row.department,
                faceStatus: 'pending', hadFaceData: false, enrolledAt: null, scanRequestedAt: null,
                lastActive: null, active: true, importedAt: now
            });
        });
        saveStudents(list);
        closeDialog(importDialog);
        A.addLog('success', 'Roster', added + ' student' + (added === 1 ? '' : 's') + ' imported (face data pending)');
        showToast(added + ' student' + (added === 1 ? '' : 's') + ' imported. They start with face data pending.');
        state.filter = 'all';
        state.limit = PAGE_SIZE;
        render();
    });

    /* ---------- filters and events ---------- */

    document.querySelectorAll('[data-um-filter]').forEach(function (tab) {
        tab.addEventListener('click', function () {
            state.filter = tab.getAttribute('data-um-filter');
            state.limit = PAGE_SIZE;
            render();
        });
    });

    byId('studentSearch').addEventListener('input', function (event) {
        state.search = event.target.value.trim().toLowerCase();
        state.limit = PAGE_SIZE;
        render();
    });
    byId('deptFilter').addEventListener('change', function (event) {
        state.dept = event.target.value;
        state.limit = PAGE_SIZE;
        render();
    });
    byId('sortSelect').addEventListener('change', function (event) {
        state.sort = event.target.value;
        render();
    });
    function clearFilters() {
        state = { filter: 'all', search: '', dept: 'all', sort: state.sort, limit: PAGE_SIZE };
        byId('studentSearch').value = '';
        render();
    }
    byId('clearStudentFilters').addEventListener('click', clearFilters);
    byId('emptyClearFilters').addEventListener('click', clearFilters);
    byId('loadMore').addEventListener('click', function () {
        state.limit += PAGE_SIZE;
        render();
    });

    byId('studentRows').addEventListener('click', function (event) {
        var button = event.target.closest('[data-action]');
        if (!button) return;
        var id = button.getAttribute('data-id');
        var action = button.getAttribute('data-action');
        if (action === 'history') openHistory(id);
        else if (action === 'scan') openScan(id);
        else if (action === 'toggle') toggleAccount(id);
    });

    byId('exportRoster').addEventListener('click', exportRoster);
    byId('openImport').addEventListener('click', openImport);

    /* ---------- start ---------- */

    ensureSeeded();
    A.init();
    A.onChange(render);   // re-renders every 15 seconds and when another tab changes storage
    render();
}());