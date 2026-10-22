import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Btn, ErrorBanner } from './ui';
import { C, R, S } from '../theme';

/**
 * Live camera capture for Expo web (desktop/mobile browsers).
 * expo-image-picker has no real camera on web, so this uses getUserMedia
 * directly: live <video> preview + frame grab to JPEG data-URL, which the
 * existing upload path already accepts.
 */
export default function WebCamera({
  onCapture,
  onClose,
}: {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          setErr('This browser has no camera API. Use Expo Go on your phone for live capture.');
          return;
        }
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 } },
            audio: false,
          });
        } catch {
          // Desktops usually have only a front camera — retry without facingMode.
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (!live) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
          setReady(true);
        }
      } catch (e: any) {
        const name = e?.name || '';
        if (name === 'NotAllowedError') setErr('Camera blocked. Click the camera icon in the address bar, allow access, and retry.');
        else if (name === 'NotFoundError' || name === 'OverconstrainedError') setErr('No camera found on this device. Use Expo Go on your phone instead.');
        else if (name === 'NotSecureError') setErr('Camera needs a secure page. Open the app via localhost or HTTPS.');
        else setErr(e?.message || 'Could not open the camera.');
      }
    })();
    return () => {
      live = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setErr('Camera not ready yet — wait a second and retry.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    onCapture(canvas.toDataURL('image/jpeg', 0.85));
  };

  if (Platform.OS !== 'web') return null;
  return (
    <View style={{ backgroundColor: '#000', borderRadius: R.card, overflow: 'hidden', marginBottom: S.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: S.md }}>
        <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: ready ? '#22C55E' : C.accent, marginRight: 8 }} />
        <Text style={{ color: '#fff', fontWeight: '800', flex: 1 }}>
          {ready ? 'LIVE — frame the group' : 'Starting camera…'}
        </Text>
        <Pressable onPress={onClose} accessibilityRole="button" style={{ padding: 6 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>✕</Text>
        </Pressable>
      </View>
      <video
        ref={videoRef as any}
        playsInline
        muted
        style={{ width: '100%', height: 320, backgroundColor: '#000', objectFit: 'cover' } as any}
      />
      <View style={{ padding: S.md }}>
        <ErrorBanner msg={err} />
        <Btn title={ready ? 'Capture Photo' : 'Please wait…'} kind="accent" onPress={capture} disabled={!ready} />
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          Tip: on a phone, Expo Go gives the full camera experience.
        </Text>
      </View>
    </View>
  );
}
