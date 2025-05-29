import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTagsContext, AudioFile } from "../contexts/TagsContext";
import SearchBar from "../components/SearchBar";
import SelectableSongItem from "../components/SelectableSongItem";
import { useSQLiteContext } from "expo-sqlite";
import { createPlaylistWithItems } from "../db/utils";

// Extend AudioFile to include the id property needed for playlists
interface ExtendedAudioFile extends AudioFile {
  id?: number;
}

interface CreatePlaylistScreenProps {
  navigation: any;
}

const CreatePlaylistScreen: React.FC<CreatePlaylistScreenProps> = ({
  navigation,
}) => {
  const { audioFiles, refreshing, scanForAudioFiles, setRefreshing } =
    useTagsContext();
  const db = useSQLiteContext();

  const [playlistName, setPlaylistName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<AudioFile[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<AudioFile[]>([]); // Array of AudioFile objects instead of URIs
  const [isCreating, setIsCreating] = useState(false);

  // Filter files based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredFiles(audioFiles);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = audioFiles.filter((file) => {
        const fileName = file.name.toLowerCase();
        const artist = file.tags?.artist?.toLowerCase() || "";
        const title = file.tags?.title?.toLowerCase() || "";
        const album = file.tags?.album?.toLowerCase() || "";

        return (
          fileName.includes(query) ||
          artist.includes(query) ||
          title.includes(query) ||
          album.includes(query)
        );
      });
      setFilteredFiles(filtered);
    }
  }, [searchQuery, audioFiles]);

  // Toggle song selection
  const toggleSongSelection = (file: AudioFile) => {
    setSelectedSongs((prev) => {
      // Check if file is already selected by comparing URIs
      const isSelected = prev.some((song) => song.uri === file.uri);

      if (isSelected) {
        return prev.filter((song) => song.uri !== file.uri);
      } else {
        return [...prev, file];
      }
    });
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await scanForAudioFiles();
    setRefreshing(false);
  };

  // Create playlist with selected songs
  const handleCreatePlaylist = async () => {
    if (!playlistName.trim()) {
      alert("Please enter a playlist name");
      return;
    }

    if (selectedSongs.length === 0) {
      alert("Please select at least one song");
      return;
    }

    setIsCreating(true);

    try {
      // Create the playlist with the selected songs
      await createPlaylistWithItems(db, playlistName, selectedSongs);
      alert(
        `Playlist "${playlistName}" created with ${selectedSongs.length} songs`
      );
      navigation.goBack();
    } catch (error) {
      console.error("Error creating playlist:", error);
      alert("Failed to create playlist");
    } finally {
      setIsCreating(false);
    }
  };

  // Render each song item
  const renderItem = ({ item }: { item: AudioFile }) => {
    const isSelected = selectedSongs.some((song) => song.uri === item.uri);

    return (
      <SelectableSongItem
        item={item}
        isSelected={isSelected}
        onSelect={toggleSongSelection}
        defaultImage={require("../assets/default-album.png")}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <TextInput
          placeholder="Enter Playlist Name"
          value={playlistName}
          onChangeText={setPlaylistName}
          style={styles.input}
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.infoContainer}>
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          placeholder="Search songs..."
        />
        <Text style={styles.infoText}>
          {selectedSongs.length} songs selected
        </Text>
      </View>

      <FlatList
        data={filteredFiles}
        renderItem={renderItem}
        keyExtractor={(item) => item.uri}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No songs found</Text>
            <Text style={styles.emptySubtext}>
              Add songs by searching their name above
            </Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.createButton,
            (selectedSongs.length === 0 || !playlistName.trim()) &&
              styles.disabledButton,
          ]}
          onPress={handleCreatePlaylist}
          disabled={
            selectedSongs.length === 0 || !playlistName.trim() || isCreating
          }
        >
          {isCreating ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="white" />
              <Text style={styles.createButtonText}>Create Playlist</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  titleContainer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  input: {
    width: "90%",
    fontSize: 24,
    fontWeight: "500",
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#007AFF",
    textAlign: "center",
  },
  infoContainer: {
    padding: 10,
    marginTop: 10,
    marginBottom: 30,
    backgroundColor: "#f8f8f8",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 40,
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
  footer: {
    padding: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    alignItems: "center",
  },
  createButton: {
    flexDirection: "row",
    backgroundColor: "#4CD964",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    width: "80%",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  createButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default CreatePlaylistScreen;
