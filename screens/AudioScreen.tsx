import React from "react";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import SongsTab from "../components/tabs/SongsTab";
import AlbumsTab from "../components/tabs/AlbumsTab";
import GenresTab from "../components/tabs/GenresTab";
import PlaylistsTab from "../components/tabs/PlaylistsTab";

// Create the top tab navigator
type TopTabParamList = {
  Songs: undefined;
  Albums: undefined;
  Genres: undefined;
  Playlists: undefined;
  Settings: undefined;
};

const TopTab = createMaterialTopTabNavigator<TopTabParamList>();

// Main AudioScreen component with top tabs
export default function AudioScreen(): JSX.Element {
  return (
    <TopTab.Navigator
      screenOptions={{
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "gray",
        tabBarIndicatorStyle: { backgroundColor: "#007AFF" },
        tabBarLabelStyle: { fontWeight: "bold" },
      }}
    >
      <TopTab.Screen name="Songs" component={SongsTab} key="Songs" />
      <TopTab.Screen name="Albums" component={AlbumsTab} key="Albums" />
      <TopTab.Screen name="Genres" component={GenresTab} key="Genres" />
      <TopTab.Screen name="Playlists" component={PlaylistsTab} key="Playlists" />
    </TopTab.Navigator>
  );
}
