import '../../core/network/api_client.dart';
import '../models/job_model.dart';

class JobRepository {
  final ApiClient _api;

  JobRepository(this._api);

  dynamic _unwrap(dynamic data) {
    if (data is Map && data['data'] != null) return data['data'];
    return data;
  }

  // ─── Catalog ───

  Future<List<JobCategoryModel>> getCategories() async {
    final res = await _api.dio.get('/jobs/catalog/categories');
    final list = _unwrap(res.data);
    if (list is List) {
      return list.map((e) => JobCategoryModel.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<List<JobServiceModel>> getServices({String? categorySlug, String? query}) async {
    final params = <String, dynamic>{};
    if (categorySlug != null) params['category'] = categorySlug;
    if (query != null) params['q'] = query;
    final res = await _api.dio.get('/jobs/catalog/services', queryParameters: params);
    final data = _unwrap(res.data);
    final list = data is Map && data['services'] != null ? data['services'] as List : data is List ? data : [];
    return list.map((e) => JobServiceModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<JobServiceModel> getServiceBySlug(String slug) async {
    final res = await _api.dio.get('/jobs/catalog/services/$slug');
    return JobServiceModel.fromJson(_unwrap(res.data) as Map<String, dynamic>);
  }

  // ─── Workers ───

  Future<List<WorkerProfileModel>> searchWorkers({String? serviceId, String? query}) async {
    final params = <String, dynamic>{};
    if (serviceId != null) params['serviceId'] = serviceId;
    if (query != null) params['q'] = query;
    final res = await _api.dio.get('/jobs/workers', queryParameters: params);
    final data = _unwrap(res.data);
    final list = data is Map && data['workers'] != null ? data['workers'] as List : data is List ? data : [];
    return list.map((e) => WorkerProfileModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<WorkerProfileModel> getWorkerProfile(String id) async {
    final res = await _api.dio.get('/jobs/workers/profile/$id');
    return WorkerProfileModel.fromJson(_unwrap(res.data) as Map<String, dynamic>);
  }

  // ─── Orders ───

  Future<List<JobOrderModel>> getOrders({String role = 'customer', String? status, int page = 1}) async {
    final params = <String, dynamic>{'role': role, 'page': page, 'limit': 20};
    if (status != null) params['status'] = status;
    final res = await _api.dio.get('/jobs/orders', queryParameters: params);
    final data = _unwrap(res.data);
    final list = data is Map && data['orders'] != null ? data['orders'] as List : data is List ? data : [];
    return list.map((e) => JobOrderModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<JobOrderModel> getOrder(String id) async {
    final res = await _api.dio.get('/jobs/orders/$id');
    return JobOrderModel.fromJson(_unwrap(res.data) as Map<String, dynamic>);
  }

  Future<JobOrderModel> createOrder(Map<String, dynamic> data) async {
    final res = await _api.dio.post('/jobs/orders', data: data);
    return JobOrderModel.fromJson(_unwrap(res.data) as Map<String, dynamic>);
  }

  Future<void> updateOrderStatus(String id, String status) async {
    await _api.dio.put('/jobs/orders/$id/status', data: {'status': status});
  }

  // ─── Reviews ───

  Future<List<JobReviewModel>> getProviderReviews(String providerId) async {
    final res = await _api.dio.get('/jobs/reviews/provider/$providerId');
    final data = _unwrap(res.data);
    final list = data is Map && data['reviews'] != null ? data['reviews'] as List : data is List ? data : [];
    return list.map((e) => JobReviewModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> createReview({required String orderId, required int rating, String? comment}) async {
    await _api.dio.post('/jobs/reviews', data: {
      'orderId': orderId,
      'rating': rating,
      'comment': ?comment,
    });
  }
}
