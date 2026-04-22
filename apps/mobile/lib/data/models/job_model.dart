class JobCategoryModel {
  final String id;
  final String name;
  final String slug;
  final String? icon;
  final String? description;
  final List<JobSubCategoryModel> subcategories;

  const JobCategoryModel({
    required this.id,
    required this.name,
    required this.slug,
    this.icon,
    this.description,
    this.subcategories = const [],
  });

  factory JobCategoryModel.fromJson(Map<String, dynamic> json) {
    return JobCategoryModel(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      icon: json['icon'] as String?,
      description: json['description'] as String?,
      subcategories: (json['subcategories'] as List?)
              ?.map((e) => JobSubCategoryModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class JobSubCategoryModel {
  final String id;
  final String name;
  final String slug;
  final String? parentId;
  final List<JobServiceModel> services;

  const JobSubCategoryModel({
    required this.id,
    required this.name,
    required this.slug,
    this.parentId,
    this.services = const [],
  });

  factory JobSubCategoryModel.fromJson(Map<String, dynamic> json) {
    return JobSubCategoryModel(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      parentId: json['parentId'] as String?,
      services: (json['services'] as List?)
              ?.map((e) => JobServiceModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class JobServiceModel {
  final String id;
  final String name;
  final String slug;
  final String? description;
  final String? icon;
  final int? minPrice;
  final int? maxPrice;
  final String? unit;
  final String? subcategoryId;

  const JobServiceModel({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.icon,
    this.minPrice,
    this.maxPrice,
    this.unit,
    this.subcategoryId,
  });

  factory JobServiceModel.fromJson(Map<String, dynamic> json) {
    return JobServiceModel(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      description: json['description'] as String?,
      icon: json['icon'] as String?,
      minPrice: json['minPrice'] as int?,
      maxPrice: json['maxPrice'] as int?,
      unit: json['unit'] as String?,
      subcategoryId: json['subcategoryId'] as String?,
    );
  }

  String get priceRange {
    if (minPrice == null && maxPrice == null) return 'Harga bervariasi';
    if (minPrice != null && maxPrice != null) return 'Rp ${formatPrice(minPrice!)} - ${formatPrice(maxPrice!)}';
    if (minPrice != null) return 'Mulai Rp ${formatPrice(minPrice!)}';
    return 'Maks Rp ${formatPrice(maxPrice!)}';
  }

  static String formatPrice(int n) {
    final s = n.toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
      buf.write(s[i]);
    }
    return buf.toString();
  }
}

class WorkerProfileModel {
  final String id;
  final String userId;
  final String? title;
  final String? bio;
  final double? rating;
  final int totalReviews;
  final int completedOrders;
  final String status;
  final String? userName;
  final String? userAvatar;
  final List<String> skills;

  const WorkerProfileModel({
    required this.id,
    required this.userId,
    this.title,
    this.bio,
    this.rating,
    this.totalReviews = 0,
    this.completedOrders = 0,
    this.status = 'PENDING',
    this.userName,
    this.userAvatar,
    this.skills = const [],
  });

  factory WorkerProfileModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    final skillsList = <String>[];
    if (json['skills'] is List) {
      for (final s in json['skills']) {
        if (s is Map) {
          skillsList.add(s['name']?.toString() ?? '');
        } else if (s is String) {
          skillsList.add(s);
        }
      }
    }
    return WorkerProfileModel(
      id: json['id'] as String,
      userId: json['userId'] as String,
      title: json['title'] as String?,
      bio: json['bio'] as String?,
      rating: (json['rating'] as num?)?.toDouble(),
      totalReviews: json['totalReviews'] as int? ?? 0,
      completedOrders: json['completedOrders'] as int? ?? 0,
      status: json['status'] as String? ?? 'PENDING',
      userName: user?['name'] as String?,
      userAvatar: user?['avatar'] as String?,
      skills: skillsList,
    );
  }
}

class JobOrderModel {
  final String id;
  final String orderNumber;
  final String status;
  final String? serviceId;
  final String? serviceName;
  final String? description;
  final int totalAmount;
  final String? address;
  final DateTime? scheduledDate;
  final String? providerName;
  final String? customerName;
  final DateTime createdAt;

  const JobOrderModel({
    required this.id,
    required this.orderNumber,
    required this.status,
    this.serviceId,
    this.serviceName,
    this.description,
    this.totalAmount = 0,
    this.address,
    this.scheduledDate,
    this.providerName,
    this.customerName,
    required this.createdAt,
  });

  factory JobOrderModel.fromJson(Map<String, dynamic> json) {
    final service = json['service'] as Map<String, dynamic>?;
    final provider = json['provider'] as Map<String, dynamic>?;
    final customer = json['customer'] as Map<String, dynamic>?;
    return JobOrderModel(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      serviceId: json['serviceId'] as String?,
      serviceName: service?['name'] as String? ?? json['serviceName'] as String?,
      description: json['description'] as String?,
      totalAmount: json['totalAmount'] as int? ?? 0,
      address: json['address'] as String?,
      scheduledDate: json['scheduledDate'] != null
          ? DateTime.tryParse(json['scheduledDate'].toString())
          : null,
      providerName: provider?['name'] as String?,
      customerName: customer?['name'] as String?,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
    );
  }
}

class JobReviewModel {
  final String id;
  final String orderId;
  final int rating;
  final String? comment;
  final String? reviewerName;
  final DateTime createdAt;

  const JobReviewModel({
    required this.id,
    required this.orderId,
    required this.rating,
    this.comment,
    this.reviewerName,
    required this.createdAt,
  });

  factory JobReviewModel.fromJson(Map<String, dynamic> json) {
    final reviewer = json['reviewer'] as Map<String, dynamic>?;
    return JobReviewModel(
      id: json['id'] as String,
      orderId: json['orderId'] as String,
      rating: json['rating'] as int? ?? 0,
      comment: json['comment'] as String?,
      reviewerName: reviewer?['name'] as String?,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
    );
  }
}
