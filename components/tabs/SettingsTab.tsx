import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SettingsTab = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    // In a real app, you would apply the theme change here
  };

  // Clear artwork cache
  const clearArtworkCache = async () => {
    try {
      setCacheClearing(true);
      await AsyncStorage.removeItem("artworkCache");
      Alert.alert("Success", "Artwork cache cleared successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to clear artwork cache");
      console.error("Error clearing cache:", error);
    } finally {
      setCacheClearing(false);
    }
  };

  // Confirm cache clearing
  const confirmClearCache = () => {
    Alert.alert(
      "Clear Artwork Cache",
      "Are you sure you want to clear the cached album artwork? This will require reloading all artwork.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          onPress: clearArtworkCache,
          style: "destructive",
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="moon-outline" size={24} color="#666" />
            <Text style={styles.settingText}>Dark Mode</Text>
          </View>
          <Switch
            value={darkMode}
            onValueChange={toggleDarkMode}
            trackColor={{ false: "#ddd", true: "#007AFF" }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Storage</Text>
        <TouchableOpacity
          style={styles.settingItem}
          onPress={confirmClearCache}
          disabled={cacheClearing}
        >
          <View style={styles.settingInfo}>
            <Ionicons name="trash-outline" size={24} color="#666" />
            <Text style={styles.settingText}>Clear Artwork Cache</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color="#666"
            />
            <Text style={styles.settingText}>Version</Text>
          </View>
          <Text style={styles.versionText}>1.0.0</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: "white",
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingText: {
    fontSize: 16,
    marginLeft: 12,
  },
  versionText: {
    fontSize: 16,
    color: "#999",
  },
});

export default SettingsTab;
