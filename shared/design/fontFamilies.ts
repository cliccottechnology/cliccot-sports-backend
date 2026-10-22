/**
 * Poppins family names bundled via `@expo-google-fonts/poppins`.
 *
 * This module is intentionally dependency-free (no `react-native` import) so
 * the native `Text`/`TextInput` shim (`RNShim.tsx`) can import the family map
 * without importing `tokens.ts`. Importing `tokens.ts` from the shim created a
 * require cycle — `RNShim -> tokens -> RNShim` — which left `Platform`
 * uninitialized at module-eval time and crashed with
 * "Cannot read property 'OS' of undefined".
 *
 * `tokens.ts` re-exports these values so existing imports keep working.
 */
export const FONT = {
  thin: 'Poppins_100Thin',
  extralight: 'Poppins_200ExtraLight',
  light: 'Poppins_300Light',
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
  black: 'Poppins_900Black',
} as const;

export const FONT_DEFAULT = FONT.regular;
