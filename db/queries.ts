import * as SQLite from "expo-sqlite";
import { readID3v2Tags } from "../utils/readID3Tags";

export interface Playlist {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  playlistItems?: PlaylistItemWithMedia[];
  cover?: string;
}

export interface PlaylistItem {
  id: number;
  playlistId: number;
  itemId: number;
  itemType: string;
  indexNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistItemWithMedia extends PlaylistItem {
  source: string;
  sourceType: string;
  name: string;
  uri?: string;
}

export interface Media {
  id: number;
  name: string;
  uri: string;
  sourceType: string; // "file" or "url"
  mediaType: string; // "audio" or "video"
  createdAt: string;
  updatedAt: string;
}

export const init = async (db: SQLite.SQLiteDatabase) => {
  console.log("--------------------------------initializing db");

  await db.execAsync(`
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS media (
id INTEGER PRIMARY KEY NOT NULL, 
name TEXT NOT NULL,
uri TEXT NOT NULL,
sourceType TEXT NOT NULL,
mediaType TEXT NOT NULL,
createdAt TEXT NOT NULL DEFAULT (datetime('now')),
updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS update_media_updatedAt
AFTER UPDATE ON media
FOR EACH ROW
BEGIN
UPDATE media SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS playlistItems (
id INTEGER PRIMARY KEY NOT NULL,
playlistId INTEGER NOT NULL,
itemId INTEGER NOT NULL,
itemType TEXT NOT NULL,
indexNumber INTEGER NOT NULL,
createdAt TEXT NOT NULL DEFAULT (datetime('now')),
updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS update_playlistItem_updatedAt
AFTER UPDATE ON playlistItems
FOR EACH ROW
BEGIN
UPDATE playlistItems SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS playlists (
id INTEGER PRIMARY KEY NOT NULL, 
name TEXT NOT NULL,
createdAt TEXT NOT NULL DEFAULT (datetime('now')),
updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS update_playlist_updatedAt
AFTER UPDATE ON playlists
FOR EACH ROW
BEGIN
UPDATE playlists SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
`);
};

export const deleteTables = async (
  db: SQLite.SQLiteDatabase
): Promise<void> => {
  console.log("--------------------------------DELETING TABLES");
  await db.execAsync(`
    DROP TABLE IF EXISTS songs;
    DROP TABLE IF EXISTS videos;
    DROP TABLE IF EXISTS playlists;
    DROP TABLE IF EXISTS playlistItems;
    DROP TABLE IF EXISTS media;
  `);
};

export const getPlaylistsAndItems = async (
  db: SQLite.SQLiteDatabase
): Promise<{ playlists: Playlist[] }> => {
  try {
    // First get all playlists
    const playlistsStatement = await db.prepareAsync("SELECT * FROM playlists");
    const playlistsResult = await playlistsStatement.executeAsync({});
    const playlists = (await playlistsResult.getAllAsync()) as Playlist[];

    // For each playlist, get its items with media data
    for (const playlist of playlists) {
      const itemsStatement = await db.prepareAsync(`
        SELECT 
          pi.id,
          pi.playlistId,
          pi.itemId,
          pi.itemType,
          pi.indexNumber,
          pi.createdAt,
          pi.updatedAt,
          m.name,
          m.uri,
          m.sourceType
        FROM playlistItems pi
        JOIN media m ON pi.itemId = m.id AND pi.itemType = 'media'
        WHERE pi.playlistId = $playlistId
      `);

      const itemsResult = await itemsStatement.executeAsync({
        $playlistId: playlist.id,
      });
      const items =
        (await itemsResult.getAllAsync()) as PlaylistItemWithMedia[];
      playlist.playlistItems = items;

      const tags = await readID3v2Tags(items[0].uri || "");
      playlist.cover = tags?.image;
    }

    return { playlists };
  } catch (error) {
    console.error("Error fetching playlists and items:", error);
    return { playlists: [] };
  }
};

export const getAllPlaylists = async (
  db: SQLite.SQLiteDatabase
): Promise<Playlist[]> => {
  try {
    const statement = await db.prepareAsync("SELECT * FROM playlists");
    const result = await statement.executeAsync({});
    const playlists = await result.getAllAsync();

    return playlists as Playlist[];
  } catch (error) {
    console.error("Error fetching playlists:", error);
    return [];
  }
};

export const getAllPlaylistItems = async (
  db: SQLite.SQLiteDatabase
): Promise<PlaylistItem[]> => {
  try {
    const statement = await db.prepareAsync("SELECT * FROM playlistItems");
    const result = await statement.executeAsync({});
    const playlistItems = await result.getAllAsync();

    return playlistItems as PlaylistItem[];
  } catch (error) {
    console.error("Error fetching playlist items:", error);
    return [];
  }
};

export const getAllMedia = async (
  db: SQLite.SQLiteDatabase
): Promise<Media[]> => {
  try {
    const statement = await db.prepareAsync("SELECT * FROM media");
    const result = await statement.executeAsync({});
    const media = await result.getAllAsync();

    return media as Media[];
  } catch (error) {
    console.error("Error fetching media:", error);
    return [];
  }
};

export const insertPlaylist = async (
  db: SQLite.SQLiteDatabase,
  name: string
): Promise<number> => {
  try {
    if (!name) {
      throw new Error("Name is required");
    }

    const statement = await db.prepareAsync(
      "INSERT INTO playlists (name) VALUES ($name) RETURNING id"
    );

    const result = await statement.executeAsync({ $name: name });
    const playlist = (await result.getFirstAsync()) as { id: number };

    return playlist.id;
  } catch (error) {
    console.error("Error inserting playlist:", error);
    throw error;
  }
};

export const insertPlaylistItem = async (
  db: SQLite.SQLiteDatabase,
  playlistId: number,
  itemId: number,
  itemType: string,
  indexNumber: number
): Promise<void> => {
  try {
    const statement = await db.prepareAsync(
      "INSERT INTO playlistItems (playlistId, itemId, itemType, indexNumber) VALUES ($playlistId, $itemId, $itemType, $indexNumber)"
    );
    await statement.executeAsync({
      $playlistId: playlistId,
      $itemId: itemId,
      $itemType: itemType,
      $indexNumber: indexNumber,
    });
  } catch (error) {
    console.error("Error inserting playlist item:", error);
    throw error;
  }
};

export const insertMedia = async (
  db: SQLite.SQLiteDatabase,
  name: string,
  uri: string,
  sourceType: string,
  mediaType: string
): Promise<number> => {
  try {
    const statement = await db.prepareAsync(
      "INSERT INTO media (name, uri, sourceType, mediaType) VALUES ($name, $uri, $sourceType, $mediaType) RETURNING id"
    );
    const result = await statement.executeAsync({
      $name: name,
      $uri: uri,
      $sourceType: sourceType,
      $mediaType: mediaType,
    });
    const media = (await result.getFirstAsync()) as { id: number };
    return media.id;
  } catch (error) {
    console.error("Error inserting media:", error);
    throw error;
  }
};

export const deleteMedia = async (
  db: SQLite.SQLiteDatabase,
  id: number
): Promise<void> => {
  const statement = await db.prepareAsync("DELETE FROM media WHERE id = $id");
  await statement.executeAsync({ $id: id });
};
