import React, { useState, useEffect, memo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AlbumArtwork from "../AlbumArtwork";
import SongItem from "../SongItem";
import SearchBarAndButton from "../SearchBarHeaderWithButton";
import { useTagsContext, AudioFile } from "../../contexts/TagsContext";
import { usePlayerContext } from "../../contexts/PlayerContext";
import Slider from "@react-native-community/slider";

const SongsTab = memo(function SongsTab() {
  const {
    audioFiles,
    loading,
    refreshing,
    scanForAudioFiles,
    setRefreshing,
    pickAudioFile,
  } = useTagsContext();

  const {
    currentTrack,
    playerState,
    playTrack,
    togglePlayPause,
    playNextTrack,
    playPreviousTrack,
    seekTo,
    setPlaylist,
  } = usePlayerContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<AudioFile[]>([]);

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

  // Initial scan for audio files
  useEffect(() => {
    scanForAudioFiles();
  }, []);

  // Update playlist when audio files change
  useEffect(() => {
    if (audioFiles.length > 0) {
      setPlaylist(audioFiles);
    }
  }, [audioFiles, setPlaylist]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await scanForAudioFiles();
    setRefreshing(false);
  };

  // Format time in mm:ss
  const formatTime = (milliseconds: number) => {
    if (!milliseconds) return "00:00";

    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Handle file selection and playback
  const handleFileSelect = async (file: AudioFile) => {
    playTrack(file);
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Render each audio file item
  const renderItem = ({ item }: { item: AudioFile }) => {
    const isSelected = currentTrack?.uri === item.uri;

    return (
      <SongItem
        item={item}
        isSelected={isSelected}
        isPlaying={playerState.isPlaying}
        onSelect={handleFileSelect}
        defaultImage={require("../../assets/default-album.png")}
      />
    );
  };

  return (
    <View style={styles.container}>
      <SearchBarAndButton
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddPress={pickAudioFile}
        placeholder="Search songs..."
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading songs...</Text>
        </View>
      ) : (
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
                Add songs using the + button
              </Text>
            </View>
          }
        />
      )}

      {currentTrack && (
        <View style={styles.playerContainer}>
          <View style={styles.progressContainer}>
            <Text style={styles.timeText}>
              {formatTime(playerState.currentTime)}
            </Text>
            <Slider
              style={styles.progressBar}
              minimumValue={0}
              maximumValue={playerState.duration > 0 ? playerState.duration : 1}
              value={playerState.currentTime}
              onSlidingComplete={(value: number) => seekTo(value)}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#DDDDDD"
              thumbTintColor="#007AFF"
            />
            <Text style={styles.timeText}>
              {formatTime(playerState.duration)}
            </Text>
          </View>

          <View style={styles.playerControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={playPreviousTrack}
            >
              <Ionicons name="play-skip-back" size={24} color="#007AFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playButton}
              onPress={togglePlayPause}
            >
              <Ionicons
                name={playerState.isPlaying ? "pause" : "play"}
                size={32}
                color="white"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={playNextTrack}
            >
              <Ionicons name="play-skip-forward" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.trackInfoContainer}>
            <AlbumArtwork
              imageData={currentTrack.tags?.image}
              style={styles.playerAlbumArt}
              defaultImage={require("../../assets/default-album.png")}
            />

            <View style={styles.trackTextContainer}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {currentTrack.tags?.title || currentTrack.name}
              </Text>
              <Text style={styles.trackArtist} numberOfLines={1}>
                {currentTrack.tags?.artist || "Unknown Artist"}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  scrollView: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  fileItem: {
    backgroundColor: "white",
    padding: 12,
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedItem: {
    backgroundColor: "#e6f2ff",
    borderColor: "#007AFF",
    borderWidth: 1,
  },
  fileInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  albumArt: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 12,
  },
  placeholderArt: {
    width: 50,
    height: 50,
    borderRadius: 4,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  fileArtist: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  fileAlbum: {
    fontSize: 12,
    color: "#888",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  fileListContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
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
  addButtonText: {
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
  },
  playerContainer: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    padding: 10,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  progressBar: {
    flex: 1,
    height: 40,
    marginHorizontal: 8,
  },
  timeText: {
    fontSize: 12,
    color: "#888",
    width: 40,
    textAlign: "center",
  },
  playerControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  controlButton: {
    padding: 10,
  },
  playButton: {
    backgroundColor: "#007AFF",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 20,
  },
  trackInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  playerAlbumArt: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 10,
  },
  playerPlaceholderArt: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  trackTextContainer: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  trackArtist: {
    fontSize: 12,
    color: "#666",
  },
  selectedFileInfo: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    padding: 15,
  },
  selectedFileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  selectedFileTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  selectedFileContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  selectedAlbumArt: {
    width: 80,
    height: 80,
    borderRadius: 6,
    marginRight: 15,
  },
  selectedPlaceholderArt: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  selectedFileDetails: {
    flex: 1,
  },
  selectedFileName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  selectedFileArtist: {
    fontSize: 16,
    color: "#666",
    marginBottom: 2,
  },
  selectedFileAlbum: {
    fontSize: 14,
    color: "#888",
  },
});

export default SongsTab;
