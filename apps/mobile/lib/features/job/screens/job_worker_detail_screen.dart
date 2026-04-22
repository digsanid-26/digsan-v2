import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/di/injection.dart';
import '../../../data/models/job_model.dart';
import '../../../data/repositories/job_repository.dart';

class JobWorkerDetailScreen extends StatefulWidget {
  final String workerId;
  const JobWorkerDetailScreen({super.key, required this.workerId});

  @override
  State<JobWorkerDetailScreen> createState() => _JobWorkerDetailScreenState();
}

class _JobWorkerDetailScreenState extends State<JobWorkerDetailScreen> {
  final _repo = getIt<JobRepository>();
  WorkerProfileModel? _worker;
  List<JobReviewModel> _reviews = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final worker = await _repo.getWorkerProfile(widget.workerId);
      List<JobReviewModel> reviews = [];
      try {
        reviews = await _repo.getProviderReviews(widget.workerId);
      } catch (_) {}
      setState(() {
        _worker = worker;
        _reviews = reviews;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_worker?.userName ?? 'Profil Pekerja'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _worker == null
              ? const Center(child: Text('Pekerja tidak ditemukan'))
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    // Profile header
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        children: [
                          CircleAvatar(
                            radius: 40,
                            backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                            child: Text(
                              (_worker!.userName ?? 'U')[0].toUpperCase(),
                              style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: AppColors.primary),
                            ),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            _worker!.userName ?? 'Pekerja',
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                          ),
                          if (_worker!.title != null) ...[
                            const SizedBox(height: 4),
                            Text(_worker!.title!, style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
                          ],
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _StatChip(icon: Icons.star_rounded, value: _worker!.rating?.toStringAsFixed(1) ?? '-', label: 'Rating', color: AppColors.amber),
                              const SizedBox(width: 24),
                              _StatChip(icon: Icons.check_circle, value: '${_worker!.completedOrders}', label: 'Order', color: AppColors.success),
                              const SizedBox(width: 24),
                              _StatChip(icon: Icons.rate_review, value: '${_worker!.totalReviews}', label: 'Review', color: AppColors.primary),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Bio
                    if (_worker!.bio != null && _worker!.bio!.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Tentang', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.textPrimary)),
                            const SizedBox(height: 8),
                            Text(_worker!.bio!, style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.5)),
                          ],
                        ),
                      ),
                    ],

                    // Skills
                    if (_worker!.skills.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Keahlian', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.textPrimary)),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: _worker!.skills.map((s) => Chip(
                                label: Text(s, style: const TextStyle(fontSize: 12)),
                                backgroundColor: AppColors.primary.withValues(alpha: 0.06),
                                side: BorderSide(color: AppColors.primary.withValues(alpha: 0.15)),
                                padding: EdgeInsets.zero,
                                visualDensity: VisualDensity.compact,
                              )).toList(),
                            ),
                          ],
                        ),
                      ),
                    ],

                    // Reviews
                    const SizedBox(height: 24),
                    Text('Review (${_reviews.length})', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                    const SizedBox(height: 14),
                    if (_reviews.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        child: Center(child: Text('Belum ada review', style: TextStyle(color: AppColors.textSecondary))),
                      )
                    else
                      ...List.generate(_reviews.length, (i) {
                        final r = _reviews[i];
                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  ...List.generate(5, (j) => Icon(
                                    j < r.rating ? Icons.star_rounded : Icons.star_border_rounded,
                                    size: 16,
                                    color: AppColors.amber,
                                  )),
                                  const Spacer(),
                                  Text(r.reviewerName ?? '', style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                                ],
                              ),
                              if (r.comment != null && r.comment!.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(r.comment!, style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                              ],
                            ],
                          ),
                        );
                      }),
                  ],
                ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;

  const _StatChip({required this.icon, required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: color, size: 22),
        const SizedBox(height: 4),
        Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary)),
        Text(label, style: TextStyle(fontSize: 11, color: AppColors.textHint)),
      ],
    );
  }
}
