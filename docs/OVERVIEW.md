# Project Overview

## Goal

The goal of this project is to create a media player that is able to play audio files and display the metadata of the audio files. Eventually the app will be able to use multiple APIs from different platforms (Spotify, SoundCloud, Apple Music, etc.) to centralize a user's music library. Another goal is to add video playback capabilities.

## Tech Stack

- React Native
- Expo
- SQLite

## Data Storage

### Overview

The app currently uses a local SQLite database to store the playlists and the audio files.
The database setup is stored in the `/db` directory.

### Tables

The app uses the following tables to store the playlists and the audio files:

- `playlists`: Stores the playlist information.
- `playlist_items`: The link between the many-to-many relationship between playlists and audio files.
- `media`: Stores the metadata of the audio files in a way that will allow for different sources (local files, remote files, etc.)

## Music Player

### react-native-track-player

The library "react-native-track-player" is a library that allows for usage of the iOS and Android native audio players.

### Local audio files

Local audio files are stored in the device's file system. Their metadata and filepath is stored in the SQLite database.

### ID3 Tag Extraction

The app has its own ID3 tag extraction logic stored in the `/utils/id3TagUtils.ts` file.

### Audio Player

The app uses the ExpoAV module to play the audio files.

## Wi-Fi File Transfer

### HTTP Server

The app creates a HTTP server on the device that can be used to transfer files to the device from a computer.
There is a class exported from the `/utils/http.ts` file that can be used to create the HTTP server. This is currently implemented in the `/http-server/server.tsx` file.