import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/di/injection.dart';
import '../../../core/network/api_client.dart';
import '../../auth/bloc/auth_bloc.dart';
import '../../auth/bloc/auth_state.dart';

class DashboardContent extends StatefulWidget {
  const DashboardContent({super.key});

  @override
  State<DashboardContent> createState() => _DashboardContentState();
}

class _DashboardContentState extends State<DashboardContent> {
  final _api = getIt<ApiClient>();
  int _treeCount = 0;
  int _chatCount = 0;
  int _points = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    try {
      final results = await Future.wait([
        _api.dio.get('/trees').catchError((_) => _emptyResponse()),
        _api.dio.get('/chat/rooms').catchError((_) => _emptyResponse()),
        _api.dio.get('/gamification/points/balance').catchError((_) => _emptyResponse()),
      ]);

      if (!mounted) return;

      final trees = _unwrapList(results[0].data);
      final rooms = _unwrapList(results[1].data);
      final balance = _unwrapMap(results[2].data);

      setState(() {
        _treeCount = trees.length;
        _chatCount = rooms.length;
        _points = (balance['balance'] ?? 0) as int;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  dynamic _emptyResponse() {
    return _FakeResponse();
  }

  List _unwrapList(dynamic data) {
    if (data is Map && data['data'] is List) return data['data'];
    if (data is List) return data;
    return [];
  }

  Map<String, dynamic> _unwrapMap(dynamic data) {
    if (data is Map && data['data'] is Map) return data['data'] as Map<String, dynamic>;
    if (data is Map<String, dynamic>) return data;
    return {};
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final userName = authState is AuthAuthenticated
        ? authState.user['name'] ?? 'User'
        : 'User';

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async {
          setState(() => _loading = true);
          await _loadStats();
        },
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const SizedBox(height: 8),
            Text(
              'Halo, $userName!',
              style: const TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Selamat datang di Digsan',
              style: TextStyle(fontSize: 15, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 24),

            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator(),
                ),
              )
            else ...[
              // Stats cards
              Row(
                children: [
                  _StatCard(
                    icon: Icons.account_tree,
                    label: 'Silsilah',
                    value: '$_treeCount',
                    color: AppColors.secondary,
                    onTap: () => context.go('/tree'),
                  ),
                  const SizedBox(width: 12),
                  _StatCard(
                    icon: Icons.chat_bubble,
                    label: 'Chat',
                    value: '$_chatCount',
                    color: AppColors.primary,
                    onTap: () => context.go('/chat'),
                  ),
                  const SizedBox(width: 12),
                  _StatCard(
                    icon: Icons.emoji_events,
                    label: 'Poin',
                    value: '$_points',
                    color: AppColors.amber,
                    onTap: () => context.go('/gamification'),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Kerja banner
              GestureDetector(
                onTap: () => context.go('/job'),
                child: Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF2563EB), Color(0xFF7C3AED)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.work_outline, color: Colors.white, size: 28),
                      ),
                      const SizedBox(width: 16),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Digsan Kerja', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                            SizedBox(height: 4),
                            Text('Cari jasa & pekerja terpercaya', style: TextStyle(fontSize: 13, color: Colors.white70)),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios, color: Colors.white70, size: 16),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 28),

              // Quick actions
              const Text(
                'Aksi Cepat',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              _QuickAction(
                icon: Icons.account_tree_outlined,
                title: 'Buat Pohon Keluarga',
                subtitle: 'Mulai silsilah keluarga baru',
                color: AppColors.secondary,
                onTap: () => context.go('/tree'),
              ),
              const SizedBox(height: 10),
              _QuickAction(
                icon: Icons.chat_bubble_outline,
                title: 'Mulai Chat',
                subtitle: 'Obrolan dengan keluarga',
                color: AppColors.primary,
                onTap: () => context.go('/chat'),
              ),
              const SizedBox(height: 10),
              _QuickAction(
                icon: Icons.work_outline,
                title: 'Cari Jasa',
                subtitle: 'Temukan pekerja & layanan',
                color: AppColors.purple,
                onTap: () => context.go('/job'),
              ),
              const SizedBox(height: 10),
              _QuickAction(
                icon: Icons.notifications_outlined,
                title: 'Notifikasi',
                subtitle: 'Lihat pemberitahuan terbaru',
                color: AppColors.amber,
                onTap: () => context.go('/notifications'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final VoidCallback onTap;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(height: 10),
              Text(
                value,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  )),
                  const SizedBox(height: 2),
                  Text(subtitle, style: TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  )),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: AppColors.textHint),
          ],
        ),
      ),
    );
  }
}

class _FakeResponse {
  final dynamic data = [];
}
