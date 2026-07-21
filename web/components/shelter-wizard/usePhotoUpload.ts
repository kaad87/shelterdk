import { useState, useCallback } from "react";

export interface UploadedPhoto {
  path: string;
  previewUrl: string | null;
  deleteToken: string;
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

export function usePhotoUpload(honeypot: string) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPhoto = useCallback(async (file: File) => {
    setError(null);
    if (photos.length >= 5) { setError("Maks 5 billeder"); return; }
    if (!ALLOWED.includes(file.type)) { setError("Brug et billede i JPEG, PNG eller WebP"); return; }
    if (file.size > MAX_BYTES) { setError("Billedet er for stort (maks 10 MB)"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("website", honeypot);
      const res = await fetch("/api/submit-shelter/photos", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Upload fejlede — prøv igen"); return; }
      setPhotos((prev) => [...prev, { path: data.path, previewUrl: data.previewUrl, deleteToken: data.deleteToken }]);
    } catch {
      setError("Upload fejlede — prøv igen");
    } finally {
      setUploading(false);
    }
  }, [photos.length, honeypot]);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => {
      const photo = prev[index];
      if (photo) {
        fetch("/api/submit-shelter/photos", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: photo.path, deleteToken: photo.deleteToken }),
        }).catch((err) => console.error("Photo delete failed:", err));
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  return { photos, uploading, error, addPhoto, removePhoto };
}
