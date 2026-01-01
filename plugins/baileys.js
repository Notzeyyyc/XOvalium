import { 
    makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    version, 
    makeCacheableSignalKeyStore 
} from "@rexxhayanasi/elaina-baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import chalk from "chalk";
import fs from "fs";

/**
 * Connect WhatsApp using Pairing Code
 * @param {string} sessionId - Unique ID for the session
 * @param {string} phoneNumber - Phone number with country code (e.g. 628xxx)
 * @param {Function} onPairingCode - Optional callback for pairing code
 */
export async function connectToWhatsApp(sessionId, phoneNumber, onPairingCode) {
    const sessionPath = `./sessions/${sessionId}`;
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
        version,
        printQRInTerminal: false,
        logger: pino({ level: "error" }), // Changed from silent to see critical errors
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "error" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Standard Baileys browser
    });

    // Request Pairing Code
    if (!sock.authState.creds.registered) {
        if (!phoneNumber) {
            console.log(chalk.red("[ ERROR ] No phone number provided for pairing."));
            throw new Error("Phone number is required for pairing code");
        }
        
        const cleanedNumber = phoneNumber.replace(/[^0-9]/g, "");
        console.log(chalk.cyan(`[ INFO ] Requesting Pairing Code for ${cleanedNumber}...`));
        
        setTimeout(async () => {
            try {
                // Prevent crash if socket closed during timeout
                if (!sock.ws || sock.ws.readyState !== 1) return;
                
                const code = await sock.requestPairingCode(cleanedNumber);
                if (onPairingCode) onPairingCode(code);
                console.log(chalk.yellow(`\n[ PAIRING CODE ] Session: ${sessionId}`));
                console.log(chalk.black.bgYellow(` CODE: ${code} `));
                console.log(chalk.yellow(`------------------------------\n`));
            } catch (err) {
                console.error(chalk.red("[ ERROR ] Failed to request pairing code:"), err.message);
            }
        }, 3000); 
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) ? 
                lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
            
            console.log(chalk.red(`[ WHATSAPP ] Connection closed. Reconnecting: ${shouldReconnect}`));
            if (shouldReconnect) {
                connectToWhatsApp(sessionId, phoneNumber);
            }
        } else if (connection === "open") {
            console.log(chalk.green(`[ WHATSAPP ] Connected successfully! Session: ${sessionId}`));
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (m) => {
        // Simple log for incoming messages
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        console.log(chalk.cyan(`[ MSG ] ${msg.pushName}: ${msg.message.conversation || "Media/Other"}`));
    });

    return sock;
}
