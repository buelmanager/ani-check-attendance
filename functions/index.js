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
          title: title || "CheckMate 알림",
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
 * 학생+부모 일괄 삭제 (서버에서 처리) - 최적화 버전
 * Firestore batch write와 병렬 처리로 성능 개선
 */
exports.batchDeleteStudents = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 540,
    memory: "1GiB"
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

    console.log(`Starting optimized batch delete for ${studentIds.length} students`);

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
    const studentPhonesToDelete = [];
    const attendanceIdsToDelete = [];

    // 1단계: 모든 학생 문서 병렬 조회
    console.log('Phase 1: Fetching all student documents...');
    const studentDocs = await Promise.all(
      studentIds.map(id => db.collection("students").doc(id).get())
    );

    // 학생 데이터 수집
    const validStudents = [];
    for (let i = 0; i < studentDocs.length; i++) {
      const doc = studentDocs[i];
      if (!doc.exists) {
        console.log(`Student not found: ${studentIds[i]}`);
        continue;
      }

      const data = doc.data();
      validStudents.push({ id: doc.id, data });

      if (data.userId) {
        authUidsToDelete.push(data.userId);
      }

      if (data.parentIds && data.parentIds.length > 0) {
        data.parentIds.forEach(pid => parentIdsToCheck.add(pid));
      }

      if (data.phone) {
        const cleanPhone = data.phone.replace(/[^0-9]/g, '');
        studentPhonesToDelete.push(cleanPhone);
      }
    }

    console.log(`Found ${validStudents.length} valid students to delete`);

    // 2단계: 출석 기록 조회 (병렬)
    console.log('Phase 2: Fetching attendance records...');
    const attendanceQueries = await Promise.all(
      validStudents.map(s =>
        db.collection("attendance").where("studentId", "==", s.id).get()
      )
    );

    attendanceQueries.forEach(query => {
      query.docs.forEach(doc => attendanceIdsToDelete.push(doc.ref));
    });

    console.log(`Found ${attendanceIdsToDelete.length} attendance records to delete`);

    // 3단계: Firestore batch delete (최대 500개씩)
    console.log('Phase 3: Batch deleting Firestore documents...');

    // 출석 기록 삭제
    for (let i = 0; i < attendanceIdsToDelete.length; i += 500) {
      const batch = db.batch();
      const chunk = attendanceIdsToDelete.slice(i, i + 500);
      chunk.forEach(ref => batch.delete(ref));
      await batch.commit();
      console.log(`Deleted attendance batch ${Math.floor(i/500) + 1}`);
    }

    // authMappings 삭제 (학생)
    for (let i = 0; i < studentPhonesToDelete.length; i += 500) {
      const batch = db.batch();
      const chunk = studentPhonesToDelete.slice(i, i + 500);
      chunk.forEach(phone => {
        batch.delete(db.collection("authMappings").doc(`student_${phone}`));
      });
      await batch.commit();
    }

    // 학생 문서 삭제
    for (let i = 0; i < validStudents.length; i += 500) {
      const batch = db.batch();
      const chunk = validStudents.slice(i, i + 500);
      chunk.forEach(s => {
        batch.delete(db.collection("students").doc(s.id));
      });
      await batch.commit();
      results.deletedStudents += chunk.length;
      console.log(`Deleted students batch ${Math.floor(i/500) + 1}`);
    }

    // 4단계: 부모 처리
    console.log('Phase 4: Processing parents...');
    if (deleteParents && parentIdsToCheck.size > 0) {
      const parentIds = Array.from(parentIdsToCheck);

      // 부모 문서 병렬 조회
      const parentDocs = await Promise.all(
        parentIds.map(id => db.collection("parents").doc(id).get())
      );

      const parentPhonesToDelete = [];
      const validParentIds = [];

      for (const doc of parentDocs) {
        if (!doc.exists) continue;
        const data = doc.data();
        validParentIds.push(doc.id);

        if (data.userId) {
          authUidsToDelete.push(data.userId);
        }

        if (data.phone) {
          const cleanPhone = data.phone.replace(/[^0-9]/g, '');
          parentPhonesToDelete.push(cleanPhone);
        }
      }

      // authMappings 삭제 (부모)
      for (let i = 0; i < parentPhonesToDelete.length; i += 500) {
        const batch = db.batch();
        const chunk = parentPhonesToDelete.slice(i, i + 500);
        chunk.forEach(phone => {
          batch.delete(db.collection("authMappings").doc(`guardian_${phone}`));
        });
        await batch.commit();
      }

      // 부모 문서 삭제
      for (let i = 0; i < validParentIds.length; i += 500) {
        const batch = db.batch();
        const chunk = validParentIds.slice(i, i + 500);
        chunk.forEach(id => {
          batch.delete(db.collection("parents").doc(id));
        });
        await batch.commit();
        results.deletedParents += chunk.length;
      }

      console.log(`Deleted ${results.deletedParents} parents`);

    } else if (parentIdsToCheck.size > 0) {
      // deleteParents가 false인 경우, 부모의 studentIds에서 삭제된 학생 제거
      const parentIds = Array.from(parentIdsToCheck);
      const parentDocs = await Promise.all(
        parentIds.map(id => db.collection("parents").doc(id).get())
      );

      for (let i = 0; i < parentDocs.length; i += 500) {
        const batch = db.batch();
        const chunk = parentDocs.slice(i, i + 500);

        for (const doc of chunk) {
          if (!doc.exists) continue;
          const data = doc.data();
          const currentStudentIds = data.studentIds || [];
          const updatedStudentIds = currentStudentIds.filter(sid => !studentIds.includes(sid));

          batch.update(doc.ref, {
            studentIds: updatedStudentIds,
            updatedAt: new Date()
          });
        }

        await batch.commit();
      }

      console.log(`Updated ${parentIds.length} parents (removed deleted students)`);
    }

    // 5단계: Firebase Auth 일괄 삭제
    console.log('Phase 5: Deleting Auth users...');
    if (authUidsToDelete.length > 0) {
      try {
        // Firebase Auth는 한 번에 최대 1000개까지 삭제 가능
        for (let i = 0; i < authUidsToDelete.length; i += 1000) {
          const chunk = authUidsToDelete.slice(i, i + 1000);
          const deleteResult = await auth.deleteUsers(chunk);
          results.deletedAuthUsers += deleteResult.successCount;
          console.log(`Auth delete batch ${Math.floor(i/1000) + 1}: ${deleteResult.successCount} succeeded`);
        }
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

    const { students, parents = [], parentChildMap = {} } = request.data;
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
    console.log(`Parent-child map:`, JSON.stringify(parentChildMap));

    const results = {
      success: true,
      totalStudents: students.length,
      totalParents: parents.length,
      createdStudents: 0,
      createdParents: 0,
      createdAuthUsers: 0,
      linkedParentStudent: 0,
      errors: []
    };

    // ID 매핑 (기존 ID -> 새 ID)
    const parentIdMap = new Map(); // oldId or phone -> newParentId
    const parentPhoneToId = new Map(); // phone -> parentId (새로 생성된 부모)
    const studentNameToId = new Map(); // studentName -> studentId (새로 생성된 학생)

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
            parentPhoneToId.set(parentData.phone, existingParentId);
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
        if (parentData.phone) {
          parentPhoneToId.set(parentData.phone, newParentId);
        }
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

    // 2. 학생 데이터 복원 (보호자 정보 포함)
    for (let i = 0; i < students.length; i++) {
      const studentData = students[i];

      try {
        console.log(`Processing student ${i + 1}/${students.length}: ${studentData.name}`);

        const studentPhone = studentData.phone ? studentData.phone.replace(/[^0-9]/g, '') : '';
        const studentEmail = studentPhone ? generateStudentEmail(studentPhone) : `student_${Date.now()}_${i}@academy.local`;
        const inviteCode = studentData.inviteCode || generateInviteCode();

        // 기존 학생 확인 (전화번호로 중복 체크)
        let existingStudentId = null;
        let studentRef = null;
        let newStudentId = null;

        if (studentData.phone) {
          const existingStudentQuery = await db.collection("students")
            .where("phone", "==", studentData.phone)
            .limit(1)
            .get();

          if (!existingStudentQuery.empty) {
            existingStudentId = existingStudentQuery.docs[0].id;
            studentRef = existingStudentQuery.docs[0].ref;
            newStudentId = existingStudentId;
            studentNameToId.set(studentData.name, existingStudentId);
            console.log(`Student already exists (phone: ${studentData.phone}): ${existingStudentId}, skipping creation`);
          }
        }

        // 기존 학생이 없으면 새로 생성
        if (!existingStudentId) {
          // 학생 문서 생성 (parentIds는 나중에 매핑)
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
            parentIds: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };

          studentRef = await db.collection("students").add(studentDocData);
          newStudentId = studentRef.id;
          studentNameToId.set(studentData.name, newStudentId);
          console.log(`Created student document: ${newStudentId}`);

          // 학생 Auth 계정 생성 (새로 생성한 학생만)
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
        } // if (!existingStudentId) 끝

        // 3. 학생 데이터에 포함된 보호자 정보 처리 (단일 시트 백업에서 복원 시)
        if (studentData.parentName && studentData.parentPhone) {
          const parentPhone = studentData.parentPhone.replace(/[^0-9]/g, '');
          const parentEmail = generateGuardianEmail(parentPhone);

          console.log(`Processing embedded parent for ${studentData.name}: ${studentData.parentName} (${studentData.parentPhone})`);

          // 기존 부모 확인 (전화번호로)
          let existingParentId = parentPhoneToId.get(studentData.parentPhone);

          if (!existingParentId) {
            const existingQuery = await db.collection("parents")
              .where("phone", "==", studentData.parentPhone)
              .limit(1)
              .get();

            if (!existingQuery.empty) {
              existingParentId = existingQuery.docs[0].id;
              parentPhoneToId.set(studentData.parentPhone, existingParentId);
              console.log(`Found existing parent: ${existingParentId}`);
            }
          }

          if (existingParentId) {
            // 기존 부모에 학생 연결
            const parentDoc = await db.collection("parents").doc(existingParentId).get();
            if (parentDoc.exists) {
              const pData = parentDoc.data();
              const currentStudentIds = pData.studentIds || [];
              if (!currentStudentIds.includes(newStudentId)) {
                await db.collection("parents").doc(existingParentId).update({
                  studentIds: [...currentStudentIds, newStudentId],
                  updatedAt: new Date()
                });
              }
            }

            // 학생 문서에 parentId 추가
            await studentRef.update({
              parentIds: [existingParentId],
              updatedAt: new Date()
            });

            results.linkedParentStudent++;
            console.log(`Linked student ${studentData.name} to existing parent ${existingParentId}`);

          } else {
            // 새 부모 생성
            const parentDocData = {
              name: studentData.parentName,
              phone: studentData.parentPhone,
              email: parentEmail,
              studentIds: [newStudentId],
              createdAt: new Date(),
              updatedAt: new Date()
            };

            const parentRef = await db.collection("parents").add(parentDocData);
            const newParentId = parentRef.id;
            parentPhoneToId.set(studentData.parentPhone, newParentId);
            console.log(`Created parent document: ${newParentId}`);

            // 부모 Auth 계정 생성
            if (parentPhone) {
              try {
                const parentUser = await auth.createUser({
                  email: parentEmail,
                  password: parentPhone,
                  displayName: studentData.parentName
                });
                const parentUid = parentUser.uid;

                await parentRef.update({ userId: parentUid });

                await db.collection("authMappings").doc(`guardian_${parentPhone}`).set({
                  userType: 'guardian',
                  firestoreId: newParentId,
                  firebaseUid: parentUid,
                  email: parentEmail,
                  name: studentData.parentName,
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

            // 학생 문서에 parentId 추가
            await studentRef.update({
              parentIds: [newParentId],
              updatedAt: new Date()
            });

            results.createdParents++;
            results.linkedParentStudent++;
            console.log(`Created and linked new parent ${newParentId} for student ${studentData.name}`);
          }
        }

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

    // 3. parentChildMap을 이용하여 학부모-학생 연결
    // parentChildMap 형식: { "부모전화번호": ["자녀이름1", "자녀이름2"], ... }
    console.log(`Linking parents and students using parentChildMap...`);

    for (const [parentPhone, childNames] of Object.entries(parentChildMap)) {
      if (!Array.isArray(childNames) || childNames.length === 0) continue;

      const parentId = parentPhoneToId.get(parentPhone);
      if (!parentId) {
        console.log(`Parent not found for phone: ${parentPhone}`);
        continue;
      }

      const linkedStudentIds = [];
      for (const childName of childNames) {
        const studentId = studentNameToId.get(childName);
        if (studentId) {
          linkedStudentIds.push(studentId);

          // 학생 문서에 parentId 추가
          try {
            const studentDoc = await db.collection("students").doc(studentId).get();
            if (studentDoc.exists) {
              const studentData = studentDoc.data();
              const currentParentIds = studentData.parentIds || [];
              if (!currentParentIds.includes(parentId)) {
                await db.collection("students").doc(studentId).update({
                  parentIds: [...currentParentIds, parentId],
                  updatedAt: new Date()
                });
                results.linkedParentStudent++;
                console.log(`Linked student ${childName} to parent ${parentPhone}`);
              }
            }
          } catch (err) {
            console.error(`Error linking student ${childName}:`, err);
          }
        } else {
          console.log(`Student not found for name: ${childName}`);
        }
      }

      // 부모 문서에 studentIds 추가
      if (linkedStudentIds.length > 0) {
        try {
          const parentDoc = await db.collection("parents").doc(parentId).get();
          if (parentDoc.exists) {
            const pData = parentDoc.data();
            const currentStudentIds = pData.studentIds || [];
            const newStudentIds = [...new Set([...currentStudentIds, ...linkedStudentIds])];
            await db.collection("parents").doc(parentId).update({
              studentIds: newStudentIds,
              updatedAt: new Date()
            });
            console.log(`Updated parent ${parentId} with ${linkedStudentIds.length} children`);
          }
        } catch (err) {
          console.error(`Error updating parent ${parentId}:`, err);
        }
      }
    }

    console.log(`Batch restore completed: ${results.createdStudents} students, ${results.createdParents} parents, ${results.createdAuthUsers} auth users, ${results.linkedParentStudent} links`);
    return results;
  }
);

/**
 * 보호자 일괄 삭제 (서버에서 처리) - 최적화 버전
 * Firestore batch write와 병렬 처리로 성능 개선
 */
exports.batchDeleteParents = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 540,
    memory: "1GiB"
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const { parentIds } = request.data;
    if (!parentIds || !Array.isArray(parentIds) || parentIds.length === 0) {
      throw new HttpsError("invalid-argument", "삭제할 보호자 ID 배열이 필요합니다.");
    }

    // 호출자가 관리자인지 확인
    const callerUid = request.auth.uid;
    try {
      const adminDoc = await db.collection("admins").doc(callerUid).get();
      if (!adminDoc.exists) {
        throw new HttpsError("permission-denied", "관리자만 보호자를 삭제할 수 있습니다.");
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "관리자 권한 확인 중 오류가 발생했습니다.");
    }

    console.log(`Starting optimized batch delete for ${parentIds.length} parents`);

    const results = {
      success: true,
      totalParents: parentIds.length,
      deletedParents: 0,
      deletedAuthUsers: 0,
      updatedStudents: 0,
      errors: []
    };

    const authUidsToDelete = [];
    const parentPhonesToDelete = [];
    const studentIdsToUpdate = new Map(); // studentId -> [parentIdsToRemove]

    // 1단계: 모든 부모 문서 병렬 조회
    console.log('Phase 1: Fetching all parent documents...');
    const parentDocs = await Promise.all(
      parentIds.map(id => db.collection("parents").doc(id).get())
    );

    // 부모 데이터 수집
    const validParents = [];
    for (let i = 0; i < parentDocs.length; i++) {
      const doc = parentDocs[i];
      if (!doc.exists) {
        console.log(`Parent not found: ${parentIds[i]}`);
        continue;
      }

      const data = doc.data();
      validParents.push({ id: doc.id, data });

      if (data.userId) {
        authUidsToDelete.push(data.userId);
      }

      if (data.phone) {
        const cleanPhone = data.phone.replace(/[^0-9]/g, '');
        parentPhonesToDelete.push(cleanPhone);
      }

      // 연결된 학생들 수집
      if (data.studentIds && data.studentIds.length > 0) {
        for (const studentId of data.studentIds) {
          if (!studentIdsToUpdate.has(studentId)) {
            studentIdsToUpdate.set(studentId, []);
          }
          studentIdsToUpdate.get(studentId).push(doc.id);
        }
      }
    }

    console.log(`Found ${validParents.length} valid parents to delete`);

    // 2단계: 연결된 학생들의 parentIds 업데이트
    console.log('Phase 2: Updating student parentIds...');
    if (studentIdsToUpdate.size > 0) {
      const studentIds = Array.from(studentIdsToUpdate.keys());

      // 학생 문서 병렬 조회
      const studentDocs = await Promise.all(
        studentIds.map(id => db.collection("students").doc(id).get())
      );

      // 배치로 학생 업데이트
      for (let i = 0; i < studentDocs.length; i += 500) {
        const batch = db.batch();
        const chunk = studentDocs.slice(i, i + 500);

        for (const doc of chunk) {
          if (!doc.exists) continue;
          const data = doc.data();
          const parentsToRemove = studentIdsToUpdate.get(doc.id) || [];
          const currentParentIds = data.parentIds || [];
          const updatedParentIds = currentParentIds.filter(pid => !parentsToRemove.includes(pid));

          batch.update(doc.ref, {
            parentIds: updatedParentIds,
            updatedAt: new Date()
          });
          results.updatedStudents++;
        }

        await batch.commit();
        console.log(`Updated students batch ${Math.floor(i/500) + 1}`);
      }
    }

    // 3단계: authMappings 삭제
    console.log('Phase 3: Deleting authMappings...');
    for (let i = 0; i < parentPhonesToDelete.length; i += 500) {
      const batch = db.batch();
      const chunk = parentPhonesToDelete.slice(i, i + 500);
      chunk.forEach(phone => {
        batch.delete(db.collection("authMappings").doc(`guardian_${phone}`));
      });
      await batch.commit();
    }

    // 4단계: 부모 문서 삭제
    console.log('Phase 4: Batch deleting parent documents...');
    for (let i = 0; i < validParents.length; i += 500) {
      const batch = db.batch();
      const chunk = validParents.slice(i, i + 500);
      chunk.forEach(p => {
        batch.delete(db.collection("parents").doc(p.id));
      });
      await batch.commit();
      results.deletedParents += chunk.length;
      console.log(`Deleted parents batch ${Math.floor(i/500) + 1}`);
    }

    // 5단계: Firebase Auth 일괄 삭제
    console.log('Phase 5: Deleting Auth users...');
    if (authUidsToDelete.length > 0) {
      try {
        for (let i = 0; i < authUidsToDelete.length; i += 1000) {
          const chunk = authUidsToDelete.slice(i, i + 1000);
          const deleteResult = await auth.deleteUsers(chunk);
          results.deletedAuthUsers += deleteResult.successCount;
          console.log(`Auth delete batch ${Math.floor(i/1000) + 1}: ${deleteResult.successCount} succeeded`);
        }
      } catch (error) {
        console.error("Error deleting auth users:", error);
        results.errors.push({
          type: 'auth_batch',
          error: error.message
        });
      }
    }

    console.log(`Batch delete completed: ${results.deletedParents} parents, ${results.deletedAuthUsers} auth users, ${results.updatedStudents} students updated`);
    return results;
  }
);

/**
 * 모든 guardian(학부모) 계정 삭제 (Admin 전용)
 * guardian_로 시작하는 이메일을 가진 Auth 계정을 모두 삭제
 */
exports.deleteAllGuardians = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 540,
    memory: "512MiB"
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    // 호출자가 관리자인지 확인
    const callerUid = request.auth.uid;
    try {
      const adminDoc = await db.collection("admins").doc(callerUid).get();
      if (!adminDoc.exists) {
        throw new HttpsError("permission-denied", "관리자만 실행할 수 있습니다.");
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "관리자 권한 확인 중 오류가 발생했습니다.");
    }

    console.log("Starting to delete all guardian accounts...");

    const results = {
      success: true,
      deletedAuthUsers: 0,
      deletedParentDocs: 0,
      deletedAuthMappings: 0,
      errors: []
    };

    try {
      // 1. guardian_ 이메일을 가진 Auth 사용자 목록 가져오기
      const guardianUids = [];
      let nextPageToken;

      do {
        const listResult = await auth.listUsers(1000, nextPageToken);

        for (const user of listResult.users) {
          if (user.email && user.email.startsWith('guardian_')) {
            guardianUids.push(user.uid);
            console.log(`Found guardian: ${user.email}`);
          }
        }

        nextPageToken = listResult.pageToken;
      } while (nextPageToken);

      console.log(`Found ${guardianUids.length} guardian accounts to delete`);

      // 2. Auth 계정 일괄 삭제
      if (guardianUids.length > 0) {
        // Firebase는 한 번에 최대 1000개까지 삭제 가능
        for (let i = 0; i < guardianUids.length; i += 1000) {
          const batch = guardianUids.slice(i, i + 1000);
          const deleteResult = await auth.deleteUsers(batch);
          results.deletedAuthUsers += deleteResult.successCount;
          console.log(`Deleted ${deleteResult.successCount} auth users (batch ${Math.floor(i/1000) + 1})`);
        }
      }

      // 3. parents 컬렉션 삭제
      const parentsSnapshot = await db.collection("parents").get();
      for (const doc of parentsSnapshot.docs) {
        await doc.ref.delete();
        results.deletedParentDocs++;
      }
      console.log(`Deleted ${results.deletedParentDocs} parent documents`);

      // 4. authMappings에서 guardian_ 삭제
      const mappingsSnapshot = await db.collection("authMappings").get();
      for (const doc of mappingsSnapshot.docs) {
        if (doc.id.startsWith('guardian_')) {
          await doc.ref.delete();
          results.deletedAuthMappings++;
        }
      }
      console.log(`Deleted ${results.deletedAuthMappings} auth mappings`);

      // 5. students의 parentIds 초기화
      const studentsSnapshot = await db.collection("students").get();
      for (const doc of studentsSnapshot.docs) {
        const data = doc.data();
        if (data.parentIds && data.parentIds.length > 0) {
          await doc.ref.update({ parentIds: [], updatedAt: new Date() });
        }
      }
      console.log(`Cleared parentIds from all students`);

    } catch (error) {
      console.error("Error in deleteAllGuardians:", error);
      results.errors.push({ error: error.message });
    }

    console.log(`Delete all guardians completed: ${results.deletedAuthUsers} auth, ${results.deletedParentDocs} docs, ${results.deletedAuthMappings} mappings`);
    return results;
  }
);
