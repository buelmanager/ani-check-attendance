# ANI CHECK - 스마트 출결 관리 시스템

학원/교육기관을 위한 실시간 출결 관리 PWA 애플리케이션

---

## 프로젝트 소개

ANI CHECK는 미술학원 등 교육기관에서 학생들의 출결을 효율적으로 관리하기 위한 웹 애플리케이션입니다.
관리자(학원), 학생, 학부모 3가지 역할을 지원하며, QR 코드 기반 출석 체크와 실시간 푸시 알림을 통해
학부모가 자녀의 출석 현황을 즉시 확인할 수 있습니다.

### 주요 특징
- **QR 코드 출석 체크**: 학생이 QR 스캔으로 간편하게 출석
- **실시간 알림**: 학부모에게 자녀 출석/지각/결석 즉시 알림
- **초대 코드 기반 회원 연결**: 학생-학부모 관계를 안전하게 연결
- **PWA 지원**: 앱처럼 설치하여 사용 가능
- **오프라인 지원**: 인터넷이 불안정해도 기본 기능 사용 가능

---

## 기술 스택

### 프론트엔드
| 기술 | 버전 | 용도 |
|------|------|------|
| React | 18.3.1 | UI 프레임워크 |
| TypeScript | 5.6.2 | 타입 안정성 |
| Vite | 6.0.1 | 빌드 도구 |
| React Router DOM | 6.28.0 | 클라이언트 라우팅 |
| Zustand | 4.5.5 | 상태 관리 |
| Tailwind CSS | 3.4.15 | 스타일링 |

### 백엔드 & 데이터베이스
| 기술 | 용도 |
|------|------|
| Firebase Authentication | 사용자 인증 |
| Cloud Firestore | NoSQL 데이터베이스 |
| Firebase Cloud Messaging | 푸시 알림 |
| Cloud Functions | 서버리스 백엔드 |
| Firebase Hosting | 배포 |

### 추가 라이브러리
| 라이브러리 | 버전 | 용도 |
|------------|------|------|
| html5-qrcode | 2.3.8 | QR 코드 스캐너 |
| qrcode | 1.5.4 | QR 코드 생성 |

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      프론트엔드 (PWA)                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │  React  │  │ Zustand │  │  Vite   │  │  Service Worker │ │
│  └────┬────┘  └────┬────┘  └─────────┘  └────────┬────────┘ │
│       │            │                             │           │
│       └────────────┴─────────────────────────────┘           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                     Firebase 서비스                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Firestore  │  │     Auth     │  │  Cloud Functions  │  │
│  │   (NoSQL)    │  │   (3 역할)   │  │   (푸시 트리거)   │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │     FCM      │  │   Hosting    │                         │
│  │  (푸시알림)  │  │    (배포)    │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 핵심 기능 상세 설명

### 1. 회원 연결 시스템 (초대 코드 기반)

학생과 학부모를 안전하게 연결하는 시스템입니다.

#### 작동 원리

```
[관리자가 학생 등록]
      ↓
[6자리 초대 코드 자동 생성] → 예: "ABC123"
      ↓
[초대 링크 공유] → https://domain.com/invite/ABC123
      ↓
[학생/학부모가 링크로 접속하여 가입]
      ↓
[양방향 관계 형성]
  - 학생 문서: parentIds: [부모ID1, 부모ID2]
  - 부모 문서: studentIds: [학생ID1, 학생ID2]
```

#### 초대 코드 생성 규칙
```typescript
// 혼동하기 쉬운 문자(0, O, 1, I) 제외
const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// 6자리 조합 생성 → "ABC123" 형태
```

#### 회원가입 플로우

**학생 가입:**
1. 초대 링크 접속 → 역할 선택 (학생)
2. 핸드폰 번호 + 비밀번호 입력
3. Firebase Auth 계정 생성 (핸드폰→이메일 변환)
4. 학생 문서에 userId 연결

**학부모 가입:**
1. 초대 링크 접속 → 역할 선택 (학부모)
2. 핸드폰 번호 + 비밀번호 + 이름 입력
3. Firebase Auth 계정 생성
4. 부모 문서 생성 + 학생과 양방향 연결

**기존 학부모의 자녀 추가:**
1. 학부모 로그인 상태에서 새 초대 코드 입력
2. 중복 확인 후 양방향 관계 추가

