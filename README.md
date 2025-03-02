# Media Player App

A modern React Native media player application with optimized ID3 tag extraction for audio files.

## Features

- **Efficient ID3 Tag Extraction**: Optimized algorithms for extracting metadata from audio files
- **Album Art Caching**: Persistent caching of album artwork to improve performance
- **Progressive Loading**: Immediate UI updates with background metadata loading
- **Audio Playback**: Full-featured audio player with playback controls
- **Search Functionality**: Search through your music library by title, artist, or album
- **Playlist Management**: Create and manage playlists of your favorite songs

## Technical Highlights

### ID3 Tag Extraction Optimizations

- **Memory Efficient**: Reads only necessary portions of files instead of loading entire files
- **Frame Scanning**: Efficiently locates needed frames without sequential parsing
- **Binary Search**: Uses optimized algorithms for finding null terminators
- **Streaming**: Implements streaming techniques for reading large files
- **Lazy Loading**: Only loads image data when explicitly requested

### Architecture

- **Context API**: Uses React Context for state management across the application
- **Separation of Concerns**: Modular code organization with separate contexts for tags and player
- **Utility Functions**: Reusable utility functions for ID3 tag extraction

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Expo CLI

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/media-player.git
   cd media-player
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Start the development server:
   ```
   npx expo start
   ```

## Dependencies

- React Native
- Expo
- @react-native-async-storage/async-storage
- @react-native-community/slider
- expo-av
- expo-file-system
- expo-media-library
- buffer

## Project Structure

```
media-player/
├── components/
│   ├── tabs/
│   │   ├── SongsTab.tsx
│   │   ├── PlaylistsTab.tsx
│   │   └── SettingsTab.tsx
├── contexts/
│   ├── TagsContext.tsx
│   └── PlayerContext.tsx
├── utils/
│   └── id3TagUtils.ts
├── App.tsx
└── package.json
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to the React Native and Expo communities for their excellent documentation and support.
- ID3 tag extraction algorithms inspired by various open-source projects and research papers on efficient binary data processing.
