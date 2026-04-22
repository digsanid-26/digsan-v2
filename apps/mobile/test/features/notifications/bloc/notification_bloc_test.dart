import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:digsan_mobile/data/models/notification_model.dart';
import 'package:digsan_mobile/data/repositories/notification_repository.dart';
import 'package:digsan_mobile/features/notifications/bloc/notification_bloc.dart';
import 'package:digsan_mobile/features/notifications/bloc/notification_event.dart';
import 'package:digsan_mobile/features/notifications/bloc/notification_state.dart';

class MockNotificationRepository extends Mock implements NotificationRepository {}

void main() {
  late MockNotificationRepository mockRepo;

  setUp(() {
    mockRepo = MockNotificationRepository();
  });

  final sampleNotifications = [
    NotificationModel(
      id: 'n1',
      userId: 'u1',
      type: 'BADGE_EARNED',
      title: 'Badge Baru',
      message: 'Kamu mendapat badge',
      isRead: false,
      createdAt: DateTime.utc(2026),
    ),
    NotificationModel(
      id: 'n2',
      userId: 'u1',
      type: 'SYSTEM',
      title: 'Update',
      message: 'Sistem diperbarui',
      isRead: true,
      readAt: DateTime.utc(2026),
      createdAt: DateTime.utc(2026),
    ),
  ];

  group('NotificationBloc', () {
    blocTest<NotificationBloc, NotificationState>(
      'emits [NotificationLoading, NotificationLoaded] on load',
      build: () {
        when(() => mockRepo.getNotifications()).thenAnswer((_) async => sampleNotifications);
        return NotificationBloc(mockRepo);
      },
      act: (bloc) => bloc.add(NotificationLoadRequested()),
      expect: () => [
        NotificationLoading(),
        NotificationLoaded(sampleNotifications),
      ],
    );

    blocTest<NotificationBloc, NotificationState>(
      'emits [NotificationLoading, NotificationError] on failure',
      build: () {
        when(() => mockRepo.getNotifications()).thenThrow(Exception('fail'));
        return NotificationBloc(mockRepo);
      },
      act: (bloc) => bloc.add(NotificationLoadRequested()),
      expect: () => [
        NotificationLoading(),
        isA<NotificationError>(),
      ],
    );

    blocTest<NotificationBloc, NotificationState>(
      'mark read updates notification in list',
      build: () {
        when(() => mockRepo.getNotifications()).thenAnswer((_) async => sampleNotifications);
        when(() => mockRepo.markAsRead('n1')).thenAnswer((_) async {});
        return NotificationBloc(mockRepo);
      },
      act: (bloc) async {
        bloc.add(NotificationLoadRequested());
        await Future.delayed(const Duration(milliseconds: 300));
        bloc.add(const NotificationMarkReadRequested('n1'));
      },
      wait: const Duration(milliseconds: 600),
      expect: () => [
        NotificationLoading(),
        NotificationLoaded(sampleNotifications),
        isA<NotificationLoaded>(),
      ],
      verify: (bloc) {
        final state = bloc.state;
        expect(state, isA<NotificationLoaded>());
        final loaded = state as NotificationLoaded;
        expect(loaded.notifications.first.isRead, true);
      },
    );

    blocTest<NotificationBloc, NotificationState>(
      'mark all read updates all notifications',
      build: () {
        when(() => mockRepo.getNotifications()).thenAnswer((_) async => sampleNotifications);
        when(() => mockRepo.markAllAsRead()).thenAnswer((_) async {});
        return NotificationBloc(mockRepo);
      },
      act: (bloc) async {
        bloc.add(NotificationLoadRequested());
        await Future.delayed(const Duration(milliseconds: 300));
        bloc.add(NotificationMarkAllReadRequested());
      },
      wait: const Duration(milliseconds: 600),
      expect: () => [
        NotificationLoading(),
        NotificationLoaded(sampleNotifications),
        isA<NotificationLoaded>(),
      ],
      verify: (bloc) {
        final loaded = bloc.state as NotificationLoaded;
        expect(loaded.notifications.every((n) => n.isRead), true);
      },
    );
  });
}
