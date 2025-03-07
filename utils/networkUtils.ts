import * as Network from 'expo-network';

/**
 * Gets the device's IP address
 * @returns The IP address as a string, or '127.0.0.1' if it can't be determined
 */
export const getIpAddress = async (): Promise<string> => {
  try {
    const ipAddress = await Network.getIpAddressAsync();
    return ipAddress || '127.0.0.1';
  } catch (error) {
    console.error('Error getting IP address:', error);
    return '127.0.0.1';
  }
}; 