#### 핵심 코드 (`AuthContext.tsx`)
```typescript
// 핸드폰 번호를 이메일로 변환 (Firebase Auth는 이메일 기반)
const phoneToEmail = (phone: string) => {
  const cleaned = phone.replace(/[^0-9]/g, '');
  return `${cleaned}@phone.local`;
};
// 010-1234-5678 → 01012345678@phone.local

// 역할 확인 순서: admins → students → parents
const checkUserRole = async (uid: string) => {
  // 1. 관리자 확인
  const adminDoc = await getDoc(doc(db, 'admins', uid));
  if (adminDoc.exists()) return 'admin';

  // 2. 학생 확인
  const student = await studentService.getByUserId(uid);
  if (student) return 'student';

  // 3. 학부모 확인
  const parent = await parentService.getByUserId(uid);
  if (parent) return 'parent';
};
```

---

### 2. QR 출석 체크 시스템

QR 코드를 통한 빠르고 정확한 출석 체크 시스템입니다.

#### 작동 원리

```
[관리자: QR 세션 생성]
      ↓
[UUID 기반 토큰 발급] → 4시간 유효
      ↓
[QR 코드 화면에 표시]
      ↓
[학생: 앱에서 QR 스캔]
      ↓
[토큰 검증]
  ├── 유효 → 출석 처리
  ├── 만료 → 오류 메시지
  └── 무효 → 오류 메시지
      ↓
[지각 판정] → 수업 시작 10분 후 = 지각
      ↓
[출석 기록 저장]
      ↓
[학부모에게 푸시 알림 전송]
```

#### QR 세션 데이터 구조
```typescript
interface QRSession {
  id: string;
  classId: string;      // 수업 ID 또는 'global' (통합 QR)
  date: string;         // YYYY-MM-DD
  token: string;        // UUID (예: "a1b2c3d4-...")
  expiresAt: Date;      // 생성 후 4시간
  isActive: boolean;    // 활성 상태
  isGlobal?: boolean;   // 통합 QR 여부
}
```

#### 토큰 검증 로직 (`qrSessionService.ts`)
```typescript
async validateToken(token: string) {
  // 1. 활성 토큰 검색
  const query = where('token', '==', token) + where('isActive', '==', true);

  // 2. 토큰 존재 여부 확인
  if (!exists) return { valid: false, reason: '존재하지 않는 QR' };

  // 3. 만료 시간 확인
  if (expiresAt < now) {
    await updateDoc(docRef, { isActive: false }); // 자동 비활성화
    return { valid: false, reason: '만료된 QR' };
  }

  // 4. 유효한 토큰
  return { valid: true, classId, date };
}
```

#### 중복 출석 방지 메커니즘

**3중 방어 시스템:**

1. **클라이언트 측 (메모리)**
```typescript
const pendingRequests = new Set<string>();

// 요청 시작 시 체크
if (pendingRequests.has(requestKey)) {
  throw new Error('이미 처리 중입니다');
}
pendingRequests.add(requestKey);

// 요청 완료 후 제거
pendingRequests.delete(requestKey);
```

2. **문서 ID 고유성**
```typescript
// 문서 ID = classId_studentId_date
const docId = `${classId}_${studentId}_${date}`;
// 예: "class1_student1_2024-01-15"
// → 같은 날, 같은 수업, 같은 학생은 하나의 문서만 존재
```

3. **Firestore 트랜잭션**
```typescript
await runTransaction(db, async (transaction) => {
  const docSnap = await transaction.get(docRef);

  if (docSnap.exists()) {
    // 이미 존재하면 업데이트만
    transaction.update(docRef, { ... });
  } else {
    // 새로 생성
    transaction.set(docRef, { ... });
  }
});
```

#### 지각 판정 로직
```typescript
// 수업 시작 시간 + 10분 이후 출석 = 지각
const classMinutes = classHour * 60 + classMin;  // 예: 14:00 = 840분
const currentMinutes = now.getHours() * 60 + now.getMinutes();

if (currentMinutes > classMinutes + 10) {
  status = 'late';  // 지각
} else {
  status = 'present';  // 출석
}
```

---

### 3. 푸시 알림 시스템 (FCM)

학부모에게 자녀의 출석 상태를 실시간으로 알려주는 시스템입니다.

#### 작동 원리

```
[학생 출석 체크 완료]
      ↓
[Firestore에 알림 문서 생성]
      ↓
[Cloud Functions 트리거 발동]
      ↓
[해당 사용자의 FCM 토큰 조회]
      ↓
[FCM으로 푸시 알림 전송]
      ↓
[학부모 기기에서 알림 수신]
  ├── 포그라운드: 앱 내 알림 표시
  └── 백그라운드: 시스템 푸시 알림
```

