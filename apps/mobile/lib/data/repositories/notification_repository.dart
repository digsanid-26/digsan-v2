import '../../core/network/api_client.dart';
import '../models/notification_model.dart';

class NotificationRepository {
  final ApiClient _api;

  NotificationRepository(this._api);

  dynamic _unwrap(dynamic data) {
    if (data is Map && data['data'] != null) return data['data'];
    return data;
  }

  Future<List<NotificationModel>> getNotifications({int page = 1, int limit = 20}) async {
    final res = await _api.dio.get('/notifications', queryParameters: {
      'page': page,
      'limit': limit,
    });
    final data = _unwrap(res.data);
    final list = data is Map && data['notifications'] != null
        ? data['notifications'] as List
        : data is List
            ? data
            : [];
    return list.map((e) => NotificationModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> markAsRead(String id) async {
    await _api.dio.patch('/notifications/$id/read');
  }

  Future<void> markAllAsRead() async {
    await _api.dio.patch('/notifications/read-all');
  }

  Future<int> getUnreadCount() async {
    try {
      final res = await _api.dio.get('/notifications/unread-count');
      final data = _unwrap(res.data);
      return data is Map ? (data['count'] as int? ?? 0) : 0;
    } catch (_) {
      return 0;
    }
  }
}
