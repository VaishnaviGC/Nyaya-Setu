// Mobile has no browser "download a file" concept - instead we fetch the PDF
// bytes, write them to the app's local storage, then open the OS share sheet.
//
// FIX: as of Expo SDK 54+, the promise-based FileSystem API used here
// (writeAsStringAsync, EncodingType, cacheDirectory) moved to the
// "expo-file-system/legacy" subpath - the default "expo-file-system" export
// is now a different, object-oriented File/Directory API. Importing from the
// wrong path silently gives you undefined functions. This app is on SDK 57,
// so the /legacy import below is the correct one.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { API_BASE_URL } from "./api";

export async function downloadAndShareComplaintPdf(category, text, userName = "", authority = "") {
  const res = await fetch(`${API_BASE_URL}/generate-complaint/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, text, user_name: userName, authority }),
  });
  if (!res.ok) {
    throw new Error(`PDF request failed (${res.status})`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);

  const fileUri = `${FileSystem.cacheDirectory}complaint_letter.pdf`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: "application/pdf",
      dialogTitle: "Save or share your complaint letter",
    });
  }
  return fileUri;
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : undefined;

    result += BASE64_CHARS[b1 >> 2];
    result += BASE64_CHARS[((b1 & 3) << 4) | (b2 === undefined ? 0 : b2 >> 4)];
    result += b2 === undefined ? "=" : BASE64_CHARS[((b2 & 15) << 2) | (b3 === undefined ? 0 : b3 >> 6)];
    result += b3 === undefined ? "=" : BASE64_CHARS[b3 & 63];
  }
  return result;
}