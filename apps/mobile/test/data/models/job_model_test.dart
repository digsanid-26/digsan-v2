import 'package:flutter_test/flutter_test.dart';
import 'package:digsan_mobile/data/models/job_model.dart';

void main() {
  group('JobCategoryModel', () {
    test('fromJson parses correctly with subcategories', () {
      final json = {
        'id': 'cat-1',
        'name': 'Rumah Tangga',
        'slug': 'rumah-tangga',
        'icon': '🏠',
        'description': 'Jasa rumah tangga',
        'subcategories': [
          {
            'id': 'sub-1',
            'name': 'Kebersihan',
            'slug': 'kebersihan',
            'parentId': 'cat-1',
            'services': [],
          },
        ],
      };
      final cat = JobCategoryModel.fromJson(json);
      expect(cat.id, 'cat-1');
      expect(cat.name, 'Rumah Tangga');
      expect(cat.slug, 'rumah-tangga');
      expect(cat.icon, '🏠');
      expect(cat.subcategories.length, 1);
      expect(cat.subcategories.first.name, 'Kebersihan');
    });

    test('fromJson handles missing optional fields', () {
      final json = {'id': 'cat-2', 'name': 'Teknik', 'slug': 'teknik'};
      final cat = JobCategoryModel.fromJson(json);
      expect(cat.icon, isNull);
      expect(cat.description, isNull);
      expect(cat.subcategories, isEmpty);
    });
  });

  group('JobServiceModel', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'svc-1',
        'name': 'Cleaning',
        'slug': 'cleaning',
        'description': 'House cleaning',
        'icon': '🧹',
        'minPrice': 50000,
        'maxPrice': 150000,
        'unit': 'per jam',
      };
      final svc = JobServiceModel.fromJson(json);
      expect(svc.id, 'svc-1');
      expect(svc.name, 'Cleaning');
      expect(svc.minPrice, 50000);
      expect(svc.maxPrice, 150000);
    });

    test('priceRange formats correctly', () {
      final svc1 = JobServiceModel.fromJson({
        'id': '1', 'name': 'A', 'slug': 'a', 'minPrice': 50000, 'maxPrice': 100000,
      });
      expect(svc1.priceRange, contains('50.000'));
      expect(svc1.priceRange, contains('100.000'));

      final svc2 = JobServiceModel.fromJson({'id': '2', 'name': 'B', 'slug': 'b'});
      expect(svc2.priceRange, 'Harga bervariasi');

      final svc3 = JobServiceModel.fromJson({'id': '3', 'name': 'C', 'slug': 'c', 'minPrice': 75000});
      expect(svc3.priceRange, contains('Mulai'));
    });

    test('formatPrice formats numbers with dots', () {
      expect(JobServiceModel.formatPrice(1000), '1.000');
      expect(JobServiceModel.formatPrice(1500000), '1.500.000');
      expect(JobServiceModel.formatPrice(500), '500');
    });
  });

  group('WorkerProfileModel', () {
    test('fromJson parses correctly with user and skills', () {
      final json = {
        'id': 'wp-1',
        'userId': 'u-1',
        'title': 'Tukang Bersih',
        'bio': 'Pengalaman 5 tahun',
        'rating': 4.5,
        'totalReviews': 12,
        'completedOrders': 30,
        'status': 'APPROVED',
        'user': {'name': 'Budi', 'avatar': 'https://example.com/budi.jpg'},
        'skills': [
          {'name': 'Cleaning'},
          {'name': 'Cooking'},
        ],
      };
      final w = WorkerProfileModel.fromJson(json);
      expect(w.id, 'wp-1');
      expect(w.userName, 'Budi');
      expect(w.rating, 4.5);
      expect(w.skills, ['Cleaning', 'Cooking']);
      expect(w.status, 'APPROVED');
    });

    test('fromJson handles missing user', () {
      final json = {'id': 'wp-2', 'userId': 'u-2'};
      final w = WorkerProfileModel.fromJson(json);
      expect(w.userName, isNull);
      expect(w.skills, isEmpty);
      expect(w.status, 'PENDING');
    });
  });

  group('JobOrderModel', () {
    test('fromJson parses correctly with nested objects', () {
      final json = {
        'id': 'ord-1',
        'orderNumber': 'ORD-001',
        'status': 'IN_PROGRESS',
        'totalAmount': 200000,
        'address': 'Jl. Merdeka 10',
        'scheduledDate': '2025-06-15T10:00:00.000Z',
        'createdAt': '2025-06-01T08:00:00.000Z',
        'service': {'name': 'House Cleaning'},
        'provider': {'name': 'Budi'},
        'customer': {'name': 'Andi'},
      };
      final o = JobOrderModel.fromJson(json);
      expect(o.id, 'ord-1');
      expect(o.orderNumber, 'ORD-001');
      expect(o.status, 'IN_PROGRESS');
      expect(o.totalAmount, 200000);
      expect(o.serviceName, 'House Cleaning');
      expect(o.providerName, 'Budi');
      expect(o.customerName, 'Andi');
      expect(o.scheduledDate, isNotNull);
    });

    test('fromJson handles minimal data', () {
      final json = {'id': 'ord-2', 'createdAt': '2025-01-01T00:00:00Z'};
      final o = JobOrderModel.fromJson(json);
      expect(o.orderNumber, '');
      expect(o.status, 'PENDING');
      expect(o.totalAmount, 0);
      expect(o.serviceName, isNull);
    });
  });

  group('JobReviewModel', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'rev-1',
        'orderId': 'ord-1',
        'rating': 5,
        'comment': 'Sangat memuaskan!',
        'reviewer': {'name': 'Andi'},
        'createdAt': '2025-06-02T12:00:00.000Z',
      };
      final r = JobReviewModel.fromJson(json);
      expect(r.id, 'rev-1');
      expect(r.rating, 5);
      expect(r.comment, 'Sangat memuaskan!');
      expect(r.reviewerName, 'Andi');
    });

    test('fromJson handles missing reviewer', () {
      final json = {
        'id': 'rev-2',
        'orderId': 'ord-2',
        'rating': 3,
        'createdAt': '2025-06-03T00:00:00Z',
      };
      final r = JobReviewModel.fromJson(json);
      expect(r.reviewerName, isNull);
      expect(r.comment, isNull);
    });
  });
}
