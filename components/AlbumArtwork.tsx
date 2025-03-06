import React from "react";
import { Image, View, StyleSheet, StyleProp, ViewStyle, ImageSourcePropType } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface AlbumArtworkProps {
  imageData: string | undefined;
  style?: StyleProp<ViewStyle>;
  defaultImage?: ImageSourcePropType;
}

const AlbumArtwork = ({
  imageData,
  style,
  defaultImage
}: AlbumArtworkProps): JSX.Element => {
  // If imageData is undefined, show default image or placeholder icon
  if (!imageData) {
    if (defaultImage) {
      return (
        <View style={[{
          width: "100%",
          height: "100%",
          borderRadius: 4,
          overflow: "hidden",
        }, style]}>
          <Image
            source={defaultImage}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 4,
            }}
            resizeMode="cover"
          />
        </View>
      );
    }
    
    return (
      <View
        style={[{
          width: "100%",
          height: "100%",
          borderRadius: 4,
          overflow: "hidden",
          backgroundColor: "#eee",
          justifyContent: "center",
          alignItems: "center",
        }, style]}
      >
        <Ionicons name="musical-notes" size={24} color="#999" />
      </View>
    );
  }

  // Process image data if it exists
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
      style={[{
        width: "100%",
        height: "100%",
        borderRadius: 4,
        overflow: "hidden",
        backgroundColor: "#fff",
      }, style]}
    >
      <Image
        source={{ uri: imageUri }}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 4,
        }}
        resizeMode="cover"
      />
    </View>
  );
};

export default AlbumArtwork;
