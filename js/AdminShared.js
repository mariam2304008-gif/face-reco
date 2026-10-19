// CampusLens admin pages: shared helpers, demo data and student <-> admin syncing.
// Student pages (CampusPages.js) and admin pages read and write the SAME localStorage
// keys for correction requests and alerts, so an action on one side shows up on the other.
(function () {
    'use strict';

    var KEYS = {
        requests: 'campusLensDemoRequests',      // shared with student CorrReq.html
        studentAlerts: 'campusLensDemoAlerts',   // shared with student Alerts.html
        courses: 'campusLensAdminCourses',
        cameras: 'campusLensAdminCameras',
        adminAlerts: 'campusLensAdminAlerts',
        logs: 'campusLensAdminLogs',
        announcements: 'campusLensAdminAnnouncements',
        seeded: 'campusLensAdminSeeded'
    };

    var STUDENT_NAME = 'Ahmed Mohamed';   // the demo student account on the student portal
    var SLA_HOURS = 48;                   // 2-3 working days promised on the student form
    var SLA_WARNING_HOURS = 24;           // "at risk" when fewer than 24h remain
    var MINUTE = 60000;
    var HOUR = 3600000;
    var changeListeners = [];

    /* ---------- storage helpers (same pattern as CampusPages.js) ---------- */

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

    function readFlag(key) {
        try { return localStorage.getItem(key) === '1'; } catch (error) { return false; }
    }

    function setFlag(key) {
        try { localStorage.setItem(key, '1'); } catch (error) { /* ignore */ }
    }

    /* ---------- formatting helpers ---------- */

    function escapeHTML(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
            var replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return replacements[character];
        });
    }

    function pad2(number) {
        return String(number).padStart(2, '0');
    }

    function localDateValue(timestamp) {
        var date = timestamp ? new Date(timestamp) : new Date();
        return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
    }

    function formatShortDate(dateText) {
        return new Date(dateText + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function formatLongDate(timestamp) {
        return new Date(timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    function formatDateTime(timestamp) {
        var date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
            date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    function formatClock(timeText) {
        var parts = timeText.split(':');
        var hours = Number(parts[0]);
        return ((hours + 11) % 12 + 1) + ':' + parts[1] + ' ' + (hours >= 12 ? 'PM' : 'AM');
    }

    function formatDuration(milliseconds) {
        var total = Math.abs(milliseconds);
        var days = Math.floor(total / (24 * HOUR));
        var hours = Math.floor((total % (24 * HOUR)) / HOUR);
        var minutes = Math.floor((total % HOUR) / MINUTE);
        if (days > 0) return days + 'd ' + hours + 'h';
        if (hours > 0) return hours + 'h ' + minutes + 'm';
        return Math.max(minutes, 1) + 'm';
    }

    function timeAgo(timestamp) {
        return formatDuration(Date.now() - timestamp) + ' ago';
    }

    function initialsOf(name) {
        return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) {
            return part.charAt(0).toUpperCase();
        }).join('');
    }

    /* ---------- demo data ---------- */

    function defaultCourses() {
        return [
            // Computer Science
            { code: 'SWE 320', name: 'Software Engineering', room: 'Hall NB2', instructor: 'Dr. Samir Hassan', start: '08:30', end: '10:15', enrolled: 92, rate: 0.957 },
            { code: 'CS 340', name: 'Computer Networks', room: 'Hall C03', instructor: 'Dr. Laila Nabil', start: '09:00', end: '10:45', enrolled: 74, rate: 0.91 },

            // Faculty of Dentistry
            { code: 'DENT 201', name: 'Oral Anatomy', room: 'Lab A14', instructor: 'Dr. Mona Farid', start: '11:00', end: '12:45', enrolled: 45, rate: 0.93 },
            { code: 'DENT 315', name: 'Operative Dentistry', room: 'Lab B06', instructor: 'Dr. Hazem Taha', start: '13:00', end: '14:45', enrolled: 40, rate: 0.88 },

            // Faculty of Mass Communication
            { code: 'MCOM 101', name: 'Intro to Media', room: 'Hall NB1', instructor: 'Dr. Tarek Nabil', start: '14:00', end: '15:45', enrolled: 85, rate: 0.92 },
            { code: 'MCOM 210', name: 'Digital Storytelling', room: 'Hall A02', instructor: 'Dr. Salma Riad', start: '15:30', end: '17:15', enrolled: 65, rate: 0.89 },

            // Faculty of Business Administration
            { code: 'BUS 210', name: 'Principles of Marketing', room: 'Hall C03', instructor: 'Dr. Sherif Adel', start: '16:00', end: '17:45', enrolled: 110, rate: 0.87 },
            { code: 'BUS 102', name: 'Financial Accounting', room: 'Hall NB3', instructor: 'Dr. Magdy Youssef', start: '17:00', end: '18:45', enrolled: 95, rate: 0.85 },

            // Faculty of Alsun / Languages
            { code: 'LANG 110', name: 'English Phonetics', room: 'Hall B01', instructor: 'Dr. Rania Ezzat', start: '18:00', end: '19:45', enrolled: 50, rate: 0.94 }
        ];
    }

    function defaultCameras() {
        var rooms = ['Hall NB2', 'Hall C03', 'Lab A14', 'Hall NB1', 'Lab B06', 'Hall A02', 'Lab C11', 'Hall NB3', 'Hall B01', 'Main Gate', 'Library Entrance', 'Student Center'];
        return rooms.map(function (room, index) {
            return { id: 'CAM-' + pad2(index + 1), room: room, online: room !== 'Lab B06' };
        });
    }

    function defaultRequests(now) {
        function stamp(text) { return new Date(text).getTime(); }
        function other(id, name, course, hoursAgo, requestedStatus, reason) {
            var submittedAt = now - hoursAgo * HOUR;
            return {
                id: id, date: localDateValue(submittedAt - 6 * HOUR), course: course, status: 'pending',
                requestedStatus: requestedStatus, reason: reason,
                detail: 'Submitted ' + formatLongDate(submittedAt) + ' · Waiting for instructor review.',
                student: name, submittedAt: submittedAt
            };
        }
        return [
            { id: 1, date: '2026-10-14', course: 'Oral Anatomy', status: 'pending', requestedStatus: 'Present', reason: 'I arrived before the class began, but my scan did not register at the entrance.', detail: 'Submitted October 14, 2026 · Waiting for instructor review.', student: STUDENT_NAME, submittedAt: stamp('2026-10-14T11:30:00') },
            { id: 2, date: '2026-09-28', course: 'Software Engineering', status: 'approved', requestedStatus: 'Present', reason: 'The attendance system did not recognize my face during the first scan.', detail: 'Approved October 1, 2026 · Your attendance record was updated.', student: STUDENT_NAME, submittedAt: stamp('2026-09-28T13:00:00') },
            { id: 3, date: '2026-09-24', course: 'Principles of Marketing', status: 'rejected', requestedStatus: 'Present', reason: 'I was present in the class, but I forgot to check the attendance result.', detail: 'Reviewed September 27, 2026 · The instructor could not confirm attendance for this session.', student: STUDENT_NAME, submittedAt: stamp('2026-09-24T12:20:00') },
            other(101, 'Sara Khaled', 'Intro to Media', 20, 'Present', 'My face scan failed twice at the door because of the glare, but I sat in the second row.'),
            other(102, 'Omar Hassan', 'Oral Anatomy', 61, 'Present', 'I was marked absent but I presented my group project during this practical lab.'),
            other(103, 'Mariam Adel', 'English Phonetics', 30, 'Late', 'I was marked absent, but I entered about ten minutes after the session started.')
        ];
    }

    function defaultAdminAlerts(now) {
        return [
            { id: 'a-sys-cam', type: 'system', title: 'Camera offline: Lab B06', message: 'The entrance camera in Lab B06 stopped responding. Face check-ins in that room are paused until it reconnects.', time: now - 95 * MINUTE, unread: true, refId: 'sys-cam-b06' },
            { id: 'a-weekly', type: 'info', title: 'Weekly attendance report ready', message: 'Last week\u2019s campus-wide attendance rate was 91%.', time: now - 26 * HOUR, unread: false, refId: 'info-weekly' }
        ];
    }

    function defaultLogs(now) {
        return [
            { id: 1, level: 'success', source: 'Recognition', message: 'Face model v2.4 health check passed', time: now - 12 * MINUTE },
            { id: 2, level: 'warn', source: 'Cameras', message: 'Lab B06 camera lost connection', time: now - 95 * MINUTE },
            { id: 3, level: 'info', source: 'Sync', message: 'Roster synced with the registrar (SIS)', time: now - 3 * HOUR },
            { id: 4, level: 'success', source: 'Attendance', message: 'Computer Networks (CS 340) closed: 67 / 74 present', time: now - 8 * HOUR },
            { id: 5, level: 'warn', source: 'Corrections', message: 'Request #1 passed its ' + SLA_HOURS + '-hour SLA', time: now - 22 * HOUR },
            { id: 6, level: 'info', source: 'Auth', message: 'Dr. Admin signed in', time: now - 26 * HOUR }
        ];
    }

    // Copy of the default alerts in CampusPages.js. Needed so that an announcement never
    // wipes the student's sample alerts when nothing has been saved yet.
    function studentAlertDefaults() {
        return [
            { id: 1, type: 'late', title: 'Late check-in recorded', message: 'Your Database Systems attendance on October 14 was recorded at 11:08 AM. If this looks incorrect, you can request a review.', tag: 'Database Systems · CS 305', time: 'Oct 14 · 11:10 AM', unread: true, action: 'History' },
            { id: 2, type: 'reminder', title: 'Class starts in 30 minutes', message: 'Software Engineering with Dr. Samir Hassan begins at 9:00 AM in Hall NB2. Have a great class.', tag: 'Software Engineering · SWE 320', time: 'Oct 16 · 8:30 AM', unread: true, action: 'History' },
            { id: 3, type: 'absent', title: 'Attendance marked absent', message: 'You were marked absent for Data Structures on October 8. If you attended class, you can send a correction request.', tag: 'Data Structures · CS 220', time: 'Oct 8 · 10:50 AM', unread: true, action: 'Correction request' },
            { id: 4, type: 'approved', title: 'Correction request approved', message: 'Your attendance correction for Computer Networks on September 28 has been approved by your instructor.', tag: 'Computer Networks · CS 340', time: 'Oct 1 · 2:15 PM', unread: false, action: 'History' },
            { id: 5, type: 'info', title: 'Your weekly summary is ready', message: 'You attended 5 out of 6 scheduled classes last week. Your attendance rate is currently 90%.', tag: 'Weekly summary', time: 'Sep 29 · 9:00 AM', unread: false, action: 'History' },
            { id: 6, type: 'reminder', title: 'Correction request received', message: 'Your request for Database Systems on September 24 is in review. We\u2019ll let you know when it has been updated.', tag: 'Database Systems · CS 305', time: 'Sep 25 · 12:20 PM', unread: false, action: 'Correction request' }
        ];
    }

    function seedAll() {
        var now = Date.now();
        var seeds = defaultRequests(now);
        var saved = readSavedList(KEYS.requests, null);

        if (!saved) {
            saveList(KEYS.requests, seeds);
        } else if (!readFlag(KEYS.seeded)) {
            // The student page may have saved its own list first: add our demo requests
            // by id and give older records the extra fields the admin side needs.
            var byId = {};
            seeds.forEach(function (seed) { byId[seed.id] = seed; });
            saved.forEach(function (request) {
                var seed = byId[request.id];
                if (seed && !request.submittedAt) request.submittedAt = seed.submittedAt;
                if (!request.student) request.student = STUDENT_NAME;
            });
            seeds.forEach(function (seed) {
                var exists = saved.some(function (request) { return request.id === seed.id; });
                if (!exists) saved.push(seed);
            });
            saveList(KEYS.requests, saved);
        }
        setFlag(KEYS.seeded);

        if (!readSavedList(KEYS.courses, null)) saveList(KEYS.courses, defaultCourses());
        if (!readSavedList(KEYS.cameras, null)) saveList(KEYS.cameras, defaultCameras());
        if (!readSavedList(KEYS.logs, null)) saveList(KEYS.logs, defaultLogs(now));
        if (!readSavedList(KEYS.adminAlerts, null)) saveList(KEYS.adminAlerts, defaultAdminAlerts(now));
    }

    /* ---------- classes and live attendance ---------- */

    function getCourses() { return readSavedList(KEYS.courses, defaultCourses()); }

    function toMinutes(timeText) {
        var parts = timeText.split(':');
        return Number(parts[0]) * 60 + Number(parts[1]);
    }

    function minutesNow(date) {
        return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
    }

    function sessionState(course, date) {
        var current = minutesNow(date);
        if (current < toMinutes(course.start)) return 'upcoming';
        if (current >= toMinutes(course.end)) return 'completed';
        return 'active';
    }

    // Demo "live" count: students trickle in during the first minutes of a class.
    function presentCount(course, date) {
        var state = sessionState(course, date);
        if (state === 'upcoming') return 0;
        var full = Math.round(course.enrolled * course.rate);
        if (state === 'completed') return full;
        var elapsed = minutesNow(date) - toMinutes(course.start);
        var ramp = Math.min(1, 0.55 + (elapsed / 12) * 0.45);
        return Math.round(full * ramp);
    }

    function getDayStats(date) {
        var now = date || new Date();
        var stats = { total: 0, active: [], upcoming: [], completed: 0, present: 0, enrolled: 0 };
        getCourses().forEach(function (course) {
            var state = sessionState(course, now);
            stats.total += 1;
            if (state === 'active') stats.active.push(course);
            else if (state === 'completed') stats.completed += 1;
            else stats.upcoming.push(course);
            if (state !== 'upcoming') {
                stats.present += presentCount(course, now);
                stats.enrolled += course.enrolled;
            }
        });
        stats.upcoming.sort(function (a, b) { return toMinutes(a.start) - toMinutes(b.start); });
        return stats;
    }

    /* ---------- facial recognition health ---------- */

    function getCameras() { return readSavedList(KEYS.cameras, defaultCameras()); }

    function getHealth(now) {
        var cameras = getCameras();
        var offline = cameras.filter(function (camera) { return !camera.online; });
        var state = offline.length === 0 ? 'operational' : (offline.length <= 2 ? 'degraded' : 'outage');
        var labels = { operational: 'Operational', degraded: 'Degraded', outage: 'Major outage' };
        return {
            state: state,
            label: labels[state],
            online: cameras.length - offline.length,
            total: cameras.length,
            offlineRooms: offline.map(function (camera) { return camera.room; }),
            latency: 190 + (Math.floor((now || Date.now()) / 15000) % 7) * 6
        };
    }

    /* ---------- correction requests and SLA ---------- */

    function getRequests() {
        return readSavedList(KEYS.requests, []).filter(function (request) {
            return request && typeof request === 'object';
        });
    }

    function submittedAtOf(request) {
        if (typeof request.submittedAt === 'number') return request.submittedAt;
        if (Number(request.id) > 1e12) return Number(request.id);   // student page uses Date.now() ids
        return new Date(request.date + 'T12:00:00').getTime();
    }

    function studentOf(request) { return request.student || STUDENT_NAME; }

    function slaInfo(request, now) {
        var remaining = SLA_HOURS * HOUR - (now - submittedAtOf(request));
        var state = remaining < 0 ? 'breached' : (remaining <= SLA_WARNING_HOURS * HOUR ? 'warning' : 'ok');
        return { remaining: remaining, state: state };
    }

    function getPendingStats(now) {
        var items = getRequests().filter(function (request) {
            return request.status === 'pending';
        }).map(function (request) {
            return { request: request, sla: slaInfo(request, now) };
        }).sort(function (a, b) { return a.sla.remaining - b.sla.remaining; });
        return {
            count: items.length,
            breached: items.filter(function (item) { return item.sla.state === 'breached'; }).length,
            warning: items.filter(function (item) { return item.sla.state === 'warning'; }).length,
            items: items
        };
    }

    /* ---------- admin alerts and logs ---------- */

    function getAdminAlerts() {
        return readSavedList(KEYS.adminAlerts, []).sort(function (a, b) { return b.time - a.time; });
    }

    // Turns student actions into admin alerts: one per new pending request and one per SLA breach.
    function syncRequestAlerts(now) {
        var alerts = readSavedList(KEYS.adminAlerts, []);
        var known = {};
        var changed = false;
        alerts.forEach(function (alert) { if (alert.refId) known[alert.refId] = true; });

        getRequests().forEach(function (request) {
            if (request.status !== 'pending') return;
            var submitted = submittedAtOf(request);
            var name = studentOf(request);
            var requestKey = 'req-' + request.id;
            var slaKey = 'sla-' + request.id;
            if (!known[requestKey]) {
                alerts.push({
                    id: 'a-' + requestKey, type: 'request', title: 'New correction request',
                    message: name + ' asked to change ' + request.course + ' (' + formatShortDate(request.date) + ') to ' + request.requestedStatus + '.',
                    time: submitted, unread: true, refId: requestKey
                });
                changed = true;
            }
            if (now - submitted > SLA_HOURS * HOUR && !known[slaKey]) {
                alerts.push({
                    id: 'a-' + slaKey, type: 'sla', title: 'SLA breached',
                    message: name + '\u2019s request for ' + request.course + ' has waited more than ' + SLA_HOURS + ' hours.',
                    time: submitted + SLA_HOURS * HOUR, unread: true, refId: slaKey
                });
                changed = true;
            }
        });
        if (changed) saveList(KEYS.adminAlerts, alerts);
    }

    function getLogs() {
        return readSavedList(KEYS.logs, []).sort(function (a, b) { return b.time - a.time; });
    }

    function addLog(level, source, message) {
        var logs = readSavedList(KEYS.logs, []);
        logs.unshift({ id: Date.now(), level: level, source: source, message: message, time: Date.now() });
        saveList(KEYS.logs, logs.slice(0, 100));
    }

    // Saves the announcement for admins AND pushes it into the student's alert list.
    function publishAnnouncement(details) {
        var now = Date.now();
        var announcements = readSavedList(KEYS.announcements, []);
        var entry = { id: now, title: details.title, message: details.message, priority: details.priority, time: now, author: 'Dr. Admin' };
        announcements.unshift(entry);
        saveList(KEYS.announcements, announcements);

        var studentAlerts = readSavedList(KEYS.studentAlerts, null) || studentAlertDefaults();
        studentAlerts.unshift({
            id: now, type: details.priority === 'emergency' ? 'emergency' : (details.priority === 'urgent' ? 'reminder' : 'info'), title: details.title,
            message: details.message, tag: details.priority === 'emergency' ? 'Emergency alert' : 'Campus announcement', time: formatDateTime(now), unread: true, action: 'History'
        });
        saveList(KEYS.studentAlerts, studentAlerts);

        addLog(details.priority === 'emergency' ? 'warn' : 'success', 'Announcements', (details.priority === 'emergency' ? 'EMERGENCY alert \u201c' : 'Announcement \u201c') + details.title + '\u201d sent to all students');
        return entry;
    }

    function getAnnouncements() {
        return readSavedList(KEYS.announcements, []).sort(function (a, b) { return b.time - a.time; });
    }
    // Adds one alert to the student's inbox (campusLensDemoAlerts) without wiping their existing alerts.
    function pushStudentAlert(details) {
        var now = Date.now();
        var studentAlerts = readSavedList(KEYS.studentAlerts, null) || studentAlertDefaults();
        studentAlerts.unshift({
            id: now, type: details.type || 'info', title: details.title, message: details.message,
            tag: details.tag || 'Campus update', time: formatDateTime(now), unread: true, action: details.action || 'History'
        });
        saveList(KEYS.studentAlerts, studentAlerts);
    }

    /* ---------- shared admin shell (clock, badges, cross-tab sync) ---------- */

    function tickClock() {
        var label = document.getElementById('todayLabel');
        if (!label) return;
        var now = new Date();
        label.textContent = (now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ' · ' +
            now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })).toUpperCase();
    }

    function refreshShell() {
        var unread = getAdminAlerts().filter(function (alert) { return alert.unread; }).length;
        var pending = getPendingStats(Date.now());
        document.querySelectorAll('[data-unread-count]').forEach(function (badge) {
            badge.textContent = String(unread);
            badge.hidden = unread === 0;
        });
        document.querySelectorAll('[data-pending-count]').forEach(function (badge) {
            badge.textContent = String(pending.count);
            badge.hidden = pending.count === 0;
            badge.classList.toggle('danger', pending.breached > 0);
        });
        document.querySelectorAll('.top-alert i').forEach(function (dot) { dot.hidden = unread === 0; });
    }

    function onChange(callback) { changeListeners.push(callback); }

    function notifyChange() {
        refreshShell();
        changeListeners.forEach(function (callback) { callback(); });
    }

    function init() {
        seedAll();
        syncRequestAlerts(Date.now());
        refreshShell();
        tickClock();
        setInterval(tickClock, 1000);
        setInterval(function () {
            syncRequestAlerts(Date.now());
            notifyChange();
        }, 15000);
        // Fires when the student portal (another tab) changes localStorage.
        window.addEventListener('storage', function (event) {
            if (event.key && event.key.indexOf('campusLens') !== 0) return;
            syncRequestAlerts(Date.now());
            notifyChange();
        });
    }

    window.CampusLensAdmin = {
        KEYS: KEYS, SLA_HOURS: SLA_HOURS, STUDENT_NAME: STUDENT_NAME,
        readSavedList: readSavedList, saveList: saveList, escapeHTML: escapeHTML,
        localDateValue: localDateValue, formatShortDate: formatShortDate, formatDateTime: formatDateTime,
        formatClock: formatClock, formatDuration: formatDuration, timeAgo: timeAgo, initialsOf: initialsOf,
        getCourses: getCourses, toMinutes: toMinutes, minutesNow: minutesNow, sessionState: sessionState,
        presentCount: presentCount, getDayStats: getDayStats, getHealth: getHealth,
        getRequests: getRequests, submittedAtOf: submittedAtOf, studentOf: studentOf, slaInfo: slaInfo,
        getPendingStats: getPendingStats, getAdminAlerts: getAdminAlerts, getLogs: getLogs, addLog: addLog,
        publishAnnouncement: publishAnnouncement, getAnnouncements: getAnnouncements, pushStudentAlert: pushStudentAlert,
        onChange: onChange, notifyChange: notifyChange, init: init
    };
}());