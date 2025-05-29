import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSQLiteContext } from "expo-sqlite";
import SearchBarHeaderWithButton from "../SearchBarHeaderWithButton";
import {
  getAllPlaylists,
  Playlist,
  getPlaylistsAndItems,
} from "../../db/queries";
import AlbumArtwork from "../AlbumArtwork";

const PlaylistsTab = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const db = useSQLiteContext();
  const [playlists, setPlaylists] = useState<any[]>([]);

  useEffect(() => {
    const fetchPlaylists = async () => {
      const data = await getPlaylistsAndItems(db);
      console.log(data.playlists[0].cover?.slice(0, 100));
      setPlaylists(data.playlists);
    };
    
    fetchPlaylists();
  }, [db]);

  return (
    <View style={styles.container}>
      <SearchBarHeaderWithButton
        placeholder="Search playlists..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddPress={() => {}}
      />
      <FlatList
        data={playlists}
        renderItem={({ item }) => <AlbumArtwork imageData={item.cover} style={styles.albumArt} defaultImage={require("../../assets/default-album.png")}/>}
      />
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
  albumArt: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
});

export default PlaylistsTab;
