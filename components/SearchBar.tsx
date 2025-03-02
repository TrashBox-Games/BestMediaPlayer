import React from "react";
import { View, TextInput, StyleSheet } from "react-native";

interface SearchBarProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
}

const SearchBar = ({
  placeholder,
  value,
  onChangeText,
}: SearchBarProps): JSX.Element => {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        clearButtonMode="while-editing"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderRadius: 8,
    marginBottom: 10,
  },
  input: {
    height: 40,
    borderRadius: 4,
    paddingHorizontal: 10,
    backgroundColor: "#f5f5f5",
    fontSize: 16,
  },
});

export default SearchBar;
