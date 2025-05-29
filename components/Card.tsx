import React, { memo } from "react";
import AlbumArtwork from "./AlbumArtwork";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface CardProps {
  title?: string;
  subtitle?: string;
  text?: string;
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  onPress: () => void;
}

const Card = memo(
  ({ title, subtitle, text, leftComponent, rightComponent, onPress }: CardProps) => {
    return (
      <TouchableOpacity
        style={[styles.fileItem, true ? styles.selectedItem : null]}
        onPress={onPress}
      >
        <View style={styles.fileInfo}>
          <View style={styles.artworkContainer}>
            {leftComponent}
          </View>
          <View style={styles.fileDetails}>
            <Text style={styles.fileName} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.fileArtist} numberOfLines={1}>
              {subtitle}
            </Text>
            <Text style={styles.fileAlbum} numberOfLines={1}>
              {text}
            </Text>
          </View>
          {rightComponent}
        </View>
      </TouchableOpacity>
    );
  }
);

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

export default Card;
