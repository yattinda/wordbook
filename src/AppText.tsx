import { Text, TextInput, type TextInputProps, type TextProps, type TextStyle } from "react-native";

import { defaultTextStyle } from "./typography";

export function AppText({ style, ...props }: TextProps) {
  return <Text {...props} style={[defaultTextStyle, style]} />;
}

export function AppTextInput({ style, ...props }: TextInputProps) {
  return <TextInput {...props} style={[defaultTextStyle, style as TextStyle]} />;
}
