import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/di/injection.dart';
import '../../../core/network/api_client.dart';

class TreeDetailScreen extends StatefulWidget {
  final String treeId;
  const TreeDetailScreen({super.key, required this.treeId});

  @override
  State<TreeDetailScreen> createState() => _TreeDetailScreenState();
}

class _TreeDetailScreenState extends State<TreeDetailScreen> {
  final _api = getIt<ApiClient>();
  Map<String, dynamic>? _tree;
  List<dynamic> _members = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final treeRes = await _api.dio.get('/trees/${widget.treeId}');
      final membersRes = await _api.dio.get('/trees/${widget.treeId}/members');
      final treeData = _unwrap(treeRes.data);
      final membersData = _unwrap(membersRes.data);

      setState(() {
        _tree = treeData is Map<String, dynamic> ? treeData : {};
        _members = membersData is List
            ? membersData
            : (membersData is Map && membersData['members'] is List)
                ? membersData['members']
                : [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  dynamic _unwrap(dynamic data) {
    if (data is Map && data['data'] != null) return data['data'];
    return data;
  }

  Future<void> _addMember() async {
    final result = await _showAddMemberDialog();
    if (result == null) return;
    try {
      await _api.dio.post('/trees/${widget.treeId}/members', data: result);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Gagal menambahkan anggota'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<Map<String, dynamic>?> _showAddMemberDialog() {
    final firstNameCtrl = TextEditingController();
    final lastNameCtrl = TextEditingController();
    String gender = 'MALE';

    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Tambah Anggota'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: firstNameCtrl,
                decoration: const InputDecoration(labelText: 'Nama Depan', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: lastNameCtrl,
                decoration: const InputDecoration(labelText: 'Nama Belakang', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: gender,
                decoration: const InputDecoration(labelText: 'Jenis Kelamin', border: OutlineInputBorder()),
                items: const [
                  DropdownMenuItem(value: 'MALE', child: Text('Laki-laki')),
                  DropdownMenuItem(value: 'FEMALE', child: Text('Perempuan')),
                ],
                onChanged: (v) => setDialogState(() => gender = v!),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
            FilledButton(
              onPressed: () {
                if (firstNameCtrl.text.trim().isEmpty) return;
                Navigator.pop(ctx, {
                  'firstName': firstNameCtrl.text.trim(),
                  'lastName': lastNameCtrl.text.trim(),
                  'gender': gender,
                });
              },
              child: const Text('Tambah'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_tree?['name'] ?? 'Detail'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_outlined),
            onPressed: _addMember,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _members.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.people_outline, size: 64, color: AppColors.textHint),
                      const SizedBox(height: 16),
                      Text('Belum ada anggota', style: TextStyle(color: AppColors.textSecondary)),
                      const SizedBox(height: 8),
                      TextButton(onPressed: _addMember, child: const Text('Tambah Anggota')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(20),
                    itemCount: _members.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final m = _members[i];
                      final isMale = m['gender'] == 'MALE';
                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 20,
                              backgroundColor: isMale
                                  ? AppColors.primary.withValues(alpha: 0.1)
                                  : AppColors.pink.withValues(alpha: 0.1),
                              child: Text(
                                (m['firstName'] ?? '?')[0].toUpperCase(),
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: isMale ? AppColors.primary : AppColors.pink,
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${m['firstName'] ?? ''} ${m['lastName'] ?? ''}'.trim(),
                                    style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    isMale ? 'Laki-laki' : 'Perempuan',
                                    style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
