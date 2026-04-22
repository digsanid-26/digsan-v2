class UserModel {
  final String id;
  final String email;
  final String name;
  final String? phone;
  final String? avatar;
  final String? bio;
  final String provider;
  final String status;
  final List<String> roles;
  final DateTime createdAt;

  const UserModel({
    required this.id,
    required this.email,
    required this.name,
    this.phone,
    this.avatar,
    this.bio,
    this.provider = 'credentials',
    this.status = 'ACTIVE',
    this.roles = const [],
    required this.createdAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final rolesList = <String>[];
    if (json['roles'] is List) {
      for (final r in json['roles']) {
        if (r is String) {
          rolesList.add(r);
        } else if (r is Map) {
          rolesList.add(r['name']?.toString() ?? r['role']?['name']?.toString() ?? '');
        }
      }
    }
    return UserModel(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String,
      phone: json['phone'] as String?,
      avatar: json['avatar'] as String?,
      bio: json['bio'] as String?,
      provider: json['provider'] as String? ?? 'credentials',
      status: json['status'] as String? ?? 'ACTIVE',
      roles: rolesList,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'phone': phone,
        'avatar': avatar,
        'bio': bio,
        'provider': provider,
        'status': status,
        'roles': roles,
        'createdAt': createdAt.toIso8601String(),
      };
}
