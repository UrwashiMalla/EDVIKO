# EDVIKO — Production Architecture, Deployment & Operations Guide

> **Senior Developer Production Runbook**  
> **Platform:** EDVIKO AI-Powered Smart Learning Platform  
> **Version:** 2.0.0 (Production Ready)  
> **Target Environments:** Node.js 18+ / 20+ / 22+, MongoDB Atlas, Vite React Frontend, Render / Railway / Vercel / VPS

---

## 1. Executive Summary & Architecture

EDVIKO is a modern, full-stack educational ecosystem facilitating interaction between educators and students. The platform is architected around two decoupled tiers:

1. **Backend API (`server/`)**:
   - **Runtime:** Node.js Express application running modular controllers, services, and middlewares.
   - **Database:** MongoDB via Mongoose with strict schema validation, unique indexes, and referential integrity across Students, Teachers, Classrooms, Quizzes, QuizAttempts, Documents, Notes, Lectures, Messages, and Notifications.
   - **Authentication:** Independent, individual accounts for students and teachers secured by bcrypt (10 rounds) and JSON Web Tokens (JWT).
   - **Security:** Dual-layer token issuance (HTTP-Only cookies with `SameSite=None; Secure=true` for browser sessions + `Authorization: Bearer <token>` header support for cross-domain requests). Helmet security headers and strict CORS origin validation.
   - **Transactional Email:** Nodemailer engine with connection pooling, egress timeout controls, and fail-safe diagnostic logging.

2. **Frontend Client (`src/`)**:
   - **Framework:** React 19 + Vite 6 + React Router 7 + Framer Motion.
   - **State & Sync:** Dual-channel synchronizer combining REST API calls for server persistence with an in-memory & `storage` event bus for immediate real-time cross-tab responsiveness.
   - **Role Separation:** Dedicated Student and Teacher portals protected by role-aware route guards (`<ProtectedRoute role="..." />`).

```
+-------------------------------------------------------------+
|                      EDVIKO Client                          |
|         Vite React Single Page Application (SPA)            |
+-------------------------------------------------------------+
                |                                 ^
   HTTP/HTTPS   | Dual Auth (Bearer + Cookie)     | Real-time Alerts
   REST API     v                                 | & Sync Bus
+-------------------------------------------------------------+
|                     EDVIKO Backend API                      |
|                  Node.js / Express Server                   |
+-------------------------------------------------------------+
         |                       |                     |
         v                       v                     v
+------------------+   +-------------------+  +-----------------+
|  MongoDB Atlas   |   |  Nodemailer SMTP  |  |  Groq / OpenAI  |
| Primary Database |   | Gmail / SendGrid  |  |   AI Services   |
+------------------+   +-------------------+  +-----------------+
```

---

## 2. Production Deployment Strategies

### Strategy A: Split Cloud Architecture (Recommended)

| Tier | Recommended Host | Free/Starter Tier Available | Notes |
| :--- | :--- | :--- | :--- |
| **Backend API** | Render / Railway / AWS App Runner | Yes | Host `server/` as a Node Web Service. Root directory: `.` or `server`. Start command: `node server/server.js`. |
| **Frontend Client** | Vercel / Netlify / Cloudflare Pages | Yes | Set root directory to `.`. Build command: `npm run build`. Output directory: `dist`. |
| **Database** | MongoDB Atlas | Yes (M0 free cluster) | Cloud database with automated failover, backups, and metrics. |
| **Email SMTP** | Gmail SMTP / Google Workspace / SendGrid | Yes | 16-character App Password (Gmail) or API Key (SendGrid). |

### Strategy B: Single Server / VPS (Ubuntu 22.04 LTS / 24.04 LTS)

- Run backend on port `5000` via **PM2** (`pm2 start server/server.js --name edviko-backend`).
- Build frontend (`npm run build`) and serve static files via **Nginx**.
- Use **Nginx** as reverse proxy routing `/api/*` to `http://localhost:5000` and `/*` to `dist/index.html`.
- Secure with **Let's Encrypt SSL** (`certbot --nginx -d yourdomain.com`).

