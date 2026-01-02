import { startServer } from "./server.js";
import { connectbot } from "./config/auth.js";
import { config } from "./config/settings.js";
import { connectToWhatsApp } from "./plugins/baileys.js";
import connectDB from "./backend/db.js";
import User from "./backend/models/user.js";
import os from "os";

// Connect to MongoDB
connectDB();

export const bot = connectbot();
const activeSessions = new Map();

/**
 * Sends a premium dashboard message
 */
async function sendStartMessage(chatId, username) {
    let user = await User.findOne({ telegramId: chatId.toString() });
    
    // Auto-create user if record doesn't exist
    if (!user) {
        user = await User.create({ 
            telegramId: chatId.toString(), 
            username: username,
            membership: 'free',
            role: 'user'
        });
    }

    const membershipTag = user.membership.toUpperCase();
    const roleTag = user.role.toUpperCase();

    const caption = `
✨ **XOVALIUM MANAGEMENT SYSTEM** ✨
━━━━━━━━━━━━━━━━━━━━━━━━
👋 **Greetings, ${username}**

Xovalium is a premium all-in-one distribution engine designed for high-performance WhatsApp operations. 

🚀 **PLATFORM FEATURES:**
⟦ 💣 ⟧ **Blast Engine:** High-speed distribution.
⟦ 🖥️ ⟧ **Web Control:** Full automation via WebUI.

🔐 **USER SESSION:**
⟦ 👤 ⟧ **User ID:** \`${chatId}\`
⟦ 🛡️ ⟧ **Access:** \`${membershipTag} [${roleTag}]\`

━━━━━━━━━━━━━━━━━━━━━━━━
*Powered by XWebUI Engine*`.trim();

    const baseUrl = `http://${config.app.urlWeb}:${config.app.port}`;

    try {
        await bot.sendVideo(chatId, "https://files.catbox.moe/eujf4u.mp4", {
            caption: caption,
            parse_mode: "Markdown",
        });
    } catch (error) {
        console.error("Failed to send video:", error.message);
        bot.sendMessage(chatId, caption, { 
            parse_mode: "Markdown",
        });
    }
}

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.first_name || "User";

    if (!text) return;

    if (text === "/start") {
        sendStartMessage(chatId, username);
    } 
    
    else if (text === "/id") {
        bot.sendMessage(chatId, `🆔 **Your Telegram ID:** \`${chatId}\``, { parse_mode: "Markdown" });
    }

    // --- KERNEL TOOLS ---
    else if (text.startsWith("/wrap")) {
        const code = text.replace("/wrap", "").trim();
        if (!code) return bot.sendMessage(chatId, "❌ **Usage:** `/wrap [logic]`\nExample: `/wrap await sock.sendMessage(...)`", { parse_mode: "Markdown" });

        const sig = "SIG_" + Math.random().toString(36).substring(7).toUpperCase();
        const wrapped = `export const version = "1.0.0";\nexport const hash = "${sig}";\n\nexport async function custom_unit(sock, jid) {\n    ${code.split('\n').join('\n    ')}\n}`;
        
        bot.sendMessage(chatId, "🛠️ **Module Wrapped!**\nInject this persistent unit into the Kernel Lab:", { parse_mode: "Markdown" });
        bot.sendMessage(chatId, "```javascript\n" + wrapped + "\n```", { parse_mode: "Markdown" });
    }

    else if (text.startsWith("/verify")) {
        const code = text.replace("/verify", "").trim();
        const hasVersion = code.includes("export const version");
        const hasHash = code.includes("export const hash");
        const hasFunction = code.includes("async function") && code.includes("(sock, jid)");

        if (hasVersion && hasHash && hasFunction) {
            bot.sendMessage(chatId, "✅ **Verification Passed:** Unit is compliant with the Xovalium Engine (v2.0).");
        } else {
            bot.sendMessage(chatId, `❌ **Verification Failed:**\n- Version Export: ${hasVersion ? '✅' : '❌'}\n- Hash Fingerprint: ${hasHash ? '✅' : '❌'}\n- Function Sig: ${hasFunction ? '✅' : '❌'}`);
        }
    }
});

bot.onCommand = function (command, callback) {
  const regex = new RegExp(`^/${command}(?:\\s+(.*))?$`);
  bot.onText(regex, (msg, match) => {
    callback(msg, match);
  });
};

// contoh penggunaan: /test
bot.onCommand('test', (msg) => {
  const chatId = msg.chat.id;
  // kirim balik JSON dari parameter msg
  bot.sendMessage(chatId, JSON.stringify(msg, null, 2));
});

// Start Express Server
startServer(bot);

// Helper
function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
}