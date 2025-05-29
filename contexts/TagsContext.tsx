import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { readID3v2Tags } from "../utils/readID3Tags";
import { Platform } from "react-native";
import { syncDatabaseWithFileSystem } from "../db/utils";
import { useSQLiteContext } from "expo-sqlite";
// Create a context
const TagsContext = createContext<TagsContextType | undefined>(undefined);

// Constants
const CACHE_FOLDER = `${FileSystem.documentDirectory}cache/`;
const ARTWORK_CACHE_FOLDER = `${CACHE_FOLDER}artwork/`;

// Types
export interface TagInfo {
  title?: string;
  artist?: string;
  album?: string;
  image?: string;
  hasImage?: string;
  [key: string]: any;
}

export interface AudioFile {
  uri: string;
  name: string;
  size: number;
  modificationTime: number;
  tags?: TagInfo;
  id?: number;
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

// Custom hook to use the context
export const useTagsContext = () => {
  const context = useContext(TagsContext);
  if (context === undefined) {
    throw new Error("useTagsContext must be used within a TagsProvider");
  }
  return context;
};

// Props for the provider component
interface TagsProviderProps {
  children: ReactNode;
}

// Provider component
export const TagsProvider: React.FC<TagsProviderProps> = ({ children }) => {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<AudioFile | null>(null);
  const [tagInfo, setTagInfo] = useState<TagInfo | null>(null);
  const db = useSQLiteContext();

  useEffect(() => {
    scanForAudioFiles();
  }, []);

  // Scan for audio files
  const scanForAudioFiles = async () => {
    try {
      setLoading(true);

      // Get document directory
      const documentDir = FileSystem.documentDirectory;
      if (!documentDir) {
        throw new Error("Document directory not available");
      }

      // Read directory contents
      const files = await FileSystem.readDirectoryAsync(documentDir);

      // Filter for audio files
      const audioFileExtensions = [".mp3", ".m4a", ".aac", ".wav", ".flac"];
      const audioFileNames = files.filter((file) =>
        audioFileExtensions.some((ext) => file.toLowerCase().endsWith(ext))
      );

      // Get file info for each audio file
      const audioFilesPromises = audioFileNames.map(async (fileName) => {
        const fileUri = `${documentDir}${fileName}`;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);

        return {
          uri: fileUri,
          name: fileName,
          size: (fileInfo as any).size || 0,
          modificationTime: (fileInfo as any).modificationTime || Date.now(),
        };
      });

      const newAudioFiles = await Promise.all(audioFilesPromises);
      setAudioFiles(newAudioFiles);

      const pureMedia = await syncDatabaseWithFileSystem(db, newAudioFiles);

      // Load basic metadata for each file
      await loadMetadata(pureMedia);

      setLoading(false);
    } catch (error) {
      console.error("Error scanning for audio files:", error);
      setLoading(false);
    }
  };

  const loadMetadata = async (files: AudioFile[]) => {
    try {
      const filesWithTags = await Promise.all(
        files.map(async (file) => {
          const tags = await readID3v2Tags(file.uri);
          return {
            ...file,
            tags: tags || undefined,
          };
        })
      );
      setAudioFiles(filesWithTags as AudioFile[]);
    } catch (error) {
      console.error("Error loading metadata:", error);
    }
  };

  // Select a file to view/edit
  const selectFile = async (file: AudioFile) => {
    try {
      setLoading(true);
      setSelectedFile(file);

      // Read full tags
      const tags = await readID3v2Tags(file.uri);

      setTagInfo(tags);
      setLoading(false);
    } catch (error) {
      console.error("Error selecting file:", error);
      setLoading(false);
    }
  };

  // Pick an audio file using document picker
  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setLoading(true);

        // Get file info
        const fileInfo = await FileSystem.getInfoAsync(asset.uri);
        const fileSize = fileInfo.exists ? (fileInfo as any).size || 0 : 0;

        // Read tags from the file
        const tags = await readID3v2Tags(asset.uri);

        // Create new audio file object
        const newFile: AudioFile = {
          uri: asset.uri,
          name: asset.name,
          size: fileSize,
          modificationTime: (fileInfo as any).modificationTime || Date.now(),
          tags: tags || undefined,
        };

        // Copy file to document directory
        const documentDir = FileSystem.documentDirectory;
        if (documentDir) {
          const newPath = `${documentDir}${asset.name}`;
          await FileSystem.copyAsync({
            from: asset.uri,
            to: newPath,
          });

          // Update URI to point to the copied file
          newFile.uri = newPath;
        }

        // Add to audio files list
        setAudioFiles((prev) => [...prev, newFile]);

        // Select the new file
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
