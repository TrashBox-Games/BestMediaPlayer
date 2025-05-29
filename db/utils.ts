import * as SQLite from "expo-sqlite";
import {
  getAllMedia,
  getAllPlaylists,
  getAllPlaylistItems,
  deleteMedia,
  insertMedia,
  insertPlaylist,
  insertPlaylistItem,
} from "./queries";
import { AudioFile } from "../contexts/TagsContext";

export interface FileSystemMedia {
  uri: string;
  name: string;
}

export const syncDatabaseWithFileSystem = async (
  db: SQLite.SQLiteDatabase,
  fileSystemMedia: AudioFile[]
): Promise<AudioFile[]> => {
  const pureMedia = [];
  const databaseMedia = await getAllMedia(db);

  for (let i = 0; i < databaseMedia.length; i++) {
    const currentDatabaseMedia = databaseMedia[i];

    if (fileSystemMedia.find((m) => m.uri === currentDatabaseMedia.uri)) {
      pureMedia.push({
        ...fileSystemMedia.find((m) => m.uri === currentDatabaseMedia.uri),
        id: currentDatabaseMedia.id,
        sourceType: "file",
        mediaType: "audio",
      });
    } else {
      await deleteMedia(db, currentDatabaseMedia.id);
    }
  }

  for (let i = 0; i < fileSystemMedia.length; i++) {
    const currentFileSystemMedia = fileSystemMedia[i];
    if (!databaseMedia.find((m) => m.uri === currentFileSystemMedia.uri)) {
      const id = await insertMedia(
        db,
        currentFileSystemMedia.name,
        currentFileSystemMedia.uri,
        "file",
        "audio"
      );
      pureMedia.push({
        ...currentFileSystemMedia,
        id: id,
        sourceType: "file",
        mediaType: "audio",
      });
    }
  }

  return pureMedia as AudioFile[];
};

export const createPlaylistWithItems = async (
  db: SQLite.SQLiteDatabase,
  name: string,
  media: AudioFile[]
): Promise<void> => {
  try {
    const playlistId = await insertPlaylist(db, name);

    for (let i = 0; i < media.length; i++) {
      if (!media[i].id) continue;
      await insertPlaylistItem(
        db,
        playlistId,
        media[i].id as number,
        "media",
        i
      );
    }
    console.log("Playlist created with items:", playlistId);
  } catch (error) {
    console.error("Error creating playlist with items:", error);
    throw error;
  }
};
