import fetch from 'node-fetch';

export class RoomManager {
  constructor(hostname, protocol) {
    this.hostname = hostname;
    this.protocol = protocol;
  }

  async createRoom(roomName) {
    const requestBody = { name: roomName };

    const apiUrl = `${this.protocol}//${this.hostname}/api/room`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      let errorMessage;
      
      try {
        const parsedError = JSON.parse(errorData);
        errorMessage = parsedError.error || 'Unknown error';
      } catch (e) {
        errorMessage = errorData || 'Unknown error';
      }
      
      throw new Error(errorMessage);
    }

    return await response.text();
  }
} 