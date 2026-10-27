import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../theme";

const ENTRIES = [
  { emoji: "🗣️", title: "I have a legal problem", desc: "Speak or type what happened — we'll figure out your rights.", route: "Voice" },
  { emoji: "📚", title: "Know Your Rights", desc: "Browse a free offline guide — no internet needed.", route: "RightsLibrary" },
  { emoji: "🗂️", title: "Saved Complaints", desc: "Reopen, edit, or re-share a complaint you generated before.", route: "Saved" },
];

export default function HomeScreen({ navigation }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.cream }} contentContainerStyle={{ paddingBottom: 30 }}>
      <LinearGradient colors={[COLORS.navy, "#16304f"]} style={styles.header}>
        <Text style={styles.badge}>NYAYA AI</Text>
        <Text style={styles.greeting}>Namaste 🙏</Text>
        <Text style={styles.subtitle}>
          Speak your legal problem, in your own language. We'll explain your rights and help you
          draft a complaint — for free.
        </Text>
      </LinearGradient>

      <View style={styles.grid}>
        {ENTRIES.map((entry) => (
          <Pressable key={entry.route} style={styles.card} onPress={() => navigation.navigate(entry.route)}>
            <Text style={styles.emoji}>{entry.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{entry.title}</Text>
              <Text style={styles.cardDesc}>{entry.desc}</Text>
            </View>
          </Pressable>
        ))}

       
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate("LitiTrack")}
        >
          <Text style={styles.emoji}>⚖️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>I have a court case</Text>
            <Text style={styles.cardDesc}>
              Save your case number and check court information through eCourts (LitiTrack).
            </Text>
          </View>
        </Pressable>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 24, paddingTop: 50, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  badge: {
    color: COLORS.goldLight,
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 10,
  },
  greeting: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: "#c9d3e0", fontSize: 13.5, lineHeight: 20 },
  grid: { padding: 20, gap: 14 },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 18,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  emoji: { fontSize: 28 },
  cardTitle: { fontSize: 15.5, fontWeight: "700", color: COLORS.navy, marginBottom: 3 },
  cardDesc: { fontSize: 12.5, color: COLORS.grey },
});
