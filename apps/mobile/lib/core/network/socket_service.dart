import 'package:socket_io_client/socket_io_client.dart' as io;
import '../constants/api_constants.dart';
import 'api_client.dart';

class SocketService {
  final ApiClient _apiClient;
  io.Socket? _socket;

  SocketService(this._apiClient);

  bool get isConnected => _socket?.connected ?? false;

  Future<void> connect() async {
    if (_socket != null && _socket!.connected) return;

    final token = await _apiClient.getAccessToken();
    if (token == null) return;

    _socket = io.io(
      ApiConstants.wsUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setPath('/chat')
          .setAuth({'token': token})
          .disableAutoConnect()
          .build(),
    );

    _socket!.connect();
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  void onNewMessage(void Function(dynamic data) callback) {
    _socket?.on('new_message', callback);
  }

  void onTyping(void Function(dynamic data) callback) {
    _socket?.on('typing', callback);
  }

  void onStopTyping(void Function(dynamic data) callback) {
    _socket?.on('stop_typing', callback);
  }

  void onUserOnline(void Function(dynamic data) callback) {
    _socket?.on('user_online', callback);
  }

  void onUserOffline(void Function(dynamic data) callback) {
    _socket?.on('user_offline', callback);
  }

  void sendMessage(String roomId, String content, {String type = 'TEXT'}) {
    _socket?.emit('send_message', {
      'roomId': roomId,
      'content': content,
      'type': type,
    });
  }

  void joinRoom(String roomId) {
    _socket?.emit('join_room', {'roomId': roomId});
  }

  void leaveRoom(String roomId) {
    _socket?.emit('leave_room', {'roomId': roomId});
  }

  void emitTyping(String roomId) {
    _socket?.emit('typing', {'roomId': roomId});
  }

  void emitStopTyping(String roomId) {
    _socket?.emit('stop_typing', {'roomId': roomId});
  }

  void markRead(String roomId) {
    _socket?.emit('mark_read', {'roomId': roomId});
  }
}
