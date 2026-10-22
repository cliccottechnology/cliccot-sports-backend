import * as React from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type StyleProp,
  type TextProps,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

// NOTE: This module is aliased in for `react-native` by `metro.config.js` for
// app source files only. We deliberately re-export the real React Native APIs
// explicitly rather than with `export *`:
//
//   * `react-native`'s runtime entry (`index.js`) is a bag of lazy getters, so
//     a wildcard re-export eagerly pulls in (and evaluates) extracted/deprecated
//     modules — `PushNotificationIOS`, `Clipboard`, `ProgressBarAndroid`,
//     `InteractionManager`, ... — which floods the app with deprecation warnings.
//   * Explicit exports keep the public surface honest and typed.
//
// Keep this list in sync with the React Native APIs the apps actually use.
//
// `SafeAreaView` is intentionally NOT re-exported: React Native's copy is
// deprecated and logs a warning on access. The apps import `SafeAreaView`
// (and `SafeAreaProvider`) from `react-native-safe-area-context` instead.
export {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  NativeModules,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  View,
} from 'react-native';

// `StyleSheet` is imported above for our own use; re-export that same binding.
export { StyleSheet };

// Types used across the app/shared code. `StyleProp` / `TextProps` /
// `TextInputProps` / `TextStyle` are imported above, so re-export those local
// bindings; the rest come straight from React Native.
export type { StyleProp, TextProps, TextInputProps, TextStyle };
export type { ImageStyle, ViewStyle } from 'react-native';

// Imported from the dependency-free module (not `./tokens`) to avoid a require
// cycle: `RNShim -> tokens -> RNShim`, which left `Platform` uninitialized and
// crashed with "Cannot read property 'OS' of undefined".
import { FONT, FONT_DEFAULT } from './fontFamilies';

/**
 * React-Native shim swapped in by `metro.config.js` for app source files only.
 *
 * React Native has no global default font (and React 19 dropped
 * `Text.defaultProps`), so the only reliable way to run an entire app in a
 * single family is to resolve `react-native` to this module and let it wrap
 * `Text` / `TextInput`.
 *
 * The weight is mapped to a *weight-specific* Poppins family so a bold
 * heading (`fontWeight: '800'`) renders as Poppins ExtraBold instead of
 * synthesising bold from the Regular file. The original `style` is still
 * applied last, so any explicit `fontFamily` a caller sets still wins.
 */

function weightFamily(style: StyleProp<TextStyle>): string {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const w = flat?.fontWeight === undefined ? undefined : String(flat.fontWeight);
  switch (w) {
    case '100':
      return FONT.thin;
    case '200':
      return FONT.extralight;
    case '300':
      return FONT.light;
    case '500':
      return FONT.medium;
    case '600':
      return FONT.semibold;
    case '700':
      return FONT.bold;
    case '800':
      return FONT.extrabold;
    case '900':
      return FONT.black;
    default:
      return FONT_DEFAULT;
  }
}

export const Text = React.forwardRef<React.ElementRef<typeof RNText>, TextProps>(
  function PoppinsText(props, ref) {
    const { style, ...rest } = props;
    return (
      <RNText ref={ref} {...rest} style={[{ fontFamily: weightFamily(style) }, style]} />
    );
  },
);

export const TextInput = React.forwardRef<
  React.ElementRef<typeof RNTextInput>,
  TextInputProps
>(function PoppinsTextInput(props, ref) {
  const { style, ...rest } = props;
  return (
    <RNTextInput
      ref={ref}
      {...rest}
      style={[{ fontFamily: weightFamily(style) }, style]}
    />
  );
});
