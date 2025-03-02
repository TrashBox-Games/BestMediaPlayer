import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Buffer } from "buffer";
import { getBasicTags, readID3v2Tags } from "../utils/id3TagUtils";
import * as DocumentPicker from "expo-document-picker";

// Define types for the tag information
export interface TagInfo {
  title?: string;
  artist?: string;
  album?: string;
  image?: string;
  hasImage?: string;
  [key: string]: any;
}

// Define type for audio file information
export interface AudioFile {
  uri: string;
  name: string;
  size: number;
  modificationTime: number;
  tags?: TagInfo;
}

interface TagsContextType {
  audioFiles: AudioFile[];
  loading: boolean;
  refreshing: boolean;
  selectedFile: AudioFile | null;
  tagInfo: TagInfo | null;
  scanForAudioFiles: () => Promise<void>;
  selectFile: (file: AudioFile) => Promise<void>;
  setRefreshing: (refreshing: boolean) => void;
  pickAudioFile: () => Promise<void>;
}

const TagsContext = createContext<TagsContextType | undefined>(undefined);

export const useTagsContext = () => {
  const context = useContext(TagsContext);
  if (context === undefined) {
    throw new Error("useTagsContext must be used within a TagsProvider");
  }
  return context;
};

interface TagsProviderProps {
  children: ReactNode;
}

