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
   pnpm install
   ```

3. Start the development server:
   ```
   pnpm start
   ```

4. Run the app:
   ```
   ## Android
   pnpm run android

   ## iOS
   pnpm run ios

   ## Web
   pnpm run web
   ```

## Common Issues

### iOS

- If you encounter issues with the iOS build, try the following:
  - Ensure you have Xcode installed and the latest version
  - Try opening Xcode before running the app
  - Try opening the simulator before running the app