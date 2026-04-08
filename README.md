# EduVerify — AI-Powered Answer Sheet Evaluation & Bias Detection Platform

An advanced exam evaluation management system built for educational institutions to digitize, audit, and ensure fairness in the answer sheet evaluation process. The platform integrates **AI-powered bias detection**, a **grievance management workflow**, and **Ethereum blockchain verification** to guarantee transparency and academic integrity.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [User Roles](#user-roles)
- [Feature Deep-Dive](#feature-deep-dive)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [MCP AI Agent](#mcp-ai-agent)
- [Blockchain Integration](#blockchain-integration)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Deployment](#deployment)

---

## Overview

EduVerify solves the problem of opaque, inconsistent, and potentially biased exam evaluations in educational institutions. It provides:

- A **secure digital submission** pipeline for answer sheets with SHA-256 integrity hashing
- An **online evaluation interface** for teachers with detailed per-question marking and time tracking
- A **grievance system** allowing students to challenge evaluations and request re-assessment
- An **AI-powered admin dashboard** that detects bias patterns (strictness, leniency, fatigue, rushing) in teacher marking behavior
- An **immutable audit trail** backed by a blockchain smart contract on the Ethereum Sepolia testnet

---

## Key Features

### For Students
- Upload answer sheets (PDF/JPEG/PNG) with cryptographic hash verification
- Track submission and evaluation status in real time
- View detailed results with per-question marks and teacher comments
- File grievances — either for a calculation error review or a full re-evaluation by a different teacher
- Verify submission integrity on the Ethereum blockchain

### For Teachers
- Create tests/question papers with per-question marks and descriptions
- Evaluate answer sheets online with per-question marking, comments, and draft saving
- Handle grievances — review calculation errors or perform re-evaluations with side-by-side comparison
- Add students to classes and manage assignments
- Dashboard with evaluation stats and personal bias score

### For Admins
- Real-time audit log dashboard with advanced filtering (event type, user, date range)
- AI-powered bias detection reports per teacher and per department
- Bulk student import via CSV
- Floating AI chat assistant (MCP) for natural-language queries about evaluations, grievances, and bias

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 3.4 |
| **UI Animations** | GSAP 3.14, Lenis (smooth scroll) |
| **Forms & Validation** | React Hook Form 7 + Zod 3 |
| **Database** | MongoDB (Atlas) + Mongoose 8 |
| **Authentication** | JWT (jsonwebtoken) + bcryptjs |
| **Blockchain** | Ethers.js 6 — Ethereum Sepolia Testnet |
| **AI Agent (MCP)** | Python Flask + Groq API (llama-3.3-70b-versatile) |
| **Email** | Nodemailer 8 |
| **Icons** | Lucide React |
| **Crypto Utilities** | Node.js crypto, crypto-js |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Student  │  │ Teacher  │  │  Admin   │              │
│  │  Pages   │  │  Pages   │  │  Pages   │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       └─────────────┴─────────────┘                    │
│                     │  REST API Routes                  │
│              ┌──────┴──────┐                            │
│              │  Next.js    │                            │
│              │  API Routes │                            │
│              └──────┬──────┘                            │
└─────────────────────┼───────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐   ┌─────▼─────┐  ┌────▼──────┐
   │ MongoDB │   │ Ethereum  │  │   Flask   │
   │  Atlas  │   │  Sepolia  │  │ MCP Agent │
   │         │   │(Blockchain│  │ (Groq AI) │
   └─────────┘   └───────────┘  └───────────┘
```

The Next.js app handles all user-facing pages and serves as a unified API layer. The Flask MCP server runs as a separate process and is called by the admin panel for AI-powered chat and analysis. MongoDB stores all persistent data. The Ethereum blockchain provides an immutable verification layer.

---

## User Roles

| Role | ID Format | Capabilities |
|---|---|---|
| **Student** | `ST2026001` | Upload sheets, view results, file grievances |
| **Teacher** | `TCH2026001` | Create tests, evaluate, handle grievances |
| **Admin** | `ADM2026001` | Audit logs, bias reports, user management |

All users log in with their role-specific ID and a password. New accounts receive auto-generated credentials via email.

---

## Feature Deep-Dive

### Answer Sheet Upload (Student)

1. Student selects a test from the list of available tests
2. Uploads a PDF, JPEG, or PNG file (max 10 MB)
3. The system generates a **SHA-256 hash** of the file for integrity verification
4. A submission record is created with status `uploaded`
5. Optionally, the submission hash is committed to the **Ethereum blockchain** for tamper-proof verification

### Evaluation Interface (Teacher)

1. Teacher views pending submissions assigned to their subjects and classes
2. Opens an answer sheet and marks each question individually
3. Can add comments per question; comments are analyzed for sentiment
4. Can **save as draft** and resume later
5. On finalization, an **evaluation hash** is generated from all marks and committed to the blockchain
6. The submission status updates to `evaluated` and eventually `published`

Audit events are logged for every action: evaluation start, each question marked, draft saves, and finalization — including timestamp and time spent per question.

### Grievance Workflow

```
Student files grievance
       │
       ├─ Calculation Error → Assigned to ORIGINAL teacher for review
       │
       └─ Re-evaluation    → Assigned to a DIFFERENT teacher
              │
              ↓
       Teacher performs re-evaluation
              │
              ↓
       System compares original vs. new marks (per question diff)
              │
              ↓
       Result published → Student notified via email
              │
              ↓
       Immutable record stored (audit log + optional blockchain)
```

Students can track grievance status: `pending` → `in_progress` → `completed` / `rejected`.

### AI Bias Detection (Admin)

The system continuously collects evaluation metrics and audit trail data per teacher. Admins can request bias reports via the admin dashboard or the floating AI chat.

**Detected Patterns:**

| Pattern | Description |
|---|---|
| **Strictness Score** | Teacher consistently awards marks well below average |
| **Leniency Score** | Teacher consistently awards marks well above average |
| **Fatigue Detection** | Evaluation quality degrades toward end of session |
| **Rushing Detection** | Questions marked faster than a reasonable threshold |
| **Sequence Bias** | Non-random ordering effects across questions |
| **Consistency Score** | Variance in marks for similar submissions |
| **Outlier Count** | Statistically anomalous evaluations |
| **Comment Sentiment** | Ratio of positive/negative/neutral teacher comments |
| **Grievance Success Rate** | Percentage of grievances that resulted in mark increases |

### Blockchain Verification

Every submission and evaluation can be anchored on the Ethereum Sepolia testnet using the **ExamIntegrity** smart contract. This enables:

- Students to prove their answer sheet was not tampered with after submission
- Admins to verify that evaluation marks were not altered after finalization
- An independent audit trail outside the platform's own database

### Audit Trail

Every significant event is logged with full context:

- **Who**: userId, role, name, department
- **What**: eventType (evaluation_started, question_marked, grievance_filed, etc.)
- **When**: ISO timestamp + time spent on action
- **Where**: sessionId, device info, IP address, user agent
- **Data**: marks, comments, question number, mark difference (for re-evaluations)

Admins can filter and search the full audit log from the dashboard.

---

## Database Schema

### `users`
```
userId        String (unique, indexed)   ST2026001 / TCH2026001 / ADM2026001
name          String
email         String (unique, indexed)
password      String (bcrypt hashed)
role          Enum: student | teacher | admin
department    String
year          Number (1–4, students only)
division      String (A–D, students only)
subjects      String[] (teachers only)
```

### `tests`
```
testId           String (unique)          TEST_CSE_2026_1707654321
title            String
subject          String
department       String
year             Number
division         String | "ALL"
totalMarks       Number
questions        [{questionNumber, marks, description}]
uploadedBy       String (teacherId)
examType         Enum: midterm | endsem | assignment | quiz
blockchainExamId String (unique numeric hash)
examDate         Date
```

### `submissions`
```
submissionId       String (unique)     Keccak256(studentId+testId+timestamp)
testId             String
studentId          String
blockchainExamId   String
fileName           String
answerSheetUrl     String
fileHash           String (SHA-256)
fileSize           Number
fileType           String
status             Enum: uploaded | under_evaluation | evaluated | published
uploadedAt         Date
blockchainTxHash   String
blockchainVerified Boolean
```

### `evaluations`
```
evaluationId          String (unique)    EVAL_{submissionId}_{teacherId}
submissionId          String (unique)
testId                String
teacherId             String
teacherName           String
questionMarks         [{questionNumber, maxMarks, marksObtained, comment}]
totalMarksObtained    Number
totalMarks            Number
percentage            Number
remarks               String
isDraft               Boolean
evaluatedAt           Date
evaluationHash        String (SHA-256)
blockchainTxHash      String
blockchainVerified    Boolean
```

### `grievances`
```
grievanceId         String (unique)    GRV_{submissionId}_{timestamp}
submissionId        String
testId              String
studentId           String
studentName         String
grievanceType       Enum: calculation_error | reevaluation
questionNumber      Number (optional)
explanation         String
originalTeacherId   String
assignedTeacherId   String
status              Enum: pending | in_progress | completed | rejected
originalEvaluationId String
reevaluationId      String
filedAt             Date
assignedAt          Date
completedAt         Date
```

### `reevaluations`
```
reevaluationId         String (unique)    REEVAL_{grievanceId}_{timestamp}
grievanceId            String (unique)
submissionId           String
originalEvaluationId   String
originalTeacherId      String
originalQuestionMarks  [{questionNumber, maxMarks, marksObtained, comment}]
originalTotal          Number
originalPercentage     Number
newTeacherId           String
newQuestionMarks       [{questionNumber, maxMarks, marksObtained, comment}]
newTotal               Number
newPercentage          Number
comparisonData         [{questionNumber, maxMarks, oldMarks, newMarks, difference}]
totalDifference        Number
percentageDifference   Number
resultHash             String
blockchainTxHash       String
```

### `audit_logs`
```
auditId            String (unique)    AUDIT_{timestamp}_{random}
eventType          String
timestamp          Date
userId             String
userRole           String
userName           String
department         String
submissionId       String
testId             String
evaluationId       String
grievanceId        String
questionNumber     Number
marksAwarded       Number
maxMarks           Number
comment            String
timeSpent          Number (ms)
markingPattern     Enum: strict | lenient | moderate | zero | full
commentSentiment   Enum: positive | negative | neutral | none
sessionId          String
deviceInfo         Object
ipAddress          String
```

### `evaluation_metrics` (Bias Detection)
```
teacherId              String
teacherName            String
department             String
subject                String
totalEvaluations       Number
overallPercentage      Number
averageTimePerQuestion Number
strictnessScore        Number
leniencyScore          Number
biasIndicators         {markingConsistency, fatigueDetected, rushingDetected, hasSequenceBias, outlierCount}
commentCoverage        Number
evaluationQualityScore Number
flaggedForReview       Boolean
reviewReason           String
```

---

## API Reference

### Authentication (Public)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login with `{userId, password}` — returns JWT cookie |
| `GET` | `/api/auth/me` | Get current user from JWT |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `POST` | `/api/auth/register` | Register a new user (admin only) |

### Student Endpoints (Require student JWT)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/student/available-tests` | List tests available for submission |
| `POST` | `/api/student/upload` | Upload answer sheet file |
| `POST` | `/api/student/submissions` | Create submission record |
| `GET` | `/api/student/submissions` | Get all student submissions |
| `GET` | `/api/student/results` | Get evaluated results with grades |
| `GET` | `/api/student/stats` | Dashboard stats (submissions, avg marks, grievances) |
| `POST` | `/api/student/grievance` | File a grievance |
| `GET` | `/api/student/grievance` | List grievances (filterable) |
| `POST` | `/api/student/reevaluation` | Request re-evaluation |
| `GET` | `/api/student/evaluation-progress/[submissionId]` | Poll evaluation status |
| `POST` | `/api/student/verify-blockchain` | Verify submission hash on blockchain |
| `POST` | `/api/student/verify-file` | Verify local file against stored hash |

### Teacher Endpoints (Require teacher JWT)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/teacher/create-test` | Create a test/question paper |
| `GET` | `/api/teacher/tests` | List tests created by teacher |
| `GET` | `/api/teacher/submissions` | List pending submissions for evaluation |
| `GET` | `/api/teacher/submission/[submissionId]` | Get submission details |
| `POST` | `/api/teacher/evaluate` | Create or update evaluation (draft or final) |
| `GET` | `/api/teacher/grievances` | List assigned grievances |
| `GET` | `/api/teacher/grievances/[grievanceId]` | Get specific grievance |
| `GET` | `/api/teacher/grievance-details` | Get grievance with related evaluation data |
| `POST` | `/api/teacher/reevaluate` | Submit re-evaluation result |
| `POST` | `/api/teacher/add-student` | Add a student to class |
| `GET` | `/api/teacher/stats` | Dashboard stats |

### Admin Endpoints (Require admin JWT)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/audit-logs` | Query audit logs with filters (eventType, userId, dateRange, page) |
| `POST` | `/api/admin/bias-report` | Generate bias report for a teacher or department |
| `POST` | `/api/admin/import-students` | Bulk import students from CSV data |

---

## MCP AI Agent

The **MCP (Multi-modal Cognition Platform)** is a Python Flask server that wraps the **Groq LLM API** to provide an intelligent, tool-using AI agent for admins. It powers the floating chat interface in the admin panel.

### Available Tools

| Tool | Purpose |
|---|---|
| `get_audit_logs` | Query audit logs with filters |
| `get_evaluation_metrics` | Fetch bias metrics for a teacher |
| `get_grievances` | List and filter grievances |
| `get_submissions` | Query submissions by teacher/status |
| `get_tests` | List tests with filters |
| `compare_reevaluation` | Compare original vs. re-evaluation marks |
| `get_teacher_analytics` | Full analytics for a teacher |

### MCP Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Check if MCP server is running |
| `POST` | `/chat` | Send a message to the AI agent |
| `GET` | `/tools` | List all available tools |
| `GET` | `/quick-report/<teacher_id>` | Generate a bias report for a teacher |
| `GET` | `/analyze-submission/<submission_id>` | Analyze evaluation quality for a submission |

All MCP endpoints require the `X-MCP-Key` header.

### Example Queries

```
"Was teacher TCH2026001 biased in their last 20 evaluations?"
"Show me grievances filed in the Computer Science department this month"
"Compare the original and re-evaluation marks for submission 0x034..."
"Which teachers have a bias score above 70?"
"Generate a full risk assessment for TCH2026003"
```

---

## Blockchain Integration

The platform integrates with the **ExamIntegrity** smart contract deployed on the **Ethereum Sepolia testnet**.

**Contract Address:** `0x4f97C4b0f99Ebe1bEfca5896Eb1945dDBA654883`

### Key Contract Functions

```typescript
commitSubmissionToBlockchain(examId, submissionId, fileHash)
// Anchors the submission hash — proves the file existed at that moment

commitEvaluationToBlockchain(examId, submissionId, evaluationHash)
// Anchors evaluation marks — proves marks were not altered after submission

getSubmissionFromBlockchain(examId, submissionId)
// Retrieves on-chain hash for comparison

verifyEvaluationOnBlockchain(params)
// Cross-checks stored hash vs. on-chain hash

verifyFileHashOnBlockchain(params)
// Verifies file integrity by comparing hashes
```

### Verification Flow

```
Student uploads file → SHA-256 hash computed → Hash committed to Sepolia
Teacher finalizes evaluation → Evaluation hash computed → Hash committed to Sepolia
Admin / Student verifies → On-chain hash compared with local hash → Pass / Fail
```

---

## Project Structure

```
TECHATHON/
├── app/
│   ├── (admin)/
│   │   ├── audit-dashboard/page.tsx     # Audit log viewer
│   │   └── import-students/page.tsx     # Bulk student import
│   ├── (auth)/
│   │   └── login/page.tsx               # Unified login page
│   ├── (student)/
│   │   ├── student-dashboard/
│   │   │   ├── page.tsx                 # Student home
│   │   │   └── components/
│   │   │       ├── EvaluationProgressModal.tsx
│   │   │       └── RecentSubmissions.tsx
│   │   ├── upload/page.tsx              # Answer sheet upload
│   │   ├── results/page.tsx             # Results viewer
│   │   └── grievance/[submissionId]/page.tsx  # File grievance
│   ├── (teacher)/
│   │   ├── teacher-dashboard/page.tsx   # Teacher home
│   │   ├── create-test/page.tsx         # Test creation
│   │   ├── add-students/page.tsx        # Add students
│   │   ├── evaluate/
│   │   │   ├── page.tsx                 # Submissions list
│   │   │   └── [submissionId]/page.tsx  # Evaluation interface
│   │   ├── grievances/page.tsx          # Assigned grievances
│   │   └── reevaluate/[grievanceId]/page.tsx  # Re-evaluation interface
│   ├── api/
│   │   ├── admin/                       # Admin API routes
│   │   ├── auth/                        # Auth API routes
│   │   ├── student/                     # Student API routes
│   │   └── teacher/                     # Teacher API routes
│   ├── dashboard/page.tsx               # Role-based redirect
│   ├── page.tsx                         # Landing / auth check
│   ├── layout.tsx                       # Root layout
│   └── globals.css                      # Global styles
├── lib/
│   ├── db/
│   │   ├── models/                      # Mongoose schemas
│   │   │   ├── User.ts
│   │   │   ├── Test.ts
│   │   │   ├── Submission.ts
│   │   │   ├── Evaluation.ts
│   │   │   ├── Grievance.ts
│   │   │   ├── ReEvaluation.ts
│   │   │   ├── AuditLog.ts
│   │   │   └── EvaluationMetrics.ts
│   │   └── mongodb.ts                   # Connection pooling
│   ├── blockchain/
│   │   ├── examContract.ts              # Contract interaction functions
│   │   └── abi/ExamIntegrity.js         # Smart contract ABI
│   ├── utils/
│   │   ├── auth.ts                      # JWT & password utilities
│   │   ├── hash.ts                      # SHA-256 hashing
│   │   ├── idGenerator.ts               # Entity ID generation
│   │   ├── validation.ts                # Zod validation schemas
│   │   ├── biasDetector.ts              # Bias analysis algorithms
│   │   ├── auditLogger.ts               # Audit event logger
│   │   ├── email.ts                     # Email notifications
│   │   └── passwordGenerator.ts         # Random password generator
│   └── types/index.ts                   # TypeScript interfaces
├── mcp/                                 # Python Flask AI backend
│   ├── app.py                           # Flask app & routes
│   ├── config.py                        # Config (ports, Groq API)
│   ├── db.py                            # MongoDB connection (Python)
│   ├── agent/
│   │   ├── mcp_agent.py                 # Groq LLM agent logic
│   │   └── prompts.py                   # System prompts
│   └── tools/                           # Agent tool definitions
│       ├── audit_tools.py
│       ├── evaluation_tools.py
│       ├── grievance_tools.py
│       ├── submission_tools.py
│       ├── test_tools.py
│       ├── comparison_tools.py
│       └── teacher_tools.py
├── components/
│   └── FloatingChat.tsx                 # Admin AI chat widget
├── scripts/
│   ├── createAdmin.js                   # Seed admin user
│   ├── add-teachers.js                  # Seed teacher users
│   └── createUsers.js                   # General user creation
├── public/images/                        # Static assets & logo
├── .env.local                           # Local environment variables
├── next.config.ts                       # Next.js configuration
├── tailwind.config.ts                   # Tailwind theme
└── tsconfig.json                        # TypeScript config
```

---

## Setup & Installation

### Prerequisites

- **Node.js** 18 or higher
- **npm** 9 or higher
- **Python** 3.10 or higher (for the MCP AI agent)
- **MongoDB Atlas** account (or local MongoDB instance)
- **Groq API key** — get one at [console.groq.com](https://console.groq.com)
- **Ethereum wallet** with Sepolia testnet ETH (for blockchain features — optional for local dev)
- **Gmail account** with App Password enabled (for email notifications — optional for local dev)

---

### Step 1 — Clone & Install Dependencies

```bash
git clone <repository-url>
cd TECHATHON

npm install
```

---

### Step 2 — Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local   # if .env.example exists, otherwise create manually
```

Populate it with the values described in the [Environment Variables](#environment-variables) section below.

---

### Step 3 — Start the Next.js Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

---

### Step 4 — Seed the Database

Create the initial admin user and teacher accounts:

```bash
node scripts/createAdmin.js
node scripts/add-teachers.js
```

These scripts print the generated credentials to the console. Save them for first login.

---

### Step 5 — Start the MCP AI Agent (Optional)

The MCP server is required for the AI chat assistant in the admin panel. Skip this step if you do not need AI features locally.

```bash
cd mcp
pip install flask flask-cors pymongo groq
python app.py
```

The Flask server starts on `http://localhost:5000` by default.

---

### Step 6 — Verify the Setup

1. Open `http://localhost:3000`
2. Log in with the admin credentials printed by `createAdmin.js`
3. Navigate to the Audit Dashboard — it should load without errors
4. (Optional) Open the floating chat in the admin panel and send a test message

---

## Environment Variables

Create `.env.local` in the project root with the following variables:

```bash
# ── MongoDB ────────────────────────────────────────────────
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority

# ── JWT Authentication ─────────────────────────────────────
JWT_SECRET=your-random-secret-key-at-least-32-characters

# ── Blockchain (Ethereum Sepolia) ──────────────────────────
# Leave blank to disable blockchain features in local dev
EXAM_CONTRACT_ADDRESS=0x4f97C4b0f99Ebe1bEfca5896Eb1945dDBA654883
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your-alchemy-key>
PRIVATE_KEY=your-ethereum-wallet-private-key

# ── Email Notifications ─────────────────────────────────────
# Use a Gmail account with an App Password (not your main password)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password

# ── App URL ────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ── MCP AI Agent ───────────────────────────────────────────
# Must match the value set in mcp/config.py
NEXT_PUBLIC_MCP_KEY=mcp_admin_secret_2026
MCP_SECRET_KEY=mcp_admin_secret_2026

# ── Groq AI (set in mcp/config.py or mcp/.env) ─────────────
GROQ_API_KEY=gsk_your_groq_api_key
GROQ_PRIMARY_MODEL=llama-3.3-70b-versatile
GROQ_FALLBACK_MODEL=llama-3.3-70b-versatile
```

### Getting Each Credential

| Variable | Where to get it |
|---|---|
| `MONGODB_URI` | MongoDB Atlas → Clusters → Connect → Drivers |
| `JWT_SECRET` | Any random string (use `openssl rand -base64 32`) |
| `SEPOLIA_RPC_URL` | Alchemy or Infura dashboard (free tier works) |
| `PRIVATE_KEY` | MetaMask → Account Details → Export Private Key |
| `EMAIL_USER` / `EMAIL_PASSWORD` | Google Account → Security → App Passwords |
| `GROQ_API_KEY` | console.groq.com → API Keys |

> **Security Note:** Never commit `.env.local` to version control. The `.gitignore` already excludes it.

---

## Scripts

```bash
# Development
npm run dev          # Start Next.js dev server with hot reload (port 3000)
npm run build        # Build optimized production bundle
npm start            # Run production server
npm run lint         # Run ESLint checks

# Database Seeding
node scripts/createAdmin.js     # Create the admin user
node scripts/add-teachers.js    # Seed teacher accounts
node scripts/createUsers.js     # General-purpose user creation

# MCP AI Agent
cd mcp && python app.py         # Start Flask AI server (port 5000)
```



## Security Considerations

- All passwords are hashed with **bcrypt** (10 rounds) — plain-text passwords are never stored
- JWT tokens expire after **7 days** and are stored in HTTP-only cookies in production
- File integrity is guaranteed by **SHA-256 hashing** at upload time
- The blockchain integration provides a **tamper-evident** record outside the platform's own database
- The MCP server requires a shared secret key (`X-MCP-Key` header) to prevent unauthorized access
- Mongoose schemas enforce strict typing and reject unknown fields, preventing NoSQL injection
- All form inputs are validated with **Zod** schemas on both client and server

---

## License

Copyright (c) 2026 TECHATHON Contributors. All rights reserved.

This project and its source code are the intellectual property of the contributors who built it. Unauthorized copying, distribution, or use without explicit permission from the contributors is prohibited.
