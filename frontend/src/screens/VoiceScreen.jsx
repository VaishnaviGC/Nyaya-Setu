import { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { COLORS } from "../theme";
import Button from "../components/Button";
import { analyzeVoice } from "../api";

// Records real audio and sends it to Gemini for transcription (works for Kannada, Hindi,
// English and mixed speech). Uses expo-audio (expo-av was removed in SDK 55).
//
// "Auto" = the answer comes back in the same language the person spoke or typed.

const REPLY_LANGUAGES = [
  { code: "auto", label: "Auto" },
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिंदी" },
  { code: "kn-IN", label: "ಕನ್ನಡ" },
];

// expo-audio's HIGH_QUALITY preset records .m4a (AAC), which Gemini accepts directly.
const AUDIO_MIME_TYPE = "audio/m4a";

export default function VoiceScreen({ navigation, route }) {
  const [replyLanguage, setReplyLanguage] = useState("auto");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  const prefill = route?.params?.prefill;

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      setPermissionGranted(status.granted);
      if (!status.granted) {
        setError("Microphone permission was denied. You can still type your problem below, or enable microphone access in your phone's Settings.");
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    })();
  }, []);

  // Coming back from the answer screen with "Add these details": keep the story, let them add more.
  useEffect(() => {
    if (prefill) {
      setText(`${prefill}\n\n`);
      setHint("Add the extra details (for example answers to the questions) by speaking or typing, then tap Continue for a sharper answer.");
    }
  }, [prefill]);

  const startRecording = async () => {
    if (!permissionGranted) {
      setError("Microphone permission is required to record. Enable it in Settings, or type your problem below.");
      return;
    }
    setError("");
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (err) {
      setError("Could not start recording: " + (err.message || "unknown error"));
    }
  };

  const stopRecordingAndTranscribe = async () => {
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) {
        setError("Recording failed - no audio was captured. Please try again.");
        return;
      }

      setTranscribing(true);
      setError("");

      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const result = await analyzeVoice(base64Audio, AUDIO_MIME_TYPE);

      if (!result.transcript || result.transcript.trim() === "") {
        setError("Couldn't make out any speech in that recording. Try again, speak closer to the mic, or type below.");
      } else {
        // Append, so the story can be told in several short recordings.
        setText((prev) => (prev.trim() ? `${prev.trimEnd()} ${result.transcript}` : result.transcript));
      }
    } catch (err) {
      setError((err.message || "Could not process the recording.") + " You can also type your problem below.");
    } finally {
      setTranscribing(false);
    }
  };

  const handleMicPress = () => {
    if (recorderState.isRecording) {
      stopRecordingAndTranscribe();
    } else {
      startRecording();
    }
  };

  const handleContinue = () => {
    const cleanText = text.trim();
    if (!cleanText) {
      setError("Please record or type your problem before continuing.");
      return;
    }
    navigation.navigate("Rights", { text: cleanText, replyLanguage });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Reply language</Text>
      <View style={styles.pillRow}>
        {REPLY_LANGUAGES.map((lang) => {
          const active = replyLanguage === lang.code;
          return (
            <Pressable key={lang.code} onPress={() => setReplyLanguage(lang.code)} style={[styles.pill, active && styles.pillActive]}>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{lang.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.subLabel}>Auto = we answer in the same language you speak.</Text>

      <Pressable
        style={[styles.micButton, recorderState.isRecording && styles.micButtonActive]}
        onPress={handleMicPress}
        disabled={transcribing}
      >
        {transcribing ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <Text style={styles.micIcon}>{recorderState.isRecording ? "⏹" : "🎤"}</Text>
        )}
      </Pressable>
      <Text style={styles.micHintText}>
        {transcribing
          ? "Understanding what you said…"
          : recorderState.isRecording
          ? "Recording… tap to stop"
          : "Tap the mic and speak your problem"}
      </Text>

      {hint ? (
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.reviewHint}>Your words (you can edit this before continuing):</Text>
      <TextInput
        style={styles.textArea}
        multiline
        value={text}
        onChangeText={setText}
        placeholder="e.g. My brother changed our father's land to his name after he died..."
        placeholderTextColor={COLORS.grey}
        textAlignVertical="top"
      />

      <Button title="Continue →" onPress={handleContinue} disabled={transcribing || recorderState.isRecording} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, paddingBottom: 40 },
  label: { color: COLORS.grey, fontSize: 13, marginBottom: 8 },
  subLabel: { color: COLORS.grey, fontSize: 11.5, marginBottom: 6 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  pill: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  pillActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  pillText: { fontSize: 13, color: COLORS.navy },
  pillTextActive: { color: COLORS.goldLight },
  micButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.navy,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
  },
  micButtonActive: { backgroundColor: COLORS.red },
  micIcon: { fontSize: 40 },
  micHintText: { textAlign: "center", color: COLORS.grey, fontSize: 13, marginBottom: 20 },
  hintBox: { backgroundColor: "#fdf6e8", borderWidth: 1, borderColor: COLORS.goldLight, borderRadius: 8, padding: 12, marginBottom: 16 },
  hintText: { color: "#5a4210", fontSize: 12.5, lineHeight: 18 },
  reviewHint: { fontSize: 13, color: COLORS.grey, marginBottom: 6 },
  textArea: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    minHeight: 140,
    fontSize: 14.5,
    color: COLORS.navy,
    marginBottom: 20,
  },
  errorBox: { backgroundColor: "#fdecea", borderWidth: 1, borderColor: "#f5b7b1", borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: COLORS.red, fontSize: 13, lineHeight: 18 },
});