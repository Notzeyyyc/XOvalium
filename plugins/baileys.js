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
import path from "path";

/**
 * Connect WhatsApp using Pairing Code
 * @param {string} sessionId - Unique ID for the session
 * @param {string} phoneNumber - Phone number with country code (e.g. 628xxx)
 * @param {Function} onUpdate - Callback for status updates (type, data)
 */
export async function connectToWhatsApp(sessionId, phoneNumber, onUpdate) {
    const sessionPath = path.join(process.cwd(), 'sessions', sessionId);
    const credsPath = path.join(sessionPath, 'creds.json');

    // --- SESSION PURGE UTILITY ---
    // If the folder exists but creds.json is missing, it's a zombie session. Purge it.
    if (fs.existsSync(sessionPath) && !fs.existsSync(credsPath)) {
        console.log(chalk.yellow(`[ ENGINE ] Purging incomplete session: ${sessionId}`));
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        } catch (e) {
            console.error(chalk.red(`[ ENGINE ] Failed to purge session folder:`), e.message);
        }
    }

    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
        version,
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }), 
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        browser: ["Ubuntu", "Chrome", "110.0.5481.178"], 
        shouldSyncHistoryMessage: () => false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
    });

    // Request Pairing Code
    if (!sock.authState.creds.registered) {
        if (!phoneNumber) {
            console.log(chalk.red("[ ERROR ] No phone number provided for pairing."));
            throw new Error("Phone number is required for pairing code");
        }
        
        const cleanedNumber = phoneNumber.replace(/[^0-9]/g, "");
        console.log(chalk.cyan(`[ INFO ] Initializing Pairing Sequence for ${cleanedNumber}...`));
        
        let pairingRequestCount = 0;
        const requestPairing = async () => {
            pairingRequestCount++;
            if (pairingRequestCount > 8) {
                console.error(chalk.red("[ ERROR ] Pairing request timed out after 8 attempts."));
                if (onUpdate) onUpdate('error', 'Handshake Timeout: Check your internet connection.');
                return;
            }

            try {
                // Wait for socket to be ready (WS state 1) AND have an initial connection
                if (sock.ws && sock.ws.readyState === 1) {
                    console.log(chalk.cyan(`[ INFO ] Engine Ready. Requesting Pairing Code (Attempt ${pairingRequestCount})...`));
                    const code = await sock.requestPairingCode(cleanedNumber);
                    if (onUpdate) onUpdate('pairing', code);
                    console.log(chalk.yellow(`\n[ PAIRING CODE ] Session: ${sessionId}`));
                    console.log(chalk.black.bgYellow(` CODE: ${code} `));
                    console.log(chalk.yellow(`------------------------------\n`));
                } else {
                    console.log(chalk.gray(`[ INFO ] Waiting for Engine Handshake... (${pairingRequestCount}/8)`));
                    setTimeout(requestPairing, 3000);
                }
            } catch (err) {
                console.error(chalk.red("[ ERROR ] Failed to request pairing code:"), err.message);
                
                if (err.message.includes('rate-overlimit')) {
                    if (onUpdate) onUpdate('error', 'Rate limited by WhatsApp. Please wait 24 hours.');
                } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
                    console.log(chalk.yellow("[ INFO ] Session corrupted. Retrying with fresh purge..."));
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                    setTimeout(requestPairing, 2000);
                } else {
                    setTimeout(requestPairing, 4000); // Backoff
                }
            }
        };

        // Delay initial request to let the socket warm up
        setTimeout(requestPairing, 6000); 
    }

    // --- CONNECTION HANDLERS ---
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // Log diagnostic QR if pairing fails (hidden fallback)
        if (qr) console.log(chalk.gray("[ DIAGNOSTIC ] QR Stream active. If pairing hangs, use QR."));

        if (connection === "close") {
            const statusCode = (lastDisconnect?.error instanceof Boom) ? 
                lastDisconnect.error.output.statusCode : 0;
            
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            console.log(chalk.red(`[ WHATSAPP ] Connection closed (Code: ${statusCode}). Reconnecting: ${shouldReconnect}`));
            if (onUpdate) onUpdate('close', { shouldReconnect, statusCode });
            
            if (shouldReconnect) {
                connectToWhatsApp(sessionId, phoneNumber, onUpdate);
            }
        } else if (connection === "open") {
            console.log(chalk.green(`[ WHATSAPP ] Connected successfully! Session: ${sessionId}`));
            if (onUpdate) onUpdate('open');
        }
    });

    // Trace history sync to detect stalls
    sock.ev.on("messaging-history.sync", ({ progress, isLatest }) => {
        console.log(chalk.gray(`[ SYNC ] History Sync: ${progress}% (Latest: ${isLatest})`));
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        console.log(chalk.cyan(`[ MSG ] ${msg.pushName || 'User'}: ${msg.message.conversation || msg.message.extendedTextMessage?.text || "Media/Other"}`));
    });

    return sock;
}
