/**
 * Parashakthi - Authority Dashboard Module
 */

const DashboardModule = (function() {
    let typeChart = null;
    let timeChart = null;

    function getIncidents(callback) {
        FirestoreService.getIncidents(callback);
    }

    function refresh() {
        getIncidents(incidents => {
            const now = new Date();
            const thisMonth = incidents.filter(i => {
                const t = i.timestamp;
                const d = t instanceof Date ? t : new Date(t);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length;

            const totalEl = document.getElementById('totalIncidents');
            const monthEl = document.getElementById('thisMonth');
            if (totalEl) totalEl.textContent = incidents.length;
            if (monthEl) monthEl.textContent = thisMonth;

            const byType = {};
            incidents.forEach(i => {
                const t = i.type || 'unknown';
                byType[t] = (byType[t] || 0) + 1;
            });
            const typesEl = document.getElementById('incidentTypes');
            if (typesEl) typesEl.textContent = Object.entries(byType)
                .map(([k, v]) => `${k}: ${v}`).join(', ') || '--';

            const grid = {};
            incidents.forEach(i => {
                const key = `${(i.lat || i.latitude || 0).toFixed(3)},${(i.lng || i.longitude || 0).toFixed(3)}`;
                grid[key] = (grid[key] || 0) + 1;
            });
            const top = Object.entries(grid).sort((a, b) => b[1] - a[1])[0];
            const topEl = document.getElementById('topArea');
            if (topEl) topEl.textContent = top ? `${top[0]} (${top[1]} incidents)` : '--';

            renderCharts(incidents);
            renderUnsafeAreas(incidents);
        });
    }

    function renderCharts(incidents) {
        const byType = {};
        const byHour = Array(24).fill(0);
        incidents.forEach(i => {
            byType[i.type || 'other'] = (byType[i.type || 'other'] || 0) + 1;
            const t = i.timestamp;
            const d = t instanceof Date ? t : new Date(t);
            byHour[d.getHours()]++;
        });

        const typeCtx = document.getElementById('typeChart');
        const timeCtx = document.getElementById('timeChart');
        if (!typeCtx || !timeCtx) return;

        if (typeChart) typeChart.destroy();
        typeChart = new Chart(typeCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(byType),
                datasets: [{
                    data: Object.values(byType),
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#6366f1', '#ec4899']
                }]
            },
            options: { responsive: true }
        });

        if (timeChart) timeChart.destroy();
        timeChart = new Chart(timeCtx, {
            type: 'bar',
            data: {
                labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                datasets: [{
                    label: 'Incidents',
                    data: byHour,
                    backgroundColor: 'rgba(99, 102, 241, 0.7)'
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    function renderUnsafeAreas(incidents) {
        const grid = {};
        incidents.forEach(i => {
            const key = `${(i.lat || i.latitude || 0).toFixed(3)},${(i.lng || i.longitude || 0).toFixed(3)}`;
            if (!grid[key]) grid[key] = { count: 0, type: i.type };
            grid[key].count++;
        });
        const sorted = Object.entries(grid).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
        const container = document.getElementById('unsafeAreas');
        if (!container) return;
        container.innerHTML = sorted.length
            ? sorted.map(([loc, d]) => `<div class="flex justify-between py-2 border-b border-slate-700"><span>${loc}</span><span class="text-red-400">${d.count} incidents</span></div>`).join('')
            : '<p class="text-slate-500">No incident data</p>';
    }

    function init() {
        refresh();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return { refresh, init };
})();
