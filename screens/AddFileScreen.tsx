import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import useHTTPServer from '../http-server/server';

export default function AddFileScreen(): JSX.Element {
  const { isRunning, startServer, stopServer, ipAddress, port, logs, setLogs } = useHTTPServer();
  const [showLogs, setShowLogs] = useState<boolean>(false);

  const addLog = (message: string): void => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
    const newLogs = [`[${timestamp}] ${message}`, ...logs];
    setLogs(newLogs);
  };


  const toggleServer = () => {
    if (isRunning) {
      stopServer();
    } else {
      startServer();
    }
  };

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true
      });
      
      if (result.canceled) {
        addLog('File picking canceled');
        return;
      }
      
      addLog(`Selected ${result.assets.length} file(s)`);
      
      // Process the selected files
      for (const asset of result.assets) {
        addLog(`File: ${asset.name}, Size: ${asset.size} bytes, URI: ${asset.uri}`);
        
        // Here you would typically copy the file to your app's storage
        const destPath = `${FileSystem.documentDirectory}files/${asset.name}`;
        
        try {
          // Create the directory if it doesn't exist
          const dirPath = `${FileSystem.documentDirectory}files`;
          const dirInfo = await FileSystem.getInfoAsync(dirPath);
          
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
            addLog(`Created directory: ${dirPath}`);
          }
          
          // Copy the file
          await FileSystem.copyAsync({
            from: asset.uri,
            to: destPath
          });
          
          addLog(`Copied file to: ${destPath}`);
        } catch (copyError) {
          addLog(`Error copying file: ${(copyError as Error).message}`);
        }
      }
    } catch (error) {
      addLog(`Error picking files: ${(error as Error).message}`);
    }
  };

  const pickDirectory = async () => {
    // Note: Expo doesn't have a direct way to pick directories
    // This is a placeholder for future implementation
    addLog('Directory picking is not yet implemented in this version');
    
    // In a real implementation, you might use a different approach
    // such as showing a custom directory browser or using a native module
  };

  return (
    <View style={styles.container}>
      <View style={styles.serverControls}>
        <Text style={styles.serverText}>Add files via Wi-Fi</Text>
        <Switch
          value={isRunning}
          onValueChange={toggleServer}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={isRunning ? '#007AFF' : '#f4f3f4'}
        />
      </View>
      
      {isRunning && (
        <View style={styles.serverInfo}>
          <Text style={styles.serverInfoText}>
            You can now access your device at: {"\n"}http://{ipAddress}{port === '80' ? '' : `:${port}`}
          </Text>
        </View>
      )}
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={pickFiles}>
          <Ionicons name="add-circle" size={24} color="#007AFF" />
          <Text style={styles.buttonText}>Add Local Files</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={pickDirectory}>
          <Ionicons name="folder-open" size={24} color="#007AFF" />
          <Text style={styles.buttonText}>Add Directory</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.logSwitch}>
        <Text style={styles.logSwitchText}>Show Logs</Text>
        <Switch
          value={showLogs}
          onValueChange={setShowLogs}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={showLogs ? '#007AFF' : '#f4f3f4'}
        />
      </View>
      
      {showLogs && (
        <View style={styles.logContainer}>
          <Text style={styles.logTitle}>Logs:</Text>
          <ScrollView style={styles.logs}>
            {logs.map((log, index) => (
              <Text key={index} style={styles.logText}>{log}</Text>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  serverControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  serverText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  serverInfo: {
    padding: 12,
    backgroundColor: '#e6f7ff',
    borderRadius: 8,
    marginBottom: 16,
  },
  serverInfoText: {
    fontSize: 14,
  },
  buttonContainer: {
    marginVertical: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  logContainer: {
    flex: 1,
    marginTop: 16,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  logs: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 8,
  },
  logText: {
    fontSize: 12,
    marginBottom: 4,
  },
  logSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  logSwitchText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
