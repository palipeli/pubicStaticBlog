(function() {
    'use strict';

    const GITHUB_USERS = ['mikaaeru', 'palipeli'];
    const CACHE_KEY = 'github_graphs_cache';
    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

    let uPlotInstances = [];

    function getCache() {
        try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    return data;
                }
            }
        } catch (e) {
            console.warn('GitHub graphs cache read failed:', e);
        }
        return null;
    }

    function setCache(data) {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
        } catch (e) {
            console.warn('GitHub graphs cache write failed:', e);
        }
    }

    function buildGraphQLQuery(username, fromDate) {
        return `
            query {
                user(login: "${username}") {
                    contributionsCollection(from: "${fromDate}") {
                        contributionCalendar {
                            weeks {
                                contributionDays {
                                    date
                                    contributionCount
                                }
                            }
                        }
                    }
                }
            }
        `;
    }

    async function fetchUserContributions(username) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 30);
        const fromISO = fromDate.toISOString().split('T')[0];

        const query = buildGraphQLQuery(username, fromISO);

        const response = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.errors) {
            throw new Error(result.errors.map(e => e.message).join(', '));
        }

        const user = result.data?.user;
        if (!user) {
            throw new Error(`User "${username}" not found`);
        }

        const weeks = user.contributionsCollection?.contributionCalendar?.weeks;
        if (!weeks) {
            throw new Error('No contribution data');
        }

        const contributions = [];
        weeks.forEach(week => {
            week.contributionDays.forEach(day => {
                contributions.push({
                    date: day.date,
                    count: day.contributionCount
                });
            });
        });

        contributions.sort((a, b) => new Date(a.date) - new Date(b.date));

        const last30Days = contributions.slice(-30);

        return last30Days.map(d => ({
            timestamp: new Date(d.date).getTime(),
            count: d.count
        }));
    }

    function createChartData(contributions) {
        const timestamps = contributions.map(c => c.timestamp);
        const counts = contributions.map(c => c.count);
        return [timestamps, counts];
    }

    function createGitHubGraphOptions(data, canvasId) {
        const [timestamps, counts] = data;
        const maxCount = Math.max(...counts, 1);

        return {
            title: '',
            width: '100%',
            height: '100%',
            canvas: document.getElementById(canvasId),
            series: [
                {},
                {
                    label: 'Commits',
                    stroke: '#39ff14',
                    width: 2,
                    fill: 'rgba(57, 255, 20, 0.15)',
                    paths: uPlot.paths.curve(),
                    points: {
                        show: false
                    }
                }
            ],
            axes: [
                {
                    show: false
                },
                {
                    show: false,
                    max: maxCount * 1.3,
                    min: 0
                }
            ],
            scales: {
                x: {
                    time: true,
                    distr: (u, i) => i,
                    range: (u, dataMin, dataMax) => [dataMin, dataMax]
                }
            },
            hooks: {
                draw: [
                    function(u) {
                        const ctx = u.ctx;
                        const { left, top, width, height } = u.bbox;
                        ctx.fillStyle = '#0d1117';
                        ctx.fillRect(left, top, width, height);
                    }
                ]
            },
            cursor: {
                show: false
            },
            legend: {
                show: false
            },
            plugins: []
        };
    }

    function initGraph(canvasId, contributions) {
        const data = createChartData(contributions);
        const opts = createGitHubGraphOptions(data, canvasId);
        const u = new uPlot(opts, data);
        uPlotInstances.push(u);
        return u;
    }

    function showError(container, message) {
        container.innerHTML = `
            <div class="github-graph-error">
                <p>${message}</p>
            </div>
        `;
        container.style.display = 'flex';
    }

    function showLoading(container) {
        container.style.display = 'flex';
        const wrappers = container.querySelectorAll('.github-graph-wrapper');
        wrappers.forEach(wrapper => {
            const canvas = wrapper.querySelector('canvas');
            if (canvas) {
                canvas.style.display = 'none';
            }
            let loader = wrapper.querySelector('.github-graph-loader');
            if (!loader) {
                loader = document.createElement('div');
                loader.className = 'github-graph-loader';
                loader.textContent = 'Loading...';
                wrapper.appendChild(loader);
            }
        });
    }

    function hideLoading(container) {
        const loaders = container.querySelectorAll('.github-graph-loader');
        loaders.forEach(l => l.remove());
        const canvases = container.querySelectorAll('canvas');
        canvases.forEach(c => c.style.display = 'block');
    }

    async function initGitHubGraphs() {
        const container = document.getElementById('github-graphs-container');
        if (!container) return;

        const cached = getCache();
        if (cached) {
            hideLoading(container);
            GITHUB_USERS.forEach((user, i) => {
                const canvasId = `github-graph-${user}`;
                if (cached[user]) {
                    initGraph(canvasId, cached[user]);
                }
            });
            container.style.display = 'flex';
            return;
        }

        showLoading(container);

        try {
            const results = {};
            for (const user of GITHUB_USERS) {
                try {
                    const contributions = await fetchUserContributions(user);
                    results[user] = contributions;
                } catch (e) {
                    console.error(`Failed to fetch ${user}:`, e);
                    results[user] = null;
                }
            }

            setCache(results);

            hideLoading(container);

            let hasData = false;
            GITHUB_USERS.forEach((user, i) => {
                const canvasId = `github-graph-${user}`;
                const wrapper = document.querySelector(`#${canvasId}`)?.closest('.github-graph-wrapper');
                if (results[user] && results[user].length > 0) {
                    initGraph(canvasId, results[user]);
                    hasData = true;
                } else if (wrapper) {
                    wrapper.innerHTML = `
                        <div class="github-graph-error">
                            <p>Failed to load data for ${user}</p>
                        </div>
                    `;
                }
            });

            if (hasData) {
                container.style.display = 'flex';
            } else {
                showError(container, 'Failed to load GitHub contribution data for both users');
            }
        } catch (e) {
            console.error('GitHub graphs init failed:', e);
            hideLoading(container);
            showError(container, 'Failed to load GitHub contribution data');
        }
    }

    function destroyGraphs() {
        uPlotInstances.forEach(u => u.destroy());
        uPlotInstances = [];
    }

    if (typeof window !== 'undefined') {
        window.initGitHubGraphs = initGitHubGraphs;
        window.destroyGitHubGraphs = destroyGraphs;
    }
})();