import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/di/injection.dart';
import '../../../data/models/job_model.dart';
import '../../../data/repositories/job_repository.dart';

class JobWorkersScreen extends StatefulWidget {
  const JobWorkersScreen({super.key});

  @override
  State<JobWorkersScreen> createState() => _JobWorkersScreenState();
}

class _JobWorkersScreenState extends State<JobWorkersScreen> {
  final _repo = getIt<JobRepository>();
  final _searchCtrl = TextEditingController();
  List<WorkerProfileModel> _workers = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({String? query}) async {
    setState(() => _loading = true);
    try {
      final workers = await _repo.searchWorkers(query: query);
      setState(() {
        _workers = workers;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Cari Pekerja'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Cari berdasarkan nama atau keahlian...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.border)),
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
              textInputAction: TextInputAction.search,
              onSubmitted: (q) => _load(query: q.trim().isEmpty ? null : q.trim()),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _workers.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.person_search, size: 64, color: AppColors.textHint),
                            const SizedBox(height: 16),
                            Text('Tidak ada pekerja ditemukan', style: TextStyle(color: AppColors.textSecondary)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () => _load(),
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                          itemCount: _workers.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 12),
                          itemBuilder: (_, i) {
                            final w = _workers[i];
                            return GestureDetector(
                              onTap: () => context.push('/job/worker/${w.id}'),
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
                                      radius: 26,
                                      backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                                      child: Text(
                                        (w.userName ?? 'U')[0].toUpperCase(),
                                        style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 18),
                                      ),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(w.userName ?? 'Pekerja', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: AppColors.textPrimary)),
                                          if (w.title != null)
                                            Text(w.title!, style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                                          const SizedBox(height: 6),
                                          Row(
                                            children: [
                                              if (w.rating != null) ...[
                                                const Icon(Icons.star_rounded, size: 16, color: AppColors.amber),
                                                const SizedBox(width: 3),
                                                Text(w.rating!.toStringAsFixed(1), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                                const SizedBox(width: 8),
                                              ],
                                              Text('${w.completedOrders} order selesai', style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                                            ],
                                          ),
                                          if (w.skills.isNotEmpty) ...[
                                            const SizedBox(height: 8),
                                            Wrap(
                                              spacing: 6,
                                              runSpacing: 4,
                                              children: w.skills.take(3).map((s) => Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: AppColors.primary.withValues(alpha: 0.06),
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: Text(s, style: const TextStyle(fontSize: 11, color: AppColors.primary)),
                                              )).toList(),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                    const Icon(Icons.chevron_right, color: AppColors.textHint),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
