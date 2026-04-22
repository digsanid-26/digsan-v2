import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../widgets/dashboard_content.dart';

class HomeScreen extends StatelessWidget {
  final Widget child;
  const HomeScreen({super.key, required this.child});

  static const _tabs = [
    ('/', Icons.home_outlined, Icons.home, 'Beranda'),
    ('/tree', Icons.account_tree_outlined, Icons.account_tree, 'Silsilah'),
    ('/chat', Icons.chat_bubble_outline, Icons.chat_bubble, 'Chat'),
    ('/gamification', Icons.emoji_events_outlined, Icons.emoji_events, 'Poin'),
    ('/profile', Icons.person_outline, Icons.person, 'Profil'),
  ];

  int _currentIndex(String location) {
    if (location == '/') return 0;
    for (int i = 1; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].$1)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final index = _currentIndex(location);
    final showDashboard = location == '/';

    return Scaffold(
      backgroundColor: AppColors.background,
      body: showDashboard ? const DashboardContent() : child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => context.go(_tabs[i].$1),
        backgroundColor: Colors.white,
        elevation: 1,
        indicatorColor: AppColors.primaryLight,
        destinations: _tabs
            .map((t) => NavigationDestination(
                  icon: Icon(t.$2),
                  selectedIcon: Icon(t.$3, color: AppColors.primary),
                  label: t.$4,
                ))
            .toList(),
      ),
    );
  }
}
