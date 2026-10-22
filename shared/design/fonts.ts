import { useFonts } from 'expo-font';
import {
  Poppins_100Thin,
  Poppins_200ExtraLight,
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';

/**
 * Single Poppins bundle shared by the Parent and Trainer apps.
 * App roots call `usePoppinsFonts()` and hold their first render until the
 * faces are ready, so every `Text`/`TextInput` (via the RN shim) resolves to a
 * real Poppins family instead of a system fallback.
 */
export const POPPINS_FONTS = {
  Poppins_100Thin,
  Poppins_200ExtraLight,
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
};

export function usePoppinsFonts(): [boolean, Error | null] {
  return useFonts(POPPINS_FONTS);
}
