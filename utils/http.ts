import TcpSocket from 'react-native-tcp-socket';
import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
import { HTTPParser } from './http-parser';
import * as FileSystem from 'expo-file-system';

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
  body: string | Buffer | Record<string, any>;
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

// Parse HTTP request using HTTPParser
function parseRequest(input: Buffer): any {
  const parser = new HTTPParser(HTTPParser.REQUEST);
  let complete = false;
  let shouldKeepAlive;
  let upgrade;
  let method;
  let url;
  let versionMajor;
  let versionMinor;
  let headers: string[] = [];
  let trailers: string[] = [];
  let bodyChunks: Buffer[] = [];

  parser[HTTPParser.kOnHeadersComplete] = function (req) {
    shouldKeepAlive = req.shouldKeepAlive;
    upgrade = req.upgrade;
    method = HTTPParser.methods[req.method];
    url = req.url;
    versionMajor = req.versionMajor;
    versionMinor = req.versionMinor;
    headers = req.headers;
  };

  parser[HTTPParser.kOnBody] = function (chunk, offset, length) {
    bodyChunks.push(chunk.slice(offset, offset + length));
  };

  parser[HTTPParser.kOnHeaders] = function (t) {
    trailers = t;
  };

  parser[HTTPParser.kOnMessageComplete] = function () {
    complete = true;
  };

  parser.execute(input);
  parser.finish();

  if (!complete) {
    throw new Error('Could not parse request');
  }

  let body = Buffer.concat(bodyChunks);

  return {
    shouldKeepAlive,
    upgrade,
    method,
    url,
    versionMajor,
    versionMinor,
    headers,
    body,
    trailers,
  };
}

// Parse HTTP response using HTTPParser
function parseResponse(input: Buffer): any {
  const parser = new HTTPParser(HTTPParser.RESPONSE);
  let complete = false;
  let shouldKeepAlive;
  let upgrade;
  let statusCode;
  let statusMessage;
  let versionMajor;
  let versionMinor;
  let headers: string[] = [];
  let trailers: string[] = [];
  let bodyChunks: Buffer[] = [];

  parser[HTTPParser.kOnHeadersComplete] = function (res) {
    shouldKeepAlive = res.shouldKeepAlive;
    upgrade = res.upgrade;
    statusCode = res.statusCode;
    statusMessage = res.statusMessage;
    versionMajor = res.versionMajor;
    versionMinor = res.versionMinor;
    headers = res.headers;
  };

  parser[HTTPParser.kOnBody] = function (chunk, offset, length) {
    bodyChunks.push(chunk.slice(offset, offset + length));
  };

  parser[HTTPParser.kOnHeaders] = function (t) {
    trailers = t;
  };

  parser[HTTPParser.kOnMessageComplete] = function () {
    complete = true;
  };

  parser.execute(input);
  parser.finish();

  if (!complete) {
    throw new Error('Could not parse response');
  }

  let body = Buffer.concat(bodyChunks);

  return {
    shouldKeepAlive,
    upgrade,
    statusCode,
    statusMessage,
    versionMajor,
    versionMinor,
    headers,
    body,
    trailers,
  };
}

// Convert array of headers to a Record object
function headersArrayToObject(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < headers.length; i += 2) {
    const key = headers[i].toLowerCase();
    const value = headers[i + 1];
    result[key] = value;
  }
  return result;
}

// Parse URL query parameters
function parseQueryParams(url: string): Record<string, string> {
  const queryParams: Record<string, string> = {};
  const queryString = url.split('?')[1];
  
  if (queryString) {
    const pairs = queryString.split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        queryParams[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    }
  }
  
  return queryParams;
}

