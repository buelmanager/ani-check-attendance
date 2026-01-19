# ANI CHECK - 스마트 출결 관리 시스템

학원/교육기관을 위한 실시간 출결 관리 PWA 애플리케이션

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI Framework |
| TypeScript | 5.6.2 | Type Safety |
| Vite | 6.0.1 | Build Tool |
| React Router DOM | 6.28.0 | Client-side Routing |
| Zustand | 4.5.5 | State Management |
| Tailwind CSS | 3.4.15 | Styling |

### Backend & Database
| Technology | Purpose |
|------------|---------|
| Firebase Authentication | User Authentication |
| Cloud Firestore | NoSQL Database |
| Firebase Cloud Messaging | Push Notifications |
| Cloud Functions | Serverless Backend |
| Firebase Hosting | Deployment |

### Additional Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| html5-qrcode | 2.3.8 | QR Code Scanner |
| qrcode | 1.5.4 | QR Code Generator |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (PWA)                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │  React  │  │ Zustand │  │  Vite   │  │  Service Worker │ │
│  └────┬────┘  └────┬────┘  └─────────┘  └────────┬────────┘ │
│       │            │                             │           │
│       └────────────┴─────────────────────────────┘           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                     Firebase Services                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Firestore  │  │     Auth     │  │  Cloud Functions  │  │
│  │   (NoSQL)    │  │  (3 Roles)   │  │   (Push Trigger)  │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │     FCM      │  │   Hosting    │                         │
│  │    (Push)    │  │   (Deploy)   │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
src/
├── components/           # Reusable UI Components
│   ├── admin/           # Admin Layout Components
│   ├── student/         # Student Layout Components
│   ├── parent/          # Parent Layout Components
│   ├── ProtectedRoute.tsx
│   ├── StudentRoute.tsx
│   └── ParentRoute.tsx
├── pages/               # Page Components
│   ├── admin/           # Admin Pages (Dashboard, Classes, Students, etc.)
│   ├── student/         # Student Pages (Dashboard, Schedule, Check-in, etc.)
│   └── parent/          # Parent Pages (Dashboard, Children, Notifications, etc.)
├── services/            # Firestore Service Layer
│   ├── attendanceService.ts
│   ├── classService.ts
│   ├── studentService.ts
│   ├── parentService.ts
│   ├── qrSessionService.ts
│   ├── announcementService.ts
│   ├── notificationService.ts
│   └── fcmService.ts
├── store/               # Zustand State Management
├── contexts/            # React Context (AuthContext)
├── hooks/               # Custom Hooks
├── lib/                 # Firebase Initialization
├── types/               # TypeScript Type Definitions
└── config/              # Configuration Files

functions/               # Cloud Functions
public/                  # Static Assets & Service Workers
```

## Database Schema (Firestore)

### Collections

| Collection | Description | Key Fields |
|------------|-------------|------------|
| `classes` | Class information | name, schedule, time, studentIds |
| `students` | Student profiles | name, phone, inviteCode, userId |
| `parents` | Parent profiles | userId, phone, studentIds |
| `attendances` | Attendance records | classId, studentId, date, status, checkInMethod |
| `announcements` | Announcements | title, content, targetType, classIds |
| `notifications` | User notifications | userId, type, title, isRead |
| `qrSessions` | QR check-in sessions | classId, token, expiresAt, isActive |
| `fcmTokens` | FCM device tokens | userId, token, userType |
| `admins` | Admin accounts | email, name, role |

### Attendance Status Types
- `present` - 출석
- `late` - 지각
- `absent` - 결석
- `excused` - 사유결석

### Check-in Methods
- `qr` - QR Code Scan
- `manual` - Manual Entry
- `gps` - GPS-based (planned)

## Authentication

### Role-Based Access Control (RBAC)

| Role | Login Method | Access |
|------|--------------|--------|
| Admin | Email + Password | Full system management |
| Student | Phone + Password + Invite Code | Personal attendance, schedule |
| Parent | Phone + Password + Invite Code | Children's attendance monitoring |

### Authentication Flow
```
Phone Number → Email Conversion (phoneToEmail)
     ↓
