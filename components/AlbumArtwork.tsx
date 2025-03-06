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
  let imageUri = imageData;
  if (!imageData.startsWith("data:image/") && !imageData.startsWith("http")) {
    let imageType = "jpeg";
    if (imageData.startsWith("/9j/")) {
      imageType = "jpeg";
    } else if (imageData.startsWith("iVBOR")) {
      imageType = "png";
    } else if (imageData.startsWith("R0lGOD")) {
      imageType = "gif";
    } else if (imageData.startsWith("UklGR")) {
      imageType = "webp";
    }

    // Add the proper data URI prefix
    imageUri = `data:image/${imageType};base64,${imageData}`;
  }

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
        source={{ uri: imageUri }}
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
