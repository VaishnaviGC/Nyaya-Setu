import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "nyaya_saved_complaints";

export async function getSavedComplaints() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveComplaint(complaint) {
  const existing = await getSavedComplaints();
  const withId = { ...complaint, id: `${Date.now()}` };
  const updated = [withId, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return withId;
}

export async function deleteComplaint(id) {
  const updated = (await getSavedComplaints()).filter((c) => c.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
