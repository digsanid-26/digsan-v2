import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:digsan_mobile/data/models/chat_model.dart';
import 'package:digsan_mobile/data/repositories/chat_repository.dart';
import 'package:digsan_mobile/features/chat/bloc/chat_bloc.dart';
import 'package:digsan_mobile/features/chat/bloc/chat_event.dart';
import 'package:digsan_mobile/features/chat/bloc/chat_state.dart';

class MockChatRepository extends Mock implements ChatRepository {}

void main() {
  late MockChatRepository mockRepo;

  setUp(() {
    mockRepo = MockChatRepository();
  });

  final sampleRooms = [
    ChatRoomModel(
      id: 'r1',
      name: 'Family Chat',
      type: 'GROUP',
      unreadCount: 2,
      createdAt: DateTime.utc(2026),
    ),
  ];

  final sampleMessages = [
    ChatMessageModel(
      id: 'm1',
      roomId: 'r1',
      senderId: 'u1',
      content: 'Hello!',
      createdAt: DateTime.utc(2026),
    ),
    ChatMessageModel(
      id: 'm2',
      roomId: 'r1',
      senderId: 'u2',
      content: 'Hi there',
      createdAt: DateTime.utc(2026, 1, 1, 0, 1),
    ),
  ];

  group('ChatBloc', () {
    blocTest<ChatBloc, ChatState>(
      'emits [ChatLoading, ChatRoomsLoaded] on ChatRoomsLoadRequested',
      build: () {
        when(() => mockRepo.getRooms()).thenAnswer((_) async => sampleRooms);
        return ChatBloc(mockRepo);
      },
      act: (bloc) => bloc.add(ChatRoomsLoadRequested()),
      expect: () => [
        ChatLoading(),
        ChatRoomsLoaded(sampleRooms),
      ],
    );

    blocTest<ChatBloc, ChatState>(
      'emits [ChatLoading, ChatError] on ChatRoomsLoadRequested failure',
      build: () {
        when(() => mockRepo.getRooms()).thenThrow(Exception('fail'));
        return ChatBloc(mockRepo);
      },
      act: (bloc) => bloc.add(ChatRoomsLoadRequested()),
      expect: () => [
        ChatLoading(),
        isA<ChatError>(),
      ],
    );

    blocTest<ChatBloc, ChatState>(
      'emits [ChatLoading, ChatMessagesLoaded] on ChatMessagesLoadRequested',
      build: () {
        when(() => mockRepo.getMessages('r1')).thenAnswer((_) async => sampleMessages);
        return ChatBloc(mockRepo);
      },
      act: (bloc) => bloc.add(const ChatMessagesLoadRequested('r1')),
      expect: () => [
        ChatLoading(),
        isA<ChatMessagesLoaded>(),
      ],
    );

    blocTest<ChatBloc, ChatState>(
      'emits [ChatMessageSent, ...] on ChatSendMessageRequested',
      build: () {
        final sent = ChatMessageModel(
          id: 'm3',
          roomId: 'r1',
          senderId: 'u1',
          content: 'New msg',
          createdAt: DateTime.utc(2026),
        );
        when(() => mockRepo.sendMessage('r1', 'New msg', type: 'TEXT'))
            .thenAnswer((_) async => sent);
        when(() => mockRepo.getMessages('r1'))
            .thenAnswer((_) async => [...sampleMessages, sent]);
        return ChatBloc(mockRepo);
      },
      act: (bloc) => bloc.add(const ChatSendMessageRequested(roomId: 'r1', content: 'New msg')),
      expect: () => [
        isA<ChatMessageSent>(),
        ChatLoading(),
        isA<ChatMessagesLoaded>(),
      ],
    );
  });
}
