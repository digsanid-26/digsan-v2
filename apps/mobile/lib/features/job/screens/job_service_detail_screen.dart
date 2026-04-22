import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/di/injection.dart';
import '../../../data/models/job_model.dart';
import '../../../data/repositories/job_repository.dart';

class JobServiceDetailScreen extends StatefulWidget {
  final String slug;
  const JobServiceDetailScreen({super.key, required this.slug});

  @override
  State<JobServiceDetailScreen> createState() => _JobServiceDetailScreenState();
}

class _JobServiceDetailScreenState extends State<JobServiceDetailScreen> {
  final _repo = getIt<JobRepository>();
  JobServiceModel? _service;
  List<WorkerProfileModel> _workers = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final svc = await _repo.getServiceBySlug(widget.slug);
      final workers = await _repo.searchWorkers(serviceId: svc.id);
      setState(() {
        _service = svc;
        _workers = workers;
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
        title: Text(_service?.name ?? 'Detail Jasa'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _service == null
              ? const Center(child: Text('Jasa tidak ditemukan'))
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    // Service info
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_service!.icon ?? '🔧', style: const TextStyle(fontSize: 40)),
                          const SizedBox(height: 12),
                          Text(_service!.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                          if (_service!.description != null) ...[
                            const SizedBox(height: 8),
                            Text(_service!.description!, style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.5)),
                          ],
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              _service!.priceRange,
                              style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.primary),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 28),

                    // Available workers
                    Text(
                      'Pekerja Tersedia (${_workers.length})',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 14),
                    if (_workers.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 32),
                        child: Center(child: Text('Belum ada pekerja', style: TextStyle(color: AppColors.textSecondary))),
                      )
                    else
                      ...List.generate(_workers.length, (i) {
                        final w = _workers[i];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _WorkerCard(
                            worker: w,
                            onTap: () => context.push('/job/worker/${w.id}'),
                          ),
                        );
                      }),
                  ],
                ),
    );
  }
}

class _WorkerCard extends StatelessWidget {
  final WorkerProfileModel worker;
  final VoidCallback onTap;

  const _WorkerCard({required this.worker, required this.onTap});

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
            CircleAvatar(
              radius: 24,
              backgroundColor: AppColors.primary.withValues(alpha: 0.1),
              child: Text(
                (worker.userName ?? 'U')[0].toUpperCase(),
                style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 18),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(worker.userName ?? 'Pekerja', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: AppColors.textPrimary)),
                  if (worker.title != null)
                    Text(worker.title!, style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      if (worker.rating != null) ...[
                        const Icon(Icons.star_rounded, size: 16, color: AppColors.amber),
                        const SizedBox(width: 3),
                        Text(worker.rating!.toStringAsFixed(1), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        Text(' (${worker.totalReviews})', style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                        const SizedBox(width: 12),
                      ],
                      Text('${worker.completedOrders} order', style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textHint),
          ],
        ),
      ),
    );
  }
}
