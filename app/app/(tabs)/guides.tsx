import { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getGuides } from "@shared/data/guides";
import { getBlogPosts } from "@shared/data/blog";

type Tab = "guides" | "blog";

export default function GuidesTab() {
  const [tab, setTab] = useState<Tab>("guides");
  const guides = getGuides();
  const posts = getBlogPosts();

  const items = tab === "guides"
    ? guides.map((g) => ({ slug: g.slug, title: g.title, excerpt: g.excerpt, image: g.coverImage }))
    : posts.map((p) => ({ slug: p.slug, title: p.title, excerpt: p.excerpt, image: p.coverImage }));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.header}>Guides & Blog</Text>

      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === "guides" && styles.tabActive]} onPress={() => setTab("guides")}>
          <Text style={[styles.tabText, tab === "guides" && styles.tabTextActive]}>Guides</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "blog" && styles.tabActive]} onPress={() => setTab("blog")}>
          <Text style={[styles.tabText, tab === "blog" && styles.tabTextActive]}>Blog</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.slug}
        renderItem={({ item }) => (
          <Pressable style={styles.card}>
            {item.image && <Image source={{ uri: item.image }} style={styles.cardImage} />}
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardExcerpt} numberOfLines={2}>{item.excerpt}</Text>
            </View>
          </Pressable>
        )}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f0" },
  header: { fontSize: 22, fontWeight: "bold", color: "#1a3a2a", paddingHorizontal: 16, paddingTop: 8 },
  tabs: { flexDirection: "row", paddingHorizontal: 16, marginTop: 12, marginBottom: 12, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd" },
  tabActive: { backgroundColor: "#1a3a2a", borderColor: "#1a3a2a" },
  tabText: { fontSize: 14, color: "#333" },
  tabTextActive: { color: "#fff" },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: "#fff", borderRadius: 10, overflow: "hidden", marginBottom: 12, elevation: 1 },
  cardImage: { width: "100%", height: 160 },
  cardContent: { padding: 12 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#1a3a2a", marginBottom: 4 },
  cardExcerpt: { fontSize: 13, color: "#666", lineHeight: 18 },
});
