import 'package:equatable/equatable.dart';

abstract class GamificationEvent extends Equatable {
  const GamificationEvent();
  @override
  List<Object?> get props => [];
}

class GamificationLoadRequested extends GamificationEvent {}
