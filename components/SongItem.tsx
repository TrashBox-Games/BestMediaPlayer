import React from "react";
import AlbumArtwork from "./AlbumArtwork";
import { View, Text, StyleSheet, TouchableOpacity, ImageSourcePropType } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AudioFile } from "../contexts/TagsContext";

interface SongItemProps {
  item: AudioFile;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: (file: AudioFile) => void;
  defaultImage: ImageSourcePropType;
}

const SongItem = ({ item, isSelected, isPlaying, onSelect, defaultImage }: SongItemProps) => {
  return (
    <TouchableOpacity
      style={[styles.fileItem, isSelected ? styles.selectedItem : null]}
      onPress={() => onSelect(item)}
    >
      <View style={styles.fileInfo}>
        <View style={styles.artworkContainer}>
          <AlbumArtwork 
            imageData={item.tags?.image} 
            style={styles.albumArt}
            defaultImage={defaultImage}
          />
        </View>
        <View style={styles.fileDetails}>
          <Text style={styles.fileName} numberOfLines={1}>
            {item.tags?.title || item.name}
          </Text>
          <Text style={styles.fileArtist} numberOfLines={1}>
            {item.tags?.artist || "Unknown Artist"}
          </Text>
          <Text style={styles.fileAlbum} numberOfLines={1}>
            {item.tags?.album || "Unknown Album"}
          </Text>
        </View>
        {isSelected && isPlaying && (
          <Ionicons name="volume-high" size={20} color="#007AFF" />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
  artworkContainer: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  albumArt: {
    width: 50,
    height: 50,
    borderRadius: 4,
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
});

export default SongItem;
