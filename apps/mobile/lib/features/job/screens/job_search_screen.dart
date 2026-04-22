import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/di/injection.dart';
import '../../../data/models/job_model.dart';
import '../../../data/repositories/job_repository.dart';

class JobSearchScreen extends StatefulWidget {
  const JobSearchScreen({super.key});

  @override
  State<JobSearchScreen> createState() => _JobSearchScreenState();
}

class _JobSearchScreenState extends State<JobSearchScreen> {
  final _repo = getIt<JobRepository>();
  final _searchCtrl = TextEditingController();
  List<JobServiceModel> _results = [];
  bool _loading = false;
  bool _searched = false;

  Future<void> _search() async {
    final q = _searchCtrl.text.trim();
    if (q.isEmpty) return;
    setState(() {
      _loading = true;
      _searched = true;
    });
    try {
      final results = await _repo.getServices(query: q);
      setState(() {
        _results = results;
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
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        title: TextField(
          controller: _searchCtrl,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Cari jasa...',
            border: InputBorder.none,
            filled: false,
          ),
          textInputAction: TextInputAction.search,
          onSubmitted: (_) => _search(),
        ),
        actions: [
          IconButton(onPressed: _search, icon: const Icon(Icons.search)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : !_searched
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.search, size: 64, color: AppColors.textHint),
                      const SizedBox(height: 16),
                      Text('Ketik untuk mencari jasa', style: TextStyle(color: AppColors.textSecondary)),
                    ],
                  ),
                )
              : _results.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.search_off, size: 64, color: AppColors.textHint),
                          const SizedBox(height: 16),
                          Text('Tidak ditemukan', style: TextStyle(color: AppColors.textSecondary)),
                        ],
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(20),
                      itemCount: _results.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (_, i) {
                        final svc = _results[i];
                        return ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(color: AppColors.border),
                          ),
                          tileColor: Colors.white,
                          leading: Text(svc.icon ?? '🔧', style: const TextStyle(fontSize: 24)),
                          title: Text(svc.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(svc.priceRange, style: TextStyle(color: AppColors.primary, fontSize: 13)),
                          trailing: const Icon(Icons.chevron_right, color: AppColors.textHint),
                          onTap: () => context.push('/job/service/${svc.slug}'),
                        );
                      },
                    ),
    );
  }
}
