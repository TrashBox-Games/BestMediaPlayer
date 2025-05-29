import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import SearchBarHeader from "../components/SearchBarHeader";

export default function VideoScreen(): JSX.Element {
  const [searchQuery, setSearchQuery] = useState<string>("");

  return (
    <View style={styles.container}>
      <SearchBarHeader
        placeholder="Search videos..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <View style={styles.contentContainer}>
        <Text style={styles.text}>Video Player Screen</Text>
        <Text style={styles.description}>
          This screen will display video files and allow playback.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  contentContainer: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
  },
});
