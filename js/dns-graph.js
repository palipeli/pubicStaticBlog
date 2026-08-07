    (function() {
    'use strict';

    const DNS_GRAPH_API = 'https://graph.kamikami.workers.dev/';
    const ALLOWED_COLOR = '#50D096';
    const BLOCKED_COLOR = '#EA38EC';

    const THEME_COLORS = {
        dark: {
            text: '#8b949e',
            grid: 'rgba(48, 54, 61, 0.3)',
            tooltipBg: '#161b22',
            tooltipBorder: '#30363d',
            tooltipTitle: '#ffffff',
            tooltipBody: '#8b949e',
            allowedFill: 'rgba(80, 208, 150, 0.12)',
            blockedFill: 'rgba(234, 56, 236, 0.12)'
        },
        light: {
            text: '#57606a',
            grid: 'rgba(208, 215, 222, 0.5)',
            tooltipBg: '#ffffff',
            tooltipBorder: '#d0d7de',
            tooltipTitle: '#24292f',
            tooltipBody: '#57606a',
            allowedFill: 'rgba(80, 208, 150, 0.15)',
            blockedFill: 'rgba(234, 56, 236, 0.15)'
        }
    };

    let chart = null;

    function getCurrentTheme() {
        const theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'light') return 'light';
        if (theme === 'dark') return 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function fetchDnsData() {
        return fetch(DNS_GRAPH_API)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('DNS graph API returned ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                const groups = data.data.viewer.accounts[0].gatewayResolverQueriesAdaptiveGroups || [];
                const byDate = {};

                groups.forEach(function(group) {
                    const date = group.dimensions.date;
                    const decision = group.dimensions.resolverDecision;
                    const count = group.count;

                    if (!byDate[date]) {
                        byDate[date] = { allowed: 0, blocked: 0 };
                    }

                    if (decision === 5 || decision === 6) {
                        byDate[date].allowed += count;
                    } else if (decision === 9 || decision === 10) {
                        byDate[date].blocked += count;
                    }
                });

                const dates = Object.keys(byDate).sort();
                const labels = [];
                const allowed = [];
                const blocked = [];

                dates.forEach(function(date) {
                    labels.push(date);
                    allowed.push(byDate[date].allowed);
                    blocked.push(byDate[date].blocked);
                });

                return { labels: labels, allowed: allowed, blocked: blocked };
            });
    }

    function createChart(data) {
        const canvas = document.getElementById('dns-graph');
        if (!canvas || typeof window.Chart === 'undefined') return;

        const colors = THEME_COLORS[getCurrentTheme()];

        chart = new window.Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Allowed',
                        data: data.allowed,
                        borderColor: ALLOWED_COLOR,
                        backgroundColor: colors.allowedFill,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 3,
                        pointHoverBackgroundColor: ALLOWED_COLOR,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Blocked',
                        data: data.blocked,
                        borderColor: BLOCKED_COLOR,
                        backgroundColor: colors.blockedFill,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 3,
                        pointHoverBackgroundColor: BLOCKED_COLOR,
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        labels: {
                            color: colors.text,
                            boxWidth: 12,
                            boxHeight: 12
                        }
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
                                return context.dataset.label + ': ' + context.parsed.y.toLocaleString();
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
                            callback: function(value) {
                                if (value >= 1000000) return (value / 1000000) + 'M';
                                if (value >= 1000) return (value / 1000) + 'K';
                                return value;
                            }
                        }
                    }
                }
            }
        });
    }

    function updateChartTheme() {
        if (!chart) return;
        const colors = THEME_COLORS[getCurrentTheme()];
        chart.data.datasets[0].backgroundColor = colors.allowedFill;
        chart.data.datasets[1].backgroundColor = colors.blockedFill;
        chart.options.plugins.legend.labels.color = colors.text;
        chart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
        chart.options.plugins.tooltip.borderColor = colors.tooltipBorder;
        chart.options.plugins.tooltip.titleColor = colors.tooltipTitle;
        chart.options.plugins.tooltip.bodyColor = colors.tooltipBody;
        chart.options.scales.x.grid.color = colors.grid;
        chart.options.scales.x.ticks.color = colors.text;
        chart.options.scales.y.grid.color = colors.grid;
        chart.options.scales.y.ticks.color = colors.text;
        chart.update();
    }

    function showError() {
        const canvas = document.getElementById('dns-graph');
        if (!canvas) return;
        const wrap = canvas.parentElement;
        if (!wrap) return;
        canvas.style.display = 'none';
        const msg = document.createElement('p');
        msg.className = 'dns-graph-error';
        msg.textContent = 'Could not load DNS request data.';
        wrap.appendChild(msg);
    }

    function initDnsGraph() {
        if (typeof window.Chart === 'undefined') return;

        fetchDnsData()
            .then(function(data) {
                createChart(data);
            })
            .catch(function() {
                showError();
            });

        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'data-theme') {
                    updateChartTheme();
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });

        if (typeof window.ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(function() {
                if (chart) chart.resize();
            });
            const wrap = document.querySelector('.dns-graph-canvas-wrap');
            if (wrap) resizeObserver.observe(wrap);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDnsGraph);
    } else {
        initDnsGraph();
    }
})();