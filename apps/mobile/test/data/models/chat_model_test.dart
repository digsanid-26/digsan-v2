import 'package:flutter_test/flutter_test.dart';
import 'package:digsan_mobile/data/models/chat_model.dart';

void main() {
  group('ChatRoomModel', () {
    test('fromJson parses correctly with nested lastMessage and members', () {
      final json = {
        'id': 'r1',
        'name': 'Family Chat',
        'type': 'GROUP',
        'avatar': null,
        'unreadCount': 3,
        'lastMessage': {
          'id': 'm1',
          'roomId': 'r1',
          'senderId': 'u1',
          'content': 'Hello',
          'type': 'TEXT',
          'createdAt': '2026-01-01T00:00:00.000Z',
        },
        'members': [
          {
            'id': 'cm1',
            'userId': 'u1',
            'role': 'admin',
            'user': {'name': 'Alice', 'avatar': null},
          },
        ],
        'createdAt': '2026-01-01T00:00:00.000Z',
      };

      final room = ChatRoomModel.fromJson(json);

      expect(room.id, 'r1');
      expect(room.name, 'Family Chat');
      expect(room.type, 'GROUP');
      expect(room.unreadCount, 3);
      expect(room.lastMessage, isNotNull);
      expect(room.lastMessage!.content, 'Hello');
      expect(room.members.length, 1);
      expect(room.members.first.userName, 'Alice');
    });

    test('fromJson handles missing optional fields', () {
      final json = {
        'id': 'r2',
        'createdAt': '2026-01-01T00:00:00.000Z',
      };

      final room = ChatRoomModel.fromJson(json);
      expect(room.name, isNull);
      expect(room.type, 'DIRECT');
      expect(room.unreadCount, 0);
      expect(room.lastMessage, isNull);
      expect(room.members, isEmpty);
    });
  });

  group('ChatMessageModel', () {
    test('fromJson parses sender info', () {
      final json = {
        'id': 'm1',
        'roomId': 'r1',
        'senderId': 'u1',
        'content': 'Hi there',
        'type': 'IMAGE',
        'sender': {'name': 'Bob', 'avatar': 'https://img.com/b.jpg'},
        'createdAt': '2026-04-01T12:00:00.000Z',
      };

      final msg = ChatMessageModel.fromJson(json);
      expect(msg.id, 'm1');
      expect(msg.content, 'Hi there');
      expect(msg.type, 'IMAGE');
      expect(msg.senderName, 'Bob');
      expect(msg.senderAvatar, 'https://img.com/b.jpg');
    });
  });
}
