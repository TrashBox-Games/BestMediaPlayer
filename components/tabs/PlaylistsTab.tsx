import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const PlaylistsTab = () => {
  return (
    <View style={styles.container}>
      <View style={styles.emptyContainer}>
        <Ionicons name="list" size={64} color="#ccc" />
        <Text style={styles.emptyText}>No Playlists Yet</Text>
        <Text style={styles.emptySubtext}>Playlists feature coming soon!</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#888",
    marginTop: 8,
  },
});

export default PlaylistsTab;