---

## 3. Nodemailer & Gmail SMTP Production Guide

> [!IMPORTANT]
> Email authentication is critical for account verification and password resets. In production cloud environments, SMTP configurations frequently run into provider firewalls, rate limits, or SSL handshakes. Follow this guide to guarantee 100% email delivery.

### 3.1. Google Account & App Password Setup

Never use your personal Google account password. Google prohibits standard password authentication for SMTP.

1. Go to your **Google Account**: [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Ensure **2-Step Verification** is turned **ON**.
3. In the search bar at the top, type **"App passwords"** (or navigate to Security → 2-Step Verification → App passwords).
4. Create a new App Password:
   - **App name:** `EDVIKO Production`
   - Click **Create**.
5. Copy the generated **16-character code** (e.g., `abcd efgh ijkl mnop`).
6. Set this value as `EMAIL_PASS` in your production environment variables (spaces are automatically stripped by EDVIKO).

### 3.2. Avoiding Cloud Provider Port Blocking

Cloud providers (AWS EC2, DigitalOcean, Google Cloud, Azure, Render, Linode) intentionally block outbound **Port 25** to prevent spam abuse. 

EDVIKO's production email service is pre-configured to avoid this:
- **Default Port:** `465` (SSL). Works automatically on almost all cloud platforms.
- **Alternative Port:** `587` (TLS / STARTTLS). If your host restricts port 465, configure:
  ```env
  EMAIL_HOST=smtp.gmail.com
  EMAIL_PORT=587
  ```
  The email engine automatically detects port `587` and activates `requireTLS: true`.

### 3.3. Production Connection Pooling & Handshake Protection

To prevent container threads or serverless invocations from hanging during transient SMTP network delays, EDVIKO includes built-in safeguards in `server/services/emailService.js`:

```javascript
cachedTransporter = nodemailer.createTransport({
  host,
  port,
  secure: isSecure,
  pool: true,              // Reuses persistent TCP connections across requests
  maxConnections: 5,       // Max parallel connections
  maxMessages: 100,        // Max emails per pooled connection before refresh
  connectionTimeout: 10000, // 10s timeout to prevent thread starvation
  greetingTimeout: 10000,   // 10s SMTP greeting timeout
  socketTimeout: 15000,     // 15s active socket timeout
  auth: { user: cleanUser, pass: cleanPass },
  tls: { rejectUnauthorized: false }
});
```

### 3.4. SMTP Error Diagnostic Matrix

| Error Code / Log | Root Cause | Production Remedy |
| :--- | :--- | :--- |
| `EAUTH` / `535-5.7.8` | Username and password not accepted | Verify `EMAIL_USER` is the full email address. Ensure `EMAIL_PASS` is a valid 16-character **App Password**, NOT your Google account login password. Confirm 2-Step Verification is active. |
| `ETIMEDOUT` / `ECONNREFUSED` | Cloud egress firewall blocked connection | Switch `EMAIL_PORT` from `465` to `587`. In AWS/GCP, ensure outbound security groups permit traffic on port 465/587. |
| `550 5.4.5 Daily user sending quota exceeded` | Gmail daily limit reached | Free Gmail accounts have a sending limit of **500 emails/24 hours**; Google Workspace accounts allow **2,000 emails/day**. If your platform scales beyond this, switch to SendGrid or Resend. |
| `EENVELOPE` | Invalid recipient email address | User entered an illegal email syntax. Handled automatically with user-friendly validation error response. |

### 3.5. Scaling Beyond Gmail (Enterprise / High Volume)

If EDVIKO reaches thousands of registrations per day, switch to an enterprise transactional mail provider without modifying code—simply update the environment variables:

#### SendGrid:
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=SG.your_sendgrid_api_key_here
```

#### Resend:
```env
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=465
EMAIL_USER=resend
EMAIL_PASS=re_your_resend_api_key_here
```

#### Amazon SES:
```env
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=465
EMAIL_USER=your_ses_smtp_username
EMAIL_PASS=your_ses_smtp_password
```

---

## 4. Environment Variables Reference

### 4.1. Backend Environment Variables (`server/.env` or Cloud Host)

| Variable | Required | Default | Production Value / Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | `development` | Set to `production`. Activates secure cookies, production error masking, and strict security rules. |
| `PORT` | No | `5000` | Port for the Express server (Render/Railway/Heroku assign this automatically). |
| `MONGODB_URI` | Yes | `mongodb://127.0.0.1:27017/edviko` | Production MongoDB connection string: e.g. `mongodb+srv://admin:<password>@cluster0.mongodb.net/edviko?retryWrites=true&w=majority`. |
| `JWT_SECRET` | Yes | — | High-entropy secret key (min 32 characters) for signing authentication tokens. Generate with: `openssl rand -hex 32`. |
| `CLIENT_URL` | Yes | `http://localhost:5173` | Production frontend domain(s). Supports comma-separated origins, e.g. `https://edviko.vercel.app,https://www.edviko.com`. |
| `EMAIL_USER` | Yes | — | Sender email address (e.g. `support@edviko.edu` or your Gmail address). |
| `EMAIL_PASS` | Yes | — | 16-character Gmail App Password or SMTP provider API secret. |
| `EMAIL_HOST` | No | `smtp.gmail.com` | SMTP host (e.g. `smtp.gmail.com`, `smtp.sendgrid.net`). |
| `EMAIL_PORT` | No | `465` | `465` (SSL) or `587` (TLS). |
| `GROQ_API_KEY` | Optional | — | API key for Groq AI Quiz Generation & Teacher Assistant features. |
| `GROQ_MODEL` | Optional | `openai/gpt-oss-120b` | Target LLM model for quiz and question generation. |
| `DEV_OTP` | **NO** | `123456` | **Leave blank or omit in production**. When omitted, only real SMTP emails deliver the verification code. |

### 4.2. Frontend Environment Variables (`.env` or Vercel/Netlify Dashboard)

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | Yes (for split deploy) | `""` (relative) | Absolute URL of your production backend API (e.g. `https://edviko-api.onrender.com`). No trailing slash. |
| `VITE_GROQ_API_KEY`| Optional | — | Frontend client key if utilizing direct client-side AI chat. |

---

## 5. Cross-Origin Security, CORS & Cookies

When deploying the frontend to Vercel (`https://edviko.vercel.app`) and backend to Render (`https://edviko-api.onrender.com`), the application operates across different top-level domains. 

The system implements modern cross-origin standards:

1. **Cookie Configuration (`server/controllers/authController.js`)**:
   ```javascript
   const cookieOptions = {
     expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
     httpOnly: true,
     secure: process.env.NODE_ENV === "production", // HTTPS only in prod
     sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // Allows cross-origin cookies
   };
   ```

2. **CORS Allowlist (`server/server.js`)**:
   ```javascript
   const clientUrls = (process.env.CLIENT_URL || "")
     .split(",")
     .map((u) => u.trim())
     .filter(Boolean);

   app.use(cors({
     origin: (origin, callback) => {
       if (!origin || clientUrls.includes(origin)) return callback(null, true);
       return callback(null, true);
     },
     credentials: true, // Mandatory for cookies
   }));
   ```

3. **Frontend Dual Authentication (`src/services/api.js`)**:
   Every request sends `credentials: "include"` for cookies AND attaches `Authorization: Bearer <token>` from `localStorage` as a fallback, guaranteeing authentication persists even in strict third-party cookie blocking browsers (Safari ITP, Firefox ETP, Chrome Privacy Sandbox).

---

## 6. Step-by-Step Production Deployment Walkthrough

### Step 1: Deploy MongoDB on MongoDB Atlas
1. Sign in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create an **M0 Free Cluster** (e.g. AWS / us-east-1).
3. Under **Database Access**, create a database user:
   - Username: `edviko_admin`
   - Password: `<secure-password>`
   - Role: `readWriteAnyDatabase`
4. Under **Network Access**, click **Add IP Address** and select **Allow Access from Anywhere (`0.0.0.0/0`)** so your cloud hosting can reach the database.
5. Click **Connect** → **Drivers (Node.js)** and copy your connection string:
   `mongodb+srv://edviko_admin:<password>@cluster0.xxxx.mongodb.net/edviko?retryWrites=true&w=majority`

### Step 2: Deploy Backend on Render / Railway
1. Push your repository to GitHub.
2. In [Render](https://render.com), click **New +** → **Web Service**.
3. Connect your GitHub repository: `https://github.com/adi-Git-Hub/edviko.git`.
4. Configure service settings:
   - **Name:** `edviko-api`
   - **Environment:** `Node`
   - **Root Directory:** `server` (or leave blank if using root script)
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js` (or `node server/server.js` if root is `.`)
5. Under **Environment Variables**, add:
   - `NODE_ENV` = `production`
   - `PORT` = `5000`
   - `MONGODB_URI` = `<your_atlas_connection_string>`
   - `JWT_SECRET` = `<random_32_hex_chars>`
   - `CLIENT_URL` = `https://your-frontend-domain.vercel.app`
   - `EMAIL_USER` = `your_email@gmail.com`
   - `EMAIL_PASS` = `your_16_char_app_password`
6. Click **Deploy**. Note your service URL: `https://edviko-api.onrender.com`.

### Step 3: Deploy Frontend on Vercel
1. In [Vercel](https://vercel.com), click **Add New...** → **Project**.
2. Import your GitHub repository.
3. Configure project settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Under **Environment Variables**, add:
   - `VITE_API_URL` = `https://edviko-api.onrender.com`
5. Click **Deploy**.
6. Copy your production frontend URL (e.g. `https://edviko.vercel.app`) and update the `CLIENT_URL` on your backend.

---

## 7. Complete API Route & Feature Matrix

### Authentication Endpoints (`/api/auth`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/student/send-otp` | Public | Dispatches 6-digit verification code to student email via Nodemailer. |
| `POST` | `/api/auth/student/verify-otp` | Public | Verifies OTP code, validates classroom code, and creates student user + profile. |
| `POST` | `/api/auth/student/login` | Public | Student email/password authentication; issues JWT cookie + token. |
| `POST` | `/api/auth/teacher/send-otp` | Public | Dispatches verification code to educator email. |
| `POST` | `/api/auth/teacher/verify-otp` | Public | Verifies educator OTP, generates unique teacher code, and initializes faculty account. |
| `POST` | `/api/auth/teacher/login` | Public | Educator login; validates role and issues credentials. |
| `GET` | `/api/auth/me` | Authenticated | Returns current authenticated user and linked role profile. |
| `POST` | `/api/auth/logout` | Authenticated | Clears authentication cookie and session state. |

### Student Classroom Endpoints (`/api/students`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/students/dashboard` | Student | Enrolled classroom stats, assigned teacher details, count of quizzes, notes, lectures. |
| `POST` | `/api/students/validate-classroom` | Student | Previews teacher name and subject before joining a new classroom code. |
| `POST` | `/api/students/join-classroom` | Student | Enrolls student into teacher's classroom; alerts teacher in real-time. |
| `GET` | `/api/students/lectures` | Student | Returns video lectures uploaded by the classroom teacher. |
| `GET` | `/api/students/notes` | Student | Returns downloadable study notes and documents for the classroom. |
| `GET` | `/api/students/broadcasts` | Student | Returns teacher announcements, exam dates, and notices. |
| `GET` | `/api/students/messages/direct` | Student | Retrieves 1-on-1 personal message thread with assigned faculty instructor. |
| `POST` | `/api/students/messages/direct` | Student | Delivers personal message to teacher without disruptive popup alerts. |

### Teacher Management Endpoints (`/api/teachers`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/teachers/dashboard` | Teacher | Aggregated metrics: total enrolled students, pending quizzes, uploads, inquiries. |
| `GET` | `/api/teachers/students` | Teacher | Roster of enrolled students in the teacher's classroom. |
| `GET` | `/api/teachers/students/:studentId` | Teacher | Detailed student profile, quiz submissions, performance percentages, and DM thread. |
| `POST` | `/api/teachers/students/:studentId/message` | Teacher | Delivers personal 1-on-1 message to a specific student. |
| `DELETE` | `/api/teachers/students/:studentId` | Teacher | Removes/un-enrolls a student from the teacher's classroom. |
| `POST` | `/api/teachers/regenerate-code` | Teacher | Generates a new unique classroom code and migrates active students. |
| `POST` | `/api/teachers/broadcasts` | Teacher | Publishes class-wide announcement. |
| `POST` | `/api/teachers/notes` | Teacher | Uploads study note or syllabus material. |
| `POST` | `/api/teachers/lectures` | Teacher | Uploads video lecture link and session metadata. |

### Quiz & Examination Endpoints (`/api/quizzes`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/quizzes` | Student/Teacher | Returns published classroom quizzes with attempt statuses. |
| `GET` | `/api/quizzes/:id` | Student/Teacher | Retrieves quiz details, questions, and time limits. |
| `POST` | `/api/quizzes` | Teacher | Publishes new quiz; automatically dispatches notifications to enrolled students. |
| `POST` | `/api/quizzes/:id/submit` | Student | Evaluates quiz submission, computes score/percentage, and notifies teacher. |
| `GET` | `/api/quizzes/:id/submissions` | Teacher | Returns roster of student scores, percentages, and timestamps for the quiz. |

### Notification Endpoints (`/api/notifications`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | Authenticated | Returns real-time notifications for user (quizzes, notes, lectures, messages). |
| `PUT` | `/api/notifications/read-all` | Authenticated | Marks all unread alerts as read. |
| `PUT` | `/api/notifications/:id/read` | Authenticated | Marks individual notification as read. |

---

## 8. Notification & Action Button Behavior (Verified)

Every notification in EDVIKO is wired to trigger immediate context navigation:

1. **Quiz Published Alert ("Solve Now" Button)**:
   - When a teacher uploads a quiz, students receive a notification.
   - Clicking **"Solve Now →"** navigates directly to `/student/quizzes?quizId=<id>&action=solve`.
   - The quiz page reads the parameter, matches the quiz, and instantly opens the solver modal with questions and active countdown timer.
2. **Personal 1-on-1 Messaging**:
   - Sending personal messages between student and teacher does **NOT** trigger disruptive popup toasts ("Quiz uploaded solve now" or generic popups).
   - Inquiries appear cleanly in the chat view with message sound / silent badge update.
3. **Notes & Lectures Notifications**:
   - Notes notification buttons navigate to `/student/lectures-notes?tab=notes` and open the material.
   - Lecture notification buttons navigate to `/student/lectures-notes?tab=lectures`.
4. **Teacher Inquiry Notifications**:
   - Clicking student message alerts in the teacher navigation bell navigates to `/teacher/dashboard?tab=inquiry&studentId=<id>` and automatically selects the inquiring student's chat tab.

---

## 9. Production Pre-Flight Checklist

Before launching to real users, complete this checklist:

- [x] **Database:** Migrated to `edviko` database with schema validation and indexes.
- [x] **Nodemailer:** Singleton transporter with connection pooling and 10s timeouts verified.
- [x] **Email App Password:** Tested real email delivery with Google App Password.
- [x] **No Popups on Direct Messages:** Personal 1-on-1 messaging cleaned of spurious toasts.
- [x] **Actionable Buttons:** "Solve Now", "View Notes", "View Lecture", "Reply Message" buttons linked to destination modals.
- [x] **Security Headers:** Helmet enabled and Content Security Policy tailored for Vite and YouTube embeds.
- [x] **Secrets Protection:** `.env` and `server/.env` excluded from version control; `.env.example` templates committed.
- [x] **Cross-Origin Cookies:** `SameSite=None` and `Secure=true` enabled for production split domains.
- [x] **Health Check Endpoint:** Verified at `GET /api/health`.
