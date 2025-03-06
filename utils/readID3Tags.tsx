import * as FileSystem from "expo-file-system";
import { Buffer } from "buffer";
import * as DocumentPicker from "expo-document-picker";

// Define types for ID3 tags
interface ID3Tags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  comment?: string;
  genre?: string;
  track?: string;
  image?: string;
  [key: string]: string | undefined;
}

interface ID3Frame {
  id: string;
  size: number;
  flags?: {
    tagAlterPreservation: boolean;
    fileAlterPreservation: boolean;
    readOnly: boolean;
    compression: boolean;
    encryption: boolean;
    groupingIdentity: boolean;
  };
  content?: Buffer;
}

/**
 * Reads ID3v2 tags from an audio file using Expo FileSystem
 * @param {string} filePath - Path to the audio file
 * @returns {Promise<ID3Tags|null>} - Object containing ID3 tags or null if not found
 */
export async function readID3v2Tags(filePath: string): Promise<ID3Tags | null> {
  try {
    // First, read just the ID3 header (first 10 bytes) to check if ID3 tags exist and get the size
    const headerData = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
      length: 10, // Just read the 10-byte header first
      position: 0,
    });

    const headerBuffer = Buffer.from(headerData, "base64");

    // Check if file has ID3v2 tags (first 3 bytes should be "ID3")
    if (headerBuffer.slice(0, 3).toString() !== "ID3") {
      console.log("No ID3v2 tags found");
      return null;
    }

    // Get ID3 version
    const version = {
      major: headerBuffer[3],
      revision: headerBuffer[4],
    };

    // Check for flags
    const flags = headerBuffer[5];
    const hasExtendedHeader = (flags & 0x40) !== 0;

    // Get tag size (last 4 bytes of header, synchsafe integers)
    const size =
      ((headerBuffer[6] & 0x7f) << 21) |
      ((headerBuffer[7] & 0x7f) << 14) |
      ((headerBuffer[8] & 0x7f) << 7) |
      (headerBuffer[9] & 0x7f);

    // Now that we know the size, read only the ID3 tag portion of the file
    // Add a small buffer (1KB) to ensure we read enough data
    const totalTagSize = 10 + size;
    const tagData = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
      length: totalTagSize,
      position: 0,
    });

    const buffer = Buffer.from(tagData, "base64");

    // Initialize position after header
    let pos = 10;

    // Skip extended header if present
    if (hasExtendedHeader) {
      // Extended header size is also a synchsafe integer in v2.4, but not in v2.3
      if (version.major === 4) {
        const extHeaderSize =
          ((buffer[pos] & 0x7f) << 21) |
          ((buffer[pos + 1] & 0x7f) << 14) |
          ((buffer[pos + 2] & 0x7f) << 7) |
          (buffer[pos + 3] & 0x7f);
        pos += extHeaderSize;
      } else {
        // v2.3 extended header
        const extHeaderSize =
          (buffer[pos] << 24) |
          (buffer[pos + 1] << 16) |
          (buffer[pos + 2] << 8) |
          buffer[pos + 3];
        pos += extHeaderSize + 4; // +4 for the size bytes themselves
      }
    }

    // Parse frames
    const tags: ID3Tags = {};
    const endPos = 10 + size;

    while (pos < endPos) {
      // Check for padding (0x00 bytes)
      if (buffer[pos] === 0) {
        break;
      }

      // Read frame ID (4 chars)
      const frameId = buffer.slice(pos, pos + 4).toString("ascii");
      pos += 4;

      // Read frame size (4 bytes)
      let frameSize;
      if (version.major === 4) {
        // v2.4 uses synchsafe integers
        frameSize =
          ((buffer[pos] & 0x7f) << 21) |
          ((buffer[pos + 1] & 0x7f) << 14) |
          ((buffer[pos + 2] & 0x7f) << 7) |
          (buffer[pos + 3] & 0x7f);
      } else {
        // v2.3 uses regular integers
        frameSize =
          (buffer[pos] << 24) |
          (buffer[pos + 1] << 16) |
          (buffer[pos + 2] << 8) |
          buffer[pos + 3];
      }
      pos += 4;

      // Read frame flags (2 bytes)
      const frameFlags = (buffer[pos] << 8) | buffer[pos + 1];
      pos += 2;

      // Skip if frame size is invalid
      if (frameSize <= 0 || frameSize > buffer.length - pos) {
        break;
      }

      // Process frame content based on frame ID
      const frameContent = buffer.slice(pos, pos + frameSize);
      pos += frameSize;

      // Process common frame types
      if (frameId === "TIT2") {
        // Title
        tags.title = decodeTextFrame(frameContent);
      } else if (frameId === "TPE1") {
        // Artist
        tags.artist = decodeTextFrame(frameContent);
      } else if (frameId === "TALB") {
        // Album
        tags.album = decodeTextFrame(frameContent);
      } else if (frameId === "TYER" || frameId === "TDRC") {
        // Year or Recording time
        tags.year = decodeTextFrame(frameContent);
      } else if (frameId === "COMM") {
        // Comment
        tags.comment = decodeCommentFrame(frameContent);
      } else if (frameId === "TRCK") {
        // Track number
        tags.track = decodeTextFrame(frameContent);
      } else if (frameId === "TCON") {
        // Genre
        tags.genre = decodeTextFrame(frameContent);
      } else if (frameId === "APIC") {
        // Picture
        const imageData = decodeImageFrame(frameContent);
        if (imageData) {
          tags.image = imageData;
        }
      } else if (frameId.startsWith("T")) {
        // Other text frames
        const value = decodeTextFrame(frameContent);
        if (value) {
          tags[frameId] = value;
        }
      }
    }

    return tags;
  } catch (error) {
    console.error("Error reading ID3 tags:", error);
    return null;
  }
}

