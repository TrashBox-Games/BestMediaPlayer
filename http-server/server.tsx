import { useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';
import { Asset } from 'expo-asset';
import { createServer } from '../utils/http';

export default function useHTTPServer(): {
  isRunning: boolean;
  startServer: () => Promise<void>;
  stopServer: () => void;
  ipAddress: string;
  port: string;
  setPort: (port: string) => void;
  logs: string[];
  setLogs: (logs: string[]) => void;
} {
  const [server, setServer] = useState<any>(null);
  const [ipAddress, setIpAddress] = useState<string>('');
  const [port, setPort] = useState<string>('80');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const initialize = async (): Promise<void> => {
      try {
        // Get IP address
        const ip = await Network.getIpAddressAsync();
        setIpAddress(ip);
        addLog(`Device IP address: ${ip}`);
        
        // Load assets
        await loadAssets();
      } catch (error) {
        addLog(`Error during initialization: ${(error as Error).message}`);
      }
    };

    initialize();

    // Clean up server on component unmount
    return () => {
      stopServer();
    };
  }, []);

  const loadAssets = async (): Promise<void> => {
    try {
      addLog('Loading assets...');
      // Load the HTML file from assets
      const htmlAsset = Asset.fromModule(require('../assets/html/index.html'));
      await htmlAsset.downloadAsync();
      
      if (htmlAsset.localUri) {
        addLog(`HTML asset loaded: ${htmlAsset.localUri}`);

        // Create the html directory in document directory if it doesn't exist
        const dirPath = `${FileSystem.documentDirectory}html`;
        const dirInfo = await FileSystem.getInfoAsync(dirPath);
        
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
          addLog(`Created directory: ${dirPath}`);
        }
        
        // Copy the asset to the document directory
        const destPath = `${dirPath}/index.html`;
        await FileSystem.copyAsync({
          from: htmlAsset.localUri,
          to: destPath
        });
        
        addLog(`Copied HTML asset to: ${destPath}`);
      } else {
        addLog('Failed to load HTML asset: localUri is undefined');
      }
    } catch (error) {
      addLog(`Error loading assets: ${(error as Error).message}`);
    }
  };

  const addLog = (message: string): void => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
    setLogs((prevLogs) => [`[${timestamp}] ${message}`, ...prevLogs]);
  };

  const startServer = async (): Promise<void> => {
    if (isRunning) {
      addLog('Server is already running');
      return;
    }

    try {
      const portNumber = parseInt(port, 10);
      if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
        addLog('Invalid port number. Please enter a number between 1 and 65535.');
        return;
      }

      // Create a new HTTP server
      const httpServer = createServer();

      // Handle root path - serve index.html
      httpServer.get('/', async (req, res) => {
        try {
          // Check if the HTML file exists in document directory
          const htmlPath = `${FileSystem.documentDirectory}html/index.html`;
          const fileInfo = await FileSystem.getInfoAsync(htmlPath);
          
          if (fileInfo.exists) {
            // Read the HTML file
            const htmlContent = await FileSystem.readAsStringAsync(htmlPath);
            
            // Set appropriate headers
            res.setHeader('Content-Type', 'text/html');
            
            // Send the HTML content
            res.send(htmlContent);
            addLog(`Served index.html to ${req.headers['user-agent'] || 'unknown client'}`);
          } else {
            // If the file doesn't exist, try to load it from assets
            try {
              await loadAssets();
              
              // Check if the file exists now
              const newFileInfo = await FileSystem.getInfoAsync(htmlPath);
              
              if (newFileInfo.exists) {
                // Read the HTML file
                const htmlContent = await FileSystem.readAsStringAsync(htmlPath);
                
                // Set appropriate headers
                res.setHeader('Content-Type', 'text/html');
                
                // Send the HTML content
                res.send(htmlContent);
                addLog(`Loaded from assets and served index.html to ${req.headers['user-agent'] || 'unknown client'}`);
              } else {
                // If still not available, create a fallback HTML file
                const fallbackHtml = createFallbackHtml();
                
                // Create the directory if it doesn't exist
                const dirPath = `${FileSystem.documentDirectory}html`;
                const dirInfo = await FileSystem.getInfoAsync(dirPath);
                if (!dirInfo.exists) {
                  await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
                }
                
                // Write the fallback HTML to the file
                await FileSystem.writeAsStringAsync(htmlPath, fallbackHtml);
                
                // Set appropriate headers
                res.setHeader('Content-Type', 'text/html');
                
                // Send the fallback HTML
                res.send(fallbackHtml);
                addLog(`Created and served fallback index.html to ${req.headers['user-agent'] || 'unknown client'}`);
              }
            } catch (assetError) {
              // If loading from assets fails, serve a fallback HTML
              const fallbackHtml = createFallbackHtml();
              
              // Set appropriate headers
              res.setHeader('Content-Type', 'text/html');
              
              // Send the fallback HTML
              res.send(fallbackHtml);
              addLog(`Served fallback HTML to ${req.headers['user-agent'] || 'unknown client'}`);
            }
          }
        } catch (error) {
          addLog(`Error serving index.html: ${(error as Error).message}`);
          res.status(500).send('Internal Server Error');
        }
      });

      // Handle static files (like CSS, JS, images)
      httpServer.get('/*', async (req, res) => {
        try {
          // Extract the file path from the URL
          const filePath = req.url.replace(/^\//, ''); // Remove leading slash
          
          // First check if the file exists in the document directory
          const docDirPath = `${FileSystem.documentDirectory}${filePath}`;
          const docDirFileInfo = await FileSystem.getInfoAsync(docDirPath);
          
          if (docDirFileInfo.exists) {
            // Determine the content type based on file extension
            const contentType = getContentType(filePath);
            
            // Read the file
            const fileContent = await FileSystem.readAsStringAsync(docDirPath);
            
            // Set appropriate headers
            res.setHeader('Content-Type', contentType);
            
            // Send the file content
            res.send(fileContent);
            addLog(`Served ${filePath} from document directory to ${req.headers['user-agent'] || 'unknown client'}`);
            return;
          }
          
          // If not in document directory, try to load from assets
          try {
            // Check if the file exists in assets
            const assetPath = `../assets/html/index.html`;
            const asset = Asset.fromModule(require(assetPath));
            await asset.downloadAsync();
            
            if (asset.localUri) {
              // Copy to document directory for future use
              const destPath = docDirPath;
              
              // Ensure the directory exists
              const dirPath = destPath.substring(0, destPath.lastIndexOf('/'));
              const dirInfo = await FileSystem.getInfoAsync(dirPath);
              if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
              }
              
              // Copy the file
              await FileSystem.copyAsync({
                from: asset.localUri,
                to: destPath
              });
              
              // Read the file
              const fileContent = await FileSystem.readAsStringAsync(destPath);
              
              // Determine the content type
              const contentType = getContentType(filePath);
              
              // Set appropriate headers
              res.setHeader('Content-Type', contentType);
              
              // Send the file content
              res.send(fileContent);
              addLog(`Served ${filePath} from assets to ${req.headers['user-agent'] || 'unknown client'}`);
            } else {
              // File not found in assets
              res.status(404).send('Not Found');
              addLog(`404 Not Found: ${filePath} (asset localUri undefined)`);
            }
          } catch (assetError) {
            // File not found in assets
            res.status(404).send('Not Found');
            addLog(`404 Not Found: ${filePath} (${(assetError as Error).message})`);
          }
        } catch (error) {
          addLog(`Error serving static file: ${(error as Error).message}`);
          res.status(500).send('Internal Server Error');
        }
      });

      let postCount = 0;

      httpServer.post('/upload', async (req, res) => {
        postCount++;
        console.log("postCount: ", postCount);

        
        try {
          if (!req.files || Object.keys(req.files).length === 0) {
            console.log("No files were uploaded.");
            return res.status(400).send('No files were uploaded.');
          }

          for (let i = 0; i < req.files.length; i++) {
            console.log("SUCCESSFULLY UPLOADED FILES");
            const file = req.files[i];
            const fileName = file.name;
            const fileData = file.data;
            
            // Create path in document directory
            const documentDir = FileSystem.documentDirectory;
            const uploadDir = `${documentDir}`;
            
            // Ensure upload directory exists
            const dirInfo = await FileSystem.getInfoAsync(uploadDir);
            if (!dirInfo.exists) {
              await FileSystem.makeDirectoryAsync(uploadDir, { intermediates: true });
            }
            
            // Save file to document directory
            const filePath = `${uploadDir}${fileName}`;
            await FileSystem.writeAsStringAsync(filePath, fileData.toString('base64'), {
              encoding: FileSystem.EncodingType.Base64
            });
            
            addLog(`File uploaded: ${fileName}`);
          }

          res.status(200).send('Files uploaded successfully');
        } catch (error) {
          console.error('Upload error:', error);
          addLog(`Error uploading file: ${(error as Error).message}`);
          res.status(500).send('Error uploading file');
        }
      });

      // Start the server
      httpServer.listen(portNumber, () => {
        addLog(`Server started on http://${ipAddress}:${portNumber}`);
        setIsRunning(true);
        setServer(httpServer);
      });
    } catch (error) {
      addLog(`Error starting server: ${(error as Error).message}`);
    }
  };

  const stopServer = (): void => {
    if (server) {
      server.close(() => {
        addLog('Server stopped');
        setIsRunning(false);
        setServer(null);
      });
    } else {
      addLog('No server is running');
      setIsRunning(false);
    }
  };

  // Helper function to determine content type based on file extension
  const getContentType = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    
    const mimeTypes: Record<string, string> = {
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'txt': 'text/plain',
      'pdf': 'application/pdf',
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogg': 'application/ogg',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'otf': 'font/otf',
      'eot': 'application/vnd.ms-fontobject'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  };

  // Create a fallback HTML content
  const createFallbackHtml = (): string => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Best Media Player</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
            background-color: #f5f5f5;
          }
          h1 { color: #2c3e50; }
          .container {
            background-color: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 800px;
            margin: 0 auto;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Best Media Player</h1>
          <p>Welcome to the Best Media Player server.</p>
          <p>This is a fallback page as the original index.html could not be found.</p>
        </div>
      </body>
      </html>
    `;
  };

  return { isRunning, startServer, stopServer, ipAddress, port, setPort, logs, setLogs };
}