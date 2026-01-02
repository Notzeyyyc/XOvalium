/**
 * Modular Kernel: Pingtest
 */
export const version = "1.0.0";
export const hash = "SIG_PINGTEST_INTERNAL";

export async function pingtest(sock, jid) {
    await sock.sendMessage(jid, { text: 'XOVA PING' });
}