// Parse multipart/form-data content
async function parseMultipartFormData(body: Buffer, contentType: string): Promise<{ fields: Record<string, string>, files: File[] }> {
  const boundary = contentType.split('boundary=')[1]?.trim();
  if (!boundary) {
    throw new Error('No boundary found in multipart/form-data content type');
  }

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundaryBuffer = Buffer.from(`--${boundary}--`);
  const crlfBuffer = Buffer.from('\r\n');
  const doubleCrlfBuffer = Buffer.from('\r\n\r\n');

  const parts: Buffer[] = [];
  let start = 0;
  let end = 0;

  // Find the first boundary
  start = body.indexOf(boundaryBuffer, 0);
  if (start === -1) {
    throw new Error('Invalid multipart/form-data: no boundary found');
  }

  // Skip the first boundary
  start += boundaryBuffer.length;

  // Find subsequent boundaries and extract parts
  while (start < body.length) {
    // Skip CRLF after boundary
    if (body.slice(start, start + 2).toString() === '\r\n') {
      start += 2;
    }

    // Find the next boundary
    end = body.indexOf(boundaryBuffer, start);
    if (end === -1) {
      // Check for end boundary
      end = body.indexOf(endBoundaryBuffer, start);
      if (end === -1) {
        // If no end boundary, use the end of the buffer
        end = body.length;
      }
    }

    // Extract the part (headers + body)
    const part = body.slice(start, end - 2); // -2 to remove trailing CRLF
    if (part.length > 0) {
      parts.push(part);
    }

    // Move to the next part
    start = end + boundaryBuffer.length;
  }

  // Process each part
  const fields: Record<string, string> = {};
  const files: File[] = [];

  for (const part of parts) {
    // Find the separator between headers and content
    const headerEndIndex = part.indexOf(doubleCrlfBuffer);
    if (headerEndIndex === -1) continue;

    // Extract and parse headers
    const headersBuffer = part.slice(0, headerEndIndex);
    const headersText = headersBuffer.toString();
    const headers: Record<string, string> = {};

    headersText.split('\r\n').forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim().toLowerCase();
        const value = line.slice(colonIndex + 1).trim();
        headers[key] = value;
      }
    });

    // Extract content
    const content = part.slice(headerEndIndex + doubleCrlfBuffer.length);

    // Check if this part is a file
    const contentDisposition = headers['content-disposition'] || '';
    const nameMatch = contentDisposition.match(/name="([^"]+)"/);
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
    
    const name = nameMatch ? nameMatch[1] : '';
    
    if (filenameMatch && name) {
      // This is a file
      const filename = filenameMatch[1];
      const contentType = headers['content-type'] || 'application/octet-stream';
      
      files.push({
        name: filename,
        type: contentType,
        size: content.length,
        data: content
      });
    } else if (name) {
      // This is a regular field
      fields[name] = content.toString();
    }
  }

  return { fields, files };
}

// Save uploaded file to temporary directory
async function saveUploadedFile(file: File): Promise<string> {
  try {
    // Create a temporary directory if it doesn't exist
    const tempDir = FileSystem.cacheDirectory + 'uploads/';
    const dirInfo = await FileSystem.getInfoAsync(tempDir);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
    }
    
    // Generate a unique filename
    const timestamp = new Date().getTime();
    const randomString = Math.random().toString(36).substring(2, 10);
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const tempFilePath = `${tempDir}${timestamp}_${randomString}_${safeFilename}`;
    
    // Write the file data
    await FileSystem.writeAsStringAsync(
      tempFilePath,
      file.data.toString('base64'),
      { encoding: FileSystem.EncodingType.Base64 }
    );
    
    return tempFilePath;
  } catch (error) {
    console.error('Error saving uploaded file:', error);
    throw new Error('Failed to save uploaded file');
  }
}

// HTTP Server class
class HttpServer extends EventEmitter {
  private routes: Route[] = [];
  private server: any = null;
  private port: number = 0;
  private debug = true;

  // Add a maximum buffer size to prevent memory issues
  private readonly MAX_BUFFER_SIZE = 50 * 1024 * 1024; // 50MB limit

  // Improved route matching with method-based indexing for faster lookups
  private routesByMethod: Record<HttpMethod, Route[]> = {
    'GET': [],
    'POST': [],
    'PUT': [],
    'DELETE': [],
    'PATCH': [],
    'OPTIONS': [],
    'HEAD': []
  };

  constructor(options: { debug?: boolean } = {}) {
    super();
    this.debug = options.debug !== undefined ? options.debug : false;
  }

  private log(...args: any[]) {
    if (this.debug) {
      console.log('[HttpServer]', ...args);
    }
  }

