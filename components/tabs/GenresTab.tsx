import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import SearchBar from "../SearchBar";

export default function GenresTab(): JSX.Element {
  const [searchQuery, setSearchQuery] = useState<string>("");

  return (
    <View style={styles.tabContainer}>
      <SearchBar
        placeholder="Search genres..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <View style={styles.contentContainer}>
        <Text style={styles.text}>Genres List</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  contentContainer: {
    padding: 16,
    alignItems: "center",
    width: "100%",
  },
  text: {
    fontSize: 18,
    fontWeight: "bold",
  },
});