export const TagsProvider: React.FC<TagsProviderProps> = ({ children }) => {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<AudioFile | null>(null);
  const [tagInfo, setTagInfo] = useState<TagInfo | null>(null);
  const [artworkCache, setArtworkCache] = useState<Record<string, string>>({});

  // Load cached artwork on mount
  useEffect(() => {
    loadCachedArtwork();
  }, []);

  // Load cached artwork from AsyncStorage
  const loadCachedArtwork = async () => {
    try {
      const cachedArtworkJson = await AsyncStorage.getItem("artworkCache");
      if (cachedArtworkJson) {
        const cachedArtwork = JSON.parse(cachedArtworkJson);
        setArtworkCache(cachedArtwork);
        console.log("Loaded cached artwork");
      }
    } catch (error) {
      console.error("Error loading cached artwork:", error);
    }
  };

  // Save artwork cache to AsyncStorage
  const saveCachedArtwork = async (cache: Record<string, string>) => {
    try {
      // Limit cache to 100 entries to prevent excessive storage usage
      const entries = Object.entries(cache);
      if (entries.length > 100) {
        const limitedCache = Object.fromEntries(entries.slice(-100));
        await AsyncStorage.setItem(
          "artworkCache",
          JSON.stringify(limitedCache)
        );
        setArtworkCache(limitedCache);
      } else {
        await AsyncStorage.setItem("artworkCache", JSON.stringify(cache));
        setArtworkCache(cache);
      }
    } catch (error) {
      console.error("Error saving cached artwork:", error);
    }
  };

  // Scan for audio files
  const scanForAudioFiles = async () => {
    try {
      setLoading(true);

      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        console.log("Media library permission not granted");
        setLoading(false);
        return;
      }

      // Get music directory
      const musicDir = FileSystem.documentDirectory;
      if (!musicDir) {
        console.log("Music directory not found");
        setLoading(false);
        return;
      }

      // Read directory
      const files = await FileSystem.readDirectoryAsync(musicDir);

      // Filter audio files
      const audioFilePromises = files
        .filter(
          (file) =>
            file.endsWith(".mp3") ||
            file.endsWith(".m4a") ||
            file.endsWith(".wav") ||
            file.endsWith(".flac")
        )
        .map(async (file) => {
          const fileUri = `${musicDir}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          return {
            uri: fileUri,
            name: file,
            size: (fileInfo as any).size || 0,
            modificationTime: (fileInfo as any).modificationTime || 0,
          };
        });

      // Wait for all file info to be gathered
      const audioFilesWithInfo = await Promise.all(audioFilePromises);

      // Sort by modification time (newest first)
      const sortedFiles = audioFilesWithInfo.sort(
        (a, b) => b.modificationTime - a.modificationTime
      );

      // Update UI immediately with basic file info
      setAudioFiles(sortedFiles);
      setLoading(false);

      // Load metadata in the background
      setTimeout(() => loadBasicMetadata(sortedFiles), 100);
    } catch (error) {
      console.error("Error scanning for audio files:", error);
      setLoading(false);
    }
  };

  // Load basic metadata for audio files
  const loadBasicMetadata = async (files: AudioFile[]) => {
    try {
      const batchSize = 3; // Process 3 files at a time for better responsiveness
      const tempArtCache = { ...artworkCache };

      // Process files in batches
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        // Process batch concurrently
        await Promise.all(
          batch.map(async (file) => {
            try {
              const tags = await getBasicTags(file.uri, tempArtCache);
              if (tags) {
                // Update file with tags
                file.tags = tags;
              }
            } catch (error) {
              console.error(`Error loading metadata for ${file.name}:`, error);
            }
          })
        );

        // Update UI with the processed batch
        setAudioFiles([...files]);

        // Small delay between batches to keep UI responsive
        if (i + batchSize < files.length) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // Update artwork cache with any new entries
      saveCachedArtwork(tempArtCache);
    } catch (error) {
      console.error("Error loading basic metadata:", error);
    }
  };

  // Select a file and read its tags
  const selectFile = async (file: AudioFile) => {
    try {
      setSelectedFile(file);

      // If we already have tags, use them
      if (file.tags) {
        setTagInfo(file.tags);

        // If we have hasImage flag but no image data, load it now
        if (file.tags.hasImage === "true" && !file.tags.image) {
          const fullTags = await readID3v2Tags(file.uri);
          if (fullTags && fullTags.image) {
            // Update file tags with image
            file.tags.image = fullTags.image;
            setTagInfo({ ...file.tags });

            // Cache the artwork if we have artist and album
            if (file.tags.artist && file.tags.album) {
              const cacheKey = `${file.tags.artist}-${file.tags.album}`;
              const newCache = { ...artworkCache, [cacheKey]: fullTags.image };
              saveCachedArtwork(newCache);
            }
          }
        }
      } else {
        // Read tags if not already available
        const tags = await readID3v2Tags(file.uri);
        setTagInfo(tags);

        // Update file with tags
        if (tags) {
          file.tags = tags;

          // Cache the artwork if we have artist and album
          if (tags.artist && tags.album && tags.image) {
            const cacheKey = `${tags.artist}-${tags.album}`;
            const newCache = { ...artworkCache, [cacheKey]: tags.image };
            saveCachedArtwork(newCache);
          }
        }
      }
    } catch (error) {
      console.error("Error selecting file:", error);
    }
  };

  // Pick an audio file
  const pickAudioFile = async () => {
    try {
      // Request permissions first
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        console.log("Media library permission denied");
        return;
      }

      // Use document picker to select audio files
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });

      if (result.type === "success") {
        setLoading(true);

        // Get file info
        const fileInfo = await FileSystem.getInfoAsync(result.uri);

        // Read tags from the file
        const tags = await readID3v2Tags(result.uri);

        // Create new audio file object
        const newFile: AudioFile = {
          uri: result.uri,
          name: result.name,
          size: fileInfo.size || 0,
          modificationTime: fileInfo.modificationTime || Date.now(),
          tags: tags || undefined,
        };

        // Add to audio files list
        setAudioFiles((prevFiles) => {
          // Check if file already exists
          const exists = prevFiles.some((file) => file.uri === newFile.uri);
          if (!exists) {
            return [...prevFiles, newFile];
          }
          return prevFiles;
        });

        // Select the newly added file
        await selectFile(newFile);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error picking audio file:", error);
      setLoading(false);
    }
  };

  // Context value
  const value: TagsContextType = {
    audioFiles,
    loading,
    refreshing,
    selectedFile,
    tagInfo,
    scanForAudioFiles,
    selectFile,
    setRefreshing,
    pickAudioFile,
  };

  return <TagsContext.Provider value={value}>{children}</TagsContext.Provider>;
};
