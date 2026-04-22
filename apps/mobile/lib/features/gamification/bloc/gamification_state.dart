import 'package:equatable/equatable.dart';
import '../../../data/models/gamification_model.dart';

abstract class GamificationState extends Equatable {
  const GamificationState();
  @override
  List<Object?> get props => [];
}

class GamificationInitial extends GamificationState {}

class GamificationLoading extends GamificationState {}

class GamificationLoaded extends GamificationState {
  final PointBalanceModel balance;
  final List<LeaderboardEntryModel> leaderboard;
  final List<BadgeModel> badges;
  final Set<String> earnedBadgeIds;

  const GamificationLoaded({
    required this.balance,
    required this.leaderboard,
    required this.badges,
    required this.earnedBadgeIds,
  });

  @override
  List<Object?> get props => [balance, leaderboard, badges, earnedBadgeIds];
}

class GamificationError extends GamificationState {
  final String message;
  const GamificationError(this.message);
  @override
  List<Object?> get props => [message];
}