#### FCM 토큰 관리 (`fcmService.ts`)
```typescript
// 토큰 저장 (로그인 시 자동 호출)
async saveToken(userId: string, userType: 'parent' | 'student' | 'admin') {
  const token = await getFCMToken();  // 브라우저에서 토큰 발급

  // 문서 ID: userId_토큰앞20자 (중복 방지)
  const docId = `${userId}_${token.substring(0, 20)}`;

  await setDoc(docRef, {
    userId,
    token,
    userType,
    deviceInfo: navigator.userAgent,
    createdAt: serverTimestamp()
  }, { merge: true });
}

// 사용자의 모든 토큰 조회 (다중 기기 지원)
async getTokensForUser(userId: string): Promise<string[]> {
  const query = where('userId', '==', userId);
  return snapshot.docs.map(doc => doc.data().token);
}
```

#### Cloud Functions 트리거 (`functions/index.js`)
```javascript
exports.sendPushOnNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    const { userId, title, message } = notification;

    // 1. 사용자의 FCM 토큰 조회
    const tokensSnapshot = await db.collection('fcmTokens')
      .where('userId', '==', userId)
      .get();

    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
    if (tokens.length === 0) return;

    // 2. FCM 메시지 전송 (data-only로 중복 방지)
    const message = {
      data: { title, body: message, ... },
      tokens: tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // 3. 유효하지 않은 토큰 자동 삭제
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error?.code === 'messaging/invalid-token') {
        // 토큰 삭제
      }
    });
  });
```

#### 푸시 알림 훅 (`usePushNotification.ts`)
```typescript
export function usePushNotification() {
  // 1. 초기화: 브라우저 지원 확인
  useEffect(() => {
    const isSupported = 'Notification' in window &&
                        'serviceWorker' in navigator;
    // Service Worker 등록
    navigator.serviceWorker.register('/firebase-messaging-sw.js');
  }, []);

  // 2. 로그인 시 토큰 자동 저장
  useEffect(() => {
    if (user && Notification.permission === 'granted') {
      fcmService.saveToken(user.uid, userType);
    }
  }, [user]);

  // 3. 포그라운드 메시지 처리
  useEffect(() => {
    onForegroundMessage((payload) => {
      new Notification(payload.notification.title, {
        body: payload.notification.body,
        icon: '/icons/logo.png'
      });
    });
  }, []);

  // 4. 권한 요청 메서드
  const requestPermission = async () => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await fcmService.saveToken(user.uid, userType);
    }
    return permission === 'granted';
  };

  return { requestPermission, ... };
}
```

#### 알림 생성 서비스 (`notificationService.ts`)
```typescript
// 체크인 알림 (출석/지각)
async notifyParentsOfCheckin(
  parentUserIds: string[],
  studentName: string,
  className: string,
  status: 'present' | 'late',
  checkInTime: string
) {
  const statusText = status === 'present' ? '출석' : '지각';

  for (const userId of parentUserIds) {
    await this.create({
      userId,
      type: 'checkin',
      title: `${studentName} ${statusText}`,
      message: `${studentName}님이 ${className} 수업에
                ${checkInTime}에 ${statusText}했습니다.`,
      isRead: false
    });
    // → Cloud Functions가 자동으로 푸시 전송
  }
}
```

---

## 프로젝트 구조

```
src/
├── components/           # 재사용 UI 컴포넌트
│   ├── admin/           # 관리자 레이아웃
│   ├── student/         # 학생 레이아웃
│   ├── parent/          # 학부모 레이아웃
│   ├── ProtectedRoute.tsx  # 관리자 라우트 보호
│   ├── StudentRoute.tsx    # 학생 라우트 보호
│   └── ParentRoute.tsx     # 학부모 라우트 보호
├── pages/               # 페이지 컴포넌트
│   ├── admin/           # 관리자 페이지
│   ├── student/         # 학생 페이지
│   └── parent/          # 학부모 페이지
├── services/            # Firestore 서비스 계층
│   ├── attendanceService.ts   # 출석 관리
│   ├── classService.ts        # 수업 관리
│   ├── studentService.ts      # 학생 관리
│   ├── parentService.ts       # 학부모 관리
│   ├── qrSessionService.ts    # QR 세션 관리
│   ├── announcementService.ts # 공지사항 관리
│   ├── notificationService.ts # 알림 관리
│   └── fcmService.ts          # FCM 토큰 관리
├── store/               # Zustand 상태 관리
├── contexts/            # React Context (AuthContext)
├── hooks/               # 커스텀 훅
├── lib/                 # Firebase 초기화
├── types/               # TypeScript 타입 정의
└── config/              # 설정 파일

functions/               # Cloud Functions
public/                  # 정적 파일 & Service Workers
```

---

## 데이터베이스 스키마 (Firestore)

