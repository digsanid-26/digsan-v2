class PointBalanceModel {
  final int balance;
  final int totalEarned;

  const PointBalanceModel({required this.balance, this.totalEarned = 0});

  factory PointBalanceModel.fromJson(Map<String, dynamic> json) {
    return PointBalanceModel(
      balance: json['balance'] as int? ?? 0,
      totalEarned: json['totalEarned'] as int? ?? 0,
    );
  }
}

class BadgeModel {
  final String id;
  final String name;
  final String? description;
  final String? icon;
  final String? category;
  final String? tier;

  const BadgeModel({
    required this.id,
    required this.name,
    this.description,
    this.icon,
    this.category,
    this.tier,
  });

  factory BadgeModel.fromJson(Map<String, dynamic> json) {
    return BadgeModel(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      icon: json['icon'] as String?,
      category: json['category'] as String?,
      tier: json['tier'] as String?,
    );
  }
}

class LeaderboardEntryModel {
  final String userId;
  final String? userName;
  final String? userAvatar;
  final int totalPoints;

  const LeaderboardEntryModel({
    required this.userId,
    this.userName,
    this.userAvatar,
    required this.totalPoints,
  });

  factory LeaderboardEntryModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return LeaderboardEntryModel(
      userId: json['userId'] as String? ?? user?['id'] as String? ?? '',
      userName: user?['name'] as String? ?? json['name'] as String?,
      userAvatar: user?['avatar'] as String?,
      totalPoints: json['_sum']?['amount'] as int? ?? json['totalPoints'] as int? ?? 0,
    );
  }
}
