import TcpSocket from 'react-native-tcp-socket';
import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

// HTTP status codes
const STATUS_CODES: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error',
};

// HTTP methods
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

interface DataPart {
  'Content-Disposition': string;
  'Content-Type': string;
  'Content-Length': string;
  Data: Buffer;
}

interface DataParts {
  [key: string]: DataPart;
}

interface File {
  name: string;
  type: string;
  size: number;
  data: Buffer;
}


// Request object
interface Request {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string | Buffer;
  params: Record<string, string>;
  query: Record<string, string>;
  files: File[];
}

// Response object
interface Response {
  statusCode: number;
  headers: Record<string, string>;
  send: (body: string | object) => void;
  json: (body: object) => void;
  status: (code: number) => Response;
  setHeader: (name: string, value: string) => Response;
  stream: (readable: any, options?: { contentType?: string, contentLength?: number }) => void;
  sendFile: (filePath: string) => Promise<void>;
}

// Route handler
type RouteHandler = (req: Request, res: Response) => void;

// Route definition
interface Route {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
}

// HTTP Server class
class HttpServer extends EventEmitter {
  private routes: Route[] = [];
  private server: any = null;
  private port: number = 0;
  private debug = true;

  // Add a maximum buffer size to prevent memory issues
  private readonly MAX_BUFFER_SIZE = 50 * 1024 * 1024; // 50MB limit

  constructor() {
    super();
  }

  private log(...args: any[]) {
    if (this.debug) {
      console.log(...args);
    }
  }

