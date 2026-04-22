import '../../core/network/api_client.dart';
import '../models/gamification_model.dart';

class GamificationRepository {
  final ApiClient _api;

  GamificationRepository(this._api);

  dynamic _unwrap(dynamic data) {
    if (data is Map && data['data'] != null) return data['data'];
    return data;
  }

  Future<PointBalanceModel> getBalance() async {
    final res = await _api.dio.get('/gamification/points/balance');
    return PointBalanceModel.fromJson(_unwrap(res.data) as Map<String, dynamic>);
  }

  Future<List<LeaderboardEntryModel>> getLeaderboard({int limit = 10}) async {
    final res = await _api.dio.get('/gamification/leaderboard', queryParameters: {'limit': limit});
    final list = _unwrap(res.data);
    if (list is List) {
      return list.map((e) => LeaderboardEntryModel.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<List<BadgeModel>> getAllBadges() async {
    final res = await _api.dio.get('/gamification/badges');
    final list = _unwrap(res.data);
    if (list is List) {
      return list.map((e) => BadgeModel.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<Set<String>> getEarnedBadgeIds() async {
    final res = await _api.dio.get('/gamification/badges/me');
    final list = _unwrap(res.data);
    if (list is List) {
      return list.map<String>((e) => (e as Map<String, dynamic>)['badgeId'].toString()).toSet();
    }
    return {};
  }
}