/**
 * Decodes a text frame from ID3v2 tag
 * @param {Buffer} buffer - Frame content buffer
 * @returns {string|null} - Decoded text or null if invalid
 */
function decodeTextFrame(buffer: Buffer): string | undefined {
  try {
    // First byte is text encoding
    const encoding = buffer[0];

    // Skip the encoding byte
    const textBuffer = buffer.slice(1);

    // Decode based on encoding
    if (encoding === 0) {
      // ISO-8859-1 (Latin-1)
      return textBuffer.toString("latin1").replace(/\0+$/, "");
    } else if (encoding === 1) {
      // UTF-16 with BOM
      return textBuffer.toString("utf16le").replace(/\0+$/, "");
    } else if (encoding === 2) {
      // UTF-16BE without BOM
      // This is a simplified approach
      return textBuffer.toString("utf16le").replace(/\0+$/, "");
    } else if (encoding === 3) {
      // UTF-8
      return textBuffer.toString("utf8").replace(/\0+$/, "");
    }

    // Default fallback
    return textBuffer.toString().replace(/\0+$/, "");
  } catch (error) {
    console.error("Error decoding text frame:", error);
    return undefined;
  }
}

/**
 * Decodes a comment frame from ID3v2 tag
 * @param {Buffer} buffer - Frame content buffer
 * @returns {string|null} - Decoded comment or null if invalid
 */
function decodeCommentFrame(buffer: Buffer): string | undefined {
  try {
    // First byte is text encoding
    const encoding = buffer[0];

    // Next 3 bytes are language
    const language = buffer.toString("ascii", 1, 4);

    // Find the first null byte after language to separate description from actual comment
    let nullIndex = 4;
    while (nullIndex < buffer.length && buffer[nullIndex] !== 0) {
      nullIndex++;
    }

    // Skip the null byte
    const commentStart = nullIndex + 1;

    // Extract the comment text
    if (encoding === 0) {
      // ISO-8859-1
      return buffer.toString("latin1", commentStart).replace(/\0+$/, "");
    } else if (encoding === 1 || encoding === 2) {
      // UTF-16
      return buffer.toString("utf16le", commentStart).replace(/\0+$/, "");
    } else if (encoding === 3) {
      // UTF-8
      return buffer.toString("utf8", commentStart).replace(/\0+$/, "");
    }

    // Default fallback
    return buffer.toString("utf8", commentStart).replace(/\0+$/, "");
  } catch (error) {
    console.error("Error decoding comment frame:", error);
    return undefined;
  }
}

/**
 * Decodes an image frame from ID3v2 tag
 * @param {Buffer} buffer - Frame content buffer
 * @returns {string|null} - Base64 encoded image data or null if invalid
 */
function decodeImageFrame(buffer: Buffer): string | undefined {
  try {
    // First byte is text encoding
    const encoding = buffer[0];

    // Find the first null byte to get the MIME type
    let pos = 1;
    while (pos < buffer.length && buffer[pos] !== 0) {
      pos++;
    }

    const mimeType = buffer.toString("ascii", 1, pos);
    pos++; // Skip null byte

    // Next byte is picture type
    const pictureType = buffer[pos];
    pos++;

    // Find the end of the description
    let descEnd = pos;
    if (encoding === 0 || encoding === 3) {
      // Single byte encoding
      while (descEnd < buffer.length && buffer[descEnd] !== 0) {
        descEnd++;
      }
      descEnd++; // Skip null byte
    } else {
      // Double byte encoding (UTF-16)
      while (
        descEnd < buffer.length - 1 &&
        !(buffer[descEnd] === 0 && buffer[descEnd + 1] === 0)
      ) {
        descEnd += 2;
      }
      descEnd += 2; // Skip null bytes
    }

    // The rest is the image data
    const imageData = buffer.slice(descEnd);

    // Convert to base64
    return imageData.toString("base64");
  } catch (error) {
    console.error("Error decoding image frame:", error);
    return undefined;
  }
}

/**
 * Example function to demonstrate tag reading
 * @param {string} audioFilePath - Path to the audio file
 */
export async function readTagsExample(audioFilePath: string): Promise<void> {
  try {
    const tags = await readID3v2Tags(audioFilePath);
    console.log("ID3 Tags:", tags);

    if (tags?.image) {
      console.log("Image data found (base64)");
    }
  } catch (error) {
    console.error("Error in example:", error);
  }
}

/**
 * Helper function to pick an audio file
 * @returns {Promise<{uri: string}|null>} - Selected file or null if cancelled
 */
export const pickAudioFile =
  async (): Promise<DocumentPicker.DocumentPickerAsset | null> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        console.log("User cancelled document picker");
        return null;
      }

      return result.assets[0];
    } catch (error) {
      console.error("Error picking document:", error);
      return null;
    }
  };

/**
 * Helper function to save a file using Expo FileSystem
 * @param {string} fileName - Name of the file to save
 * @param {string} data - Data to write to the file
 * @param {string} encoding - Encoding to use (default: utf8)
 * @returns {Promise<string>} - Path to the saved file
 */
export const saveFile = async (
  fileName: string,
  data: string,
  encoding: FileSystem.EncodingType = FileSystem.EncodingType.UTF8
): Promise<string> => {
  try {
    // Create a directory for files if it doesn't exist
    const dirPath = `${FileSystem.documentDirectory}files`;
    const dirInfo = await FileSystem.getInfoAsync(dirPath);

    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }

    // Save the file
    const filePath = `${dirPath}/${fileName}`;
    await FileSystem.writeAsStringAsync(filePath, data, { encoding });

    console.log(`File saved to: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error("Error saving file:", error);
    throw error;
  }
};
