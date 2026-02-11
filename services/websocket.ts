class WebSocketService {
  private isConnected = false;
  private connectionError: string | null = null;
  private listeners: { [event: string]: Function[] } = {};

  connect(partnerId: string, token: string) {
    console.log('WebSocket: Connecting...', { partnerId, token });
    this.isConnected = true;
    this.emit('connect', { partnerId, token });
  }

  disconnect() {
    console.log('WebSocket: Disconnecting...');
    this.isConnected = false;
    this.emit('disconnect');
  }

  subscribe(channel: string) {
    console.log('WebSocket: Subscribing to', channel);
    this.emit('subscribe', channel);
  }

  unsubscribe(channel: string) {
    console.log('WebSocket: Unsubscribing from', channel);
    this.emit('unsubscribe', channel);
  }

  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }
  }

  private emit(event: string, data?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => cb(data));
    }
  }

  getIsConnected() {
    return this.isConnected;
  }

  getConnectionError() {
    return this.connectionError;
  }
}

const webSocketService = new WebSocketService();
export default webSocketService;
