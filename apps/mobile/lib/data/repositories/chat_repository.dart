import '../../core/network/api_client.dart';
import '../models/chat_model.dart';

class ChatRepository {
  final ApiClient _api;

  ChatRepository(this._api);

  dynamic _unwrap(dynamic data) {
    if (data is Map && data['data'] != null) return data['data'];
    return data;
  }

  Future<List<ChatRoomModel>> getRooms() async {
    final res = await _api.dio.get('/chat/rooms');
    final list = _unwrap(res.data);
    if (list is List) {
      return list.map((e) => ChatRoomModel.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<ChatRoomModel> createDirectRoom(String targetUserId) async {
    final res = await _api.dio.post('/chat/rooms/direct', data: {'targetUserId': targetUserId});
    return ChatRoomModel.fromJson(_unwrap(res.data) as Map<String, dynamic>);
  }

  Future<ChatRoomModel> createGroupRoom({required String name, required List<String> memberIds}) async {
    final res = await _api.dio.post('/chat/rooms/group', data: {
      'name': name,
      'memberIds': memberIds,
    });
    return ChatRoomModel.fromJson(_unwrap(res.data) as Map<String, dynamic>);
  }

  Future<List<ChatMessageModel>> getMessages(String roomId, {int page = 1, int limit = 50}) async {
    final res = await _api.dio.get('/chat/rooms/$roomId/messages', queryParameters: {
      'page': page,
      'limit': limit,
    });
    final data = _unwrap(res.data);
    final list = data is Map && data['messages'] != null
        ? data['messages'] as List
        : data is List
            ? data
            : [];
    return list.map((e) => ChatMessageModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<ChatMessageModel> sendMessage(String roomId, String content, {String type = 'TEXT'}) async {
    final res = await _api.dio.post('/chat/rooms/$roomId/messages', data: {
      'content': content,
      'type': type,
    });
    return ChatMessageModel.fromJson(_unwrap(res.data) as Map<String, dynamic>);
  }

  Future<void> markAsRead(String roomId) async {
    await _api.dio.post('/chat/rooms/$roomId/read');
  }

  Future<void> deleteMessage(String roomId, String messageId) async {
    await _api.dio.delete('/chat/rooms/$roomId/messages/$messageId');
  }
}