Firebase Auth (signInWithEmailAndPassword)
     ↓
Role Detection (Firestore lookup: admins → students → parents)
     ↓
Route Protection (ProtectedRoute / StudentRoute / ParentRoute)
```

## Key Features

### 1. QR Code Check-in System
- **Token-based validation** with 4-hour expiration
- **UUID-based unique tokens** for security
- **Global QR support** for multi-class check-in
- **Webcam-based scanning** using html5-qrcode

### 2. Real-time Synchronization
- **Firestore onSnapshot()** for live updates
- **Bi-directional binding** between Zustand store and Firestore
- **Automatic sync initialization** on app load

### 3. Duplicate Prevention
```typescript
// Client-side: pendingRequests Set
// Server-side: Firestore Transaction
// Document ID: `${classId}_${studentId}_${date}` (uniqueness guaranteed)
```

### 4. Push Notifications (FCM)
- **Cloud Function trigger** on notification creation
- **Multi-device support** via FCM token management
- **Data-only messages** to prevent duplicate notifications
- **Auto-cleanup** of invalid tokens

### 5. Offline Support
- **Service Worker caching** (Network first, Cache fallback)
- **Firestore IndexedDB persistence**
- **Zustand localStorage persistence**
- **Online/Offline state detection**

## PWA Configuration

### Service Workers
| File | Purpose |
|------|---------|
| `sw.js` | App caching & offline support |
| `firebase-messaging-sw.js` | Background push notification handling |

### Manifest Files
| File | Target |
|------|--------|
| `manifest.json` | General users (Students, Parents) |
| `manifest-admin.json` | Admin users |

### PWA Features
- Installable on home screen
- iOS Safari support (`apple-mobile-web-app-capable`)
- Notch support (`viewport-fit=cover`)
- Theme color: `#1E3A5F`

## API Routes

### Public Routes
| Path | Description |
|------|-------------|
| `/` | Home page |
| `/invite/:code` | Invitation link handler |
| `/qr/:token` | QR check-in page |

### Student Routes (`/student/*`)
| Path | Description |
|------|-------------|
| `/student` | Dashboard |
| `/student/schedule` | Class schedule |
| `/student/notices` | Announcements |
| `/student/checkin` | QR check-in |
| `/student/settings` | Account settings |

### Parent Routes (`/parent/*`)
| Path | Description |
|------|-------------|
| `/parent` | Dashboard |
| `/parent/child/:id` | Child detail view |
| `/parent/notices` | Announcements |
| `/parent/notifications` | Notification center |
| `/parent/settings` | Account settings |

### Admin Routes (`/admin/*`) - Protected
| Path | Description |
|------|-------------|
| `/admin` | Dashboard |
| `/admin/classes` | Class management |
| `/admin/students` | Student management |
| `/admin/attendance` | Attendance management |
| `/admin/announcements` | Announcement management |
| `/admin/reports` | Reports & statistics |
| `/admin/settings` | System settings |

## Development

### Prerequisites
- Node.js 20+
- npm or yarn
- Firebase CLI

### Environment Variables
```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

### Commands
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Deploy to Firebase
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions
```

## Deployment

### Firebase Services
| Service | Configuration |
|---------|---------------|
| Hosting | `dist/` directory, SPA rewrite to `/index.html` |
| Firestore | Custom security rules (`firestore.rules`) |
| Functions | Node.js 20 runtime |

### Security Rules Highlights
- Classes/Students: Authenticated write, public read
- Attendances: Public create, authenticated update/delete
- Notifications: User-scoped access
- FCM Tokens: Owner-only access

## Performance Optimizations

| Optimization | Implementation |
|--------------|----------------|
| Offline Caching | Service Worker + IndexedDB |
| State Persistence | Zustand persist middleware |
| ACID Transactions | Firestore transactions for critical operations |
| Duplicate Prevention | Client + Server dual defense |
| Batch Operations | writeBatch for bulk updates |
| Real-time Updates | Subscription-based instead of polling |

## Browser Support

- Chrome 80+
- Safari 14+ (iOS included)
- Firefox 75+
- Edge 80+

## License

Private - All rights reserved
