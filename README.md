# Nyaya Setu — Nyaya AI Module (M1 + M2)

Voice-in, rights-and-complaint-out. This is Journey 1 of Nyaya Setu:
**"I have a legal problem" → speak it → AI explains your rights → generates
a complaint letter → share as PDF.**

**This is a mobile app (Expo / React Native), not a website.** The backend
is a plain FastAPI REST API underneath, so it works with any frontend — it
doesn't know or care whether a phone app or a browser is calling it.

Everything below has been build-tested already:
- Backend hit end-to-end with a real test client (all 5 endpoints, including
  a real generated PDF).
- Frontend bundled successfully with Metro for both Android and iOS
  (`npx expo export`) — 880+ modules, no errors.

---

## 1. Folder structure

```
nyaya-setu/
  backend/     ← FastAPI + Gemini (M2)
  frontend/    ← Expo / React Native app (M1)
  mock-data/   ← empty, reserved for M3 (LitiTrack)
  docs/        ← empty, reserved for report/screenshots
```

## 2. Prerequisites

- **Python 3.10+**
- **Node.js 18+** (Node 20 LTS recommended)
- **Expo Go** app on your phone (free, from Play Store / App Store) — this
  is the easiest way to run and test the app without installing Android
  Studio or Xcode.
- A free **Gemini API key**: https://aistudio.google.com/apikey (optional
  to start — see "Mock Mode" below)

## 3. Open in VS Code

```bash
cd nyaya-setu
code .
```

---

## 4. Run the backend (Terminal 1)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Open `backend/.env` and paste your real key:
```
GEMINI_API_KEY=your_real_key_here
```

The `.env.example` also includes a `JWT_SECRET_KEY` used to sign login
tokens — the default placeholder value works fine for local development and
demos, but should be changed to a real random string before any public
deployment.

**No key yet?** Leave it blank — the backend auto-switches to **MOCK MODE**
and returns realistic canned responses instead of crashing, so you can test
the whole app before Gemini is wired up. You'll see
`"GEMINI_API_KEY not set - running in MOCK MODE"` printed on startup.

Start the server:
```bash
uvicorn main:app --reload --port 8000
```

Verify: open http://localhost:8000/docs (Swagger UI) or
http://localhost:8000/health directly.

**⚠️ If you change `.env`, you must restart `uvicorn`** (Ctrl+C, then rerun).
`--reload` only watches code files, not `.env` — a common source of "I added
the key but it's still in mock mode" confusion.

---

## 5. Run the mobile app (Terminal 2 — new terminal, keep backend running)

```bash
cd frontend
npm install
npx expo start
```

A QR code appears in the terminal.
- **Android**: open the Expo Go app → Scan QR Code.
- **iOS**: open your Camera app and point it at the QR code → tap the
  notification to open in Expo Go.

Your phone and laptop **must be on the same WiFi network**.

### IMPORTANT: point the app at your backend

Open `frontend/src/api.js` and check `API_BASE_URL`:

```js
export const API_BASE_URL = "http://localhost:8000"; // <-- change this
```

`localhost` on your phone means the phone itself, not your laptop — you
must use your laptop's actual network IP:

1. Find your laptop's LAN IP:
   - **Mac**: `ipconfig getifaddr en0`
   - **Windows**: `ipconfig` → look for "IPv4 Address" (e.g. `192.168.1.5`)
   - **Linux**: `hostname -I`
2. Set `API_BASE_URL = "http://192.168.1.5:8000"` (use your real IP).
3. Save the file — Expo's fast refresh will pick it up automatically.

