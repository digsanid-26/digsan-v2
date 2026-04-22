import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../data/models/gamification_model.dart';
import '../../../data/repositories/gamification_repository.dart';
import 'gamification_event.dart';
import 'gamification_state.dart';

class GamificationBloc extends Bloc<GamificationEvent, GamificationState> {
  final GamificationRepository _repository;

  GamificationBloc(this._repository) : super(GamificationInitial()) {
    on<GamificationLoadRequested>(_onLoad);
  }

  Future<void> _onLoad(GamificationLoadRequested event, Emitter<GamificationState> emit) async {
    emit(GamificationLoading());
    try {
      final results = await Future.wait([
        _repository.getBalance().catchError((_) => const PointBalanceModel(balance: 0)),
        _repository.getLeaderboard().catchError((_) => <LeaderboardEntryModel>[]),
        _repository.getAllBadges().catchError((_) => <BadgeModel>[]),
        _repository.getEarnedBadgeIds().catchError((_) => <String>{}),
      ]);

      emit(GamificationLoaded(
        balance: results[0] as PointBalanceModel,
        leaderboard: results[1] as List<LeaderboardEntryModel>,
        badges: results[2] as List<BadgeModel>,
        earnedBadgeIds: results[3] as Set<String>,
      ));
    } catch (e) {
      emit(GamificationError(e.toString()));
    }
  }
}
