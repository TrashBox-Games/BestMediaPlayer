import React from "react";
import { Image, View, StyleSheet } from "react-native";

interface AlbumArtworkProps {
  imageData: string;
  size?: number;
}

const AlbumArtwork = ({
  imageData,
  size = 200,
}: AlbumArtworkProps): JSX.Element => {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 20,
        overflow: "hidden",
        backgroundColor: "#fff",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
      }}
    >
      <Image
        source={{ uri: `data:image/jpeg;base64,${imageData}` }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 20,
          backgroundColor: "#eee",
        }}
        resizeMode="cover"
      />
    </View>
  );
};

export default AlbumArtwork;
