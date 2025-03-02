import React from "react";
import AlbumArtwork from "./AlbumArtwork";
import { View, Text, StyleSheet } from "react-native";

interface SongItemProps {
  title: string;
  artist: string;
  album: string;
  artwork: string;
}

const SongItem = ({ title, artist, album, artwork }: SongItemProps) => {
  return (
    <View style={styles.container}>
      <AlbumArtwork imageData={artwork} size={40} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {title}
        </Text>
        <Text style={styles.artist}>
          {artist}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
  },
  textContainer: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  artist: {
    fontSize: 14,
    color: '#777',
  },
});

export default SongItem;
