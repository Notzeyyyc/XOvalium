import { startServer } from "./server.js";
import { connectbot } from "./config/auth.js";
import { config } from "./config/settings.js";
import { connectToWhatsApp } from "./plugins/baileys.js";
import connectDB from "./backend/db.js";
import os from "os";

// Connect to MongoDB
connectDB();

export const bot = connectbot();
const activeSessions = new Map();

/**
 * Sends a premium dashboard message
 */
async function sendStartMessage(chatId, username) {
    const uptime = formatUptime(process.uptime());
    const ram = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeRam = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);

    const caption = `
╭━━━━〔 🛠️ **${config.app.name}** 〕━━━━╮
┃
┃  👋 **Hello, ${username}!**
┃  Welcome to the central control panel.
┃
┣━━〔 📊 **SERVER STATUS** 〕━━
┃  » **Status:** 🟢 Online
┃  » **Express:** Listening on port ${config.app.port}
┃  » **Uptime:** ${uptime}
┃  » **RAM:** ${freeRam}GB / ${ram}GB
┃
┣━━〔 🚀 **APP INFO** 〕━━
┃  » **Version:** ${config.app.version}
┃  » **Author:** @${config.app.author}
┃  » **Mode:** Production
┃
┣━━〔 🔑 **LOGIN INFO** 〕━━
┃  » Your ID: \`${chatId}\`
┃  » Use this ID to login on web.
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
   *Powered by Ovalium Technology*`.trim();

    try {
        await bot.sendVideo(chatId, "https://files.catbox.moe/eujf4u.mp4", {
            caption: caption,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "⚙️ Settings", callback_data: "settings" },
                        { text: "📰 Set News", callback_data: "setnews" }
                    ],
                    [
                        { text: "💎 Add VIP", callback_data: "addvip" }
                    ]
                ]
            }
        });
    } catch (error) {
        console.error("Failed to send video:", error.message);
        // Fallback to text if video fails
        bot.sendMessage(chatId, caption, { 
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "⚙️ Settings", callback_data: "settings" },
                        { text: "📰 Set News", callback_data: "setnews" }
                    ],
                    [
                        { text: "💎 Add VIP", callback_data: "addvip" }
                    ]
                ]
            }
        });
    }
}

// Callback Query Handler
bot.on("callback_query", (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === "settings") {
        bot.sendMessage(chatId, "⚙️ **Settings Menu**\nUse `/connect <number>` to pair WhatsApp.", { parse_mode: "Markdown" });
    } else if (data === "setnews") {
        bot.sendMessage(chatId, "📰 **Set News Menu**\nUnder development...", { parse_mode: "Markdown" });
    } else if (data === "addvip") {
        bot.sendMessage(chatId, "💎 **Add VIP Menu**\nUnder development...", { parse_mode: "Markdown" });
    }
    
    bot.answerCallbackQuery(query.id);
});

// Command Handler
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
    
    else if (text.startsWith("/connect")) {
        const args = text.split(" ");
        if (args.length < 2) {
            return bot.sendMessage(chatId, "❌ **Error**\nFormat: `/connect 628xxx`", { parse_mode: "Markdown" });
        }

        const phoneNumber = args[1];
        const sessionId = `session_${chatId}`;
        
        bot.sendMessage(chatId, `⏳ **Requesting pairing code for ${phoneNumber}...**\nPlease check your terminal or wait for a follow-up.`, { parse_mode: "Markdown" });

        try {
            const sock = await connectToWhatsApp(sessionId, phoneNumber);
            activeSessions.set(sessionId, sock);
        } catch (error) {
            bot.sendMessage(chatId, `❌ **Error:** ${error.message}`);
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