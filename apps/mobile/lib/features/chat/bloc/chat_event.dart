import 'package:equatable/equatable.dart';

abstract class ChatEvent extends Equatable {
  const ChatEvent();
  @override
  List<Object?> get props => [];
}

class ChatRoomsLoadRequested extends ChatEvent {}

class ChatMessagesLoadRequested extends ChatEvent {
  final String roomId;
  const ChatMessagesLoadRequested(this.roomId);
  @override
  List<Object?> get props => [roomId];
}

class ChatSendMessageRequested extends ChatEvent {
  final String roomId;
  final String content;
  final String type;
  const ChatSendMessageRequested({required this.roomId, required this.content, this.type = 'TEXT'});
  @override
  List<Object?> get props => [roomId, content, type];
}

class ChatMarkAsReadRequested extends ChatEvent {
  final String roomId;
  const ChatMarkAsReadRequested(this.roomId);
  @override
  List<Object?> get props => [roomId];
}

class ChatMessageReceived extends ChatEvent {
  final Map<String, dynamic> messageData;
  const ChatMessageReceived(this.messageData);
  @override
  List<Object?> get props => [messageData];
}
