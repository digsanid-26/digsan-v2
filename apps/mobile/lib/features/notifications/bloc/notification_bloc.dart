import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../data/repositories/notification_repository.dart';
import 'notification_event.dart';
import 'notification_state.dart';

class NotificationBloc extends Bloc<NotificationEvent, NotificationState> {
  final NotificationRepository _repository;

  NotificationBloc(this._repository) : super(NotificationInitial()) {
    on<NotificationLoadRequested>(_onLoad);
    on<NotificationMarkReadRequested>(_onMarkRead);
    on<NotificationMarkAllReadRequested>(_onMarkAllRead);
  }

  Future<void> _onLoad(NotificationLoadRequested event, Emitter<NotificationState> emit) async {
    emit(NotificationLoading());
    try {
      final notifications = await _repository.getNotifications();
      emit(NotificationLoaded(notifications));
    } on DioException catch (e) {
      emit(NotificationError(e.response?.data?['message']?.toString() ?? 'Gagal memuat notifikasi'));
    } catch (e) {
      emit(NotificationError(e.toString()));
    }
  }

  Future<void> _onMarkRead(NotificationMarkReadRequested event, Emitter<NotificationState> emit) async {
    try {
      await _repository.markAsRead(event.id);
      final currentState = state;
      if (currentState is NotificationLoaded) {
        final updated = currentState.notifications.map((n) {
          if (n.id == event.id) return n.copyWith(isRead: true, readAt: DateTime.now());
          return n;
        }).toList();
        emit(NotificationLoaded(updated));
      }
    } catch (_) {}
  }

  Future<void> _onMarkAllRead(NotificationMarkAllReadRequested event, Emitter<NotificationState> emit) async {
    try {
      await _repository.markAllAsRead();
      final currentState = state;
      if (currentState is NotificationLoaded) {
        final updated = currentState.notifications
            .map((n) => n.copyWith(isRead: true, readAt: DateTime.now()))
            .toList();
        emit(NotificationLoaded(updated));
      }
    } catch (_) {}
  }
}
