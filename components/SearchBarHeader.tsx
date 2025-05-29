import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SearchBar from "./SearchBar";

interface SearchBarHeaderProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  placeholder?: string;
}

const SearchBarHeader: React.FC<SearchBarHeaderProps> = ({
  searchQuery,
  onSearchChange,
  placeholder = "Search...",
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
    height: 40,
  },
});

export default SearchBarHeader;
