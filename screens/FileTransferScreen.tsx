import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  ScrollView,
  TextInput,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as Network from "expo-network";
import TcpSocket from "react-native-tcp-socket";
import { AddressInfo } from "net";
import { Buffer } from "buffer";

// Define constants
const END_OF_FILE_MARKER = "<<EOF>>";

// Define types for the component state
interface ReceivedFile {
  name: string;
  path: string;
  size: number;
  timestamp: string;
}

// Use the actual TcpSocket types
type TcpSocketType = ReturnType<typeof TcpSocket.createServer>;
type TcpSocketConnection = Parameters<
  Parameters<typeof TcpSocket.createServer>[0]
>[0];

export default function FileTransferScreen(): JSX.Element {
  const [server, setServer] = useState<TcpSocketType | null>(null);
  const [ipAddress, setIpAddress] = useState<string>("");
  const [port, setPort] = useState<string>("8080");
  const [status, setStatus] = useState<string>("Server not running");
  const [logs, setLogs] = useState<string[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);

  useEffect(() => {
    // Get the device's IP address
    const getIpAddress = async (): Promise<void> => {
      try {
        const ip = await Network.getIpAddressAsync();
        setIpAddress(ip);
      } catch (error) {
        addLog(`Error getting IP address: ${(error as Error).message}`);
      }
    };

    getIpAddress();

    // Clean up server on component unmount
    return () => {
      stopServer();
    };
  }, []);

  const addLog = (message: string): void => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prevLogs) => [`[${timestamp}] ${message}`, ...prevLogs]);
  };

  const startServer = (): void => {
    try {
      // Create a server
      const newServer = TcpSocket.createServer(
        (socket: TcpSocketConnection) => {
          const addressInfo = socket.address() as AddressInfo;
          addLog(`New client connected: ${addressInfo.address || "unknown"}`);

          let receivedData = "";
          let fileName = "";
          let fileSize = 0;
          let receivedSize = 0;
          let isReceivingFile = false;

          socket.on("data", (data: any) => {
            // Handle incoming data
            const chunk = data.toString();
            receivedData += chunk;

            // Check if we've received the complete file
            if (receivedData.includes(END_OF_FILE_MARKER)) {
              const [fileDataBase64, _] =
                receivedData.split(END_OF_FILE_MARKER);

              try {
                // Decode base64 data
                const fileData = Buffer.from(fileDataBase64, "base64");

                // Save the file
                saveReceivedFile(fileData);

                // Reset for next file
                receivedData = "";

                // Send acknowledgment
                socket.write("FILE_RECEIVED");
              } catch (error) {
                addLog(`Error processing file: ${(error as Error).message}`);
              }
            }
          });

          socket.on("error", (error: Error) => {
            addLog(`Socket error: ${error.message}`);
          });

          socket.on("close", () => {
            addLog("Client disconnected");
          });
        }
      );

      // Handle server errors
      newServer.on("error", (error: Error) => {
        addLog(`Server error: ${error.message}`);
        setStatus("Server error");
        setServer(null);
      });

      // Start listening
      const portNumber = parseInt(port, 10);
      newServer.listen({
        port: portNumber,
        host: ipAddress,
      });

      setServer(newServer);
      setStatus(`Server running on ${ipAddress}:${port}`);
      addLog(`Server started on ${ipAddress}:${port}`);
    } catch (error) {
      addLog(`Error starting server: ${(error as Error).message}`);
      setStatus("Failed to start server");
    }
  };

  const stopServer = (): void => {
    if (server) {
      server.close();
      setServer(null);
      setStatus("Server stopped");
      addLog("Server stopped");
    }
  };

  const saveReceivedFile = async (fileData: Buffer): Promise<void> => {
    try {
      // Generate a unique filename
      const fileName = `file_${Date.now()}.bin`;

      // Create a directory for received files if it doesn't exist
      const dirPath = `${FileSystem.documentDirectory}received_files`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirPath);
      }

      // Save the file
      const filePath = `${dirPath}/${fileName}`;
      await FileSystem.writeAsStringAsync(
        filePath,
        fileData.toString("base64"),
        {
          encoding: FileSystem.EncodingType.Base64,
        }
      );

      // Add to received files list
      const timestamp = new Date().toLocaleString();
      const newFile: ReceivedFile = {
        name: fileName,
        path: filePath,
        size: fileData.length,
        timestamp,
      };

      setReceivedFiles((prevFiles) => [newFile, ...prevFiles]);
      addLog(`File saved to: ${filePath}`);
    } catch (error) {
      addLog(`Error saving file: ${(error as Error).message}`);
    }
  };

  const saveFile = async (fileName: string, data: string): Promise<void> => {
    try {
      // Create a directory for received files if it doesn't exist
      const dirPath = `${FileSystem.documentDirectory}received_files`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirPath);
      }

      // Save the file
      const filePath = `${dirPath}/${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, data, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Add to received files list
      const timestamp = new Date().toLocaleString();
      const newFile: ReceivedFile = {
        name: fileName,
        path: filePath,
        size: data.length,
        timestamp,
      };

      setReceivedFiles((prevFiles) => [newFile, ...prevFiles]);
      addLog(`File saved to: ${filePath}`);
    } catch (error) {
      addLog(`Error saving file: ${(error as Error).message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>File Transfer Server</Text>

      <View style={styles.serverControls}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>IP Address:</Text>
          <TextInput
            style={styles.input}
            value={ipAddress}
            onChangeText={setIpAddress}
            placeholder="IP Address"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Port:</Text>
          <TextInput
            style={styles.input}
            value={port}
            onChangeText={setPort}
            placeholder="Port"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.buttonContainer}>
          {!server ? (
            <Button title="Start Server" onPress={startServer} />
          ) : (
            <Button title="Stop Server" onPress={stopServer} color="red" />
          )}
        </View>
      </View>

      <Text style={styles.statusText}>{status}</Text>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Server Logs</Text>
        <ScrollView style={styles.logsContainer}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log}
            </Text>
          ))}
        </ScrollView>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Received Files</Text>
        <ScrollView style={styles.filesContainer}>
          {receivedFiles.length > 0 ? (
            receivedFiles.map((file, index) => (
              <View key={index} style={styles.fileItem}>
                <Text style={styles.fileName}>{file.name}</Text>
                <Text style={styles.fileInfo}>
                  Size: {file.size} bytes | Received: {file.timestamp}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No files received yet</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  serverControls: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  inputContainer: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    marginBottom: 4,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 8,
    fontSize: 16,
  },
  buttonContainer: {
    marginTop: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
    color: "#007AFF",
  },
  sectionContainer: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  logsContainer: {
    flex: 1,
  },
  logText: {
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 4,
  },
  filesContainer: {
    flex: 1,
  },
  fileItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  fileName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  fileInfo: {
    fontSize: 12,
    color: "#666",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 16,
    color: "#666",
    fontStyle: "italic",
  },
});
