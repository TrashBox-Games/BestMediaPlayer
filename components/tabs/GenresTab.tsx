import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import SearchBarHeader from "../SearchBarHeader";

export default function GenresTab(): JSX.Element {
  const [searchQuery, setSearchQuery] = useState<string>("");

  return (
    <View style={styles.tabContainer}>
      <SearchBarHeader
        placeholder="Search genres..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
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
