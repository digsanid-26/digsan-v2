import 'package:equatable/equatable.dart';
import '../../../data/models/chat_model.dart';

abstract class ChatState extends Equatable {
  const ChatState();
  @override
  List<Object?> get props => [];
}

class ChatInitial extends ChatState {}

class ChatLoading extends ChatState {}

class ChatRoomsLoaded extends ChatState {
  final List<ChatRoomModel> rooms;
  const ChatRoomsLoaded(this.rooms);
  @override
  List<Object?> get props => [rooms];
}

class ChatMessagesLoaded extends ChatState {
  final String roomId;
  final List<ChatMessageModel> messages;
  const ChatMessagesLoaded({required this.roomId, required this.messages});
  @override
  List<Object?> get props => [roomId, messages];
}

class ChatMessageSent extends ChatState {
  final ChatMessageModel message;
  const ChatMessageSent(this.message);
  @override
  List<Object?> get props => [message];
}

class ChatError extends ChatState {
  final String message;
  const ChatError(this.message);
  @override
  List<Object?> get props => [message];
}
