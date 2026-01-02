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
            if (tabId === 'kernel') {
                fetchKernels();
                fetchKernelFiles();
            }
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

    // --- Kernel Lab Logic (File Manager Edition) ---
    const fetchKernelFiles = async () => {
        try {
            const res = await fetch('/api/admin/kernel/files');
            const data = await res.json();
            if (data.success) {
                renderKernelFiles(data.files);
            }
        } catch (e) {}
    };

    const renderKernelFiles = (files) => {
        const container = document.getElementById('kernelFilesList');
        if (!container) return;
        
        if (files.length === 0) {
            container.innerHTML = '<p style="font-size: 0.6rem; color: #444; text-align: center; margin-top: 1rem;">No custom units</p>';
            return;
        }

        container.innerHTML = files.map(file => `
            <div class="kernel-file-item" data-file="${file}" style="padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 0.7rem; color: #888; font-family: monospace; transition: all 0.2s; display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 0.9rem;">javascript</span>
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${file}</span>
            </div>
        `).join('');

        // Selection Logic
        document.querySelectorAll('.kernel-file-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.kernel-file-item').forEach(i => i.style.background = 'none');
                item.style.background = 'rgba(94, 92, 230, 0.1)';
                item.style.color = '#5e5ce6';
                loadKernelFile(item.dataset.file);
            });
        });
    };

    const loadKernelFile = async (filename) => {
        window.toast.info(`Opening ${filename}...`);
        try {
            const res = await fetch(`/api/admin/kernel/read/${filename}`);
            const data = await res.json();
            if (data.success) {
                document.getElementById('kernelFnName').value = filename.replace('.js', '');
                document.getElementById('kernelFnCode').value = data.content;
                document.getElementById('btnDeleteKernel').style.display = 'block';
                document.getElementById('kernelFnName').readOnly = true;
            }
        } catch (e) {
            window.toast.error('Failed to read unit');
        }
    };

    document.getElementById('btnNewKernel').addEventListener('click', () => {
        const template = `export const version = "1.0.0";
export const hash = "SIG_${Math.random().toString(36).substring(7).toUpperCase()}";

/**
 * Custom Attack Unit
 */
export async function my_unit(sock, jid) {
    // Write your logic here
    await sock.sendMessage(jid, { text: 'XOVALIUM MODULE EXECUTED' });
}`;
        document.getElementById('kernelFnName').value = '';
        document.getElementById('kernelFnCode').value = template;
        document.getElementById('kernelFnName').readOnly = false;
        document.getElementById('btnDeleteKernel').style.display = 'none';
        document.querySelectorAll('.kernel-file-item').forEach(i => i.style.background = 'none');
        document.getElementById('kernelFnName').focus();
    });

    document.getElementById('btnSaveKernel').addEventListener('click', async () => {
        const filename = document.getElementById('kernelFnName').value;
        const code = document.getElementById('kernelFnCode').value;

        if (!filename || !code) return window.toast.error('Filename and Code required');

        // Check if it's a temporary request (by name or toggle logic)
        // For simplicity, if filename starts with 'temp_', we use the temp API
        const isTemp = filename.startsWith('temp_');
        const endpoint = isTemp ? '/api/admin/kernel/temp' : '/api/admin/kernel/save';
        const body = isTemp ? { name: filename, code } : { filename, code };

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                window.toast.success(isTemp ? 'Temp unit loaded in memory' : 'Persistent unit hot-reloaded');
                if (!isTemp) fetchKernelFiles();
                fetchKernels(); 
                if (!isTemp) {
                    document.getElementById('btnDeleteKernel').style.display = 'block';
                    document.getElementById('kernelFnName').readOnly = true;
                }
            } else {
                window.toast.error(data.error || 'Operation failed');
            }
        } catch (e) {
            window.toast.error('Network failure');
        }
    });

    document.getElementById('btnDeleteKernel').addEventListener('click', async () => {
        const filename = document.getElementById('kernelFnName').value + '.js';
        if (!confirm(`Are you sure you want to PERMANENTLY delete ${filename}?`)) return;

        try {
            const res = await fetch('/api/admin/kernel/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
            const data = await res.json();
            if (data.success) {
                window.toast.warning('Kernel unit purged');
                document.getElementById('btnNewKernel').click();
                fetchKernelFiles();
                fetchKernels();
            }
        } catch (e) {
            window.toast.error('Purge failed');
        }
    });

    // Runtime Registry Check
    const fetchKernels = async () => {
        try {
            const res = await fetch('/api/admin/kernel-list');
            const data = await res.json();
            if (data.success) {
                renderKernels(data.kernels);
            }
        } catch (e) {}
    };

    const renderKernels = (kernels) => {
        const container = document.getElementById('activeKernelsList');
        if (!container) return;
        container.innerHTML = kernels.map(k => `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid var(--border); padding: 4px 10px; border-radius: 6px; font-size: 0.6rem; color: #888; font-family: monospace;">
                ${k.toUpperCase()}
            </div>
        `).join('');
    };

    // Hotkey: Ctrl + S to save
    document.getElementById('kernelFnCode').addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            document.getElementById('btnSaveKernel').click();
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
