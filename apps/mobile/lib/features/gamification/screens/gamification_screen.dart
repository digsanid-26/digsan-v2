import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/gamification_bloc.dart';
import '../bloc/gamification_event.dart';
import '../bloc/gamification_state.dart';

class GamificationScreen extends StatefulWidget {
  const GamificationScreen({super.key});

  @override
  State<GamificationScreen> createState() => _GamificationScreenState();
}

class _GamificationScreenState extends State<GamificationScreen> {
  @override
  void initState() {
    super.initState();
    context.read<GamificationBloc>().add(GamificationLoadRequested());
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: BlocConsumer<GamificationBloc, GamificationState>(
        listener: (context, state) {
          if (state is GamificationError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: AppColors.error),
            );
          }
        },
        builder: (context, state) {
          if (state is GamificationLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          final loaded = state is GamificationLoaded ? state : null;
          final balance = loaded?.balance.balance ?? 0;
          final leaderboard = loaded?.leaderboard ?? [];
          final badges = loaded?.badges ?? [];
          final earnedBadgeIds = loaded?.earnedBadgeIds ?? {};

          return RefreshIndicator(
            onRefresh: () async => context.read<GamificationBloc>().add(GamificationLoadRequested()),
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const Text(
                  'Gamifikasi',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 20),

                // Points card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFF59E0B), Color(0xFFEA580C)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.star_rounded, color: Colors.white, size: 36),
                      const SizedBox(height: 8),
                      Text(
                        '$balance',
                        style: const TextStyle(
                          fontSize: 40, fontWeight: FontWeight.bold, color: Colors.white,
                        ),
                      ),
                      Text(
                        'Total Poin',
                        style: TextStyle(fontSize: 14, color: Colors.white.withValues(alpha: 0.85)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),

                // Leaderboard
                const Text(
                  'Leaderboard',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 12),
                if (leaderboard.isEmpty)
                  _emptyState('Belum ada data')
                else
                  ...List.generate(leaderboard.length, (i) {
                    final entry = leaderboard[i];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 30, height: 30,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: i == 0
                                  ? AppColors.amber.withValues(alpha: 0.15)
                                  : i == 1
                                      ? Colors.grey.withValues(alpha: 0.12)
                                      : i == 2
                                          ? Colors.orange.withValues(alpha: 0.12)
                                          : AppColors.divider,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '${i + 1}',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: i < 3 ? AppColors.amber : AppColors.textSecondary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(entry.userName ?? 'User', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                          ),
                          Text(
                            '${entry.totalPoints}',
                            style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.amber),
                          ),
                        ],
                      ),
                    );
                  }),
                const SizedBox(height: 28),

                // Badges
                const Text(
                  'Badge',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 12),
                if (badges.isEmpty)
                  _emptyState('Belum ada badge')
                else
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 1.3,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    itemCount: badges.length,
                    itemBuilder: (_, i) {
                      final badge = badges[i];
                      final earned = earnedBadgeIds.contains(badge.id);
                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: earned ? AppColors.amber.withValues(alpha: 0.08) : Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: earned ? AppColors.amber.withValues(alpha: 0.3) : AppColors.border,
                          ),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(badge.icon ?? '🏅', style: const TextStyle(fontSize: 28)),
                            const SizedBox(height: 6),
                            Text(
                              badge.name,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                                color: earned ? AppColors.textPrimary : AppColors.textSecondary,
                              ),
                            ),
                            if (earned) ...[
                              const SizedBox(height: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.amber.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Text(
                                  'Diperoleh',
                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.amber),
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _emptyState(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Center(child: Text(text, style: TextStyle(color: AppColors.textSecondary))),
    );
  }
}
