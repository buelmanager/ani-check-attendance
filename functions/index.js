const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getAuth } = require("firebase-admin/auth");

initializeApp();

const auth = getAuth();

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

      // FCM 메시지 생성 (data-only 메시지로 중복 알림 방지)
      // notification 필드를 사용하지 않고 data만 사용하여 Service Worker에서만 알림 표시
      const fcmMessage = {
        data: {
          title: title || "ANI WID 알림",
          body: message || "",
          type: type || "general",
          notificationId: event.params.notificationId,
          url: "/parent/notifications",
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

/**
 * Firebase Auth 사용자 삭제 (Admin SDK 사용)
 * 클라이언트에서 호출: httpsCallable(functions, 'deleteAuthUser')
 */
exports.deleteAuthUser = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    // 호출자 인증 확인
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const { uid } = request.data;
    if (!uid) {
      throw new HttpsError("invalid-argument", "삭제할 사용자 UID가 필요합니다.");
    }

    // 호출자가 관리자인지 확인
    const callerUid = request.auth.uid;
    try {
      const adminDoc = await db.collection("admins").doc(callerUid).get();
      if (!adminDoc.exists) {
        throw new HttpsError("permission-denied", "관리자만 사용자를 삭제할 수 있습니다.");
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error("Error checking admin status:", error);
      throw new HttpsError("internal", "관리자 권한 확인 중 오류가 발생했습니다.");
    }

    // Firebase Auth에서 사용자 삭제
    try {
      await auth.deleteUser(uid);
      console.log(`Successfully deleted user: ${uid}`);
      return { success: true, message: "사용자가 삭제되었습니다." };
    } catch (error) {
      console.error(`Error deleting user ${uid}:`, error);
      if (error.code === "auth/user-not-found") {
        // 이미 삭제된 경우 성공으로 처리
        return { success: true, message: "사용자가 이미 삭제되었습니다." };
      }
      throw new HttpsError("internal", `사용자 삭제 실패: ${error.message}`);
    }
  }
);

/**
 * 여러 Firebase Auth 사용자 일괄 삭제
 */
exports.deleteAuthUsers = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const { uids } = request.data;
    if (!uids || !Array.isArray(uids) || uids.length === 0) {
      throw new HttpsError("invalid-argument", "삭제할 사용자 UID 배열이 필요합니다.");
    }

    // 호출자가 관리자인지 확인
    const callerUid = request.auth.uid;
    try {
      const adminDoc = await db.collection("admins").doc(callerUid).get();
      if (!adminDoc.exists) {
        throw new HttpsError("permission-denied", "관리자만 사용자를 삭제할 수 있습니다.");
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "관리자 권한 확인 중 오류가 발생했습니다.");
    }

    // 최대 1000명까지 일괄 삭제 가능 (Firebase 제한)
    const batchSize = Math.min(uids.length, 1000);
    const uidsToDelete = uids.slice(0, batchSize);

    try {
      const result = await auth.deleteUsers(uidsToDelete);
      console.log(`Batch delete result: ${result.successCount} succeeded, ${result.failureCount} failed`);

      return {
        success: true,
        successCount: result.successCount,
        failureCount: result.failureCount,
        errors: result.errors.map(e => ({ index: e.index, error: e.error.message }))
      };
    } catch (error) {
      console.error("Error in batch delete:", error);
      throw new HttpsError("internal", `일괄 삭제 실패: ${error.message}`);
    }
  }
);

// 이메일 생성 헬퍼 함수
function generateStudentEmail(phone) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  return `student_${cleanPhone}@academy.local`;
}

function generateGuardianEmail(phone) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  return `guardian_${cleanPhone}@academy.local`;
}

// 6자리 랜덤 초대 코드 생성
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * 학생+부모 일괄 등록 (서버에서 처리하여 rate limit 회피)
 * Admin SDK는 클라이언트 SDK와 달리 rate limit이 훨씬 높음
 */