### 컬렉션 구조

| 컬렉션 | 설명 | 주요 필드 |
|--------|------|----------|
| `classes` | 수업 정보 | name, schedule, time, studentIds |
| `students` | 학생 정보 | name, phone, inviteCode, userId, parentIds |
| `parents` | 학부모 정보 | userId, phone, studentIds |
| `attendances` | 출석 기록 | classId, studentId, date, status, checkInMethod |
| `announcements` | 공지사항 | title, content, targetType, classIds |
| `notifications` | 알림 | userId, type, title, message, isRead |
| `qrSessions` | QR 세션 | classId, token, expiresAt, isActive |
| `fcmTokens` | FCM 토큰 | userId, token, userType |
| `admins` | 관리자 | email, name, role |

### 출석 상태
- `present` - 출석
- `late` - 지각
- `absent` - 결석
- `excused` - 사유결석

### 체크인 방식
- `qr` - QR 코드 스캔
- `manual` - 수동 입력

---

## 인증 시스템

### 역할별 접근 권한 (RBAC)

| 역할 | 로그인 방식 | 접근 범위 |
|------|------------|----------|
| 관리자 | 이메일 + 비밀번호 | 전체 시스템 관리 |
| 학생 | 핸드폰 + 비밀번호 + 초대코드 | 본인 출석, 일정 확인 |
| 학부모 | 핸드폰 + 비밀번호 + 초대코드 | 자녀 출석 모니터링 |

### 인증 플로우
```
핸드폰 번호 → 이메일 변환 (phoneToEmail)
     ↓
Firebase Auth (signInWithEmailAndPassword)
     ↓
역할 확인 (Firestore: admins → students → parents)
     ↓
라우트 보호 (ProtectedRoute / StudentRoute / ParentRoute)
```

---

## PWA 설정

### Service Workers
| 파일 | 용도 |
|------|------|
| `sw.js` | 앱 캐싱 & 오프라인 지원 |
| `firebase-messaging-sw.js` | 백그라운드 푸시 알림 처리 |

### PWA 기능
- 홈 화면 설치 가능
- iOS Safari 지원 (`apple-mobile-web-app-capable`)
- 노치 지원 (`viewport-fit=cover`)
- 테마 색상: `#1E3A5F`

---

## 라우트 구조

### 공개 라우트
| 경로 | 설명 |
|------|------|
| `/` | 홈페이지 |
| `/invite/:code` | 초대 링크 |
| `/qr/:token` | QR 체크인 |

### 학생 라우트 (`/student/*`)
| 경로 | 설명 |
|------|------|
| `/student` | 대시보드 |
| `/student/schedule` | 수업 일정 |
| `/student/notices` | 공지사항 |
| `/student/checkin` | QR 출석 체크 |
| `/student/settings` | 설정 |

### 학부모 라우트 (`/parent/*`)
| 경로 | 설명 |
|------|------|
| `/parent` | 대시보드 |
| `/parent/child/:id` | 자녀 상세 |
| `/parent/notices` | 공지사항 |
| `/parent/notifications` | 알림 센터 |
| `/parent/settings` | 설정 |

### 관리자 라우트 (`/admin/*`) - 보호됨
| 경로 | 설명 |
|------|------|
| `/admin` | 대시보드 |
| `/admin/classes` | 수업 관리 |
| `/admin/students` | 학생 관리 |
| `/admin/attendance` | 출석 관리 |
| `/admin/announcements` | 공지사항 관리 |
| `/admin/reports` | 보고서 |
| `/admin/settings` | 설정 |

---

## 개발 환경

### 사전 요구사항
- Node.js 20+
- npm 또는 yarn
- Firebase CLI

### 환경 변수
```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

### 명령어
```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 미리보기
npm run preview

# 린트 검사
npm run lint

# Firebase 배포
firebase deploy

# Hosting만 배포
firebase deploy --only hosting

# Functions만 배포
firebase deploy --only functions
```

---

## 성능 최적화

| 최적화 | 구현 방식 |
|--------|----------|
| 오프라인 캐싱 | Service Worker + IndexedDB |
| 상태 영속성 | Zustand persist 미들웨어 |
| ACID 트랜잭션 | Firestore 트랜잭션 (중요 작업) |
| 중복 방지 | 클라이언트 + 서버 이중 방어 |
| 배치 처리 | writeBatch로 대량 업데이트 |
| 실시간 업데이트 | 폴링 대신 구독 기반 |

---

## 브라우저 지원

- Chrome 80+
- Safari 14+ (iOS 포함)
- Firefox 75+
- Edge 80+

---

## 라이선스

Private - All rights reserved