  // Register route handlers for different HTTP methods with improved indexing
  get(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'GET', path, handler });
    this.routesByMethod['GET'].push({ method: 'GET', path, handler });
    return this;
  }

  post(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'POST', path, handler });
    this.routesByMethod['POST'].push({ method: 'POST', path, handler });
    return this;
  }

  put(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'PUT', path, handler });
    this.routesByMethod['PUT'].push({ method: 'PUT', path, handler });
    return this;
  }

  delete(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'DELETE', path, handler });
    this.routesByMethod['DELETE'].push({ method: 'DELETE', path, handler });
    return this;
  }

  patch(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'PATCH', path, handler });
    this.routesByMethod['PATCH'].push({ method: 'PATCH', path, handler });
    return this;
  }

  options(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'OPTIONS', path, handler });
    this.routesByMethod['OPTIONS'].push({ method: 'OPTIONS', path, handler });
    return this;
  }

  head(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'HEAD', path, handler });
    this.routesByMethod['HEAD'].push({ method: 'HEAD', path, handler });
    return this;
  }

  // Optimize buffer concatenation
  private appendToBuffer(existing: Buffer, chunk: Buffer): Buffer {
    return Buffer.concat([existing, chunk]);
  }

  private findInBuffer(buffer: Buffer, search: Buffer, start: number = 0): number {
    return buffer.indexOf(search, start);
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
      'webm': 'video/webm',
      'txt': 'text/plain',
      'pdf': 'application/pdf',
      'svg': 'image/svg+xml',
      'xml': 'application/xml',
      'zip': 'application/zip',
      'ico': 'image/x-icon',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'otf': 'font/otf',
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // Extract path parameters from URL
  private extractPathParams(routePath: string, requestPath: string): Record<string, string> | null {
    const routeParts = routePath.split('/');
    const requestParts = requestPath.split('/');
    
    if (routeParts.length !== requestParts.length) {
      return null;
    }
    
    const params: Record<string, string> = {};
    
    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const requestPart = requestParts[i];
      
      // Check if this part is a parameter (starts with :)
      if (routePart.startsWith(':')) {
        const paramName = routePart.substring(1);
        params[paramName] = requestPart;
      } else if (routePart !== requestPart) {
        // If parts don't match and it's not a parameter, no match
        return null;
      }
    }
    
    return params;
  }

  // Optimized route matching with path parameter support
  private matchRoute(req: Request): Route | null {
    // First check if we have routes for this method
    const methodRoutes = this.routesByMethod[req.method as HttpMethod];
    if (!methodRoutes || methodRoutes.length === 0) {
      return null;
    }
    
    // Get the path without query parameters
    const path = req.url.split('?')[0];
    
    // Look for an exact match first (most common case)
    for (const route of methodRoutes) {
      if (route.path === path) {
        return route;
      }
    }
    
    // If no exact match, check for path parameters
    for (const route of methodRoutes) {
      if (route.path.includes(':')) {
        const params = this.extractPathParams(route.path, path);
        if (params) {
          // Store the extracted parameters in the request object
          req.params = params;
          return route;
        }
      }
    }
    
    return null;
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

  // Process HTTP request with streaming support
  private async handleRequest(socket: any, data: Buffer) {
    try {
      // Parse the HTTP request
      const parsedRequest = parseRequest(data);
      
      // Convert headers array to object
      const headerObj = headersArrayToObject(parsedRequest.headers);
      
      // Parse query parameters
      const queryParams = parseQueryParams(parsedRequest.url);
      
      // Create request object
      const req: Request = {
        method: parsedRequest.method as HttpMethod,
        url: parsedRequest.url,
        headers: headerObj,
        body: parsedRequest.body,
        params: {},
        query: queryParams,
        files: [], // Will be populated if multipart/form-data
      };
      
      // Handle file uploads if content-type is multipart/form-data
      const contentType = headerObj['content-type'] || '';
      if (contentType.includes('multipart/form-data') && parsedRequest.body.length > 0) {
        try {
          const { fields, files } = await parseMultipartFormData(parsedRequest.body, contentType);
          
          // Add form fields to body as an object
          req.body = fields;
          
          // Add files to the request
          req.files = files;
          
          // Optionally save files to temporary storage
          for (let i = 0; i < req.files.length; i++) {
            try {
              const tempPath = await saveUploadedFile(req.files[i]);
              // Add the temporary path to the file object
              (req.files[i] as any).path = tempPath;
            } catch (error) {
              this.log('Error saving uploaded file:', error);
            }
          }
        } catch (error) {
          this.log('Error parsing multipart/form-data:', error);
        }
      } else if (contentType.includes('application/json') && typeof req.body !== 'string') {
        // Parse JSON body
        try {
          req.body = JSON.parse(req.body.toString());
        } catch (error) {
          this.log('Error parsing JSON body:', error);
        }
      } else if (contentType.includes('application/x-www-form-urlencoded') && typeof req.body !== 'string') {
        // Parse URL-encoded form data
        const bodyStr = req.body.toString();
        const formData: Record<string, string> = {};
        
        bodyStr.split('&').forEach(pair => {
          const [key, value] = pair.split('=');
          if (key) {
            formData[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
          }
        });
        
        req.body = formData;
      }
      
      // Create response object
      const res = this.createResponse(socket);
      
      // Find matching route
      const route = this.matchRoute(req);
      
      if (route) {
        // Execute route handler
        try {
          route.handler(req, res);
        } catch (error) {
          this.log('Error in route handler:', error);
          res.status(500).send('Internal Server Error');
        }
      } else {
        // No matching route found
        res.status(404).send('Not Found');
      }
    } catch (error) {
      this.log('Error handling request:', error);
      // Send a basic 400 response
      const errorResponse = `HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nBad Request`;
      socket.write(errorResponse);
      socket.end();
    }
  }

  // Start the server with streaming support
  listen(port: number, callback?: () => void) {
    this.port = port;
    
    this.server = TcpSocket.createServer((socket: any) => {
      // Set a reasonable timeout
      socket.setTimeout(30000); // 30 seconds timeout
      
      let buffer = Buffer.alloc(0);
      let headersParsed = false;
      let contentLength = 0;
      let bytesRead = 0;
      
      socket.on('timeout', () => {
        socket.end();
      });
      
      socket.on('data', (chunk: Buffer) => {
        // Append the new chunk to our buffer
        buffer = Buffer.concat([buffer, chunk]);
        bytesRead += chunk.length;
        
        // Check if we've exceeded the maximum buffer size
        if (bytesRead > this.MAX_BUFFER_SIZE) {
          this.log('Request too large, closing connection');
          socket.write('HTTP/1.1 413 Payload Too Large\r\nConnection: close\r\n\r\n');
          socket.end();
          return;
        }
        
        // If headers aren't parsed yet, try to parse them
        if (!headersParsed) {
          const headersEnd = buffer.indexOf(Buffer.from('\r\n\r\n'));
          if (headersEnd !== -1) {
            // Headers are complete, check for Content-Length
            const headersStr = buffer.slice(0, headersEnd).toString();
            const contentLengthMatch = headersStr.match(/content-length:\s*(\d+)/i);
            
            if (contentLengthMatch) {
              contentLength = parseInt(contentLengthMatch[1], 10);
            }
            
            headersParsed = true;
            
            // If no content expected or we already have all the content, process the request
            if (contentLength === 0 || buffer.length >= headersEnd + 4 + contentLength) {
              this.handleRequest(socket, buffer);
              buffer = Buffer.alloc(0); // Clear buffer after processing
            }
          }
        } else {
          // Headers already parsed, check if we have the full body
          const headersEnd = buffer.indexOf(Buffer.from('\r\n\r\n'));
          if (buffer.length >= headersEnd + 4 + contentLength) {
            this.handleRequest(socket, buffer);
            buffer = Buffer.alloc(0); // Clear buffer after processing
          }
        }
      });
      
      socket.on('error', (error: Error) => {
        this.log('Socket error:', error);
        this.emit('error', error);
      });
      
      socket.on('close', () => {
        buffer = Buffer.alloc(0); // Clear buffer on close
      });
    });
    
    this.server.on('error', (error: Error) => {
      this.log('Server error:', error);
      this.emit('error', error);
    });
    
    this.server.listen({ port, host: '0.0.0.0' }, () => {
      this.log(`HTTP server listening on port ${port}`);
      if (callback) callback();
    });
    
    return this;
  }

  // Close the server
  close(callback?: () => void) {
    if (this.server) {
      this.server.close(() => {
        this.log('HTTP server closed');
        if (callback) callback();
      });
    }
    
    return this;
  }
}

// Create server function (similar to Express)
export function createServer(options: { debug?: boolean } = {}): HttpServer {
  return new HttpServer(options);
}
