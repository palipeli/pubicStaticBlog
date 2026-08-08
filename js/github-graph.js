(function() {
    'use strict';

    const GITHUB_GRAPH_API = 'https://github-contributions-api.jogruber.de/v4/';
    const GITHUB_GRAPH_ACCOUNTS = ['mikaaeru', 'palipeli'];
    const NEON_GREEN = '#50D096';

    const RANGE_DAYS = {
        '1d': 1,
        '10d': 10,
        '30d': 30,
        '6m': 183,
        '1y': 366
    };

    const THEME_COLORS = {
        dark: {
            text: '#8b949e',
            grid: 'rgba(48, 54, 61, 0.3)',
            tooltipBg: '#161b22',
            tooltipBorder: '#30363d',
            tooltipTitle: '#ffffff',
            tooltipBody: '#8b949e',
            fill: 'rgba(80, 208, 150, 0.12)'
        },
        light: {
            text: '#57606a',
            grid: 'rgba(208, 215, 222, 0.5)',
            tooltipBg: '#ffffff',
            tooltipBorder: '#d0d7de',
            tooltipTitle: '#24292f',
            tooltipBody: '#57606a',
            fill: 'rgba(80, 208, 150, 0.15)'
        }
    };

    const charts = {};
    const allData = {};
    let currentRange = '1y';

    function getCurrentTheme() {
        const theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'light') return 'light';
        if (theme === 'dark') return 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function fetchContributions(username) {
        return fetch(GITHUB_GRAPH_API + username)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('GitHub contributions API returned ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                const contributions = data.contributions || [];
                const labels = [];
                const values = [];
                contributions.forEach(function(day) {
                    labels.push(day.date);
                    values.push(day.count);
                });
                return {labels: labels, values: values};
            });
    }

    function filterDataByRange(data, range) {
        const days = RANGE_DAYS[range] || RANGE_DAYS['1y'];
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const labels = [];
        const values = [];
        for (let i = 0; i < data.labels.length; i++) {
            const date = new Date(data.labels[i]);
            if (date >= cutoff) {
                labels.push(data.labels[i]);
                values.push(data.values[i]);
            }
        }
        return {labels: labels, values: values};
    }

    function createChart(canvasId, username, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof window.Chart === 'undefined') return;

        const colors = THEME_COLORS[getCurrentTheme()];
        const filtered = filterDataByRange(data, currentRange);

        charts[canvasId] = new window.Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: filtered.labels,
                datasets: [{
                    label: username + ' contributions',
                    data: filtered.values,
                    borderColor: NEON_GREEN,
                    backgroundColor: colors.fill,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    pointHoverBackgroundColor: NEON_GREEN,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 16 / 9,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        titleColor: colors.tooltipTitle,
                        bodyColor: colors.tooltipBody,
                        callbacks: {
                            title: function(items) {
                                return items[0].label;
                            },
                            label: function(context) {
                                return context.parsed.y + ' contributions';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: colors.grid
                        },
                        ticks: {
                            color: colors.text,
                            maxTicksLimit: 8,
                            maxRotation: 0,
                            callback: function(value, index) {
                                const label = this.getLabelForValue(value);
                                const parts = label.split('-');
                                if (parts.length === 3) {
                                    return parts[1] + '/' + parts[2];
                                }
                                return label;
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: colors.grid
                        },
                        ticks: {
                            color: colors.text,
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    function updateChartTheme() {
        const colors = THEME_COLORS[getCurrentTheme()];
        Object.keys(charts).forEach(function(canvasId) {
            const chart = charts[canvasId];
            if (!chart) return;
            chart.data.datasets[0].backgroundColor = colors.fill;
            chart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
            chart.options.plugins.tooltip.borderColor = colors.tooltipBorder;
            chart.options.plugins.tooltip.titleColor = colors.tooltipTitle;
            chart.options.plugins.tooltip.bodyColor = colors.tooltipBody;
            chart.options.scales.x.grid.color = colors.grid;
            chart.options.scales.x.ticks.color = colors.text;
            chart.options.scales.y.grid.color = colors.grid;
            chart.options.scales.y.ticks.color = colors.text;
            chart.update();
        });
    }

    function updateChartRange() {
        Object.keys(charts).forEach(function(canvasId) {
            const chart = charts[canvasId];
            if (!chart) return;
            const username = canvasId.replace('github-graph-', '');
            const data = allData[username];
            if (!data) return;
            const filtered = filterDataByRange(data, currentRange);
            chart.data.labels = filtered.labels;
            chart.data.datasets[0].data = filtered.values;
            chart.update();
        });
    }

    function setupRangeButtons() {
        const container = document.querySelector('.github-graph-ranges');
        if (!container) return;
        container.addEventListener('click', function(e) {
            const btn = e.target.closest('.github-graph-range-btn');
            if (!btn) return;
            container.querySelectorAll('.github-graph-range-btn').forEach(function(b) {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            currentRange = btn.dataset.range;
            updateChartRange();
        });
    }

    function showError(canvasId, username) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const wrap = canvas.parentElement;
        if (!wrap) return;
        canvas.style.display = 'none';
        const msg = document.createElement('p');
        msg.className = 'github-graph-error';
        msg.textContent = 'Could not load ' + username + ' contribution data.';
        wrap.appendChild(msg);
    }

    function initGithubGraphs() {
        if (typeof window.Chart === 'undefined') return;

        setupRangeButtons();

        GITHUB_GRAPH_ACCOUNTS.forEach(function(username) {
            const canvasId = 'github-graph-' + username;
            fetchContributions(username)
                .then(function(data) {
                    allData[username] = data;
                    createChart(canvasId, username, data);
                })
                .catch(function() {
                    showError(canvasId, username);
                });
        });

        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'data-theme') {
                    updateChartTheme();
                }
            });
        });
        observer.observe(document.documentElement, {attributes: true});

        if (typeof window.ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(function() {
                Object.keys(charts).forEach(function(canvasId) {
                    const chart = charts[canvasId];
                    if (chart) chart.resize();
                });
            });
            const container = document.querySelector('.github-graphs-container');
            if (container) resizeObserver.observe(container);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGithubGraphs);
    } else {
        initGithubGraphs();
    }
})();