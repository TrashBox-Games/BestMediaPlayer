import React, { createContext, useContext, useState, useEffect } from "react";
import TrackPlayer, {
  Event,
  State,
  useTrackPlayerEvents,
  useProgress,
  Track,
  AppKilledPlaybackBehavior,
  Capability,
} from "react-native-track-player";
import { AudioFile } from "./TagsContext";
import { Platform } from "react-native";
import * as ExpoAV from "expo-av";

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
  sound: null; // Keeping for backward compatibility but will be unused
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

// Setup function for TrackPlayer
export const setupPlayer = async () => {
  try {
    // Set up the player with iOS category and mode
    await TrackPlayer.setupPlayer({
      minBuffer: 30, // Minimum duration of media that the player will attempt to buffer in seconds
    });
    
    // Update options for controls and notification
    await TrackPlayer.updateOptions({
      // Enable capabilities for lockscreen controls
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.Stop,
        Capability.SeekTo,
      ],
      // Enable compact capabilities (shown when the notification is collapsed)
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      // Android-specific options
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
      // Jump intervals
      forwardJumpInterval: 30,
      backwardJumpInterval: 15,
      progressUpdateEventInterval: 1,
    });
    
    // Set iOS audio session category and mode separately
    if (Platform.OS === 'ios') {
      await ExpoAV.Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
    }
    
    console.log("Player setup complete");
    return true;
  } catch (error) {
    console.error("Error setting up the player:", error);
    return false;
  }
};

// Custom hook for using the context
export const usePlayerContext = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayerContext must be used within a PlayerProvider");
  }
  return context;
};

// Convert AudioFile to Track format
const convertToTrack = (audioFile: AudioFile): Track => {
  return {
    id: audioFile.uri,
    url: audioFile.uri,
    title: audioFile.tags?.title || audioFile.name,
    artist: audioFile.tags?.artist || "Unknown Artist",
    album: audioFile.tags?.album || "Unknown Album",
    artwork: audioFile.tags?.image || undefined,
    duration: audioFile.tags?.duration ? parseFloat(audioFile.tags.duration) : undefined,
    pitchAlgorithm: Platform.OS === 'ios' ? undefined : undefined, // You can set a specific pitch algorithm if needed
    date: audioFile.tags?.date || undefined,
    genre: audioFile.tags?.genre || undefined,
    description: audioFile.tags?.comment || undefined,
  };
};

// Provider component
export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentTrack, setCurrentTrack] = useState<AudioFile | null>(null);
  const [playlist, setPlaylist] = useState<AudioFile[]>([]);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1.0,
  });
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Initialize the player
  useEffect(() => {
    let isMounted = true;
    
    const initializePlayer = async () => {
      const isSetup = await setupPlayer();
      if (isMounted && isSetup) {
        console.log("Player initialized");
        setIsPlayerReady(true);
      }
    };

    initializePlayer();

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for player events
  useTrackPlayerEvents([Event.PlaybackState, Event.PlaybackTrackChanged], async (event) => {
    if (event.type === Event.PlaybackState) {
      const state = await TrackPlayer.getState();
      setPlayerState(prev => ({
        ...prev,
        isPlaying: state === State.Playing,
      }));
    }
    
    if (event.type === Event.PlaybackTrackChanged && event.nextTrack !== undefined) {
      const trackIndex = event.nextTrack;
      if (trackIndex >= 0 && trackIndex < playlist.length) {
        setCurrentTrack(playlist[trackIndex]);
      }
    }
  });

  // Update progress
  const progress = useProgress();
  useEffect(() => {
    setPlayerState(prev => ({
      ...prev,
      currentTime: progress.position * 1000, // Convert to milliseconds
      duration: progress.duration * 1000, // Convert to milliseconds
    }));
  }, [progress]);

  // Play a track
  const playTrack = async (track: AudioFile) => {
    try {
      if (!isPlayerReady) {
        console.warn("Player is not ready yet");
        return;
      }

      // Reset the queue
      await TrackPlayer.reset();
      
      // Convert the track to the format expected by TrackPlayer
      const trackToPlay = convertToTrack(track);
      
      // Add and play the track
      await TrackPlayer.add(trackToPlay);
      
      // Start playback
      await TrackPlayer.play();
      
      // Update current track
      setCurrentTrack(track);
      
      // If on iOS, make sure the track appears on the lockscreen
      if (Platform.OS === 'ios') {
        // Force metadata update for the current track (index 0 after reset)
        await TrackPlayer.updateMetadataForTrack(0, {
          title: trackToPlay.title,
          artist: trackToPlay.artist,
          artwork: trackToPlay.artwork,
          album: trackToPlay.album,
        });
      }
    } catch (error) {
      console.error("Error playing track:", error);
    }
  };

  // Pause current track
  const pauseTrack = async () => {
    if (isPlayerReady) {
      await TrackPlayer.pause();
    }
  };

  // Resume current track
  const resumeTrack = async () => {
    if (isPlayerReady) {
      await TrackPlayer.play();
    }
  };

  // Stop current track
  const stopTrack = async () => {
    if (isPlayerReady) {
      await TrackPlayer.stop();
      await TrackPlayer.reset();
      setCurrentTrack(null);
    }
  };

  // Seek to position
  const seekTo = async (position: number) => {
    if (isPlayerReady) {
      // Convert milliseconds to seconds for TrackPlayer
      await TrackPlayer.seekTo(position / 1000);
    }
  };

  // Set volume
  const setVolume = async (volume: number) => {
    if (isPlayerReady) {
      await TrackPlayer.setVolume(volume);
      setPlayerState(prev => ({ ...prev, volume }));
    }
  };

  // Update playlist
  useEffect(() => {
    const updateQueue = async () => {
      if (isPlayerReady && playlist.length > 0) {
        // Only reset and add tracks if the player is not currently playing
        const state = await TrackPlayer.getState();
        if (state !== State.Playing && state !== State.Buffering) {
          await TrackPlayer.reset();
          
          // Convert all tracks to the format expected by TrackPlayer
          const tracksToAdd = playlist.map(convertToTrack);
          
          // Add all tracks to the queue
          await TrackPlayer.add(tracksToAdd);
          
          // Make sure all tracks have proper metadata for the lockscreen
          if (Platform.OS === 'ios') {
            // Update metadata for each track
            for (let i = 0; i < tracksToAdd.length; i++) {
              const track = tracksToAdd[i];
              await TrackPlayer.updateMetadataForTrack(i, {
                title: track.title,
                artist: track.artist,
                artwork: track.artwork,
                album: track.album,
              });
            }
          }
        }
      }
    };
    
    updateQueue();
  }, [playlist, isPlayerReady]);

  // Play next track in playlist
  const playNextTrack = async () => {
    if (isPlayerReady) {
      await TrackPlayer.skipToNext();
    }
  };

  // Play previous track in playlist
  const playPreviousTrack = async () => {
    if (isPlayerReady) {
      await TrackPlayer.skipToPrevious();
    }
  };

  // Toggle play/pause
  const togglePlayPause = async () => {
    if (!isPlayerReady) return;
    
    const state = await TrackPlayer.getState();
    
    if (state === State.Playing) {
      await pauseTrack();
    } else if (state === State.Paused || state === State.Ready) {
      await resumeTrack();
    } else if (currentTrack) {
      await playTrack(currentTrack);
    } else if (playlist.length > 0) {
      await playTrack(playlist[0]);
    }
  };

  // Context value
  const value: PlayerContextType = {
    currentTrack,
    playerState,
    sound: null, // No longer using Expo's Sound object
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
