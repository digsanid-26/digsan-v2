class FamilyTreeModel {
  final String id;
  final String userId;
  final String name;
  final String? description;
  final bool isPublic;
  final String? coverImage;
  final int memberCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  const FamilyTreeModel({
    required this.id,
    required this.userId,
    required this.name,
    this.description,
    this.isPublic = false,
    this.coverImage,
    this.memberCount = 0,
    required this.createdAt,
    required this.updatedAt,
  });

  factory FamilyTreeModel.fromJson(Map<String, dynamic> json) {
    return FamilyTreeModel(
      id: json['id'] as String,
      userId: json['userId'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      isPublic: json['isPublic'] as bool? ?? false,
      coverImage: json['coverImage'] as String?,
      memberCount: (json['_count'] is Map ? json['_count']['members'] : null) as int? ?? 0,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'name': name,
        'description': description,
        'isPublic': isPublic,
        'coverImage': coverImage,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
      };
}

class FamilyMemberModel {
  final String id;
  final String treeId;
  final String? userId;
  final String name;
  final String? gender;
  final DateTime? birthDate;
  final String? birthPlace;
  final DateTime? deathDate;
  final String? photo;
  final String? phone;
  final String? email;
  final bool isCreator;
  final String? familyRole;
  final int? childOrder;
  final String? parentId;
  final String? spouseId;

  const FamilyMemberModel({
    required this.id,
    required this.treeId,
    this.userId,
    required this.name,
    this.gender,
    this.birthDate,
    this.birthPlace,
    this.deathDate,
    this.photo,
    this.phone,
    this.email,
    this.isCreator = false,
    this.familyRole,
    this.childOrder,
    this.parentId,
    this.spouseId,
  });

  factory FamilyMemberModel.fromJson(Map<String, dynamic> json) {
    return FamilyMemberModel(
      id: json['id'] as String,
      treeId: json['treeId'] as String,
      userId: json['userId'] as String?,
      name: json['name'] as String,
      gender: json['gender'] as String?,
      birthDate: json['birthDate'] != null ? DateTime.tryParse(json['birthDate'].toString()) : null,
      birthPlace: json['birthPlace'] as String?,
      deathDate: json['deathDate'] != null ? DateTime.tryParse(json['deathDate'].toString()) : null,
      photo: json['photo'] as String?,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      isCreator: json['isCreator'] as bool? ?? false,
      familyRole: json['familyRole'] as String?,
      childOrder: json['childOrder'] as int?,
      parentId: json['parentId'] as String?,
      spouseId: json['spouseId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'treeId': treeId,
        'userId': userId,
        'name': name,
        'gender': gender,
        'birthDate': birthDate?.toIso8601String(),
        'birthPlace': birthPlace,
        'deathDate': deathDate?.toIso8601String(),
        'photo': photo,
        'phone': phone,
        'email': email,
        'isCreator': isCreator,
        'familyRole': familyRole,
        'childOrder': childOrder,
        'parentId': parentId,
        'spouseId': spouseId,
      };
}
