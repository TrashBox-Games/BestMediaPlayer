import * as FileSystem from "expo-file-system";
import { Buffer } from "buffer";
import { TagInfo } from "../contexts/TagsContext";

/**
 * Scans for frame positions in an ID3v2 tag buffer
 */
export const scanFramePositions = (
  buffer: Buffer,
  startPos: number,
  endPos: number,
  version: { major: number; revision: number }
): Record<string, { pos: number; size: number }> => {
  const framePositions: Record<string, { pos: number; size: number }> = {};
  let pos = startPos;

  // Only scan for frames we actually need
  const neededFrames = ["TIT2", "TPE1", "TALB", "APIC"];

  while (pos < endPos - 10) {
    // Need at least 10 bytes for a frame
    const frameId = buffer.toString("ascii", pos, pos + 4);
    pos += 4;

    // Read frame size
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

    // Skip if frame size is invalid
    if (frameSize <= 0 || frameSize > buffer.length - (pos + 6)) {
      break;
    }

    if (neededFrames.includes(frameId)) {
      framePositions[frameId] = {
        pos: pos + 6, // Position after frame header (size + flags)
        size: frameSize,
      };
    }

    pos += 4 + 2 + frameSize; // Skip size, flags, and frame data
  }

  return framePositions;
};

/**
 * Extracts an image from an APIC frame if it's small enough
 */
export const extractImageIfSmallEnough = (
  buffer: Buffer,
  frameSize: number
): string | undefined => {
  try {
    // If frame is too large, don't try to extract the image
    if (frameSize > 1000000) {
      return undefined;
    }

    // Use binary search to find null terminators more efficiently
    const findNullTerminator = (
      start: number,
      isDoubleByte = false
    ): number => {
      let step = 16; // Start with larger steps
      let pos = start;

      // First use larger steps to get close
      while (pos < buffer.length) {
        if (isDoubleByte) {
          if (
            pos + 1 < buffer.length &&
            buffer[pos] === 0 &&
            buffer[pos + 1] === 0
          ) {
            break;
          }
        } else if (buffer[pos] === 0) {
          break;
        }

        pos += step;

        // If we've gone too far, back up and use smaller steps
        if (pos >= buffer.length) {
          pos = Math.min(start + step - 1, buffer.length - 1);
          step = 1;
        }
      }

      // Back up to where we were before the last step
      if (pos >= buffer.length || (isDoubleByte && pos + 1 >= buffer.length)) {
        pos = Math.max(start, buffer.length - (isDoubleByte ? 2 : 1));
      }

      // Linear search for the exact position
      if (isDoubleByte) {
        while (pos < buffer.length - 1) {
          if (buffer[pos] === 0 && buffer[pos + 1] === 0) {
            break;
          }
          pos += 2;
        }
      } else {
        while (pos < buffer.length && buffer[pos] !== 0) {
          pos++;
        }
      }

      return pos;
    };

    // First byte is text encoding
    const encoding = buffer[0];

    // Find the first null byte to get the MIME type
    const mimeEndPos = findNullTerminator(1);

    // Skip null byte
    const pictureTypePos = mimeEndPos + 1;

    // Make sure we're not out of bounds
    if (pictureTypePos >= buffer.length) {
      return undefined;
    }

    // Next byte is picture type
    const pictureType = buffer[pictureTypePos];

    // Find the end of the description
    const descStartPos = pictureTypePos + 1;

    // Make sure we're not out of bounds
    if (descStartPos >= buffer.length) {
      return undefined;
    }

    // Find description terminator based on encoding
    const isDoubleByte = encoding === 1 || encoding === 2;
    const descEndPos = findNullTerminator(descStartPos, isDoubleByte);

    // Skip null terminator(s)
    const imageStartPos = descEndPos + (isDoubleByte ? 2 : 1);

    // Make sure we're not out of bounds
    if (imageStartPos >= buffer.length) {
      return undefined;
    }

    // The rest is the image data
    const imageData = buffer.slice(imageStartPos);
    return imageData.toString("base64");
  } catch (error) {
    console.error("Error extracting image:", error);
    return undefined;
  }
};

/**
 * Decodes a text frame from an ID3v2 tag
 */
export const decodeTextFrame = (buffer: Buffer): string | undefined => {
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
};

/**
 * Loads image data lazily from a file
 */
export const loadImageLazily = async (
  filePath: string,
  framePos: number,
  frameSize: number
): Promise<string | undefined> => {
  try {
    // Only load the image when explicitly requested
    const imageData = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
      length: frameSize,
      position: framePos,
    });

    return imageData;
  } catch (error) {
    console.error("Error loading image lazily:", error);
    return undefined;
  }
};

/**
 * Gets basic tags from a file without loading full image data
 */