exports.batchCreateStudents = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 540, // 9분 타임아웃 (최대 540초)
    memory: "512MiB"
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const { students } = request.data;
    if (!students || !Array.isArray(students) || students.length === 0) {
      throw new HttpsError("invalid-argument", "등록할 학생 데이터가 필요합니다.");
    }

    // 호출자가 관리자인지 확인
    const callerUid = request.auth.uid;
    try {
      const adminDoc = await db.collection("admins").doc(callerUid).get();
      if (!adminDoc.exists) {
        throw new HttpsError("permission-denied", "관리자만 학생을 등록할 수 있습니다.");
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "관리자 권한 확인 중 오류가 발생했습니다.");
    }

    console.log(`Starting batch create for ${students.length} students`);

    const results = {
      success: true,
      totalStudents: students.length,
      createdStudents: 0,
      createdParents: 0,
      errors: []
    };

    // 순차 처리 (병렬 처리하면 rate limit 걸릴 수 있음)
    for (let i = 0; i < students.length; i++) {
      const studentData = students[i];

      try {
        console.log(`Processing student ${i + 1}/${students.length}: ${studentData.name}`);

        // 1. 학생 Firestore 문서 생성
        const studentPhone = studentData.phone.replace(/[^0-9]/g, '');
        const studentEmail = generateStudentEmail(studentPhone);
        const inviteCode = generateInviteCode();

        const studentDocData = {
          name: studentData.name,
          phone: studentData.phone,
          birthDate: studentData.birthDate || null,
          gender: studentData.gender || null,
          school: studentData.school || '',
          grade: studentData.grade || '',
          address: studentData.address || '',
          notes: studentData.notes || '',
          status: 'active',
          inviteCode,
          parentIds: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const studentRef = await db.collection("students").add(studentDocData);
        const studentId = studentRef.id;
        console.log(`Created student document: ${studentId}`);

        // 2. 학생 Firebase Auth 계정 생성
        let studentUid = null;
        try {
          const studentUser = await auth.createUser({
            email: studentEmail,
            password: studentPhone,
            displayName: studentData.name
          });
          studentUid = studentUser.uid;
          console.log(`Created student auth: ${studentUid}`);

          // 학생 문서에 userId 업데이트
          await studentRef.update({ userId: studentUid });

          // authMappings에 저장
          await db.collection("authMappings").doc(`student_${studentPhone}`).set({
            userType: 'student',
            firestoreId: studentId,
            firebaseUid: studentUid,
            email: studentEmail,
            name: studentData.name,
            createdAt: new Date()
          });

          results.createdStudents++;
        } catch (authError) {
          console.error(`Student auth error for ${studentData.name}:`, authError.message);
          if (authError.code !== 'auth/email-already-exists') {
            results.errors.push({
              index: i,
              type: 'student_auth',
              name: studentData.name,
              error: authError.message
            });
          }
        }

        // 3. 부모 정보가 있으면 부모도 생성
        if (studentData.parent && studentData.parent.phone) {
          const parentPhone = studentData.parent.phone.replace(/[^0-9]/g, '');
          const parentEmail = generateGuardianEmail(parentPhone);

          // 기존 부모 확인
          const existingParentQuery = await db.collection("parents")
            .where("phone", "==", studentData.parent.phone)
            .limit(1)
            .get();

          let parentId = null;

          if (!existingParentQuery.empty) {
            // 기존 부모에 학생 연결
            parentId = existingParentQuery.docs[0].id;
            const existingParentData = existingParentQuery.docs[0].data();
            const currentStudentIds = existingParentData.studentIds || [];

            if (!currentStudentIds.includes(studentId)) {
              await db.collection("parents").doc(parentId).update({
                studentIds: [...currentStudentIds, studentId],
                updatedAt: new Date()
              });
            }
            console.log(`Linked to existing parent: ${parentId}`);
          } else {
            // 새 부모 생성
            const parentDocData = {
              name: studentData.parent.name,
              phone: studentData.parent.phone,
              email: parentEmail,
              studentIds: [studentId],
              createdAt: new Date(),
              updatedAt: new Date()
            };

            if (studentData.parent.relationType) {
              parentDocData.relationType = studentData.parent.relationType;
            }

            const parentRef = await db.collection("parents").add(parentDocData);
            parentId = parentRef.id;
            console.log(`Created parent document: ${parentId}`);

            // 부모 Firebase Auth 계정 생성
            try {
              const parentUser = await auth.createUser({
                email: parentEmail,
                password: parentPhone,
                displayName: studentData.parent.name
              });
              const parentUid = parentUser.uid;
              console.log(`Created parent auth: ${parentUid}`);

              // 부모 문서에 userId 업데이트
              await parentRef.update({ userId: parentUid });

              // authMappings에 저장
              await db.collection("authMappings").doc(`guardian_${parentPhone}`).set({
                userType: 'guardian',
                firestoreId: parentId,
                firebaseUid: parentUid,
                email: parentEmail,
                name: studentData.parent.name,
                createdAt: new Date()
              });

              results.createdParents++;
            } catch (parentAuthError) {
              console.error(`Parent auth error for ${studentData.parent.name}:`, parentAuthError.message);
              if (parentAuthError.code !== 'auth/email-already-exists') {
                results.errors.push({
                  index: i,
                  type: 'parent_auth',
                  name: studentData.parent.name,
                  error: parentAuthError.message
                });
              }
            }
          }

          // 학생 문서에 부모 ID 연결
          if (parentId) {
            await studentRef.update({
              parentIds: [parentId],
              updatedAt: new Date()
            });
          }
        }

      } catch (error) {
        console.error(`Error processing student ${i}:`, error);
        results.errors.push({
          index: i,
          type: 'general',
          name: studentData.name,
          error: error.message
        });
      }
    }

    console.log(`Batch create completed: ${results.createdStudents} students, ${results.createdParents} parents`);
    return results;
  }
);

