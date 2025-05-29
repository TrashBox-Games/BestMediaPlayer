import React from "react";
import AlbumArtwork from "./AlbumArtwork";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AudioFile } from "../contexts/TagsContext";

interface SelectableSongItemProps {
  item: AudioFile;
  isSelected: boolean;
  onSelect: (file: AudioFile) => void;
  defaultImage: ImageSourcePropType;
}

const SelectableSongItem = ({
  item,
  isSelected,
  onSelect,
  defaultImage,
}: SelectableSongItemProps) => {
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
        <View style={styles.checkboxContainer}>
          {isSelected ? (
            <Ionicons name="checkbox" size={24} color="#007AFF" />
          ) : (
            <Ionicons name="square-outline" size={24} color="#999" />
          )}
        </View>
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
  checkboxContainer: {
    marginLeft: 10,
    justifyContent: "center",
  },
});

export default SelectableSongItem;
