import 'package:equatable/equatable.dart';

abstract class NotificationEvent extends Equatable {
  const NotificationEvent();
  @override
  List<Object?> get props => [];
}

class NotificationLoadRequested extends NotificationEvent {}

class NotificationMarkReadRequested extends NotificationEvent {
  final String id;
  const NotificationMarkReadRequested(this.id);
  @override
  List<Object?> get props => [id];
}

class NotificationMarkAllReadRequested extends NotificationEvent {}
