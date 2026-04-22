class ApiConstants {
  static const String baseUrl = 'http://10.0.2.2:4000/api';
  static const String wsUrl = 'http://10.0.2.2:4000';

  // Auth
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String verifyEmail = '/auth/verify-email';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';
  static const String refreshToken = '/auth/refresh-token';
  static const String logout = '/auth/logout';

  // User
  static const String profile = '/users/me';

  // Trees
  static const String trees = '/trees';

  // Chat
  static const String chatRooms = '/chat/rooms';

  // Gamification
  static const String pointsBalance = '/gamification/points/balance';
  static const String pointsHistory = '/gamification/points/history';
  static const String leaderboard = '/gamification/leaderboard';
  static const String badges = '/gamification/badges';
  static const String myBadges = '/gamification/badges/me';

  // Notifications
  static const String notifications = '/notifications';

  // Admin
  static const String adminDashboard = '/admin/dashboard';
  static const String adminUsers = '/admin/users';
  static const String adminWorkers = '/admin/workers';
  static const String adminSettings = '/admin/settings';
}
