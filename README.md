# Alina — frontend

https://my-alina-backend.onrender.com/docs

Phone-first React app for the Alina AI backend: **React 19 + Vite + Tailwind CSS v4 + React Router + lucide icons**, installable as a PWA, dark/light themes, CSS animations (respects *reduce motion*).

## Run it (Windows PowerShell)

```powershell
cd frontend
npm install
copy .env.example .env      # optional; the defaults work with the backend on port 8000
npm run dev
```

Open **http://localhost:5173**. Start the backend first (`python -m uvicorn app.main:app --reload` in the backend folder).

In development Vite forwards `/api` to `http://127.0.0.1:8000`, so there are no CORS problems.

### Try it on your phone
1. Phone and PC on the same Wi-Fi. Run `npm run dev` (it already listens on the network) and open `http://<your-pc-ip>:5173` on the phone.
2. **Microphone needs HTTPS** (browsers only allow it on `localhost` or secure origins). To test voice on a phone, use an HTTPS tunnel (e.g. `cloudflared tunnel --url http://localhost:5173` or `ngrok http 5173`) or deploy. Text chat works over plain HTTP.
3. “Add to Home Screen” installs it as an app (PWA).

### Production
```powershell
npm run build       # output in dist/
npm run preview
```
Serve `dist/` from any static host with **SPA fallback** (all unknown paths → `index.html`). Either put the API on the same domain under `/api`, or set `VITE_API_URL=https://api.example.com` before building and add the site's origin to the backend `CORS_ORIGINS`.

## Screens → backend APIs

| Screen (route) | What it does | Endpoints used |
|---|---|---|
| Sign in / Register / Forgot / Reset (`/login`, `/register`, `/forgot-password`, `/reset-password?token=`) | Account, token refresh, password rules | `/api/auth/*` |
| Home (`/`) | Greeting, AI status, quick actions, today's agenda, recent chats | `/api/ai/status`, `/api/chats`, `/api/tasks`, `/api/reminders` |
| Chat (`/chat`, `/chat/:id`, `/chat/new`) | History list + search, **streaming replies (SSE)**, stop, retry, copy, read aloud, save-to-memory, rename/clear/delete | `/api/chats*`, `/api/chat/stream` |
| Voice (`/voice`) | Push-to-talk: Listening → Transcribing → Thinking → Speaking, transcript review, stop | `/api/voice/*`, `/api/chat` |
| Daily routine (`/routine`) | Today, tasks, reminders (time zone, repeat, snooze), morning wake-up, notifications | `/api/tasks*`, `/api/reminders*` |
| Files (`/files`) | Upload, status polling, ask with **named sources**, reprocess, delete | `/api/files*` |
| Images (`/images`) | Upload, gallery, delete | `/api/images*` |
| Memory (`/memory`) | Consent, pause/resume, add/edit/disable/delete, clear all | `/api/memory*` |
| Settings (`/settings`) | Language, time zone, personality, voice, quiet hours, privacy, service status, theme, **export data**, change password, sign out, delete account | `/api/settings*`, `/api/auth/*`, `/api/ai/*`, `/api/voice/*`, `/api/health/storage` |

## Behaviour you should know about (honest limits)

- **Sessions:** the access token lives in memory; the refresh token is in `localStorage` and rotates on every refresh. A 401 triggers one shared refresh and a retry; a revoked session returns you to sign-in. (`localStorage` is readable by scripts on the page — keep the site free of third-party scripts, or move to cookies later; only `src/lib/session.js` would change.)
- **Voice:** uses the server's speech-to-text/text-to-speech when configured. If not, it falls back to your **browser's** speech recognition (may send audio to the browser vendor — the app says so) and **device** voice for speaking. Nothing is faked: if neither exists, the screen says so and text chat remains.
- **Reminders:** the server stores and schedules them. While the app is open it shows a notification at the due time (respecting quiet hours). Alerts with the app *closed* need push notifications configured on the server (FCM) plus a device token — this frontend does not register push tokens yet. Reminders are not a native alarm clock, and the UI never claims they are.
- **Memory** is off until the user turns it on; saving always needs a tap (e.g. the bookmark under a reply).
- **Export** collects chats, memories, tasks, reminders and settings into one JSON file on the device (file/image contents are not included).

## Project layout
```
src/
  lib/        api client (refresh + SSE), session, formatting, markdown, errors
  services/   one function per endpoint
  context/    auth, settings, theme, toasts
  hooks/      voice recorder, speaker, reminder watcher, data loading
  components/ UI kit, app shell, bottom navigation, message bubble, sheets
  pages/      one file per screen
public/       avatar + icons, manifest, service worker
```

## Verification status
This code was written without access to the npm registry in the authoring environment, so `npm install` / `vite build` were **not** run there. It was instead bundled with esbuild (all 41 modules compile, imports resolve), styled with Tailwind v4's compiler, and exercised in headless Chromium against a mocked API (login, home, chat with streaming, voice, routine, files, images, memory, settings, mobile and desktop widths) with no runtime errors. Run `npm install && npm run dev` and report anything that differs on your machine.
