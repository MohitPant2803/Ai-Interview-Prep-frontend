# KGP Interview Prep - Backend Server

This is the Express backend server for **KGP Interview Prep** — a student-focused interview preparation platform designed for IIT Kharagpur candidates.

## Tech Stack
- **Runtime**: Node.js
- **Server Framework**: Express.js
- **Database**: MongoDB Atlas via Mongoose
- **Authentication**: Google Identity Services token verification
- **AI Integrations**: Gemini API (`@google/generative-ai`)

## Project Structure
```text
backend/
├── middleware/
│   └── auth.js         # JWT validation middleware
├── models/
│   └── User.js         # Mongoose User schema (profiles & reports)
├── routes/
│   ├── auth.js         # Google login token authentication routes
│   ├── profile.js      # Profile management routes (API keys, CVs)
│   └── reports.js      # Session report saving & cumulative AI merging routes
├── .env.example        # Environment variables reference template
├── .gitignore          # Git exclusion rules
├── README.md           # This document
└── server.js           # Server application entrypoint
```

## Setup & Running
1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Configure your environment credentials in `.env` (`MONGO_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server in development mode (with auto-watch):
   ```bash
   npm run dev
   ```
5. The API server will listen on `http://localhost:5000`.
