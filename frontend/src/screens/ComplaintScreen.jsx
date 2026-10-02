import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { COLORS } from "../theme";
import Button from "../components/Button";
import { generateComplaint } from "../api";
import { useAuth } from "../AuthContext";
import { downloadAndShareComplaintPdf } from "../pdfDownload";
import { saveComplaint } from "../storage";

export default function ComplaintScreen({ route, navigation }) {
  const { text, category = "Other" } = route.params || {};
  const { token } = useAuth();

  const [userName, setUserName] = useState("");
  const [authority, setAuthority] = useState("");
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [sharing, setSharing] = useState(false);

  const generate = async () => {
    if (!text) {
      navigation.replace("Voice");
      return;
    }
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const result = await generateComplaint(category, text, userName, authority, token);
      setLetter(result.letter_text);
    } catch (err) {
      setError(err.message || "Could not generate the letter. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    await saveComplaint({ category, text, letter, createdAt: new Date().toISOString() });
    setSaved(true);
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      await downloadAndShareComplaintPdf(category, text, userName, authority);
    } catch (err) {
      Alert.alert("Could not share PDF", err.message || "Something went wrong.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.badge}>{category}</Text>

      <TextInput
        style={styles.input}
        placeholder="Your name (optional)"
        placeholderTextColor={COLORS.grey}
        value={userName}
        onChangeText={setUserName}
      />
      <TextInput
        style={styles.input}
        placeholder="Authority to address (optional, e.g. Labour Commissioner)"
        placeholderTextColor={COLORS.grey}
        value={authority}
        onChangeText={setAuthority}
      />
      <Button
        title={loading ? "Regenerating…" : "🔄 Regenerate with these details"}
        variant="secondary"
        onPress={generate}
        disabled={loading}
        style={{ marginBottom: 16 }}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && !letter ? (
        <View style={{ alignItems: "center", marginVertical: 24 }}>
          <ActivityIndicator color={COLORS.navy} />
          <Text style={styles.loadingText}>Drafting your complaint letter…</Text>
        </View>
      ) : (
        <>
          <Text style={styles.hint}>Review and edit your letter before saving or sharing:</Text>
          <TextInput
            style={styles.letterBox}
            multiline
            value={letter}
            onChangeText={setLetter}
            textAlignVertical="top"
          />

          <View style={styles.row}>
            <Button
              title={saved ? "✓ Saved" : "💾 Save"}
              variant="secondary"
              onPress={handleSave}
              style={{ flex: 1 }}
            />
            <Button
              title={sharing ? "Preparing…" : "📄 Share PDF"}
              onPress={handleShare}
              disabled={sharing}
              style={{ flex: 1 }}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", padding: 20 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.goldLight,
    color: "#5a4210",
    fontSize: 11.5,
    fontWeight: "700",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 14,
    overflow: "hidden",
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    color: COLORS.navy,
  },
  hint: { fontSize: 12.5, color: COLORS.grey, marginBottom: 6 },
  letterBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 12.5,
    lineHeight: 19,
    color: COLORS.navy,
    minHeight: 280,
    marginBottom: 16,
    fontFamily: "monospace",
  },
  row: { flexDirection: "row", gap: 10, marginTop: 6 },
  loadingText: { color: COLORS.grey, fontSize: 13, marginTop: 10 },
  errorBox: {
    backgroundColor: "#fdecea",
    borderWidth: 1,
    borderColor: "#f5b7b1",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: COLORS.red, fontSize: 13 },
});
