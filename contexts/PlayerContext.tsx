import React, { createContext, useContext, useState, useEffect } from "react";
import { Audio } from "expo-av";
import { AudioFile } from "./TagsContext";

// Define player state type
interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

// Define context type
interface PlayerContextType {
  currentTrack: AudioFile | null;
  playerState: PlayerState;
  sound: Audio.Sound | null;
  playTrack: (track: AudioFile) => Promise<void>;
  pauseTrack: () => Promise<void>;
  resumeTrack: () => Promise<void>;
  stopTrack: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  playNextTrack: () => Promise<void>;
  playPreviousTrack: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  playlist: AudioFile[];
  setPlaylist: (tracks: AudioFile[]) => void;
}

// Create context
const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// Custom hook for using the context
export const usePlayerContext = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayerContext must be used within a PlayerProvider");
  }
  return context;
};

// Provider component
export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentTrack, setCurrentTrack] = useState<AudioFile | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playlist, setPlaylist] = useState<AudioFile[]>([]);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1.0,
  });

  // Clean up sound on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Update playback status
  const updatePlaybackStatus = (status: Audio.PlaybackStatus) => {
    if (status.isLoaded) {
      setPlayerState({
        isPlaying: status.isPlaying,
        currentTime: status.positionMillis,
        duration: status.durationMillis || 0,
        volume: status.volume,
      });
    }
  };

  // Play a track
  const playTrack = async (track: AudioFile) => {
    try {
      // Stop current track if playing
      if (sound) {
        await sound.unloadAsync();
      }

      // Configure audio session
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // Load and play the new track
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: track.uri },
        { shouldPlay: true, volume: playerState.volume },
        updatePlaybackStatus
      );

      setSound(newSound);
      setCurrentTrack(track);
    } catch (error) {
      console.error("Error playing track:", error);
    }
  };

  // Pause current track
  const pauseTrack = async () => {
    if (sound) {
      await sound.pauseAsync();
    }
  };

  // Resume current track
  const resumeTrack = async () => {
    if (sound) {
      await sound.playAsync();
    }
  };

  // Stop current track
  const stopTrack = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
      setCurrentTrack(null);
    }
  };

  // Seek to position
  const seekTo = async (position: number) => {
    if (sound) {
      await sound.setPositionAsync(position);
    }
  };

  // Set volume
  const setVolume = async (volume: number) => {
    if (sound) {
      await sound.setVolumeAsync(volume);
      setPlayerState((prev) => ({ ...prev, volume }));
    }
  };

  // Play next track in playlist
  const playNextTrack = async () => {
    if (currentTrack && playlist.length > 0) {
      const currentIndex = playlist.findIndex(
        (track) => track.uri === currentTrack.uri
      );
      if (currentIndex < playlist.length - 1) {
        await playTrack(playlist[currentIndex + 1]);
      } else if (playlist.length > 0) {
        // Loop back to the first track
        await playTrack(playlist[0]);
      }
    }
  };

  // Play previous track in playlist
  const playPreviousTrack = async () => {
    if (currentTrack && playlist.length > 0) {
      const currentIndex = playlist.findIndex(
        (track) => track.uri === currentTrack.uri
      );
      if (currentIndex > 0) {
        await playTrack(playlist[currentIndex - 1]);
      } else if (playlist.length > 0) {
        // Loop to the last track
        await playTrack(playlist[playlist.length - 1]);
      }
    }
  };

  // Toggle play/pause
  const togglePlayPause = async () => {
    if (!sound) {
      if (currentTrack) {
        await playTrack(currentTrack);
      } else if (playlist.length > 0) {
        await playTrack(playlist[0]);
      }
    } else if (playerState.isPlaying) {
      await pauseTrack();
    } else {
      await resumeTrack();
    }
  };

  // Context value
  const value: PlayerContextType = {
    currentTrack,
    playerState,
    sound,
    playTrack,
    pauseTrack,
    resumeTrack,
    stopTrack,
    seekTo,
    setVolume,
    playNextTrack,
    playPreviousTrack,
    togglePlayPause,
    playlist,
    setPlaylist,
  };

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
};
