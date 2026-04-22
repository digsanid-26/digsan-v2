import 'package:flutter_test/flutter_test.dart';
import 'package:digsan_mobile/data/models/notification_model.dart';

void main() {
  group('NotificationModel', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'n1',
        'userId': 'u1',
        'type': 'BADGE_EARNED',
        'title': 'Badge Baru!',
        'message': 'Kamu mendapat badge Newcomer',
        'data': {'badgeId': 'b1'},
        'isRead': false,
        'readAt': null,
        'createdAt': '2026-04-01T12:00:00.000Z',
      };

      final n = NotificationModel.fromJson(json);
      expect(n.id, 'n1');
      expect(n.type, 'BADGE_EARNED');
      expect(n.title, 'Badge Baru!');
      expect(n.isRead, false);
      expect(n.data, isNotNull);
      expect(n.data!['badgeId'], 'b1');
    });

    test('copyWith updates isRead', () {
      final n = NotificationModel(
        id: 'n1',
        userId: 'u1',
        type: 'SYSTEM',
        title: 'Test',
        message: 'msg',
        createdAt: DateTime.utc(2026),
      );

      final updated = n.copyWith(isRead: true, readAt: DateTime.utc(2026, 4, 1));
      expect(updated.isRead, true);
      expect(updated.readAt, isNotNull);
      expect(updated.id, n.id);
      expect(updated.title, n.title);
    });
  });
}
