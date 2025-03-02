import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  ScrollView,
  TextInput,
  Switch,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as Network from "expo-network";
import TcpSocket from "react-native-tcp-socket";
import { Buffer } from "buffer";
import { AddressInfo } from "net";

// Use the actual TcpSocket types
type TcpSocketType = ReturnType<typeof TcpSocket.createServer>;
type TcpSocketConnection = Parameters<
  Parameters<typeof TcpSocket.createServer>[0]
>[0];

interface HttpRequest {
  method: string;
  path: string;
  httpVersion: string;
  headers: Record<string, string>;
}

interface HttpResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | Buffer;
}

interface FileStats {
  name: string;
  path: string;
  size: number;
  isDirectory: () => boolean;
  mtime: Date;
}

export default function HttpServerScreen(): JSX.Element {
  const [server, setServer] = useState<TcpSocketType | null>(null);
  const [ipAddress, setIpAddress] = useState<string>("");
  const [port, setPort] = useState<string>("8080");
  const [status, setStatus] = useState<string>("Server not running");
  const [logs, setLogs] = useState<string[]>([]);
  const [serveDirectory, setServeDirectory] = useState<string>(
    FileSystem.documentDirectory || ""
  );
  const [allowDirectoryListing, setAllowDirectoryListing] =
    useState<boolean>(true);

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

  const createTestHtmlFile = async (): Promise<void> => {
    try {
      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Page</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
          }
          h1 { color: #333; }
          p { color: #666; }
        </style>
      </head>
      <body>
        <h1>HTTP Server Test Page</h1>
        <p>This is a test page served from your mobile device.</p>
        <p>Server is running successfully!</p>
      </body>
      </html>
      `;

      const filePath = `${serveDirectory}/index.html`;
      await FileSystem.writeAsStringAsync(filePath, htmlContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      addLog(`Created test HTML file at: ${filePath}`);
    } catch (error) {
      addLog(`Error creating test file: ${(error as Error).message}`);
    }
  };

  const createCustomHtmlPage = async (): Promise<void> => {
    try {
      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>My Custom Page</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            background-color: #f0f0f0;
            padding: 20px;
          }
          h1 { color: #2c3e50; }
          .container {
            background-color: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Welcome to My Custom Page</h1>
          <p>This is a custom HTML page served from your React Native app.</p>
          <p>You can add any HTML, CSS, and even JavaScript here!</p>
          <button onclick="alert('Hello from JavaScript!')">Click Me</button>
        </div>
      </body>
      </html>
      `;

      const filePath = `${FileSystem.documentDirectory}/custom.html`;
      await FileSystem.writeAsStringAsync(filePath, htmlContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      addLog(`Created custom HTML file at: ${filePath}`);
    } catch (error) {
      addLog(`Error creating custom file: ${(error as Error).message}`);
    }
  };

  const addLog = (message: string): void => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prevLogs) => [`[${timestamp}] ${message}`, ...prevLogs]);
  };

  const parseHttpRequest = (data: string): HttpRequest | null => {
    try {
      const lines = data.split("\r\n");
      const requestLine = lines[0].split(" ");

      if (requestLine.length < 3) {
        return null;
      }

      const method = requestLine[0];
      const path = requestLine[1];
      const httpVersion = requestLine[2];

      const headers: Record<string, string> = {};
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) break;

        const [key, value] = lines[i].split(": ");
        if (key && value) {
          headers[key.toLowerCase()] = value;
        }
      }

      return { method, path, httpVersion, headers };
    } catch (error) {
      addLog(`Error parsing HTTP request: ${(error as Error).message}`);
      return null;
    }
  };

  const createHttpResponse = (
    statusCode: number,
    statusText: string,
    headers: Record<string, string>,
    body: string | Buffer
  ): string | Buffer => {
    let responseHeaders = "";
    for (const [key, value] of Object.entries(headers)) {
      responseHeaders += `${key}: ${value}\r\n`;
    }

    if (typeof body === "string") {
      const responseHead = `HTTP/1.1 ${statusCode} ${statusText}\r\n${responseHeaders}\r\n`;
      return responseHead + body;
    } else {
      // For binary data
      const responseHead = Buffer.from(
        `HTTP/1.1 ${statusCode} ${statusText}\r\n${responseHeaders}\r\n`
      );
      return Buffer.concat([responseHead, body]);
    }
  };

  const getMimeType = (filePath: string): string => {
    const extension = filePath.split(".").pop()?.toLowerCase() || "";

    const mimeTypes: Record<string, string> = {
      html: "text/html",
      htm: "text/html",
      css: "text/css",
      js: "application/javascript",
      json: "application/json",
      txt: "text/plain",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      mp3: "audio/mpeg",
      mp4: "video/mp4",
      webm: "video/webm",
      pdf: "application/pdf",
    };

    return mimeTypes[extension] || "application/octet-stream";
  };

  const generateDirectoryListing = async (
    dirPath: string,
    requestPath: string
  ): Promise<string> => {
    try {
      const fileList = await FileSystem.readDirectoryAsync(dirPath);
      const filePromises = fileList.map(async (fileName) => {
        const filePath = `${dirPath}/${fileName}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        return {
          name: fileName,
          path: filePath,
          size: fileInfo.exists ? (fileInfo as any).size || 0 : 0,
          isDirectory: () => fileInfo.isDirectory || false,
          mtime: new Date(
            fileInfo.exists
              ? (fileInfo as any).modificationTime || Date.now()
              : Date.now()
          ),
        };
      });

      const files = await Promise.all(filePromises);

      let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Directory Listing: ${requestPath}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
          }
          h1 { color: #333; margin-bottom: 20px; }
          .directory-list {
            list-style: none;
            padding: 0;
          }
          .directory-list li {
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .directory-list a {
            text-decoration: none;
            color: #0066cc;
            display: block;
          }
          .directory-list a:hover {
            text-decoration: underline;
          }
          .file-info {
            color: #666;
            font-size: 0.9em;
            margin-left: 10px;
          }
          .directory-icon:before {
            content: "📁";
            margin-right: 5px;
          }
          .file-icon:before {
            content: "📄";
            margin-right: 5px;
          }
        </style>
      </head>
      <body>
        <h1>Directory Listing: ${requestPath}</h1>
        <ul class="directory-list">
      `;

      // Add parent directory link if not at root
      if (requestPath !== "/") {
        const parentPath = requestPath.split("/").slice(0, -1).join("/") || "/";
        html += `<li><a href="${parentPath}" class="directory-icon">Parent Directory</a></li>`;
      }

      // Sort directories first, then files
      const sortedFiles = [...files].sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const file of sortedFiles) {
        const isDir = file.isDirectory();
        const fileSize = isDir ? "-" : formatFileSize(file.size);
        const modDate = new Date(file.mtime).toLocaleString();
        const linkPath = `${requestPath}${
          requestPath.endsWith("/") ? "" : "/"
        }${file.name}${isDir ? "/" : ""}`;

        html += `
          <li>
            <a href="${linkPath}" class="${
          isDir ? "directory-icon" : "file-icon"
        }">
              ${file.name}${isDir ? "/" : ""}
              <span class="file-info">${fileSize} - ${modDate}</span>
            </a>
          </li>
        `;
      }

      html += `
        </ul>
      </body>
      </html>
      `;

      return html;
    } catch (error) {
      addLog(`Error generating directory listing: ${(error as Error).message}`);
      return `<html><body><h1>Error</h1><p>Could not list directory: ${
        (error as Error).message
      }</p></body></html>`;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleHttpRequest = async (
    socket: TcpSocketConnection,
    request: HttpRequest
  ): Promise<void> => {
    try {
      // Decode URL path
      let path = decodeURIComponent(request.path);

      // Normalize path to prevent directory traversal
      path = path.replace(/\.\.\//g, "").replace(/\/+/g, "/");

      // Map URL path to file system path
      let filePath = `${serveDirectory}${path}`;

      // Check if path exists
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        // Return 404 Not Found
        const notFoundHtml = `
        <html>
          <body>
            <h1>404 Not Found</h1>
            <p>The requested resource was not found on this server.</p>
          </body>
        </html>
        `;

        const response = createHttpResponse(
          404,
          "Not Found",
          {
            "Content-Type": "text/html",
            "Content-Length": String(notFoundHtml.length),
          },
          notFoundHtml
        );

        socket.write(response);
        socket.end();
        return;
      }

      // Check if it's a directory
      if (fileInfo.isDirectory) {
        // Check for index.html in directory
        const indexPath = `${filePath}${
          filePath.endsWith("/") ? "" : "/"
        }index.html`;
        const indexInfo = await FileSystem.getInfoAsync(indexPath);

        if (indexInfo.exists) {
          // Serve index.html
          filePath = indexPath;
        } else if (allowDirectoryListing) {
          // Generate directory listing
          const listing = await generateDirectoryListing(filePath, path);

          const response = createHttpResponse(
            200,
            "OK",
            {
              "Content-Type": "text/html",
              "Content-Length": String(listing.length),
            },
            listing
          );

          socket.write(response);
          socket.end();
          return;
        } else {
          // Directory listing not allowed
          const forbiddenHtml = `
          <html>
            <body>
              <h1>403 Forbidden</h1>
              <p>Directory listing is not allowed.</p>
            </body>
          </html>
          `;

          const response = createHttpResponse(
            403,
            "Forbidden",
            {
              "Content-Type": "text/html",
              "Content-Length": String(forbiddenHtml.length),
            },
            forbiddenHtml
          );

          socket.write(response);
          socket.end();
          return;
        }
      }

      // Serve the file
      try {
        const mimeType = getMimeType(filePath);
        const isText =
          mimeType.startsWith("text/") ||
          mimeType === "application/javascript" ||
          mimeType === "application/json";

        // Read file content
        const content = await FileSystem.readAsStringAsync(filePath, {
          encoding: isText
            ? FileSystem.EncodingType.UTF8
            : FileSystem.EncodingType.Base64,
        });

        // Convert base64 to buffer for binary files
        const fileContent = isText ? content : Buffer.from(content, "base64");

        // Create response
        const contentLength = isText
          ? Buffer.byteLength(content)
          : fileContent.length;

        const response = createHttpResponse(
          200,
          "OK",
          {
            "Content-Type": mimeType,
            "Content-Length": String(contentLength),
            "Cache-Control": "max-age=3600",
          },
          fileContent
        );

        socket.write(response);
        addLog(`Served file: ${filePath} (${mimeType})`);
        socket.end();
      } catch (error) {
        // Server error
        const errorHtml = `
        <html>
          <body>
            <h1>500 Internal Server Error</h1>
            <p>Error reading file: ${(error as Error).message}</p>
          </body>
        </html>
        `;

        const response = createHttpResponse(
          500,
          "Internal Server Error",
          {
            "Content-Type": "text/html",
            "Content-Length": String(errorHtml.length),
          },
          errorHtml
        );

        socket.write(response);
        addLog(`Error serving file: ${(error as Error).message}`);
        socket.end();
      }
    } catch (error) {
      addLog(`Error handling request: ${(error as Error).message}`);
      socket.end();
    }
  };

  const startServer = (): void => {
    try {
      // Create a server
      const newServer = TcpSocket.createServer(
        (socket: TcpSocketConnection) => {
          const addressInfo = socket.address() as AddressInfo;
          addLog(`New client connected: ${addressInfo.address || "unknown"}`);

          // Send an HTML response instead of plain text
          const htmlResponse = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>HTTP Server</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                line-height: 1.6;
                text-align: center;
              }
              h1 { color: #333; }
              p { color: #666; }
            </style>
          </head>
          <body>
            <h1>Welcome to the HTTP Server</h1>
            <p>Your server is running successfully!</p>
          </body>
          </html>
          `;
          
          const response = createHttpResponse(
            200,
            "OK",
            {
              "Content-Type": "text/html",
              "Content-Length": String(Buffer.byteLength(htmlResponse)),
            },
            htmlResponse
          );
          
          socket.write(response);
          addLog("Sent HTML response");

          // Then continue with your normal code...
          let buffer = "";

          socket.on("data", (data) => {
            const chunk = data.toString();
            buffer += chunk;

            // Add this debug log
            addLog(`Received data: ${chunk.substring(0, 100)}...`);

            // Check if we have received a complete HTTP request
            if (buffer.includes("\r\n\r\n")) {
              // Parse the HTTP request
              const request = parseHttpRequest(buffer);

              if (request) {
                addLog(
                  `Received ${request.method} request for ${request.path}`
                );
                handleHttpRequest(socket, request);
              } else {
                // Invalid HTTP request
                addLog("Invalid HTTP request received");
                const response = createHttpResponse(
                  400,
                  "Bad Request",
                  { "Content-Type": "text/plain" },
                  "Invalid HTTP request"
                );

                socket.write(response);
                socket.end();
              }

              // Reset buffer for next request
              buffer = "";
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
        host: "0.0.0.0",
      });

      setServer(newServer);
      setStatus(`Server running on ${ipAddress}:${port}`);
      addLog(`HTTP server started on ${ipAddress}:${port}`);

      // Create a test HTML file
      createTestHtmlFile();
      createCustomHtmlPage();
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>HTTP File Server</Text>

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

        <View style={styles.switchContainer}>
          <Text style={styles.label}>Allow Directory Listing:</Text>
          <Switch
            value={allowDirectoryListing}
            onValueChange={setAllowDirectoryListing}
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={allowDirectoryListing ? "#007AFF" : "#f4f3f4"}
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

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Access the server from a web browser at:
        </Text>
        <Text style={styles.urlText}>
          http://{ipAddress}:{port}/
        </Text>
      </View>

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
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  infoContainer: {
    backgroundColor: "#e8f4ff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  infoText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  urlText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0066cc",
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
});
