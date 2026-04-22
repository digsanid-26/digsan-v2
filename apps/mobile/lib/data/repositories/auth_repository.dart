import '../../core/constants/api_constants.dart';
import '../../core/network/api_client.dart';

class AuthRepository {
  final ApiClient _apiClient;

  AuthRepository(this._apiClient);

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await _apiClient.dio.post(
      ApiConstants.login,
      data: {'email': email, 'password': password},
    );
    final data = _unwrap(res.data);
    await _apiClient.saveTokens(data['accessToken'], data['refreshToken']);
    return data;
  }

  Future<Map<String, dynamic>> register({
    required String email,
    required String name,
    required String password,
    String? phone,
  }) async {
    final res = await _apiClient.dio.post(
      ApiConstants.register,
      data: {
        'email': email,
        'name': name,
        'password': password,
        'phone': ?phone,
      },
    );
    return _unwrap(res.data);
  }

  Future<Map<String, dynamic>> getProfile() async {
    final res = await _apiClient.dio.get(ApiConstants.profile);
    return _unwrap(res.data);
  }

  Future<void> forgotPassword(String email) async {
    await _apiClient.dio.post(
      ApiConstants.forgotPassword,
      data: {'email': email},
    );
  }

  Future<void> logout() async {
    final refreshToken = await _apiClient.getRefreshToken();
    try {
      await _apiClient.dio.post(
        ApiConstants.logout,
        data: {'refreshToken': refreshToken},
      );
    } catch (_) {}
    await _apiClient.clearTokens();
  }

  Future<bool> isLoggedIn() async {
    final token = await _apiClient.getAccessToken();
    return token != null;
  }

  Map<String, dynamic> _unwrap(dynamic data) {
    if (data is Map<String, dynamic> && data.containsKey('data')) {
      return data['data'] as Map<String, dynamic>;
    }
    return data as Map<String, dynamic>;
  }
}