/**
 * 학생+부모 일괄 삭제 (서버에서 처리)
 * Firestore 문서와 Firebase Auth 계정 모두 삭제
 */
exports.batchDeleteStudents = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 540,
    memory: "512MiB"
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const { studentIds, deleteParents = false } = request.data;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      throw new HttpsError("invalid-argument", "삭제할 학생 ID 배열이 필요합니다.");
    }

    // 호출자가 관리자인지 확인
    const callerUid = request.auth.uid;
    try {
      const adminDoc = await db.collection("admins").doc(callerUid).get();
      if (!adminDoc.exists) {
        throw new HttpsError("permission-denied", "관리자만 학생을 삭제할 수 있습니다.");
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "관리자 권한 확인 중 오류가 발생했습니다.");
    }

    console.log(`Starting batch delete for ${studentIds.length} students`);

    const results = {
      success: true,
      totalStudents: studentIds.length,
      deletedStudents: 0,
      deletedParents: 0,
      deletedAuthUsers: 0,
      errors: []
    };

    const authUidsToDelete = [];
    const parentIdsToCheck = new Set();

    // 순차 처리
    for (let i = 0; i < studentIds.length; i++) {
      const studentId = studentIds[i];

      try {
        console.log(`Processing student ${i + 1}/${studentIds.length}: ${studentId}`);

        // 학생 문서 조회
        const studentDoc = await db.collection("students").doc(studentId).get();
        if (!studentDoc.exists) {
          console.log(`Student not found: ${studentId}`);
          continue;
        }

        const studentData = studentDoc.data();

        // 학생의 Auth UID 수집
        if (studentData.userId) {
          authUidsToDelete.push(studentData.userId);
        }

        // 연결된 부모 ID 수집
        if (studentData.parentIds && studentData.parentIds.length > 0) {
          studentData.parentIds.forEach(pid => parentIdsToCheck.add(pid));
        }

        // 관련 출석 기록 삭제
        const attendanceQuery = await db.collection("attendance")
          .where("studentId", "==", studentId)
          .get();

        const attendanceBatch = db.batch();
        attendanceQuery.docs.forEach(doc => {
          attendanceBatch.delete(doc.ref);
        });
        if (!attendanceQuery.empty) {
          await attendanceBatch.commit();
          console.log(`Deleted ${attendanceQuery.docs.length} attendance records`);
        }

        // authMappings에서 학생 삭제
        if (studentData.phone) {
          const cleanPhone = studentData.phone.replace(/[^0-9]/g, '');
          const mappingDoc = db.collection("authMappings").doc(`student_${cleanPhone}`);
          const mappingSnapshot = await mappingDoc.get();
          if (mappingSnapshot.exists) {
            await mappingDoc.delete();
          }
        }

        // 학생 문서 삭제
        await db.collection("students").doc(studentId).delete();
        results.deletedStudents++;
        console.log(`Deleted student: ${studentId}`);

      } catch (error) {
        console.error(`Error deleting student ${studentId}:`, error);
        results.errors.push({
          index: i,
          type: 'student',
          id: studentId,
          error: error.message
        });
      }
    }

    // 부모 처리 (deleteParents 옵션에 따라)
    if (deleteParents && parentIdsToCheck.size > 0) {
      for (const parentId of parentIdsToCheck) {
        try {
          const parentDoc = await db.collection("parents").doc(parentId).get();
          if (!parentDoc.exists) continue;

          const parentData = parentDoc.data();

          // 부모의 Auth UID 수집
          if (parentData.userId) {
            authUidsToDelete.push(parentData.userId);
          }

          // authMappings에서 부모 삭제
          if (parentData.phone) {
            const cleanPhone = parentData.phone.replace(/[^0-9]/g, '');
            const mappingDoc = db.collection("authMappings").doc(`guardian_${cleanPhone}`);
            const mappingSnapshot = await mappingDoc.get();
            if (mappingSnapshot.exists) {
              await mappingDoc.delete();
            }
          }

          // 부모 문서 삭제
          await db.collection("parents").doc(parentId).delete();
          results.deletedParents++;
          console.log(`Deleted parent: ${parentId}`);

        } catch (error) {
          console.error(`Error deleting parent ${parentId}:`, error);
          results.errors.push({
            type: 'parent',
            id: parentId,
            error: error.message
          });
        }
      }
    } else if (parentIdsToCheck.size > 0) {
      // deleteParents가 false인 경우, 부모의 studentIds에서 삭제된 학생 제거
      for (const parentId of parentIdsToCheck) {
        try {
          const parentDoc = await db.collection("parents").doc(parentId).get();
          if (!parentDoc.exists) continue;

          const parentData = parentDoc.data();
          const currentStudentIds = parentData.studentIds || [];
          const updatedStudentIds = currentStudentIds.filter(sid => !studentIds.includes(sid));

          await db.collection("parents").doc(parentId).update({
            studentIds: updatedStudentIds,
            updatedAt: new Date()
          });
          console.log(`Updated parent ${parentId}: removed deleted students`);

        } catch (error) {
          console.error(`Error updating parent ${parentId}:`, error);
        }
      }
    }

    // Firebase Auth 일괄 삭제
    if (authUidsToDelete.length > 0) {
      try {
        const deleteResult = await auth.deleteUsers(authUidsToDelete);
        results.deletedAuthUsers = deleteResult.successCount;
        console.log(`Auth delete result: ${deleteResult.successCount} succeeded, ${deleteResult.failureCount} failed`);
      } catch (error) {
        console.error("Error deleting auth users:", error);
        results.errors.push({
          type: 'auth_batch',
          error: error.message
        });
      }
    }

    console.log(`Batch delete completed: ${results.deletedStudents} students, ${results.deletedParents} parents, ${results.deletedAuthUsers} auth users`);
    return results;
  }
);

