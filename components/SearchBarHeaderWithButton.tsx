import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SearchBar from "./SearchBar";

interface SearchBarAndButtonProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onAddPress: () => void;
  placeholder?: string;
  addButtonColor?: string;
}

const SearchBarAndButton: React.FC<SearchBarAndButtonProps> = ({
  searchQuery,
  onSearchChange,
  onAddPress,
  placeholder = "Search...",
  addButtonColor = "#007AFF",
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.searchBarContainer}>
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          placeholder={placeholder}
        />
      </View>
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: addButtonColor }]}
        onPress={onAddPress}
      >
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  searchBarContainer: {
    flex: 1,
    marginRight: 10,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default SearchBarAndButton;
