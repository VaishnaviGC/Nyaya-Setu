import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Linking, Alert, ActivityIndicator } from "react-native";
import * as Speech from "expo-speech";
import { COLORS } from "../theme";
import Button from "../components/Button";
import Card from "../components/Card";
import { analyzeText } from "../api";
import { getEmergencyHelplines, GENERAL_LEGAL_AID } from "../data/helplines";
import { useAuth } from "../AuthContext";

// Android's speech engine rejects very long text, so read it in sentence-sized pieces.
function chunkText(text, max = 1200) {
  const parts = text.match(/[^.!?।\n]+[.!?।\n]*/g) || [text];
  const chunks = [];
  let current = "";
  for (const part of parts) {
    if ((current + part).length > max && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += part;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// If the phone has no voice for this language, Android would read Kannada with an English voice
// and produce nonsense - so check first.
async function hasVoiceFor(lang) {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (!voices || voices.length === 0) return true; // cannot tell - just try
    const base = lang.split("-")[0].toLowerCase();
    return voices.some((v) => (v.language || "").replace("_", "-").toLowerCase().startsWith(base));
  } catch {
    return true;
  }
}

function buildSpeech(result) {
  const isEnglish = (result.language || "en-IN").toLowerCase().startsWith("en");
  const rights = (result.rights || []).map((r) => (isEnglish ? `${r.law}. ${r.explanation}` : r.explanation));
  return [result.summary, ...rights, ...(result.next_steps || [])].filter(Boolean).join("\n");
}

function BulletList({ items }) {
  return (
    <View>
      {items.map((item, i) => (
        <Text key={i} style={styles.bullet}>
          •  {item}
        </Text>
      ))}
    </View>
  );
}

export default function RightsScreen({ route, navigation }) {
  const { text, replyLanguage = "auto" } = route.params || {};
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!text) {
      navigation.goBack();
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setResult(null);
      try {
        const data = await analyzeText(text, replyLanguage, token);
        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Something went wrong. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [text, replyLanguage, token, attempt, navigation]);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      Speech.stop();
    };
  }, []);

  const speakChunks = (chunks, lang, index) => {
    if (stoppedRef.current || index >= chunks.length) {
      setSpeaking(false);
      return;
    }
    Speech.speak(chunks[index], {
      language: lang,
      onDone: () => speakChunks(chunks, lang, index + 1),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const handleReadAloud = async () => {
    if (speaking) {
      stoppedRef.current = true;
      Speech.stop();
      setSpeaking(false);
      return;
    }
    const lang = result.language || "en-IN";
    if (!(await hasVoiceFor(lang))) {
      Alert.alert(
        "Voice not installed",
        `Your phone has no text-to-speech voice for this language (${lang}). Open Settings, search "Text-to-speech", choose the Google engine, download the language's voice data, then try again.`
      );
      return;
    }
    stoppedRef.current = false;
    setSpeaking(true);
    speakChunks(chunkText(buildSpeech(result)), lang, 0);
  };

  const addMoreDetails = () => {
    navigation.navigate("MainTabs", { screen: "Voice", params: { prefill: text } });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.navy} />
        <Text style={styles.loadingText}>
          Reading your problem and checking the relevant laws…{"\n"}This can take up to 30 seconds.
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
        <Button title="🔄 Try again" onPress={() => setAttempt((n) => n + 1)} style={{ marginBottom: 12 }} />
        <Button title="← Go back" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const helplines = getEmergencyHelplines(result.category);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      {helplines && (
        <View style={styles.helplineBanner}>
          <Text style={styles.helplineTitle}>⚠️ If you are in immediate danger, please call for help right now:</Text>
          {helplines.map((h) => (
            <Text key={h.number} style={styles.helplineLink} onPress={() => Linking.openURL(`tel:${h.number}`)}>
              {h.label}: {h.number}
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.badge}>{result.category}</Text>

      <Button
        title={speaking ? "⏹ Stop reading" : "🔊 Read my rights aloud"}
        variant="secondary"
        onPress={handleReadAloud}
        style={{ marginBottom: 16 }}
      />

      {result.understood ? <Card title="What we understood">{result.understood}</Card> : null}
      {result.summary ? <Card title="Your rights, in plain language">{result.summary}</Card> : null}

      {result.rights.map((r, i) => (
        <Card key={i} title={r.law}>
          {r.explanation}
        </Card>
      ))}

      {result.next_steps.length > 0 && (
        <Card title="What you can do next">
          <BulletList items={result.next_steps} />
        </Card>
      )}

      {result.documents.length > 0 && (
        <Card title="Useful documents / evidence">
          <BulletList items={result.documents} />
        </Card>
      )}

      {result.questions.length > 0 && (
        <Card title="Details that could change the answer">
          <BulletList items={result.questions} />
          <Button
            title="✍️ Add these details for a sharper answer"
            variant="secondary"
            onPress={addMoreDetails}
            style={{ marginTop: 12 }}
          />
        </Card>
      )}

      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimerText}>
          {result.disclaimer ||
            "This is AI-generated guidance for general awareness, not a substitute for advice from a qualified lawyer."}
        </Text>
      </View>

      <Card title="Need free legal help?" style={{ backgroundColor: "#f5f7fa" }}>
        <Text style={styles.helplineLink} onPress={() => Linking.openURL(`tel:${GENERAL_LEGAL_AID.number}`)}>
          {GENERAL_LEGAL_AID.label}: {GENERAL_LEGAL_AID.number}
        </Text>
      </Card>

      <Button
        title="📝 Generate a Complaint Letter"
        variant="gold"
        onPress={() => navigation.navigate("Complaint", { text, category: result.category })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", padding: 20 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  loadingText: { color: COLORS.grey, fontSize: 13.5, textAlign: "center", marginTop: 16, lineHeight: 20 },
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
  bullet: { fontSize: 13.5, color: "#4a5568", lineHeight: 21, marginBottom: 6 },
  helplineBanner: {
    backgroundColor: "#fdecea",
    borderWidth: 1.5,
    borderColor: COLORS.red,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  helplineTitle: { fontWeight: "700", color: "#7a1f14", marginBottom: 8, fontSize: 13.5 },
  helplineLink: { color: COLORS.red, fontWeight: "700", fontSize: 13.5, marginBottom: 4 },
  disclaimerBox: {
    backgroundColor: "#fdf6e8",
    borderWidth: 1,
    borderColor: COLORS.goldLight,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  disclaimerText: { fontSize: 13, color: "#5a4210", lineHeight: 19 },
  errorBox: {
    backgroundColor: "#fdecea",
    borderWidth: 1,
    borderColor: "#f5b7b1",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: COLORS.red, fontSize: 13.5, lineHeight: 19 },
});