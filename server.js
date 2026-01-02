import { config } from "./config/settings.js";
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import User from "./backend/models/user.js";
import chalk from "chalk";
import os from "os";
import { executeAttack, promoteToContacts, accountWarmingUp } from "./plugins/function.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let globalNotification = {
    message: "Welcome to Xovalium Dashboard!",
    type: "info",
    updatedAt: new Date()
};

// Comprehensive Bot State Management
let botState = {
    state: 'disconnected',
    pairingCode: null,
    sessionId: null,
    sessions: {}, // sid -> { status, code }
    totalActive: 0
};

const activeWaSockets = new Map();

const updateSessionState = (sid, status, code = null) => {
    botState.sessions[sid] = { state: status, pairingCode: code };
    // Maintain legacy fields for current pairing session
    if (status === 'connecting' || status === 'error') {
        botState.state = status;
        botState.pairingCode = code;
        botState.sessionId = sid;
    }
    botState.totalActive = activeWaSockets.size;
};

let botLogs = [];
const pushLog = (msg) => {
    const entry = { time: new Date().toLocaleTimeString(), message: msg };
    botLogs.push(entry);
    if (botLogs.length > 50) botLogs.shift();
    console.log(`[ TERMINAL ] ${msg}`);
};


export const startServer = (bot) => {
    const app = express();
    
    // Request Logger
    app.use((req, res, next) => {
        if (!req.path.startsWith('/api/admin/bot-state')) {
            console.log(chalk.gray(`[ HTTP ] ${req.method} ${req.path}`));
        }
        next();
    });

    app.use(express.json());
    app.use(cookieParser());

    // Middleware to check authentication
    const authMiddleware = (req, res, next) => {
        const token = req.cookies.auth_token;
        if (!token) {
            if (req.xhr || req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            return res.redirect('/login.html');
        }
        try {
            const decoded = jwt.verify(token, config.app.secretKey);
            req.user = decoded;
            next();
        } catch (err) {
            res.clearCookie('auth_token');
            if (req.xhr || req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'Session expired' });
            }
            return res.redirect('/login.html');
        }
    };

    // Middleware to check admin role
    const adminMiddleware = (req, res, next) => {
        if (req.user && req.user.role === 'owner') {
            next();
        } else {
            res.status(403).json({ error: 'Forbidden: Admin access only' });
        }
    };

    // Public API Routes
    app.post('/api/auth/request-otp', async (req, res) => {
        const { telegramId } = req.body;
        if (!telegramId) return res.status(400).json({ error: "Telegram ID is required" });

        try {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

            await User.findOneAndUpdate(
                { telegramId },
                { otp, otpExpiry },
                { upsert: true }
            );

            console.log(chalk.magenta(`[ DEBUG ] OTP FOR ${telegramId}: ${otp}`));

            await bot.sendMessage(telegramId, `🔐 **Your Login OTP:** \`${otp}\`\nThis code will expire in 5 minutes.`, { parse_mode: "Markdown" });

            res.json({ success: true, message: "OTP sent" });
        } catch (err) {
            res.status(500).json({ error: "Failed to send OTP. Make sure you have started the bot." });
        }
    });

    app.post('/api/auth/verify-otp', async (req, res) => {
        const { telegramId, otp } = req.body;
        try {
            const user = await User.findOne({ telegramId, otp });
            if (!user || user.otpExpiry < new Date()) {
                return res.status(401).json({ error: "Invalid or expired OTP" });
            }

            user.otp = undefined;
            user.otpExpiry = undefined;
            user.isVerified = true;
            user.lastLogin = new Date();
            
            // Assign Owner Role if matches config
            if (user.telegramId === config.app.ownerId) {
                user.role = 'owner';
                user.membership = 'lifetime';
            }
            
            await user.save();

            const token = jwt.sign({ id: user._id, telegramId: user.telegramId, role: user.role }, config.app.secretKey, { expiresIn: '24h' });
            res.cookie('auth_token', token, { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 });
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // API: Get Current User Info
    app.get('/api/user/me', authMiddleware, async (req, res) => {
        try {
            const user = await User.findOne({ telegramId: req.user.telegramId });
            res.json({ success: true, user });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // API: Get App Info (Notifications, etc)
    app.get('/api/app/info', authMiddleware, (req, res) => {
        res.json({ success: true, notification: globalNotification });
    });

    // --- ADMIN ROUTES ---
    app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
        const stats = {
            platform: os.platform(),
            uptime: os.uptime(),
            totalMem: os.totalmem(),
            freeMem: os.freemem(),
            cpuModel: os.cpus()[0].model,
            cpuCores: os.cpus().length,
            loadAvg: os.loadavg()
        };
        res.json({ success: true, stats });
    });

    app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
        try {
            const users = await User.find().sort({ createdAt: -1 });
            res.json({ success: true, users });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/admin/update-membership', authMiddleware, adminMiddleware, async (req, res) => {
        const { telegramId, membership } = req.body;
        try {
            const user = await User.findOneAndUpdate({ telegramId }, { membership }, { new: true });
            if (!user) return res.status(404).json({ error: "User not found" });
            res.json({ success: true, user });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/admin/set-notification', authMiddleware, adminMiddleware, (req, res) => {
        const { message, type } = req.body;
        globalNotification = {
            message,
            type: type || 'info',
            updatedAt: new Date()
        };
        res.json({ success: true, notification: globalNotification });
    });

    // --- BLAST & ATTACK ROUTES ---
    app.post('/api/blast/attack', authMiddleware, async (req, res) => {
        const { jid, type, amount } = req.body;
        
        try {
            // Find user to check membership
            const user = await User.findOne({ telegramId: req.user.telegramId });
                if (!user) return res.status(404).json({ error: "Identity not recognized" });
    
                // Access Control
                const isPrivileged = user.role === 'owner' || user.role === 'developer' || user.membership !== 'free';
                if (!isPrivileged) {
                    return res.status(403).json({ error: "Access Denied: Highly privileged operation" });
                }
    
                if (!jid) return res.status(400).json({ error: "Target identifier required" });
    
                // Get the active WA socket for this session
                const sock = activeWaSockets.get(botState.sessionId);
                if (!sock) return res.status(400).json({ error: "WhatsApp socket not connected" });
    
                const result = await executeAttack(sock, jid, type, amount);
            if (result.success) {
                res.json({ success: true, target: jid });
            } else {
                res.status(500).json({ success: false, error: result.error });
            }
        } catch (err) {
            res.status(500).json({ error: "Kernel level transmission failure" });
        }
    });


    // --- BOT MANAGEMENT ---
    app.get('/api/admin/bot-state', authMiddleware, adminMiddleware, (req, res) => {
        res.json({ 
            success: true, 
            ...botState, 
            logs: botLogs,
            activeSessions: activeWaSockets.size
        });
    });

    app.post('/api/admin/bot-connect', authMiddleware, adminMiddleware, async (req, res) => {
        const { phoneNumber } = req.body;
        if (!phoneNumber) return res.status(400).json({ error: "Phone number required" });

        const cleanedNumber = phoneNumber.replace(/[^0-9]/g, "");
        const sessionId = `session_${cleanedNumber}`;

        // Stop existing socket if re-connecting
        if (activeWaSockets.has(sessionId)) {
            const old = activeWaSockets.get(sessionId);
            try { old.ev.removeAllListeners(); old.ws.close(); } catch(e) {}
            activeWaSockets.delete(sessionId);
        }

        const { connectToWhatsApp } = await import("./plugins/baileys.js");
        try {
            updateSessionState(sessionId, 'connecting', "Pending...");
            pushLog(`Starting connection: ${cleanedNumber}`);
            
            connectToWhatsApp(sessionId, cleanedNumber, (code) => {
                updateSessionState(sessionId, 'connecting', code);
                pushLog(`PAIRING [${cleanedNumber}]: ${code}`);
            }).then((sock) => {
                activeWaSockets.set(sessionId, sock);
                updateSessionState(sessionId, 'connected', null);
                pushLog(`CONNECTED: ${cleanedNumber}`);
            }).catch(e => {
                updateSessionState(sessionId, 'error', null);
                pushLog(`FAILED [${cleanedNumber}]: ${e.message}`);
            });

            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/admin/bot-logout', authMiddleware, adminMiddleware, async (req, res) => {
        const { phoneNumber } = req.body;
        const sid = phoneNumber ? `session_${phoneNumber.replace(/[^0-9]/g, "")}` : botState.sessionId;

        if (activeWaSockets.has(sid)) {
            const sock = activeWaSockets.get(sid);
            try {
                sock.logout();
                sock.ws.close();
            } catch(e) {}
            activeWaSockets.delete(sid);
            updateSessionState(sid, 'disconnected');
            pushLog(`Logged out: ${sid}`);
            res.json({ success: true, message: "Session terminated" });
        } else {
            res.status(404).json({ error: "Session not active" });
        }
    });

    app.post('/api/admin/warm-up', authMiddleware, adminMiddleware, async (req, res) => {
        const targetSockets = Array.from(activeWaSockets.values());
        
        if (targetSockets.length < 2) {
            return res.status(400).json({ error: "Need at least 2 connected accounts for warming up interaction." });
        }

        // Run warming up in background
        accountWarmingUp(targetSockets, (msg) => {
            pushLog(msg);
        });

        res.json({ success: true, message: "Engine Warming Up sequence started in background." });
    });

    app.post('/api/admin/add-function', authMiddleware, adminMiddleware, async (req, res) => {
        const { functionName, code } = req.body;
        if (!functionName || !code) return res.status(400).json({ error: "Function name and code required" });

        const filePath = path.join(__dirname, 'plugins', 'function.js');
        
        // Adjusting to named function style as requested: export async function name(sock, jid) { ... }
        const formattedCode = `\n/**\n * Dynamically added function: ${functionName}\n */\nexport async function ${functionName}(sock, jid) {\n${code.trim()}\n}\nKERNELS["${functionName.toLowerCase()}"] = ${functionName};\n`;

        try {
            fs.appendFileSync(filePath, formattedCode);
            pushLog(`KERNEL: New function '${functionName}' injected successfully.`);
            res.json({ success: true, message: `Function ${functionName} added to kernel.` });
        } catch (err) {
            res.status(500).json({ error: "Failed to write to kernel file" });
        }
    });

    app.get('/api/admin/kernel-list', authMiddleware, async (req, res) => {
        try {
            const { KERNELS } = await import('./plugins/function.js');
            res.json({ success: true, kernels: Object.keys(KERNELS) });
        } catch (err) {
            res.status(500).json({ error: "Failed to load kernels" });
        }
    });

    // Public Static Pages
    app.get('/login.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    });

    // Logout
    app.get('/logout', (req, res) => {
        res.clearCookie('auth_token');
        res.redirect('/login.html');
    });

    // Protected Routes
    app.use((req, res, next) => {
        const publicFiles = ['/login.html', '/api/auth/request-otp', '/api/auth/verify-otp', '/fonts.css', '/transitions.css', '/js/', '/css/'];
        const isPublic = publicFiles.some(p => req.path === p || req.path.startsWith('/api/auth/') || req.path.endsWith('.css') || req.path.includes('/js/'));
        
        if (isPublic) return next();
        authMiddleware(req, res, next);
    });

    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    app.use(express.static(path.join(__dirname, 'public')));

    // --- GLOBAL ERROR HANDLER ---
    app.use((err, req, res, next) => {
        console.error(chalk.red("[ KERNEL PANIC ]"), err);
        if (res.headersSent) return next(err);
        res.status(500).json({ 
            success: false, 
            error: "Internal System Error",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined 
        });
    });

    app.listen(config.app.port, () => {
        console.log(`[ SERVER ] Dashboard running at ${config.app.urlWeb}:${config.app.port}`);
    });
};