If you're instead testing on an **Android emulator** on the same machine,
use `http://10.0.2.2:8000` (a special alias the emulator maps to your
laptop's localhost).

---

## 6. Test the full flow

1. **First launch → Create an account.** Enter a phone number and password
   (6+ characters). Case number is optional — leave it blank if you don't
   have one yet.
2. Home tab → tap **"I have a legal problem."**
3. Tap into the text box, then use your **keyboard's own mic button**
   (every iOS/Android keyboard has one) to dictate — or just type. Example:
   *"My employer fired me and didn't pay my last salary."*
4. Tap **Continue** → calls `/detect-problem` then `/explain-rights`. Since
   you're logged in, this is automatically saved to your history.
5. On the Rights screen, try **"🔊 Read my rights aloud"** — text-to-speech
   reads the explanation back in the language you picked.
6. Tap **Generate a Complaint Letter** → calls `/generate-complaint` (also
   saved to history). Edit if needed, then **Save** (stored on-device) or
   **Share PDF** (opens your phone's share sheet).
7. Check the **Profile** tab: your account, your case number (editable),
   and a running summary of **how the app has helped you** — total
   interactions, complaints drafted, categories covered. Tap
   "View full history →" for the complete list.
8. Check the **Rights** tab (offline library, works with backend off) and
   **Saved** tab (your saved complaints, on-device).

If something shows a red error box, it's almost always `API_BASE_URL`
pointing at the wrong address, or the backend not running — check Terminal 1
and step 5 (network setup) above.

---

## 7. Why not the browser's Web Speech API?

An earlier version of this module was built for the web (React + Vite) and
used the browser's built-in `SpeechRecognition`. Mobile has no direct
equivalent — a real native speech-to-text module needs a custom Expo dev
build and won't run inside plain Expo Go. Instead, this app leans on a
feature every phone already has: **the keyboard's own dictation/mic
button**. Tap into any text field and use it — same "speak instead of type"
experience, zero extra native setup, works immediately in Expo Go.

Text-to-speech (reading rights back out loud) uses `expo-speech`, which
**is** officially supported in Expo Go — no extra setup needed there.

---

## 8. Pushing to the shared GitHub repo

Per the team plan, don't push directly to `main`:

```bash
git checkout -b m1-m2-nyaya-ai
git add frontend backend .gitignore README.md
git commit -m "Nyaya AI: mobile voice input, login/accounts, Gemini rights/complaint generation"
git push origin m1-m2-nyaya-ai
```

Then open a Pull Request into `main` on GitHub.

**Double-check before pushing:** `backend/.env` and `backend/nyaya_setu.db`
(the SQLite database file, created automatically on first run) are already
excluded by `.gitignore` — don't force-add them. There's no `frontend/.env`
in this version since `API_BASE_URL` lives directly in `src/api.js`.

**A note for your teammate:** `backend/auth.py`, `database.py`, and
`models.py` are now filled in — a real login system (phone number +
password, JWT tokens) backed by a SQLite database, with a `History` table
that records every rights-check and complaint generated while logged in.
If she already has her own version of these files locally, compare before
merging — two different implementations of the same three files will
conflict on any pull request.

---

## 9. What's real vs mock right now

| Piece | Status |
|---|---|
| Login / account creation | ✅ Real (phone number + password, JWT tokens, bcrypt-hashed passwords) |
| Case number linking | ✅ Real, optional field on your profile, editable any time |
| History tracking ("how has this app helped me") | ✅ Real, saved server-side in SQLite whenever you're logged in |
| Voice input (keyboard dictation) | ✅ Real, no extra native module needed |
| Gemini problem detection / rights / complaint generation | ✅ Real, once `GEMINI_API_KEY` is set |
| Read rights aloud (text-to-speech) | ✅ Real (`expo-speech`) |
| Complaint PDF export + share | ✅ Real (`expo-file-system` + `expo-sharing`) |
| Emergency helpline banner (Domestic Violence) | ✅ Real, static numbers |
| Know Your Rights library | ✅ Real, static offline content |
| Saved Complaints (device-only letter drafts) | ✅ Real, on-device (`AsyncStorage`) — separate from server-side History |
| Court case tracking (LitiTrack) | 🚧 M3/M4's module — Home screen has a placeholder card |

## 10. Common issues

- **App can't reach the backend / network error** → almost always
  `API_BASE_URL` set to `localhost` instead of your laptop's LAN IP (see
  step 5). Also check your firewall isn't blocking incoming connections on
  port 8000.
- **Still shows "mock mode" after adding a real key** → you need to restart
  `uvicorn`, not just save `.env`.
- **PDF share does nothing** → `expo-sharing` isn't available on some
  emulators without a share target app installed; test on a real device via
  Expo Go for the most reliable result.
- **Metro bundler errors on `npm install`** → delete `node_modules` and
  `package-lock.json`, then `npm install` again.
