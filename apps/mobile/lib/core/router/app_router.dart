import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/bloc/auth_bloc.dart';
import '../../features/auth/bloc/auth_state.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/auth/screens/register_screen.dart';
import '../../features/auth/screens/forgot_password_screen.dart';
import '../../features/home/screens/home_screen.dart';
import '../../features/tree/screens/tree_list_screen.dart';
import '../../features/tree/screens/tree_detail_screen.dart';
import '../../features/chat/screens/chat_list_screen.dart';
import '../../features/chat/screens/chat_room_screen.dart';
import '../../features/gamification/screens/gamification_screen.dart';
import '../../features/notifications/screens/notifications_screen.dart';
import '../../features/profile/screens/profile_screen.dart';
import '../../features/splash/screens/splash_screen.dart';
import '../../features/job/screens/job_home_screen.dart';
import '../../features/job/screens/job_category_screen.dart';
import '../../features/job/screens/job_search_screen.dart';
import '../../features/job/screens/job_service_detail_screen.dart';
import '../../features/job/screens/job_worker_detail_screen.dart';
import '../../features/job/screens/job_workers_screen.dart';
import '../../features/job/screens/job_orders_screen.dart';
import '../../features/job/screens/job_order_detail_screen.dart';

class AppRouter {
  final AuthBloc authBloc;

  AppRouter(this.authBloc);

  late final GoRouter router = GoRouter(
    initialLocation: '/splash',
    refreshListenable: GoRouterRefreshStream(authBloc.stream),
    redirect: (context, state) {
      final authState = authBloc.state;
      final isOnAuth = state.matchedLocation == '/login' ||
          state.matchedLocation == '/register' ||
          state.matchedLocation == '/forgot-password';
      final isOnSplash = state.matchedLocation == '/splash';

      if (authState is AuthInitial || isOnSplash && authState is AuthLoading) {
        return '/splash';
      }

      if (authState is AuthUnauthenticated) {
        return isOnAuth ? null : '/login';
      }

      if (authState is AuthAuthenticated && isOnAuth) {
        return '/';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => HomeScreen(child: child),
        routes: [
          GoRoute(
            path: '/',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: DashboardTab(),
            ),
          ),
          GoRoute(
            path: '/tree',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: TreeListScreen(),
            ),
            routes: [
              GoRoute(
                path: ':id',
                builder: (context, state) => TreeDetailScreen(
                  treeId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: '/chat',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ChatListScreen(),
            ),
            routes: [
              GoRoute(
                path: ':roomId',
                builder: (context, state) => ChatRoomScreen(
                  roomId: state.pathParameters['roomId']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: '/gamification',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: GamificationScreen(),
            ),
          ),
          GoRoute(
            path: '/notifications',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: NotificationsScreen(),
            ),
          ),
          GoRoute(
            path: '/job',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: JobHomeScreen(),
            ),
            routes: [
              GoRoute(
                path: 'search',
                builder: (context, state) => const JobSearchScreen(),
              ),
              GoRoute(
                path: 'workers',
                builder: (context, state) => const JobWorkersScreen(),
              ),
              GoRoute(
                path: 'orders',
                builder: (context, state) => const JobOrdersScreen(),
              ),
              GoRoute(
                path: 'category/:slug',
                builder: (context, state) => JobCategoryScreen(
                  slug: state.pathParameters['slug']!,
                ),
              ),
              GoRoute(
                path: 'service/:slug',
                builder: (context, state) => JobServiceDetailScreen(
                  slug: state.pathParameters['slug']!,
                ),
              ),
              GoRoute(
                path: 'worker/:id',
                builder: (context, state) => JobWorkerDetailScreen(
                  workerId: state.pathParameters['id']!,
                ),
              ),
              GoRoute(
                path: 'order/:id',
                builder: (context, state) => JobOrderDetailScreen(
                  orderId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: '/profile',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ProfileScreen(),
            ),
          ),
        ],
      ),
    ],
  );
}

class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream stream) {
    stream.listen((_) => notifyListeners());
  }
}

class DashboardTab extends StatelessWidget {
  const DashboardTab({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}