export const getBasicTags = async (
  filePath: string,
  artCache: Record<string, string>
): Promise<TagInfo | null> => {
  try {
    // First, read just the ID3 header (10 bytes)
    const initialHeaderSize = 10;
    const headerData = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
      length: initialHeaderSize,
      position: 0,
    });

    const headerBuffer = Buffer.from(headerData, "base64");

    // Check if file has ID3v2 tags
    if (headerBuffer.toString("utf8", 0, 3) !== "ID3") {
      return null;
    }

    // Get ID3 version and size
    const version = {
      major: headerBuffer[3],
      revision: headerBuffer[4],
    };

    const size =
      ((headerBuffer[6] & 0x7f) << 21) |
      ((headerBuffer[7] & 0x7f) << 14) |
      ((headerBuffer[8] & 0x7f) << 7) |
      (headerBuffer[9] & 0x7f);

    // Now read a smaller portion of the tag data (up to 10KB)
    const readSize = Math.min(1000000, size);

    const framesData = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
      length: readSize,
      position: 10, // Start after header
    });

    const buffer = Buffer.from(framesData, "base64");

    // Extract basic metadata (title, artist, album)
    const tags: TagInfo = {};

    // Scan for frame positions
    const framePositions = scanFramePositions(
      buffer,
      0,
      buffer.length,
      version
    );

    // Process text frames
    if (framePositions["TIT2"]) {
      const { pos, size: frameSize } = framePositions["TIT2"];
      tags.title = decodeTextFrame(buffer.slice(pos, pos + frameSize));
    }

    if (framePositions["TPE1"]) {
      const { pos, size: frameSize } = framePositions["TPE1"];
      tags.artist = decodeTextFrame(buffer.slice(pos, pos + frameSize));
    }

    if (framePositions["TALB"]) {
      const { pos, size: frameSize } = framePositions["TALB"];
      tags.album = decodeTextFrame(buffer.slice(pos, pos + frameSize));
    }

    // Check if we can use cached artwork
    if (tags.album && tags.artist) {
      const cacheKey = `${tags.artist}-${tags.album}`;
      if (artCache[cacheKey]) {
        tags.image = artCache[cacheKey];
        console.log(`Using cached artwork for ${tags.album}`);
      } else if (framePositions["APIC"]) {
        // Mark that an image exists but we didn't load it yet
        tags.hasImage = "true";

        // Only extract small images immediately
        const { pos, size: frameSize } = framePositions["APIC"];
        if (frameSize < 100000) {
          // Extract image if small enough
          const imageData = extractImageIfSmallEnough(
            buffer.slice(pos, pos + Math.min(frameSize, buffer.length - pos)),
            frameSize
          );

          if (imageData) {
            tags.image = imageData;

            // Cache the image
            artCache[cacheKey] = imageData;
            console.log(`Cached artwork for ${tags.album}`);
          }
        }
      }
    }

    return tags;
  } catch (error) {
    console.error("Error reading basic tags:", error);
    return null;
  }
};

/**
 * Reads full ID3v2 tags from a file
 */
export const readID3v2Tags = async (
  filePath: string
): Promise<TagInfo | null> => {
  try {
    // Read the file data
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    const fileSize = (fileInfo as any).size || 0;
    const readSize = Math.min(100000, fileSize); // Read more data for full tag extraction

    const data = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
      length: readSize,
      position: 0,
    });

    const buffer = Buffer.from(data, "base64");

    // Check if file has ID3v2 tags
    if (buffer.toString("utf8", 0, 3) !== "ID3") {
      console.log("NO ID3 TAGS");
      return null;
    }

    // Extract metadata
    const tags: TagInfo = {};

    // Get ID3 version and size
    const version = {
      major: buffer[3],
      revision: buffer[4],
    };

    const size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);

    // Scan for frame positions
    const framePositions = scanFramePositions(
      buffer,
      10,
      Math.min(10 + size, buffer.length),
      version
    );

    // Process all frames
    for (const [frameId, { pos, size: frameSize }] of Object.entries(
      framePositions
    )) {
      if (frameId === "TIT2") {
        tags.title = decodeTextFrame(buffer.slice(pos, pos + frameSize));
      } else if (frameId === "TPE1") {
        tags.artist = decodeTextFrame(buffer.slice(pos, pos + frameSize));
      } else if (frameId === "TALB") {
        tags.album = decodeTextFrame(buffer.slice(pos, pos + frameSize));
      } else if (frameId === "APIC") {
        const imageData = extractImageIfSmallEnough(
          buffer.slice(pos, pos + Math.min(frameSize, buffer.length - pos)),
          frameSize
        );
        if (imageData) {
          tags.image = imageData;
        }
      }
    }

    return tags;
  } catch (error) {
    console.error("Error reading ID3v2 tags:", error);
    return null;
  }
};
