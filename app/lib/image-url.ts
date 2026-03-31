const PHOTO_PROXY_BASE = "https://shelterdk.dk/api/google-photo";

export function getGooglePhotoUrl(ref: string, maxWidth = 600): string {
  return `${PHOTO_PROXY_BASE}?ref=${encodeURIComponent(ref)}&maxwidth=${maxWidth}`;
}
