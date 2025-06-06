import React, { useState, useEffect } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import TrackPlayer from "react-native-track-player";
// Import screens
import PlaylistsScreen from "./screens/PlaylistListScreen";
import VideoScreen from "./screens/VideoScreen";
import SettingsScreen from "./screens/SettingsScreen";
import AudioScreen from "./screens/AudioScreen";
import AddFileScreen from "./screens/AddFileScreen";
import PlaylistScreen from "./screens/PlaylistScreen";
import CreatePlaylistScreen from "./screens/CreatePlaylistScreen";
// Import context provider
import { TagsProvider } from "./contexts/TagsContext";
import { PlayerProvider } from "./contexts/PlayerContext";
import { SQLiteProvider } from "expo-sqlite";
import { init } from "./db/queries";

// Define the tab navigator parameter list type
type TabParamList = {
  Settings: undefined;
  Playlists: undefined;
  Audio: undefined;
  "Add Files": undefined;
  Video: undefined;
  Playlist: undefined;
  "Create Playlist": undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export default function App() {
  const colorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<"light" | "dark">(
    colorScheme === "dark" ? "dark" : "light"
  );

  return (
    <SQLiteProvider databaseName="bestmedia.db" onInit={init}>
      <TagsProvider>
        <PlayerProvider>
          <View style={styles.container}>
            <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
            <NavigationContainer>
              <Tab.Navigator
                screenOptions={({ route }) => ({
                  tabBarIcon: ({ focused, color, size }) => {
                    let iconName: any;

                    if (route.name === "Playlists") {
                      iconName = focused ? "list" : "list-outline";
                    } else if (route.name === "Audio") {
                      iconName = focused
                        ? "musical-notes"
                        : "musical-notes-outline";
                    } else if (route.name === "Video") {
                      iconName = focused ? "videocam" : "videocam-outline";
                    } else if (route.name === "Settings") {
                      iconName = focused ? "settings" : "settings-outline";
                    } else if (route.name === "Add Files") {
                      iconName = focused ? "add-circle" : "add-circle-outline";
                    } else if (route.name === "Playlist") {
                      iconName = focused ? "disc" : "disc-outline";
                    } else if (route.name === "Create Playlist") {
                      iconName = focused ? "add-circle" : "add-circle-outline";
                    }
                    // Return the Ionicons component
                    return (
                      <Ionicons name={iconName} size={size} color={color} />
                    );
                  },
                  tabBarActiveTintColor:
                    themeMode === "dark" ? "#FFFFFF" : "#007AFF",
                  tabBarInactiveTintColor:
                    themeMode === "dark" ? "#8E8E93" : "#8E8E93",
                  headerShown: true,
                  tabBarStyle: {
                    backgroundColor:
                      themeMode === "dark" ? "#1C1C1E" : "#FFFFFF",
                    borderTopColor:
                      themeMode === "dark" ? "#38383A" : "#E5E5EA",
                  },
                  headerStyle: {
                    backgroundColor:
                      themeMode === "dark" ? "#1C1C1E" : "#FFFFFF",
                  },
                  headerTintColor: themeMode === "dark" ? "#FFFFFF" : "#000000",
                })}
              >
                <Tab.Screen name="Playlists" component={PlaylistsScreen} />
                <Tab.Screen name="Audio" component={AudioScreen} />
                <Tab.Screen
                  name="Playlist"
                  component={PlaylistScreen}
                  options={{
                    title: "Featured Playlist",
                  }}
                />
                <Tab.Screen name="Add Files" component={AddFileScreen} />
                <Tab.Screen name="Video" component={VideoScreen} />
                <Tab.Screen
                  name="Settings"
                  component={SettingsScreen}
                  options={{
                    tabBarLabel: "Settings",
                  }}
                />
                <Tab.Screen
                  name="Create Playlist"
                  component={CreatePlaylistScreen}
                  options={{
                    title: "Create Playlist",
                  }}
                />
              </Tab.Navigator>
            </NavigationContainer>
          </View>
        </PlayerProvider>
      </TagsProvider>
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
