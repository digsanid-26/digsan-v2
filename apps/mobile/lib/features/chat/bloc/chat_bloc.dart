import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../data/models/chat_model.dart';
import '../../../data/repositories/chat_repository.dart';
import 'chat_event.dart';
import 'chat_state.dart';

class ChatBloc extends Bloc<ChatEvent, ChatState> {
  final ChatRepository _repository;

  ChatBloc(this._repository) : super(ChatInitial()) {
    on<ChatRoomsLoadRequested>(_onLoadRooms);
    on<ChatMessagesLoadRequested>(_onLoadMessages);
    on<ChatSendMessageRequested>(_onSendMessage);
    on<ChatMarkAsReadRequested>(_onMarkAsRead);
    on<ChatMessageReceived>(_onMessageReceived);
  }

  Future<void> _onLoadRooms(ChatRoomsLoadRequested event, Emitter<ChatState> emit) async {
    emit(ChatLoading());
    try {
      final rooms = await _repository.getRooms();
      emit(ChatRoomsLoaded(rooms));
    } on DioException catch (e) {
      emit(ChatError(e.response?.data?['message']?.toString() ?? 'Gagal memuat percakapan'));
    } catch (e) {
      emit(ChatError(e.toString()));
    }
  }

  Future<void> _onLoadMessages(ChatMessagesLoadRequested event, Emitter<ChatState> emit) async {
    emit(ChatLoading());
    try {
      final messages = await _repository.getMessages(event.roomId);
      emit(ChatMessagesLoaded(roomId: event.roomId, messages: messages.reversed.toList()));
    } on DioException catch (e) {
      emit(ChatError(e.response?.data?['message']?.toString() ?? 'Gagal memuat pesan'));
    } catch (e) {
      emit(ChatError(e.toString()));
    }
  }

  Future<void> _onSendMessage(ChatSendMessageRequested event, Emitter<ChatState> emit) async {
    try {
      final message = await _repository.sendMessage(event.roomId, event.content, type: event.type);
      emit(ChatMessageSent(message));
      add(ChatMessagesLoadRequested(event.roomId));
    } on DioException catch (e) {
      emit(ChatError(e.response?.data?['message']?.toString() ?? 'Gagal mengirim pesan'));
    } catch (e) {
      emit(ChatError(e.toString()));
    }
  }

  Future<void> _onMarkAsRead(ChatMarkAsReadRequested event, Emitter<ChatState> emit) async {
    try {
      await _repository.markAsRead(event.roomId);
    } catch (_) {}
  }

  Future<void> _onMessageReceived(ChatMessageReceived event, Emitter<ChatState> emit) async {
    final msg = ChatMessageModel.fromJson(event.messageData);
    final currentState = state;
    if (currentState is ChatMessagesLoaded && currentState.roomId == msg.roomId) {
      emit(ChatMessagesLoaded(
        roomId: currentState.roomId,
        messages: [...currentState.messages, msg],
      ));
    }
  }
}
