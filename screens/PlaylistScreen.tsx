import React, { useState, useEffect, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ImageSourcePropType,
  Image,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SongItem from "../components/SongItem";
import SearchBarHeader from "../components/SearchBarHeader";
import { useTagsContext, AudioFile } from "../contexts/TagsContext";
import { usePlayerContext } from "../contexts/PlayerContext";
import * as SQLite from "expo-sqlite";
import { useSQLiteContext } from "expo-sqlite";

// Extend AudioFile interface to include playlist-specific properties
interface PlaylistAudioFile extends AudioFile {
  playlistItemId?: number;
  id?: number; // Make id optional since it may not exist in all AudioFiles
}

interface PlaylistItem {
  id: number;
  playlistId: number;
  itemId: number;
  itemType: string;
  indexNumber: number;
  songName: string;
  source: string;
}

interface PlaylistData {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface PlaylistScreenProps {
  playlistId?: string;
  playlistName?: string;
  playlistCover?: string;
  navigation?: any;
  route?: any;
}

const PlaylistScreen: React.FC<PlaylistScreenProps> = ({
  playlistId,
  playlistName: propPlaylistName,
  playlistCover: propPlaylistCover,
  navigation,
  route,
}) => {
  // Extract params from route if provided
  const params = route?.params || {};
  const routePlaylistId = params.playlistId;
  const routePlaylistName = params.playlistName;
  const routePlaylistCover = params.playlistCover;

  // Use props or route params
  const id = playlistId || routePlaylistId || "default";

  const { audioFiles } = useTagsContext();
  const { currentTrack, playerState, playTrack } = usePlayerContext();
  const db = useSQLiteContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [playlistSongs, setPlaylistSongs] = useState<PlaylistAudioFile[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<PlaylistAudioFile[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [playlistName, setPlaylistName] = useState(
    propPlaylistName || routePlaylistName || "My Playlist"
  );
  const [coverArt, setCoverArt] = useState(
    propPlaylistCover || routePlaylistCover
  );

  // Setup header buttons
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setIsEditMode(!isEditMode)}
          style={styles.headerButton}
        >
          <Ionicons
            name={isEditMode ? "checkmark" : "pencil"}
            size={24}
            color="#007AFF"
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isEditMode]);

  // Load playlist data from database
  useEffect(() => {
    const loadPlaylist = async () => {
      try {
        // Get playlist details
        const playlistResult = await db.getAllAsync<PlaylistData>(
          "SELECT * FROM playlists WHERE id = ?",
          [id]
        );

        if (playlistResult.length > 0) {
          setPlaylistName(playlistResult[0].name);
        }

        // Get playlist songs
        const playlistItemsResult = await db.getAllAsync<PlaylistItem>(
          `SELECT pi.*, s.name as songName, s.source 
           FROM playlistItems pi 
           JOIN songs s ON pi.itemId = s.id 
           WHERE pi.playlistId = ? AND pi.itemType = 'song'
           ORDER BY pi.indexNumber ASC`,
          [id]
        );

        if (playlistItemsResult.length > 0) {
          // Map database results to AudioFile format
          const songs: PlaylistAudioFile[] = playlistItemsResult.map((item) => {
            // Find the matching audioFile from the audioFiles array if available
            const matchedAudioFile = audioFiles.find(
              (audio) =>
                audio.uri === item.source || audio.name === item.songName
            );

            if (matchedAudioFile) {
              return {
                ...matchedAudioFile,
                playlistItemId: item.id,
                id: item.itemId,
              };
            }

            // Fallback if no matching file
            return {
              id: item.itemId,
              name: item.songName,
              uri: item.source,
              playlistItemId: item.id,
              size: 0,
              type: "audio",
              modificationTime: Date.now(),
            };
          });

          setPlaylistSongs(songs);
        } else {
          // For demo/development - fall back to all audio files if none in playlist
          setPlaylistSongs(audioFiles as PlaylistAudioFile[]);
        }
      } catch (error) {
        console.error("Error loading playlist:", error);
        // Fall back to all audio files for demo purposes
        setPlaylistSongs(audioFiles as PlaylistAudioFile[]);
      }
    };

    loadPlaylist();
  }, [id, db, audioFiles]);

  // Filter songs based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredSongs(playlistSongs);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = playlistSongs.filter((file) => {
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
      setFilteredSongs(filtered);
    }
  }, [searchQuery, playlistSongs]);

  // Handle file selection and playback
  const handleSongSelect = async (file: PlaylistAudioFile) => {
    if (isEditMode) {
      // In edit mode, prompt to remove from playlist
      Alert.alert(
        "Remove Song",
        `Remove "${file.tags?.title || file.name}" from playlist?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => removeSongFromPlaylist(file),
          },
        ]
      );
    } else {
      // In normal mode, play the song
      playTrack(file);
    }
  };

  // Save playlist changes
  const savePlaylistChanges = async () => {
    try {
      // Update playlist name
      const existingPlaylist = await db.getFirstAsync("SELECT * FROM playlists WHERE id = ?", [id]);
      if (existingPlaylist) {
        console.log("playlist exists, updating name");
        await db.runAsync("UPDATE playlists SET name = ? WHERE id = ?", [
          playlistName,
          id,
        ]);
      } else {
        console.log("playlist does not exist, creating new one");
        await db.runAsync("INSERT INTO playlists (name) VALUES (?)", [
          playlistName,
        ]);
      }

      // Exit edit mode
      setIsEditMode(false);

      // Notify user
      Alert.alert("Success", "Playlist updated successfully");
    } catch (error) {
      console.error("Error saving playlist:", error);
      Alert.alert("Error", "Failed to save playlist changes");
    }
  };

  // Remove song from playlist
  const removeSongFromPlaylist = async (file: PlaylistAudioFile) => {
    try {
      if (file.playlistItemId) {
        await db.runAsync("DELETE FROM playlistItems WHERE id = ?", [
          file.playlistItemId,
        ]);
      } else if (file.id) {
        await db.runAsync(
          "DELETE FROM playlistItems WHERE playlistId = ? AND itemId = ? AND itemType = 'song'",
          [id, file.id]
        );
      }

      // Update the local state to reflect the change
      setPlaylistSongs((currentSongs) =>
        currentSongs.filter((song) => song.uri !== file.uri)
      );
    } catch (error) {
      console.error("Error removing song:", error);
      Alert.alert("Error", "Failed to remove song from playlist");
    }
  };

  // Calculate total duration for playlist info
  const calculateTotalDuration = () => {
    const totalSeconds = playlistSongs.reduce((total, song) => {
      const duration = song.tags?.duration || 0;
      return total + duration;
    }, 0);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
  };

  const defaultImage = require("../assets/default-album.png");

  // Header component with playlist info
  const renderHeader = () => (
    <View style={styles.playlistHeader}>
      <TouchableOpacity
        style={styles.coverContainer}
        onPress={() =>
          isEditMode &&
          Alert.alert(
            "Feature",
            "Change cover image functionality would be implemented here"
          )
        }
      >
        <Image
          source={coverArt ? { uri: coverArt } : defaultImage}
          style={styles.playlistCover}
        />
        {isEditMode && (
          <View style={styles.editCoverOverlay}>
            <Ionicons name="camera" size={24} color="white" />
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.playlistInfo}>
        {isEditMode ? (
          <TextInput
            style={styles.playlistNameInput}
            value={playlistName}
            onChangeText={setPlaylistName}
            placeholder="Playlist Name"
            autoFocus
          />
        ) : (
          <Text style={styles.playlistName}>{playlistName}</Text>
        )}

        <Text style={styles.playlistDetails}>
          {playlistSongs.length} songs • {calculateTotalDuration()}
        </Text>

        {!isEditMode && (
          <View style={styles.playlistActions}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => {
                if (playlistSongs.length > 0) {
                  playTrack(playlistSongs[0]);
                }
              }}
            >
              <Ionicons name="play" size={24} color="white" />
              <Text style={styles.playButtonText}>Play</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shuffleButton}>
              <Ionicons name="shuffle" size={22} color="#007AFF" />
            </TouchableOpacity>
          </View>
        )}

        {isEditMode && (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={savePlaylistChanges}
          >
            <Ionicons name="save" size={20} color="white" />
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SearchBarHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={
          isEditMode ? "Search to add songs..." : "Search in playlist..."
        }
      />

      <FlatList
        data={filteredSongs}
        renderItem={({ item }) => (
          <SongItem
            item={item}
            isSelected={currentTrack?.uri === item.uri}
            isPlaying={!isEditMode && playerState.isPlaying}
            onSelect={handleSongSelect}
            defaultImage={defaultImage}
          />
        )}
        keyExtractor={(item) => item.uri}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {isEditMode
                ? "Add songs to your playlist"
                : "No songs in this playlist"}
            </Text>
          </View>
        }
      />

      {isEditMode && (
        <TouchableOpacity
          style={styles.addSongsButton}
          onPress={() =>
            Alert.alert("Add Songs", "This would open a song selection screen")
          }
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  headerButton: {
    marginRight: 16,
  },
  playlistHeader: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  coverContainer: {
    position: "relative",
    marginRight: 16,
  },
  playlistCover: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  editCoverOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  playlistInfo: {
    flex: 1,
    justifyContent: "center",
  },
  playlistName: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  playlistNameInput: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
    padding: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
  },
  playlistDetails: {
    fontSize: 14,
    color: "#888",
    marginBottom: 16,
  },
  playlistActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  playButton: {
    flexDirection: "row",
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
    marginRight: 12,
  },
  playButtonText: {
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
  },
  shuffleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  saveButton: {
    flexDirection: "row",
    backgroundColor: "#4CD964",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  saveButtonText: {
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#888",
    marginTop: 16,
  },
  addSongsButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

export default PlaylistScreen;