  // Register route handlers for different HTTP methods
  get(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'GET', path, handler });
    return this;
  }

  post(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'POST', path, handler });
    return this;
  }

  put(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'PUT', path, handler });
    return this;
  }

  delete(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'DELETE', path, handler });
    return this;
  }

  // Optimize buffer concatenation
  private appendToBuffer(existing: Buffer, chunk: Buffer): Buffer {
    // Pre-allocate a buffer of the right size to avoid multiple allocations
    const newBuffer = Buffer.alloc(existing.length + chunk.length);
    existing.copy(newBuffer, 0);
    chunk.copy(newBuffer, existing.length);
    return newBuffer;
  }

  private findInBuffer(buffer: Buffer, search: Buffer, start: number = 0): number {
    // For small buffers, use the built-in indexOf
    if (buffer.length < 10000) {
      return buffer.indexOf(search, start);
    }
    
    // For large buffers, use a more efficient search algorithm
    // This is a simplified example - you might want a more sophisticated approach
    const searchLength = search.length;
    const maxIndex = buffer.length - searchLength;
    
    for (let i = start; i <= maxIndex; i += searchLength) {
      // First check just the first byte as a quick filter
      if (buffer[i] === search[0]) {
        // If first byte matches, check the whole sequence
        let matches = true;
        for (let j = 1; j < searchLength; j++) {
          if (buffer[i + j] !== search[j]) {
            matches = false;
            break;
          }
        }
        if (matches) return i;
      }
    }
    
    return -1;
  }

  private splitBuffer(buffer: Buffer, delimiter: Buffer): Buffer[] {
    const parts: Buffer[] = [];
    let start = 0;
    let index: number;

    while ((index = this.findInBuffer(buffer, delimiter, start)) !== -1) {
      parts.push(buffer.slice(start, index));
      start = index + delimiter.length;
    }

    // Push the remaining part after the last delimiter
    if (start < buffer.length) {
      parts.push(buffer.slice(start));
    }

    return parts;
  }

  private joinBuffer(buffer: Buffer[], delimiter: Buffer): Buffer {
    let joinedBuffer = Buffer.from('');
    for (let i = 0; i < buffer.length; i++) {
      joinedBuffer = Buffer.concat([joinedBuffer, buffer[i]]);
      if (i < buffer.length - 1) {
        joinedBuffer = Buffer.concat([joinedBuffer, delimiter]);
      }
    }

    return joinedBuffer;
  }

  private parseBufferRequest(data: Buffer): Request | null {
    const lines = this.splitBuffer(data, Buffer.from('\r\n'));
    const [methodLine, ...headerLines] = lines;

    if (!methodLine) return null;
    
    const [method, url] = methodLine.toString().split(' ');

    if (!method || !url) return null;

    const headers: Record<string, string> = {};
    let bodyStartIndex = 0;

    for (let i = 0; i < headerLines.length; i++) {
      const line = headerLines[i];
      if (line.toString().trim() === '') {
        bodyStartIndex = i + 1;
        break;
      }

      const [key, value] = line.toString().split(': ');
      if (key && value) {
        headers[key.toString().toLowerCase()] = value.toString();
      }
    }

    const body = this.joinBuffer(headerLines.slice(bodyStartIndex), Buffer.from('\r\n'));

    // let files: Record<string, any> = {};
    // if (headers['content-type'] && headers['content-type'].includes('multipart/form-data') && body) {
    //   const dataParts = this.parseBufferRequestBody(body);
    //   if (dataParts) {
    //     files = this.filesFromDataParts(dataParts);
    //   }
    // }

    const [path, queryString] = (url || '').split('?');
    const query: Record<string, string> = {};

    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key) {
          query[key] = value || '';
        }
      });
    }

    const params: Record<string, string> = {};

    return {
      method: method as HttpMethod,
      url,
      headers,
      body,
      params,
      query,
      files: []
    };
  }

  private parseBufferRequestBody(body: Buffer, dataParts: DataParts): DataParts | null {
    // Split the body by \r\n to separate the lines
    const lines = this.splitBuffer(body, Buffer.from('\r\n'));
    
    let boundary = '';
    dataParts = dataParts || {};
    for (let i = 0; i < lines.length; i++) {
      // this.log("LINE: ", lines[i].toString());
      if (lines[i].toString().includes('------WebKitFormBoundary')) {
        if (!boundary) {
          boundary = lines[i].toString().split('------WebKitFormBoundary')[1].trim();
          dataParts[boundary] = {
            'Content-Disposition': '',
            'Content-Type': '',
            'Content-Length': '',
            'Data': Buffer.from('')
          };
        }
      } else {
        if (lines[i].toString().includes('Content-Disposition: form-data')) {
          dataParts[boundary]['Content-Disposition'] = lines[i].toString().split('Content-Disposition: ')[1];
        }
        else if (lines[i].toString().includes('Content-Type:')) {
          dataParts[boundary]['Content-Type'] = lines[i].toString().split('Content-Type: ')[1];
        }
        else if (lines[i].toString().includes('Content-Length:')) {
          dataParts[boundary]['Content-Length'] = lines[i].toString().split('Content-Length: ')[1];
        }
        else {
          if (dataParts[boundary]['Data']) {
            dataParts[boundary]['Data'] = Buffer.concat([dataParts[boundary]['Data'], lines[i]]);
          }
          else {
            dataParts[boundary]['Data'] = lines[i];
          }
        }
      }
    }

    this.log("BOUNDARY: ", boundary);

    return dataParts;
  }

  private filesFromDataParts(dataParts: DataParts): File[] {
    const files: File[] = [];
    for (let i in dataParts) {
      this.log(dataParts[i]['Content-Disposition']);
      this.log(dataParts[i]['Content-Type']);
      this.log(dataParts[i]['Data'].length);
      const file: File = {
        name: '',
        type: '',
        size: 0,
        data: Buffer.from('')
      };
      const contentDisposition = dataParts[i]['Content-Disposition'] || '';
      const contentType = dataParts[i]['Content-Type'] || '';
      const data = dataParts[i]['Data'] || Buffer.from('');
      const nameMatch = contentDisposition.match(/name="([^"]+)"/);
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      if (nameMatch && filenameMatch) {
        file.name = filenameMatch[1];
        file.type = contentType;
        file.size = data.length || 0;
        file.data = data;
      }
      files.push(file);
    }
    return files;
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4',
      // Add more as needed
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // Match route
  private matchRoute(req: Request): Route | null {
    return this.routes.find(route => 
      route.method === req.method && 
      (route.path === req.url || route.path === req.url.split('?')[0])
    ) || null;
  }

  // Create response object
  private createResponse(socket: any): Response {
    const res: Response = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Connection': 'close',
      },
      send: (body) => {
        const content = typeof body === 'string' ? body : JSON.stringify(body);
        res.headers['Content-Length'] = String(Buffer.byteLength(content));
        
        let responseText = `HTTP/1.1 ${res.statusCode} ${STATUS_CODES[res.statusCode] || 'Unknown'}\r\n`;
        
        Object.entries(res.headers).forEach(([key, value]) => {
          responseText += `${key}: ${value}\r\n`;
        });
        
        responseText += '\r\n' + content;
        
        socket.write(responseText);
        socket.end();
        return res;
      },
      json: (body) => {
        res.headers['Content-Type'] = 'application/json';
        return res.send(JSON.stringify(body));
      },
      status: (code) => {
        res.statusCode = code;
        return res;
      },
      setHeader: (name, value) => {
        res.headers[name] = value;
        return res;
      },
      stream: (readable, options = {}) => {
        // Set content type if provided
        if (options.contentType) {
          res.headers['Content-Type'] = options.contentType;
        }
        
        // Set content length if provided
        if (options.contentLength) {
          res.headers['Content-Length'] = String(options.contentLength);
        }
        
        // Write headers first
        let headerText = `HTTP/1.1 ${res.statusCode} ${STATUS_CODES[res.statusCode] || 'Unknown'}\r\n`;
        
        Object.entries(res.headers).forEach(([key, value]) => {
          headerText += `${key}: ${value}\r\n`;
        });
        
        headerText += '\r\n';
        socket.write(headerText);
        
        // Handle different types of readables
        if (typeof readable.on === 'function') {
          // Event-based readable (like Node.js streams)
          readable.on('data', (chunk: Buffer | string) => {
            const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
            socket.write(buffer);
          });
          
          readable.on('end', () => {
            socket.end();
          });
          
          readable.on('error', (err: Error) => {
            this.log('Stream error:', err);
            socket.end();
          });
        } else if (typeof readable.then === 'function') {
          // Promise-based readable
          readable
            .then((data: Buffer | string) => {
              const buffer = typeof data === 'string' ? Buffer.from(data) : data;
              socket.write(buffer);
              socket.end();
            })
            .catch((err: Error) => {
              this.log('Stream error:', err);
              socket.end();
            });
        } else if (readable instanceof Buffer || typeof readable === 'string') {
          // Direct buffer or string
          const buffer = typeof readable === 'string' ? Buffer.from(readable) : readable;
          socket.write(buffer);
          socket.end();
        } else {
          // Unknown type
          socket.end();
          throw new Error('Unsupported readable type');
        }
      },
      sendFile: async (filePath: string) => {
        try {
          // This would depend on your file system access method
          // For React Native, you might use FileSystem from expo-file-system
          // For simplicity, I'll assume a readFile function that returns a Promise<Buffer>
          const fileSystem = require('expo-file-system');
          const fileInfo = await fileSystem.getInfoAsync(filePath);
          
          if (!fileInfo.exists) {
            res.status(404).send('File not found');
            return;
          }
          
          // Set content type based on file extension
          const contentType = this.getMimeType(filePath);
          res.setHeader('Content-Type', contentType);
          
          // Set content length if available
          if (fileInfo.size) {
            res.setHeader('Content-Length', String(fileInfo.size));
          }
          
          // For small files, read all at once
          if (!fileInfo.size || fileInfo.size < 1024 * 1024) { // Less than 1MB
            const content = await fileSystem.readAsStringAsync(filePath, { encoding: fileSystem.EncodingType.Base64 });
            const buffer = Buffer.from(content, 'base64');
            res.send(buffer);
            return;
          }
          
          // For larger files, we need to stream
          // Write headers first
          let headerText = `HTTP/1.1 ${res.statusCode} ${STATUS_CODES[res.statusCode] || 'Unknown'}\r\n`;
          
          Object.entries(res.headers).forEach(([key, value]) => {
            headerText += `${key}: ${value}\r\n`;
          });
          
          headerText += '\r\n';
          socket.write(headerText);
          
          // Read and send file in chunks
          // Note: This is a simplified example - actual implementation would depend on
          // what file reading capabilities are available in your environment
          const CHUNK_SIZE = 64 * 1024; // 64KB chunks
          let position = 0;
          
          while (position < fileInfo.size) {
            const length = Math.min(CHUNK_SIZE, fileInfo.size - position);
            // Read a chunk of the file
            // This is pseudo-code - you'll need to adapt to your file system API
            const chunk = await fileSystem.readAsStringAsync(filePath, {
              encoding: fileSystem.EncodingType.Base64,
              position,
              length
            });
            
            const buffer = Buffer.from(chunk, 'base64');
            socket.write(buffer);
            
            position += length;
          }
          
          socket.end();
        } catch (error) {
          this.log('Error sending file:', error);
          res.status(500).send('Error sending file');
        }
      }
    };
    
    return res;
  }

  // Add a new method for streaming multipart form data
  private streamMultipartFormData(req: Request, socket: any, callback: (req: Request) => void): void {
    if (!req.headers['content-type']?.includes('multipart/form-data')) {
      callback(req);
      return;
    }

    // Extract boundary from content-type header
    this.log("CONTENT TYPE: ", req.headers['content-type']);
    const boundaryMatch = req.headers['content-type'].match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
      this.log("NO BOUNDARY MATCH");
      callback(req);
      return;
    }
    
    const boundary = `${boundaryMatch[1] || boundaryMatch[2]}`;
    const endBoundary = `${boundary}--`;

    this.log("BOUNDARY: ", boundary);
    this.log("END BOUNDARY: ", endBoundary);
    
    // Initialize state for streaming parser
    const files: File[] = [];
    let currentFile: {
      headers: Record<string, string>;
      name: string;
      type: string;
      data: Buffer[];
      size: number;
    } | null = null;
    
    let buffer = Buffer.from([]);
    let state: 'boundary' | 'headers' | 'content' = 'boundary';
    let headerText = '';
    
    // Function to process a chunk of data
    const processChunk = (chunk: Buffer): void => {
      this.log("PROCESSING CHUNK");
      buffer = Buffer.concat([buffer, chunk]);
      
      // Process buffer until we can't make progress
      let madeProgress = true;
      while (madeProgress) {
        madeProgress = false;
        
        if (state === 'boundary') {
          this.log("BUFFER IN BOUNDARY STATE: ", buffer.length);
          const boundaryIndex = buffer.indexOf(Buffer.from(boundary));
          if (boundaryIndex !== -1) {
            // Found a boundary, move past it
            buffer = buffer.slice(boundaryIndex + boundary.length);
            state = 'headers';
            headerText = '';
            madeProgress = true;
          }
        } else if (state === 'headers') {
          const headersEndIndex = buffer.indexOf(Buffer.from('\r\n\r\n'));
          if (headersEndIndex !== -1) {
            // Extract headers
            headerText += buffer.slice(0, headersEndIndex).toString();
            buffer = buffer.slice(headersEndIndex + 4); // +4 for \r\n\r\n
            
            // Parse headers
            const headers: Record<string, string> = {};
            headerText.split('\r\n').forEach(line => {
              const colonIndex = line.indexOf(':');
              if (colonIndex !== -1) {
                const key = line.slice(0, colonIndex).trim().toLowerCase();
                const value = line.slice(colonIndex + 1).trim();
                headers[key] = value;
              }
            });
            
            // Check if this is a file part
            const contentDisposition = headers['content-disposition'] || '';
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
            const nameMatch = contentDisposition.match(/name="([^"]+)"/);

            this.log("FILENAME MATCH: ", filenameMatch[1]);
            this.log("NAME MATCH: ", nameMatch[1]); 
            this.log("CONTENT DISPOSITION: ", contentDisposition);
            this.log("CONTENT TYPE: ", headers['content-type']);
            
            if (filenameMatch && nameMatch) {
              // This is a file part
              currentFile = {
                headers,
                name: filenameMatch[1],
                type: headers['content-type'] || '',
                data: [],
                size: 0
              };
            } else {
              // Not a file part, skip
              currentFile = null;
            }
            
            state = 'content';
            this.log("STATE: ", state);
            madeProgress = true;
          }
        } else if (state === 'content') {
          // Look for the next boundary
          this.log("IN THE CONTENT STATE");
          
          // Try different boundary formats
          const possibleBoundaries = [
            `\r\n--${boundary}`, // Standard format with CRLF
            `\n--${boundary}`,   // LF only
            `--${boundary}`,     // No line ending
            `\r\n${boundary}`,   // Your current format
            `\n${boundary}`      // Alternative format
          ];
          
          let boundaryIndex = -1;
          let matchedBoundary = '';
          
          // Try each possible boundary format
          for (const possibleBoundary of possibleBoundaries) {
            const index = buffer.indexOf(Buffer.from(possibleBoundary));
            if (index !== -1) {
              boundaryIndex = index;
              matchedBoundary = possibleBoundary;
              break;
            }
          }
          
          this.log("BOUNDARY INDEX: ", boundaryIndex);
          if (boundaryIndex !== -1) {
            this.log("MATCHED BOUNDARY: ", matchedBoundary);
          }
          
          // Also check for end boundary
          const possibleEndBoundaries = [
            `\r\n--${boundary}--`, // Standard format with CRLF
            `\n--${boundary}--`,   // LF only
            `--${boundary}--`,     // No line ending
            `\r\n${boundary}--`,   // Your current format
            `\n${boundary}--`      // Alternative format
          ];
          
          let endBoundaryIndex = -1;
          let matchedEndBoundary = '';
          
          // Try each possible end boundary format
          for (const possibleEndBoundary of possibleEndBoundaries) {
            const index = buffer.indexOf(Buffer.from(possibleEndBoundary));
            if (index !== -1) {
              endBoundaryIndex = index;
              matchedEndBoundary = possibleEndBoundary;
              break;
            }
          }
          
          this.log("END BOUNDARY INDEX: ", endBoundaryIndex);
          if (endBoundaryIndex !== -1) {
            this.log("MATCHED END BOUNDARY: ", matchedEndBoundary);
          }
          
          // Process the content based on boundary detection
          if (boundaryIndex !== -1 || endBoundaryIndex !== -1) {
            // We found the end of this part
            const endIndex = (endBoundaryIndex !== -1) ? endBoundaryIndex : boundaryIndex;
            
            if (currentFile) {
              // Add the content to the current file
              const content = buffer.slice(0, endIndex);
              currentFile.data.push(content);
              currentFile.size += content.length;
              
              this.log("ADDING FILE: ", currentFile.name, " SIZE: ", currentFile.size);
              
              // Create a file object and add it to files
              files.push({
                name: currentFile.name,
                type: currentFile.type,
                size: currentFile.size,
                data: Buffer.concat(currentFile.data)
              });
            }
            
            // Move past this boundary
            if (endBoundaryIndex !== -1) {
              // We're done processing
              this.log("FOUND END BOUNDARY");
              this.log("FILES COUNT: ", files.length);
              req.files = files;
              callback(req);
              return;
            } else {
              // Move to next part
              buffer = buffer.slice(endIndex + matchedBoundary.length);
              state = 'headers';
              headerText = '';
              madeProgress = true;
            }
          } else if (buffer.length > 1024 * 1024) { // 1MB chunk size
            // Buffer is getting large, process a chunk
            if (currentFile) {
              // Keep the last 200 bytes in case they contain part of the boundary
              const safeLength = Math.max(0, buffer.length - 200);
              const chunk = buffer.slice(0, safeLength);
              currentFile.data.push(chunk);
              currentFile.size += chunk.length;
              buffer = buffer.slice(safeLength);
              this.log("PROCESSED CHUNK FOR FILE: ", currentFile.name, " TOTAL SIZE: ", currentFile.size);
            } else {
              // Not a file part, discard
              buffer = buffer.slice(buffer.length);
            }
            madeProgress = true;
          }
        }
      }
    };
    
    // Set up data handler for socket
    socket.on('data', (chunk: Buffer) => {
      try {
        this.log("IN SOCKET DATA");
        processChunk(chunk);
      } catch (error) {
        this.log('Error processing multipart data:', error);
        req.files = files; // Use what we've got so far
        callback(req);
      }
    });
    
    // Handle end of data
    socket.on('end', () => {
      req.files = files;
      callback(req);
    });
  }

  // Start the server
  listen(port: number, callback?: () => void) {
    this.port = port;
    
    this.server = TcpSocket.createServer((socket) => {
      socket.setTimeout(30000); // 30 seconds timeout

      socket.on('timeout', () => {
        this.log('Socket timeout');
        socket.end();
      });

      let buffer = Buffer.from([])
      let body = Buffer.from([])
      let req: Request | null = null;
      let dataParts: DataParts = {};
      let contentLength = 0;
      
      socket.on('data', (chunk: string | Buffer) => {
        this.log("IN SOCKET DATA 2");
        const chunkBuffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        
        // Check buffer size before appending
        if (buffer.length + chunkBuffer.length > this.MAX_BUFFER_SIZE) {
          socket.write('HTTP/1.1 413 Payload Too Large\r\n\r\n');
          socket.end();
          return;
        }
        
        this.log("BUFFER IN SOCKET DATA 2: ", buffer.length);
        buffer = this.appendToBuffer(buffer, chunkBuffer);

        // If we haven't parsed the request yet
        if (!req && buffer.includes(Buffer.from('\r\n\r\n'))) {
          req = this.parseBufferRequest(buffer);
          
          if (!req) {
            socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
            socket.end();
            return;
          }
          
          // Check if this is a multipart form data request
          if (req.headers['content-type']?.includes('multipart/form-data')) {
            // Handle streaming for multipart form data
            this.streamMultipartFormData(req, socket, (updatedReq) => {
              // This callback is called when streaming is complete
              const res = this.createResponse(socket);
              const route = this.matchRoute(updatedReq);
              
              if (route) {
                try {
                  route.handler(updatedReq, res);
                } catch (error) {
                  this.log('Error handling request:', error);
                  res.status(500).send('Internal Server Error');
                }
              } else {
                res.status(404).send('Not Found');
              }
            });
            
            // Reset buffer since we're now handling streaming
            buffer = Buffer.from([]);
          } else {
            // For non-multipart requests, handle normally
            const res = this.createResponse(socket);
            const route = this.matchRoute(req);
            
            if (route) {
              try {
                route.handler(req, res);
              } catch (error) {
                this.log('Error handling request:', error);
                res.status(500).send('Internal Server Error');
              }
            } else {
              res.status(404).send('Not Found');
            }
            
            // Reset for next request
            buffer = Buffer.from([]);
            req = null;
          }
        }
      });

      socket.on('close', () => {
        this.log('Socket closed');
      });
      
      socket.on('error', (error) => {
        this.log('Socket error:', error);
        this.emit('error', error);
      });
    });
    
    this.server.listen({ port, host: '0.0.0.0' }, () => {
      if (callback) callback();
    });
    
    return this;
  }

  // Close the server
  close(callback?: () => void) {
    if (this.server) {
      this.server.close(() => {
        if (callback) callback();
      });
    }
    
    return this;
  }
}

// Create server function (similar to Express)
export function createServer(): HttpServer {
  return new HttpServer();
}
