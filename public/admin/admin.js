document.addEventListener('DOMContentLoaded', () => {
    // Tab Navigation Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // UI Feedback
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            // Trigger data load
            if (tabId === 'membership') fetchUsers();
            if (tabId === 'overview') fetchStats();
            if (tabId === 'notifications') fetchCurrentNotif();
            if (tabId === 'terminal') fetchBotState();
        });
    });

    // --- Terminal & Bot Management ---
    const fetchBotState = async () => {
        try {
            const res = await fetch('/api/admin/bot-state');
            const data = await res.json();
            if (data.success) {
                const tag = document.getElementById('botStatusTag');
                tag.textContent = data.state.toUpperCase();
                tag.style.background = data.state === 'connected' ? 'rgba(50,215,75,0.1)' : 'rgba(255,55,95,0.1)';
                tag.style.color = data.state === 'connected' ? '#32d74b' : '#ff375f';

                if (data.pairingCode) {
                    document.getElementById('pairingContainer').style.display = 'block';
                    document.getElementById('pairingCode').textContent = data.pairingCode;
                } else {
                    document.getElementById('pairingContainer').style.display = 'none';
                }

                // Render active sessions count
                const countEl = document.getElementById('activeSessionsCount');
                if (countEl) {
                    countEl.textContent = `${data.activeSessions || 0} active sender accounts`;
                }

                // Render Logs
                const logContainer = document.getElementById('botLogs');
                if (data.logs && data.logs.length > 0) {
                    logContainer.innerHTML = data.logs.map(log => 
                        `<div style="margin-bottom: 2px;"><span style="color: #666;">[${log.time}]</span> ${log.message}</div>`
                    ).join('');
                    logContainer.scrollTop = logContainer.scrollHeight;
                }
            }
        } catch (err) {}
    };

    document.getElementById('btnConnectBot').addEventListener('click', async () => {
        const phoneNumber = document.getElementById('botPhoneNumber').value;
        if (!phoneNumber) return window.toast.error('Please enter a phone number first');

        window.toast.info('Requesting new pairing code...');
        const res = await fetch('/api/admin/bot-connect', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber })
        });
        const data = await res.json();
        if (data.success) {
            fetchBotState();
        } else {
            window.toast.error(data.error || 'Connection failed');
        }
    });

    document.getElementById('btnLogoutBot').addEventListener('click', async () => {
        const phoneNumber = document.getElementById('botPhoneNumber').value;
        if (!confirm(`Are you sure you want to kill the session ${phoneNumber || 'active'}?`)) return;

        const res = await fetch('/api/admin/bot-logout', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber })
        });
        const data = await res.json();
        if (data.success) {
            window.toast.warning('Socket terminated');
            fetchBotState();
        } else {
            window.toast.error(data.error || 'Failed to logout');
        }
    });

    document.getElementById('btnWarmUp').addEventListener('click', async () => {
        if (!confirm('Start simulated human interaction between all active accounts? This helps prevent bans.')) return;
        
        try {
            const res = await fetch('/api/admin/warm-up', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                window.toast.success('Warm-up sequence initiated in background');
            } else {
                window.toast.error(data.error || 'Failed to start warm-up');
            }
        } catch (e) {
            window.toast.error('Network error');
        }
    });

    // Live Log Injection (Stub for demonstration)
    const addLog = (msg) => {
        const logs = document.getElementById('botLogs');
        const entry = document.createElement('div');
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logs.appendChild(entry);
        logs.scrollTop = logs.scrollHeight;
    };

    // Auto-refresh bot state
    setInterval(() => {
        const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
        if (activeTab === 'terminal') fetchBotState();
    }, 5000);

    // --- Overview & System Pulse ---
    let healthChart;
    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin/stats');
            const data = await res.json();
            if (data.success) {
                updateCoreUI(data.stats);
            }
        } catch (err) {
            console.error('Core sync error:', err);
        }
    };

    const updateCoreUI = (stats) => {
        document.getElementById('cpuModel').textContent = stats.cpuModel;
        document.getElementById('cpuCores').textContent = `${stats.cpuCores}`;
        
        const usedMem = (stats.totalMem - stats.freeMem) / (1024 ** 3);
        const totalMem = stats.totalMem / (1024 ** 3);
        const memPercent = (usedMem / totalMem) * 100;
        
        document.getElementById('memUsage').textContent = `${usedMem.toFixed(1)}GB / ${totalMem.toFixed(1)}GB`;
        document.getElementById('memBar').style.width = `${memPercent}%`;
        
        const uptimeH = Math.floor(stats.uptime / 3600);
        const uptimeM = Math.floor((stats.uptime % 3600) / 60);
        document.getElementById('uptime').textContent = `${uptimeH}h ${uptimeM}m`;

        updatePulseChart(memPercent);
    };

    const updatePulseChart = (val) => {
        const ctx = document.getElementById('healthChart').getContext('2d');
        if (healthChart) {
            healthChart.data.datasets[0].data.push(val);
            if (healthChart.data.datasets[0].data.length > 10) healthChart.data.datasets[0].data.shift();
            healthChart.update('none'); // Update without animation for smoother real-time pulse
            return;
        }

        healthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(10).fill(''),
                datasets: [{
                    data: [val],
                    borderColor: '#5e5ce6',
                    backgroundColor: 'rgba(94, 92, 230, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    borderCapStyle: 'round'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        max: 100, 
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#444', font: { size: 10 } }
                    },
                    x: { display: false }
                },
                plugins: { legend: { display: false } }
            }
        });
    };

    // --- Identity Registry (Users) ---
    const fetchUsers = async () => {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        if (data.success) {
            renderUserCards(data.users);
        }
    };

    const renderUserCards = (users) => {
        const container = document.getElementById('userListBody');
        container.innerHTML = users.map(user => `
            <div class="user-card">
                <div class="user-header">
                    <span class="user-tg-id">${user.telegramId}</span>
                    <span class="role-tag" style="color: ${user.role === 'owner' ? '#ff9f0a' : '#32d74b'}">
                        ${user.role}
                    </span>
                </div>
                <p style="font-size: 0.65rem; color: var(--text-secondary);">Last Sync: ${new Date(user.lastLogin).toLocaleDateString()} ${new Date(user.lastLogin).toLocaleTimeString()}</p>
                <div class="user-footer">
                    <select class="select-native" onchange="updateAccess('${user.telegramId}', this.value)">
                        <option value="free" ${user.membership === 'free' ? 'selected' : ''}>Standard Free</option>
                        <option value="premium" ${user.membership === 'premium' ? 'selected' : ''}>Premium VIP</option>
                        <option value="vip" ${user.membership === 'vip' ? 'selected' : ''}>Ultra VIP</option>
                        <option value="lifetime" ${user.membership === 'lifetime' ? 'selected' : ''}>Lifetime access</option>
                    </select>
                </div>
            </div>
        `).join('');
    };

    window.updateAccess = async (telegramId, level) => {
        const res = await fetch('/api/admin/update-membership', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId, membership: level })
        });
        const data = await res.json();
        if (data.success) {
            window.toast.success('Access levels recalibrated');
        } else {
            window.toast.error('Sync failed');
        }
    };

    // --- Transmission Control (Broadcast) ---
    const fetchCurrentNotif = async () => {
        const res = await fetch('/api/app/info');
        const data = await res.json();
        if (data.success) {
            const box = document.getElementById('currentNotifBox');
            box.textContent = data.notification.message;
            box.style.borderLeft = `5px solid ${
                data.notification.type === 'error' ? '#ff375f' : 
                data.notification.type === 'warning' ? '#ff9f0a' : 
                data.notification.type === 'success' ? '#32d74b' : '#5e5ce6'
            }`;
        }
    };

    document.getElementById('saveNotif').addEventListener('click', async () => {
        const message = document.getElementById('notifMessage').value;
        const type = document.getElementById('notifType').value;
        
        if (!message) return window.toast.error('Content required for broadcast');

        const res = await fetch('/api/admin/set-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, type })
        });
        const data = await res.json();
        if (data.success) {
            window.toast.success('Global transmission broadcasted');
            fetchCurrentNotif();
        }
    });

    // --- Kernel Lab Logic ---
    document.getElementById('btnInjectKernel').addEventListener('click', async () => {
        const functionName = document.getElementById('kernelFnName').value;
        const code = document.getElementById('kernelFnCode').value;

        if (!functionName || !code) return window.toast.error('All fields are required');
        
        if (!confirm('Warning: This will modify the core function file. Invalid syntax could crash the server. Proceed?')) return;

        try {
            const res = await fetch('/api/admin/add-function', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ functionName, code })
            });
            const data = await res.json();
            if (data.success) {
                window.toast.success(`Kernel updated: ${functionName}`);
                document.getElementById('kernelFnName').value = '';
                document.getElementById('kernelFnCode').value = '';
            } else {
                window.toast.error(data.error || 'Injection failed');
            }
        } catch (e) {
            window.toast.error('Network failure during injection');
        }
    });

    // User Search Optimization
    document.getElementById('userSearch').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.user-card');
        cards.forEach(card => {
            const id = card.querySelector('.user-tg-id').textContent.toLowerCase();
            card.style.display = id.includes(term) ? 'flex' : 'none';
        });
    });

    // Real-time Pulse
    setInterval(() => {
        if (document.getElementById('overview').classList.contains('active')) {
            fetchStats();
        }
    }, 4000);

    fetchStats();
});
