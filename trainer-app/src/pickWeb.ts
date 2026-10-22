import { Platform } from 'react-native';

export type WebPick = { uri: string; name: string } | null;

export const isWeb = (): boolean => Platform.OS === 'web';

/**
 * Browser file picker for the Expo-web build.
 *
 * `expo-image-picker.launchCameraAsync` has no real camera on web — it falls
 * back to the file picker, which is why "Camera" and "Photo Library" behaved
 * identically. This uses a hidden <input type="file"> instead, with
 * capture="environment" for the camera option so mobile browsers offer the
 * camera directly. (Desktop browsers have no capture UI and show the file
 * dialog; use Expo Go / a native build on phones for full camera capture.)
 *
 * Returns a data-URL uri that works for <Image> preview and is decoded to
 * bytes at upload time (see api.appendPhoto).
 */
export function pickPhotoWeb(camera: boolean): Promise<WebPick> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.setAttribute('capture', 'environment');
    let done = false;
    const finish = (v: WebPick) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) {
        finish(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => finish({ uri: String(reader.result), name: f.name || (camera ? 'camera.jpg' : 'upload.jpg') });
      reader.onerror = () => finish(null);
      reader.readAsDataURL(f);
    };
    // Fallback for browsers without cancel events: resolve null on re-focus with no file.
    window.addEventListener('focus', function onFocus() {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => {
        if (!input.files?.length) finish(null);
      }, 300);
    });
    input.click();
  });
}
