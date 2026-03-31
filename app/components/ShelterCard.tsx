import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { Shelter } from "@shared/types/shelter";
import { getDisplayImageUrl, getCapacity, getAddress } from "@shared/lib/shelter-detail";
import { Star, MapPin } from "lucide-react-native";

interface Props {
  shelter: Shelter;
}

export function ShelterCard({ shelter }: Props) {
  const router = useRouter();
  const imageUrl = getDisplayImageUrl(shelter);
  const capacity = getCapacity(shelter);
  const address = getAddress(shelter);

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/shelter/${shelter.slug}`)}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderText}>Intet billede</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{shelter.title}</Text>
        {address && (
          <View style={styles.row}>
            <MapPin size={12} color="#999" />
            <Text style={styles.meta} numberOfLines={1}>{address}</Text>
          </View>
        )}
        <View style={styles.row}>
          {shelter.google_rating && (
            <>
              <Star size={12} color="#f59e0b" fill="#f59e0b" />
              <Text style={styles.meta}>{shelter.google_rating.toFixed(1)}</Text>
            </>
          )}
          {capacity && <Text style={styles.meta}> · {capacity} pl.</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 10, overflow: "hidden", marginBottom: 10, elevation: 1 },
  image: { width: 100, height: 80 },
  placeholder: { backgroundColor: "#e5e5e5", justifyContent: "center", alignItems: "center" },
  placeholderText: { fontSize: 11, color: "#999" },
  info: { flex: 1, padding: 10, justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "600", color: "#1a3a2a", marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  meta: { fontSize: 12, color: "#999" },
});
