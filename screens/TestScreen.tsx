import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import * as FileSystem from "expo-file-system";
import { pickAudioFile, readID3v2Tags } from "../utils/readID3Tags";
import AlbumArtwork from "../components/AlbumArtwork";

interface ID3Tags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  comment?: string;
  genre?: string;
  track?: string;
  image?: string;
  [key: string]: string | undefined;
}

const TestScreen: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [tags, setTags] = useState<ID3Tags | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickFile = async () => {
    try {
      setLoading(true);
      setError(null);
      setTags(null);

      const result = await pickAudioFile();

      if (result) {
        setFileName(result.name);
        setSelectedFile(result.uri);

        // Read ID3 tags
        const id3Tags = await readID3v2Tags(result.uri);

        // Debug logging for album art
        console.log("ID3 Tags found:", id3Tags ? "Yes" : "No");
        if (id3Tags) {
          console.log("All tag keys:", Object.keys(id3Tags));
          console.log("Has image tag:", id3Tags.hasOwnProperty("image"));
          if (id3Tags.image) {
            console.log("Image tag value length:", id3Tags.image.length);
            console.log(
              "Image tag value starts with:",
              id3Tags.image.substring(0, 50) + "..."
            );
          } else {
            console.log("No image tag found in ID3 tags");
          }
        }

        setTags(id3Tags);
      }
    } catch (err) {
      console.error("Error picking or reading file:", err);
      setError(
        "Failed to read file tags: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setLoading(false);
    }
  };

  const renderTagItem = (key: string, value: string | undefined) => {
    if (!value) return null;

    // Special handling for image tag
    if (key === "image" && value) {
      console.log("Rendering image tag, URI length:", value.length);

      // Log the first part of the image URI to debug
      const uriPreview = value.substring(0, 30) + "...";
      console.log("Image URI preview:", uriPreview);

      return (
        <View key={key} style={styles.tagItem}>
          <Text style={styles.tagLabel}>Album Art:</Text>
          <AlbumArtwork imageData={value} />
        </View>
      );
    }

    return (
      <View key={key} style={styles.tagItem}>
        <Text style={styles.tagLabel}>
          {key.charAt(0).toUpperCase() + key.slice(1)}:
        </Text>
        <Text style={styles.tagValue}>{value}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ID3 Tag Reader</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handlePickFile}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Loading..." : "Select Audio File"}
        </Text>
      </TouchableOpacity>

      {loading && (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {fileName && (
        <View style={styles.fileInfoContainer}>
          <Text style={styles.fileInfoLabel}>Selected File:</Text>
          <Text style={styles.fileInfoValue}>{fileName}</Text>
        </View>
      )}

      {tags && (
        <ScrollView style={styles.tagsContainer}>
          <Text style={styles.sectionTitle}>ID3 Tags</Text>
          {Object.entries(tags).map(([key, value]) =>
            renderTagItem(key, value)
          )}
        </ScrollView>
      )}

      {tags === null && selectedFile && !loading && !error && (
        <View style={styles.noTagsContainer}>
          <Text style={styles.noTagsText}>No ID3 tags found in this file</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#2196F3",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  loader: {
    marginVertical: 20,
  },
  fileInfoContainer: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  fileInfoLabel: {
    fontWeight: "bold",
    marginRight: 8,
  },
  fileInfoValue: {
    flex: 1,
    fontSize: 14,
  },
  tagsContainer: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 8,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  tagItem: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 10,
  },
  tagLabel: {
    fontWeight: "bold",
    marginBottom: 5,
    fontSize: 16,
  },
  tagValue: {
    fontSize: 14,
  },
  albumArt: {
    width: "100%",
    height: 200,
    marginTop: 10,
    borderRadius: 8,
  },
  errorContainer: {
    backgroundColor: "#ffebee",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorText: {
    color: "#d32f2f",
  },
  noTagsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noTagsText: {
    fontSize: 16,
    color: "#757575",
    textAlign: "center",
  },
});

export default TestScreen;
