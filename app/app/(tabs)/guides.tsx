import { View, Text, StyleSheet } from "react-native";

export default function GuidesTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Guides</Text>
      <Text style={styles.subtitle}>Guides og blog kommer her</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f0" },
  title: { fontSize: 24, fontWeight: "bold", color: "#1a3a2a" },
  subtitle: { fontSize: 16, color: "#666", marginTop: 8 },
});
