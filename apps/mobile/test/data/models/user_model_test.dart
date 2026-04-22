import 'package:flutter_test/flutter_test.dart';
import 'package:digsan_mobile/data/models/user_model.dart';

void main() {
  group('UserModel', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'u1',
        'email': 'test@test.com',
        'name': 'Test User',
        'phone': '08123456789',
        'avatar': 'https://img.com/a.jpg',
        'bio': 'Hello',
        'provider': 'credentials',
        'status': 'ACTIVE',
        'roles': ['user', 'admin'],
        'createdAt': '2026-01-01T00:00:00.000Z',
      };

      final user = UserModel.fromJson(json);

      expect(user.id, 'u1');
      expect(user.email, 'test@test.com');
      expect(user.name, 'Test User');
      expect(user.phone, '08123456789');
      expect(user.avatar, 'https://img.com/a.jpg');
      expect(user.bio, 'Hello');
      expect(user.roles, ['user', 'admin']);
      expect(user.status, 'ACTIVE');
    });

    test('fromJson handles nested role objects', () {
      final json = {
        'id': 'u2',
        'email': 'a@b.com',
        'name': 'A',
        'roles': [
          {'name': 'user'},
          {'role': {'name': 'admin'}},
        ],
        'createdAt': '2026-01-01T00:00:00.000Z',
      };

      final user = UserModel.fromJson(json);
      expect(user.roles, ['user', 'admin']);
    });

    test('fromJson handles missing optional fields', () {
      final json = {
        'id': 'u3',
        'email': 'x@x.com',
        'name': 'X',
        'createdAt': '2026-01-01T00:00:00.000Z',
      };

      final user = UserModel.fromJson(json);
      expect(user.phone, isNull);
      expect(user.avatar, isNull);
      expect(user.bio, isNull);
      expect(user.roles, isEmpty);
      expect(user.provider, 'credentials');
      expect(user.status, 'ACTIVE');
    });

    test('toJson round-trips correctly', () {
      final user = UserModel(
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        roles: ['user'],
        createdAt: DateTime.utc(2026, 1, 1),
      );

      final json = user.toJson();
      final restored = UserModel.fromJson(json);

      expect(restored.id, user.id);
      expect(restored.email, user.email);
      expect(restored.name, user.name);
      expect(restored.roles, user.roles);
    });
  });
}
