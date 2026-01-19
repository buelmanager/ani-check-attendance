const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

/**
 * 알림이 생성되면 해당 사용자의 FCM 토큰으로 푸시 알림 전송
 */
exports.sendPushOnNotification = onDocumentCreated(
  "notifications/{notificationId}",
  async (event) => {
    const notification = event.data?.data();
    if (!notification) {
      console.log("No notification data");
      return;
    }

    const { userId, title, message, type } = notification;

    if (!userId) {
      console.log("No userId in notification");
      return;
    }

    try {
      // 해당 사용자의 FCM 토큰 조회
      const tokensSnapshot = await db
        .collection("fcmTokens")
        .where("userId", "==", userId)
        .get();

      if (tokensSnapshot.empty) {
        console.log(`No FCM tokens found for user: ${userId}`);
        return;
      }

      const tokens = tokensSnapshot.docs.map((doc) => doc.data().token);
      console.log(`Found ${tokens.length} tokens for user: ${userId}`);

      // 알림 타입에 따른 아이콘 설정
      const iconMap = {
        checkin: "check_circle",
        late: "schedule",
        absent: "cancel",
        announcement: "campaign",
      };

      // FCM 메시지 생성
      const fcmMessage = {
        notification: {
          title: title || "ANI WID 알림",
          body: message || "",
        },
        data: {
          type: type || "general",
          notificationId: event.params.notificationId,
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
        webpush: {
          notification: {
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-72x72.png",
            tag: type || "general",
            requireInteraction: type === "absent",
          },
          fcmOptions: {
            link: "/parent/notifications",
          },
        },
      };

      // 각 토큰으로 메시지 전송
      const sendPromises = tokens.map(async (token) => {
        try {
          await messaging.send({
            ...fcmMessage,
            token,
          });
          console.log(`Push sent successfully to token: ${token.substring(0, 20)}...`);
          return { success: true, token };
        } catch (error) {
          console.error(`Failed to send to token: ${token.substring(0, 20)}...`, error.message);

          // 유효하지 않은 토큰 삭제
          if (
            error.code === "messaging/invalid-registration-token" ||
            error.code === "messaging/registration-token-not-registered"
          ) {
            const tokenDoc = tokensSnapshot.docs.find(
              (doc) => doc.data().token === token
            );
            if (tokenDoc) {
              await tokenDoc.ref.delete();
              console.log(`Deleted invalid token: ${token.substring(0, 20)}...`);
            }
          }
          return { success: false, token, error: error.message };
        }
      });

      const results = await Promise.all(sendPromises);
      const successCount = results.filter((r) => r.success).length;
      console.log(`Push notification sent: ${successCount}/${tokens.length} successful`);

    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  }
);
