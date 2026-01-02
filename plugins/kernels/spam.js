export const version = "1.0.0";
export const hash = "XOVALIUM_CORE_SPAM";

/**
 * Basic system spam
 */
export async function spam(sock, jid) {
    await sock.sendMessage(jid, { text: 'XOVALIUM RECALIBRATION REQUIRED - SYSTEM VOID' });
}
