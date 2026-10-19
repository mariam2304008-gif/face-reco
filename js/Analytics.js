// CampusLens admin: analytics. Needs AdminShared.js loaded first.
// Everything is generated from the class schedule plus a seeded random generator, so charts stay stable between reloads.
(function () {
    'use strict';

    var A = window.CampusLensAdmin;
    if (!A) return;

    var esc = A.escapeHTML;
    var DAY = 86400000;
    var TARGET = 85;
    var WEEKDAY_SHIFT = [-1, 0, 0.5, 1, 0, -3.5, -2.5];          // Sun..Sat, in percentage points
    var PROFILE = [0.04, 0.10, 0.28, 0.34, 0.16, 0.06, 0.02];    // share of a class walking in at -20, -15 ... +10 min from its start
    var DEPARTMENTS = [
        { name: 'Computer Science', students: 412, bias: 1.5 },
        { name: 'Software Engineering', students: 286, bias: 2.5 },
        { name: 'Electrical Engineering', students: 334, bias: -1.5 },
        { name: 'Business Administration', students: 458, bias: -4 },
        { name: 'Cybersecurity', students: 142, bias: 3 },
        { name: 'Information Systems', students: 198, bias: -0.5 }
    ];
    var state = { range: 'week', style: 'bar' };

    function byId(id) { return document.getElementById(id); }
    function round1(number) { return Math.round(number * 10) / 10; }
    function clamp(number, low, high) { return Math.max(low, Math.min(high, number)); }
    function average(values) { return values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length : 0; }

    // Stable 0..1 number from a text seed.
    function seeded(text) {
        var hash = 2166136261;
        for (var i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        hash ^= hash >>> 15;
        hash = Math.imul(hash, 2246822507);
        hash ^= hash >>> 13;
        return ((hash >>> 0) % 10000) / 10000;
    }

    function clock(minutes) {
        return A.formatClock(Math.floor(minutes / 60) + ':' + ('0' + (minutes % 60)).slice(-2));
    }

    function hourLabel(minutes) {
        var hour = Math.floor(minutes / 60);
        return ((hour + 11) % 12 + 1) + (hour >= 12 ? ' PM' : ' AM');
    }

    function deltaHTML(difference) {
        var rounded = round1(difference);
        return '<span class="delta ' + (rounded >= 0 ? 'up' : 'down') + '">' + (rounded >= 0 ? '▲ +' : '▼ ') + rounded.toFixed(1) + '</span>';
    }

    /* ---------- attendance data ---------- */

    function baseRate() {
        var sum = 0;
        var total = 0;
        A.getCourses().forEach(function (course) { sum += course.rate * course.enrolled; total += course.enrolled; });
        return total ? sum / total : 0.9;
    }

    function dailyRate(date, bias, salt) {
        var noise = (seeded(salt + A.localDateValue(date.getTime())) - 0.5) * 4;   // +/- 2 points
        return clamp(baseRate() * 100 + WEEKDAY_SHIFT[date.getDay()] + (bias || 0) + noise, 55, 99);
    }

    // `days` dates ending `endOffset` days ago (0 = ending today), oldest first.
    function dayList(days, endOffset) {
        var end = new Date();
        end.setHours(12, 0, 0, 0);
        var list = [];
        for (var i = days - 1; i >= 0; i -= 1) list.push(new Date(end.getTime() - (i + endOffset) * DAY));
        return list;
    }

    /* ---------- attendance trend chart ---------- */

    function renderTrend(series) {
        var W = 720, H = 280, L = 42, R = 14, T = 16, B = 34;
        var iw = W - L - R;
        var ih = H - T - B;
        var min = 50;
        var max = 100;
        var step = iw / series.length;
        var parts = [];

        function y(value) { return T + ih - ((value - min) / (max - min)) * ih; }

        [50, 60, 70, 80, 90, 100].forEach(function (tick) {
            parts.push('<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(tick).toFixed(1) + '" y2="' + y(tick).toFixed(1) + '"/>' +
                '<text class="axis" x="' + (L - 8) + '" y="' + (y(tick) + 4).toFixed(1) + '" text-anchor="end">' + tick + '%</text>');
        });
        parts.push('<line class="target" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(TARGET).toFixed(1) + '" y2="' + y(TARGET).toFixed(1) + '"/>' +
            '<text class="target-label" x="' + (W - R - 4) + '" y="' + (y(TARGET) - 6).toFixed(1) + '" text-anchor="end">85% requirement</text>');

        var points = [];
        series.forEach(function (point, index) {
            var cx = L + step * index + step / 2;
            var low = point.value < TARGET;
            var tip = point.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ': ' + point.value.toFixed(1) + '% attendance';

            if (state.style === 'bar') {
                var barWidth = Math.min(40, step * 0.62);
                parts.push('<rect class="bar' + (low ? ' low' : '') + '" x="' + (cx - barWidth / 2).toFixed(1) + '" y="' + y(point.value).toFixed(1) + '" width="' + barWidth.toFixed(1) + '" height="' + (T + ih - y(point.value)).toFixed(1) + '" rx="4"><title>' + esc(tip) + '</title></rect>');
                if (series.length <= 7) parts.push('<text class="val" x="' + cx.toFixed(1) + '" y="' + (y(point.value) - 6).toFixed(1) + '">' + point.value.toFixed(0) + '%</text>');
            } else {
                points.push({ cx: cx, cy: y(point.value), tip: tip, low: low });
            }

            if (series.length <= 7 || (series.length - 1 - index) % 5 === 0) {
                var label = series.length <= 7
                    ? point.date.toLocaleDateString('en-US', { weekday: 'short' })
                    : point.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                parts.push('<text class="axis" x="' + cx.toFixed(1) + '" y="' + (H - 11) + '" text-anchor="middle">' + esc(label) + '</text>');
            }
        });

        if (state.style === 'line' && points.length) {
            var path = points.map(function (p, i) { return (i ? 'L' : 'M') + p.cx.toFixed(1) + ' ' + p.cy.toFixed(1); }).join(' ');
            parts.push('<path class="area" d="' + path + ' L' + points[points.length - 1].cx.toFixed(1) + ' ' + (T + ih) + ' L' + points[0].cx.toFixed(1) + ' ' + (T + ih) + ' Z"/>');
            parts.push('<path class="line" d="' + path + '"/>');
            points.forEach(function (p) {
                parts.push('<circle class="dot' + (p.low ? ' low' : '') + '" cx="' + p.cx.toFixed(1) + '" cy="' + p.cy.toFixed(1) + '" r="' + (series.length <= 7 ? 4.5 : 3) + '"><title>' + esc(p.tip) + '</title></circle>');
            });
        }

        var values = series.map(function (p) { return p.value; });
        var summary = 'Attendance rate for the last ' + series.length + ' days, from ' + Math.min.apply(null, values).toFixed(1) + '% to ' + Math.max.apply(null, values).toFixed(1) + '%';
        byId('trendChart').innerHTML = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(summary) + '">' + parts.join('') + '</svg>';
    }

    /* ---------- department table ---------- */

    function renderDepartments(days) {
        var current = dayList(days, 0);
        var previous = dayList(days, days);
        var rows = DEPARTMENTS.map(function (dept) {
            var now = average(current.map(function (d) { return dailyRate(d, dept.bias, dept.name); }));
            var before = average(previous.map(function (d) { return dailyRate(d, dept.bias, dept.name); }));
            var late = round1(now * (0.04 + seeded('late' + dept.name) * 0.04));
            return { name: dept.name, students: dept.students, rate: now, late: late, onTime: now - late, absent: 100 - now, delta: now - before };
        });
        rows.sort(function (a, b) { return b.rate - a.rate; });

        var totalStudents = 0;
        var weighted = { rate: 0, late: 0, onTime: 0, absent: 0, delta: 0 };
        rows.forEach(function (row) {
            totalStudents += row.students;
            Object.keys(weighted).forEach(function (key) { weighted[key] += row[key] * row.students; });
        });

        var html = rows.map(function (row) {
            return '<tr>' +
                '<td class="course-cell"><strong>' + esc(row.name) + '</strong></td>' +
                '<td class="time-cell">' + row.students.toLocaleString('en-US') + '</td>' +
                '<td><div class="attend-cell"><span class="mini-track' + (row.rate < TARGET ? ' low' : '') + '"><span style="width:' + row.rate.toFixed(1) + '%"></span></span><strong class="time-cell">' + row.rate.toFixed(1) + '%</strong></div></td>' +
                '<td class="time-cell">' + row.onTime.toFixed(1) + '%</td>' +
                '<td class="time-cell">' + row.late.toFixed(1) + '%</td>' +
                '<td class="time-cell">' + row.absent.toFixed(1) + '%</td>' +
                '<td>' + deltaHTML(row.delta) + '</td></tr>';
        }).join('');

        html += '<tr class="total-row"><td>University</td><td class="time-cell">' + totalStudents.toLocaleString('en-US') + '</td>' +
            '<td class="time-cell">' + (weighted.rate / totalStudents).toFixed(1) + '%</td>' +
            '<td class="time-cell">' + (weighted.onTime / totalStudents).toFixed(1) + '%</td>' +
            '<td class="time-cell">' + (weighted.late / totalStudents).toFixed(1) + '%</td>' +
            '<td class="time-cell">' + (weighted.absent / totalStudents).toFixed(1) + '%</td>' +
            '<td>' + deltaHTML(weighted.delta / totalStudents) + '</td></tr>';

        byId('deptRows').innerHTML = html;
        return rows;
    }

    /* ---------- peak entry times ---------- */

    function level(perMinute) { return perMinute >= 5.5 ? 'congested' : (perMinute >= 3.5 ? 'busy' : 'normal'); }
    var LEVEL_PILL = { congested: ['breached', 'Congested'], busy: ['warning', 'Busy'], normal: ['ok', 'Normal'] };

    function buildEntryModel() {
        var courses = A.getCourses();
        if (!courses.length) return null;
        var offline = A.getHealth(Date.now()).offlineRooms;
        var starts = courses.map(function (course) { return A.toMinutes(course.start); });
        var minT = Math.floor((Math.min.apply(null, starts) - 20) / 30) * 30;
        var maxT = Math.ceil((Math.max.apply(null, starts) + 15) / 30) * 30;
        var count = (maxT - minT) / 10;
        var buckets = [];
        for (var i = 0; i < count; i += 1) buckets.push({ start: minT + i * 10, total: 0, top: 0, room: '' });

        var doors = courses.map(function (course) {
            var arrivals = Math.round(course.enrolled * course.rate);
            var start = A.toMinutes(course.start);
            var perBucket = {};
            PROFILE.forEach(function (share, k) {
                var index = Math.floor((start - 20 + k * 5 - minT) / 10);
                if (index >= 0 && index < count) perBucket[index] = (perBucket[index] || 0) + arrivals * share;
            });
            var peak = 0;
            var peakIndex = 0;
            Object.keys(perBucket).forEach(function (key) {
                var entries = perBucket[key];
                var bucket = buckets[key];
                bucket.total += entries;
                if (entries / 10 > bucket.top) { bucket.top = entries / 10; bucket.room = course.room; }
                if (entries > peak) { peak = entries; peakIndex = Number(key); }
            });
            return { room: course.room, code: course.code, entries: Math.round(peak), perMin: peak / 10, window: buckets[peakIndex].start, offline: offline.indexOf(course.room) !== -1 };
        });
        return { buckets: buckets, doors: doors };
    }

    function renderPeak() {
        var model = buildEntryModel();
        byId('peakEmpty').hidden = !!model;
        byId('peakBody').hidden = !model;
        if (!model) return null;

        var W = 720, H = 250, L = 40, R = 14, T = 14, B = 30;
        var iw = W - L - R;
        var ih = H - T - B;
        var top = Math.max(20, Math.ceil(Math.max.apply(null, model.buckets.map(function (b) { return b.total; })) / 20) * 20);
        var step = iw / model.buckets.length;
        var parts = [];

        function y(value) { return T + ih - (value / top) * ih; }

        for (var g = 0; g <= 4; g += 1) {
            var tick = top / 4 * g;
            parts.push('<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(tick).toFixed(1) + '" y2="' + y(tick).toFixed(1) + '"/>' +
                '<text class="axis" x="' + (L - 8) + '" y="' + (y(tick) + 4).toFixed(1) + '" text-anchor="end">' + Math.round(tick) + '</text>');
        }
        model.buckets.forEach(function (bucket, index) {
            var x = L + index * step;
            if (bucket.total > 0.5) {
                var tip = clock(bucket.start) + ' – ' + clock(bucket.start + 10) + ' · ' + Math.round(bucket.total) + ' entries' +
                    (bucket.room ? ' · busiest doorway ' + bucket.room + ' (' + bucket.top.toFixed(1) + '/min)' : '');
                parts.push('<rect class="pbar ' + level(bucket.top) + '" x="' + (x + step * 0.1).toFixed(1) + '" y="' + y(bucket.total).toFixed(1) + '" width="' + (step * 0.8).toFixed(1) + '" height="' + (T + ih - y(bucket.total)).toFixed(1) + '" rx="2"><title>' + esc(tip) + '</title></rect>');
            }
            if (bucket.start % 60 === 0) parts.push('<text class="axis" x="' + (x + step / 2).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle">' + hourLabel(bucket.start) + '</text>');
        });
        byId('peakChart').innerHTML = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Students entering classrooms per 10 minutes through the day, peaking just before class starts">' + parts.join('') + '</svg>';

        var doors = model.doors.slice().sort(function (a, b) { return b.perMin - a.perMin; });
        byId('hotspotList').innerHTML = doors.slice(0, 5).map(function (door, index) {
            var pill = LEVEL_PILL[level(door.perMin)];
            return '<li class="hotspot-item"><span class="hotspot-rank">' + (index + 1) + '</span>' +
                '<span class="hotspot-copy"><strong>' + esc(door.room) + ' <span class="code-chip">' + esc(door.code) + '</span></strong>' +
                '<small>' + esc(clock(door.window) + ' – ' + clock(door.window + 10)) + ' · ' + door.entries + ' entries · ' + door.perMin.toFixed(1) + ' per min' + (door.offline ? ' · camera offline, estimate' : '') + '</small></span>' +
                '<span class="sla-pill ' + pill[0] + '">' + pill[1] + '</span></li>';
        }).join('');
        return doors[0];
    }

    /* ---------- summary cards + render ---------- */

    function renderSummary(series, previousAverage, depts, door, days) {
        var avg = average(series.map(function (p) { return p.value; }));
        byId('sumAvg').innerHTML = avg.toFixed(1) + '<span class="value-percent">%</span>';
        byId('sumAvgFoot').innerHTML = deltaHTML(avg - previousAverage) + '<span>vs previous ' + days + ' days</span>';

        var best = series.reduce(function (a, b) { return b.value > a.value ? b : a; });
        byId('sumBest').textContent = best.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        byId('sumBestFoot').textContent = best.value.toFixed(1) + '% attendance';

        var lowest = depts[depts.length - 1];
        byId('sumDept').textContent = lowest.name;
        byId('sumDeptFoot').textContent = lowest.rate.toFixed(1) + '% · ' + (lowest.rate < TARGET ? 'below' : 'above') + ' the ' + TARGET + '% requirement';

        byId('sumDoor').textContent = door ? door.room : '—';
        byId('sumDoorFoot').textContent = door ? clock(door.window) + ' – ' + clock(door.window + 10) + ' · ' + door.perMin.toFixed(1) + ' per min' : 'No classes scheduled';
    }

    function render() {
        var days = state.range === 'week' ? 7 : 30;
        var series = dayList(days, 0).map(function (date) { return { date: date, value: round1(dailyRate(date, 0, 'all')) }; });
        var previousAverage = average(dayList(days, days).map(function (date) { return dailyRate(date, 0, 'all'); }));

        document.querySelectorAll('[data-range]').forEach(function (tab) {
            var active = tab.getAttribute('data-range') === state.range;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-pressed', String(active));
        });
        document.querySelectorAll('[data-style]').forEach(function (tab) {
            var active = tab.getAttribute('data-style') === state.style;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-pressed', String(active));
        });
        byId('trendPill').textContent = 'Last ' + days + ' days';

        renderTrend(series);
        var depts = renderDepartments(days);
        var door = renderPeak();
        renderSummary(series, previousAverage, depts, door, days);
    }

    document.querySelectorAll('[data-range]').forEach(function (tab) {
        tab.addEventListener('click', function () { state.range = tab.getAttribute('data-range'); render(); });
    });
    document.querySelectorAll('[data-style]').forEach(function (tab) {
        tab.addEventListener('click', function () { state.style = tab.getAttribute('data-style'); render(); });
    });

    A.init();
    A.onChange(render);
    render();
}());