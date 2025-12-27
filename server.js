import { config } from "./config/settings.js";
import express from "express";
import path from "path";
import { fileURLToPath } from 'url';
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import User from "./backend/models/user.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const startServer = (bot) => {
    const app = express();
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

    app.listen(config.app.port, () => {
        console.log(`[ SERVER ] Dashboard running at ${config.app.urlWeb}:${config.app.port}`);
    });
};
