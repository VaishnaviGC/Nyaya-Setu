import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { COLORS } from "../theme";
import rightsLibrary from "../data/rightsLibrary";

export default function RightsLibraryScreen() {
  const [openId, setOpenId] = useState(null);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.badge}>WORKS OFFLINE</Text>
      <Text style={styles.title}>Know Your Rights</Text>
      <Text style={styles.subtitle}>A free legal guidebook, always available — even without internet.</Text>

      {rightsLibrary.map((section) => {
        const isOpen = openId === section.id;
        return (
          <View style={styles.card} key={section.id}>
            <Pressable style={styles.cardHeader} onPress={() => setOpenId(isOpen ? null : section.id)}>
              <Text style={styles.icon}>{section.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{section.title}</Text>
                <Text style={styles.cardIntro}>{section.intro}</Text>
              </View>
              <Text style={styles.chevron}>{isOpen ? "▲" : "▼"}</Text>
            </Pressable>

            {isOpen && (
              <View style={styles.pointsList}>
                {section.points.map((point, i) => (
                  <Text key={i} style={styles.point}>
                    •  {point}
                  </Text>
                ))}
              </View>
            )}
          </View>
        );
      })}
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
    marginBottom: 10,
    overflow: "hidden",
  },
  title: { fontSize: 20, fontWeight: "700", color: COLORS.navy, marginBottom: 4 },
  subtitle: { fontSize: 13, color: COLORS.grey, marginBottom: 20 },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  icon: { fontSize: 22 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: COLORS.navy },
  cardIntro: { fontSize: 12.5, color: COLORS.grey, marginTop: 2 },
  chevron: { color: COLORS.gold, fontSize: 13 },
  pointsList: { marginTop: 14, gap: 8 },
  point: { fontSize: 13, color: "#4a5568", lineHeight: 19 },
});
