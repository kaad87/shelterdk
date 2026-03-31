import { useState } from "react";
import { View, Text, Pressable, Image, TextInput, StyleSheet, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Camera } from "lucide-react-native";
import { enqueueSyncAction } from "../lib/sync-manager";

interface Props {
  shelterId: number;
  onUploadQueued?: () => void;
}

export function PhotoUpload({ shelterId, onUploadQueued }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  const pickImage = async (useCamera: boolean) => {
    let result: ImagePicker.ImagePickerResult;

    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Kamera", "ShelterDK skal bruge dit kamera for at tage billeder.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Galleri", "ShelterDK skal have adgang til dine billeder.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    }

    if (result.canceled || !result.assets[0]) return;

    const compressed = await manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: SaveFormat.JPEG }
    );

    setPreview(compressed.uri);
  };

  const submit = async () => {
    if (!preview) return;
    await enqueueSyncAction("photo_upload", {
      shelterId,
      uri: preview,
      caption,
    });
    setPreview(null);
    setCaption("");
    onUploadQueued?.();
    Alert.alert("Tak!", "Dit billede uploades snart.");
  };

  return (
    <View style={styles.container}>
      {!preview ? (
        <View style={styles.buttons}>
          <Pressable style={styles.button} onPress={() => pickImage(true)}>
            <Camera size={20} color="#1a3a2a" />
            <Text style={styles.buttonText}>Tag foto</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => pickImage(false)}>
            <Text style={styles.buttonText}>Vælg fra galleri</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <Image source={{ uri: preview }} style={styles.preview} />
          <TextInput
            style={styles.captionInput}
            placeholder="Tilføj en tekst (valgfrit)"
            value={caption}
            onChangeText={setCaption}
          />
          <View style={styles.buttons}>
            <Pressable style={styles.button} onPress={() => setPreview(null)}>
              <Text style={styles.buttonText}>Annuller</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.submitButton]} onPress={submit}>
              <Text style={[styles.buttonText, { color: "#fff" }]}>Upload</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16, marginBottom: 24 },
  buttons: { flexDirection: "row", gap: 12 },
  button: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd" },
  submitButton: { backgroundColor: "#1a3a2a", borderColor: "#1a3a2a" },
  buttonText: { fontSize: 14, fontWeight: "600", color: "#1a3a2a" },
  preview: { width: "100%", height: 200, borderRadius: 10, marginBottom: 12 },
  captionInput: { padding: 12, backgroundColor: "#fff", borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#ddd" },
});
