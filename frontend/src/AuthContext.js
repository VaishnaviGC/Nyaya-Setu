import { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "./api";

// expo-secure-store keeps the auth token in the device's encrypted keychain
// (Keychain on iOS, Keystore on Android) - safer than AsyncStorage for
// anything sensitive like a login token.
const TOKEN_KEY = "nyaya_auth_token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null); // { user_id, phone_number, case_number }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (savedToken) {
        const ok = await fetchProfile(savedToken);
        if (!ok) {
          // token expired/invalid - clear it so the user isn't stuck on a broken session
          await SecureStore.deleteItemAsync(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  const fetchProfile = async (authToken) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return false;
      const profile = await res.json();
      setUser(profile);
      setToken(authToken);
      return true;
    } catch {
      return false;
    }
  };

  const authRequest = async (path, body) => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || "Something went wrong");
    }
    return data;
  };

  const register = useCallback(async (phoneNumber, password, caseNumber) => {
    const data = await authRequest("/auth/register", {
      phone_number: phoneNumber,
      password,
      case_number: caseNumber || undefined,
    });
    await SecureStore.setItemAsync(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
    setUser({ user_id: data.user_id, phone_number: data.phone_number, case_number: data.case_number });
  }, []);

  const login = useCallback(async (phoneNumber, password) => {
    const data = await authRequest("/auth/login", { phone_number: phoneNumber, password });
    await SecureStore.setItemAsync(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
    setUser({ user_id: data.user_id, phone_number: data.phone_number, case_number: data.case_number });
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateCaseNumber = useCallback(
    async (caseNumber) => {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ case_number: caseNumber }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not update case number");
      setUser((prev) => ({ ...prev, case_number: data.case_number }));
    },
    [token]
  );

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, logout, updateCaseNumber }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}
