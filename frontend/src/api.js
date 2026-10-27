// Talks to the Nyaya AI FastAPI backend.
//
// "localhost" means the phone itself, not your laptop. Use your laptop's WiFi IP
// (run `ipconfig` on Windows, look for IPv4 Address). Phone and laptop must be on
// the same WiFi. Android emulator: http://10.0.2.2:8000
export const API_BASE_URL = "http://10.161.30.51:8000"; // <-- YOUR laptop's WiFi IP

import * as FileSystem from "expo-file-system/legacy";
const REQUEST_TIMEOUT_MS = 90000;

// One place for timeouts and readable error messages.
async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { ...options, signal: controller.signal });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      let detail = raw;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.detail) {
          detail = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
        }
      } catch {
        // response was not JSON - keep the raw text
      }
      throw new Error(detail || `Request failed (${res.status})`);
    }
    return res;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("The server took too long to answer. Please try again.");
    }
    if (String(err.message).includes("Network request failed")) {
      throw new Error("Cannot reach the server. Check that the backend is running and that your phone is on the same WiFi as your laptop.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function post(path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await request(path, { method: "POST", headers, body: JSON.stringify(body) });
  return res.json();
}

async function get(path, token) {
  const res = await request(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return res.json();
}

// Recorded audio (base64) -> transcript in its own script.
export async function analyzeVoice(audioBase64, mimeType = "audio/m4a") {
  return post("/analyze-voice", { audio_base64: audioBase64, mime_type: mimeType });
}

// Text -> category, rights, next steps, documents, follow-up questions, in the person's language.
// replyLanguage: "auto" | "en-IN" | "hi-IN" | "kn-IN". Token is optional (saves history when logged in).
export async function analyzeText(text, replyLanguage = "auto", token) {
  return post("/analyze-text", { text, reply_language: replyLanguage }, token);
}

export async function generateComplaint(category, text, userName = "", authority = "", token) {
  return post("/generate-complaint", { category, text, user_name: userName, authority }, token);
}

export async function checkHealth() {
  return get("/health");
}

export async function getHistory(token) {
  return get("/history", token);
}

export async function getHistorySummary(token) {
  return get("/history/summary", token);
}


export async function getSavedCases(token) {
  return get("/lititrack/cases", token);
}
export async function saveCase(cnr, token, nickname = "") {
  return post(
    "/lititrack/cases",
    { cnr, nickname },
    token
  );
}

export async function deleteSavedCase(caseId, token) {
  const res = await request(`/lititrack/cases/${caseId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}


export async function simplifyCourtOrder(orderText) {
  return post("/simplify-order", { order_text: orderText });
}


export async function getLiveCaseDetails(cnr, token) {
  return get(
    `/lititrack/live-case/${encodeURIComponent(cnr)}`,
    token
  );
}



export async function uploadCourtOrderPdf(uri, name, token) {
  // Read the selected PDF as Base64 using Expo's legacy FileSystem API.
  const pdfBase64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!pdfBase64) {
    throw new Error("Could not read the selected PDF. Please select it again.");
  }

  return post(
    "/simplify-order-pdf",
    {
      filename: name || "court-order.pdf",
      pdf_base64: pdfBase64,
    },
    token
  );
}