/**
 * 엑셀/백업에서 학생+부모 일괄 복원 (서버에서 처리)
 * batchCreateStudents와 유사하지만 기존 ID 유지 옵션 지원
 */
exports.batchRestoreStudents = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 540,
    memory: "512MiB"
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const { students, parents = [], preserveIds = false } = request.data;
    if (!students || !Array.isArray(students) || students.length === 0) {
      throw new HttpsError("invalid-argument", "복원할 학생 데이터가 필요합니다.");
    }

    // 호출자가 관리자인지 확인
    const callerUid = request.auth.uid;
    try {
      const adminDoc = await db.collection("admins").doc(callerUid).get();
      if (!adminDoc.exists) {
        throw new HttpsError("permission-denied", "관리자만 데이터를 복원할 수 있습니다.");
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "관리자 권한 확인 중 오류가 발생했습니다.");
    }

    console.log(`Starting batch restore for ${students.length} students and ${parents.length} parents`);

    const results = {
      success: true,
      totalStudents: students.length,
      totalParents: parents.length,
      createdStudents: 0,
      createdParents: 0,
      createdAuthUsers: 0,
      errors: []
    };

    // ID 매핑 (기존 ID -> 새 ID)
    const studentIdMap = new Map();
    const parentIdMap = new Map();

    // 1. 먼저 부모 데이터 복원
    for (let i = 0; i < parents.length; i++) {
      const parentData = parents[i];

      try {
        console.log(`Processing parent ${i + 1}/${parents.length}: ${parentData.name}`);

        const oldParentId = parentData.id;
        const parentPhone = parentData.phone ? parentData.phone.replace(/[^0-9]/g, '') : '';
        const parentEmail = parentPhone ? generateGuardianEmail(parentPhone) : `guardian_${Date.now()}_${i}@academy.local`;

        // 기존 부모 확인 (전화번호로)
        let existingParentId = null;
        if (parentData.phone) {
          const existingQuery = await db.collection("parents")
            .where("phone", "==", parentData.phone)
            .limit(1)
            .get();

          if (!existingQuery.empty) {
            existingParentId = existingQuery.docs[0].id;
            parentIdMap.set(oldParentId, existingParentId);
            console.log(`Parent already exists: ${existingParentId}`);
            continue;
          }
        }

        // 부모 문서 생성
        const parentDocData = {
          name: parentData.name,
          phone: parentData.phone || '',
          email: parentEmail,
          studentIds: [], // 나중에 업데이트
          createdAt: new Date(),
          updatedAt: new Date()
        };

        if (parentData.relationType) {
          parentDocData.relationType = parentData.relationType;
        }

        const parentRef = await db.collection("parents").add(parentDocData);
        const newParentId = parentRef.id;
        parentIdMap.set(oldParentId, newParentId);
        console.log(`Created parent document: ${newParentId}`);

        // 부모 Auth 계정 생성
        if (parentPhone) {
          try {
            const parentUser = await auth.createUser({
              email: parentEmail,
              password: parentPhone,
              displayName: parentData.name
            });
            const parentUid = parentUser.uid;

            await parentRef.update({ userId: parentUid });

            await db.collection("authMappings").doc(`guardian_${parentPhone}`).set({
              userType: 'guardian',
              firestoreId: newParentId,
              firebaseUid: parentUid,
              email: parentEmail,
              name: parentData.name,
              createdAt: new Date()
            });

            results.createdAuthUsers++;
            console.log(`Created parent auth: ${parentUid}`);
          } catch (authError) {
            if (authError.code !== 'auth/email-already-exists') {
              console.error(`Parent auth error:`, authError.message);
            }
          }
        }

        results.createdParents++;

      } catch (error) {
        console.error(`Error restoring parent ${i}:`, error);
        results.errors.push({
          index: i,
          type: 'parent',
          name: parentData.name,
          error: error.message
        });
      }
    }

    // 2. 학생 데이터 복원
    for (let i = 0; i < students.length; i++) {
      const studentData = students[i];

      try {
        console.log(`Processing student ${i + 1}/${students.length}: ${studentData.name}`);

        const studentPhone = studentData.phone ? studentData.phone.replace(/[^0-9]/g, '') : '';
        const studentEmail = studentPhone ? generateStudentEmail(studentPhone) : `student_${Date.now()}_${i}@academy.local`;
        const inviteCode = studentData.inviteCode || generateInviteCode();

        // parentIds 매핑 변환
        let newParentIds = [];
        if (studentData.parentIds && studentData.parentIds.length > 0) {
          newParentIds = studentData.parentIds
            .map(oldId => parentIdMap.get(oldId) || oldId)
            .filter(id => id);
        }

        // 학생 문서 생성
        const studentDocData = {
          name: studentData.name,
          phone: studentData.phone || '',
          birthDate: studentData.birthDate || null,
          gender: studentData.gender || null,
          school: studentData.school || '',
          grade: studentData.grade || '',
          address: studentData.address || '',
          notes: studentData.notes || '',
          status: studentData.status || 'active',
          inviteCode,
          parentIds: newParentIds,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const studentRef = await db.collection("students").add(studentDocData);
        const newStudentId = studentRef.id;
        studentIdMap.set(studentData.id, newStudentId);
        console.log(`Created student document: ${newStudentId}`);

        // 부모 문서에 학생 ID 추가
        for (const parentId of newParentIds) {
          try {
            const parentDoc = await db.collection("parents").doc(parentId).get();
            if (parentDoc.exists) {
              const parentData = parentDoc.data();
              const currentStudentIds = parentData.studentIds || [];
              if (!currentStudentIds.includes(newStudentId)) {
                await db.collection("parents").doc(parentId).update({
                  studentIds: [...currentStudentIds, newStudentId],
                  updatedAt: new Date()
                });
              }
            }
          } catch (err) {
            console.error(`Error updating parent ${parentId}:`, err);
          }
        }

        // 학생 Auth 계정 생성
        if (studentPhone) {
          try {
            const studentUser = await auth.createUser({
              email: studentEmail,
              password: studentPhone,
              displayName: studentData.name
            });
            const studentUid = studentUser.uid;

            await studentRef.update({ userId: studentUid });

            await db.collection("authMappings").doc(`student_${studentPhone}`).set({
              userType: 'student',
              firestoreId: newStudentId,
              firebaseUid: studentUid,
              email: studentEmail,
              name: studentData.name,
              createdAt: new Date()
            });

            results.createdAuthUsers++;
            console.log(`Created student auth: ${studentUid}`);
          } catch (authError) {
            if (authError.code !== 'auth/email-already-exists') {
              console.error(`Student auth error:`, authError.message);
            }
          }
        }

        results.createdStudents++;

      } catch (error) {
        console.error(`Error restoring student ${i}:`, error);
        results.errors.push({
          index: i,
          type: 'student',
          name: studentData.name,
          error: error.message
        });
      }
    }

    console.log(`Batch restore completed: ${results.createdStudents} students, ${results.createdParents} parents, ${results.createdAuthUsers} auth users`);
    return results;
  }
);
