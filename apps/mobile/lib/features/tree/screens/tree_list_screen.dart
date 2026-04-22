import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/tree_bloc.dart';
import '../bloc/tree_event.dart';
import '../bloc/tree_state.dart';

class TreeListScreen extends StatefulWidget {
  const TreeListScreen({super.key});

  @override
  State<TreeListScreen> createState() => _TreeListScreenState();
}

class _TreeListScreenState extends State<TreeListScreen> {
  @override
  void initState() {
    super.initState();
    context.read<TreeBloc>().add(TreeLoadRequested());
  }

  void _createTree() async {
    final name = await _showCreateDialog();
    if (name == null || name.isEmpty) return;
    if (mounted) {
      context.read<TreeBloc>().add(TreeCreateRequested(name: name));
    }
  }

  Future<String?> _showCreateDialog() {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Pohon Keluarga Baru'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'Nama pohon keluarga',
            border: OutlineInputBorder(),
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Buat'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: BlocConsumer<TreeBloc, TreeState>(
        listener: (context, state) {
          if (state is TreeError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: AppColors.error),
            );
          } else if (state is TreeOperationSuccess) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message)),
            );
          }
        },
        builder: (context, state) {
          final isLoading = state is TreeLoading;
          final trees = state is TreeListLoaded ? state.trees : [];

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Pohon Keluarga',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    IconButton.filled(
                      onPressed: _createTree,
                      icon: const Icon(Icons.add, size: 20),
                      style: IconButton.styleFrom(backgroundColor: AppColors.primary),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : trees.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.account_tree_outlined, size: 64, color: AppColors.textHint),
                                const SizedBox(height: 16),
                                Text('Belum ada pohon keluarga',
                                    style: TextStyle(fontSize: 16, color: AppColors.textSecondary)),
                                const SizedBox(height: 8),
                                TextButton(onPressed: _createTree, child: const Text('Buat Sekarang')),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: () async => context.read<TreeBloc>().add(TreeLoadRequested()),
                            child: ListView.separated(
                              padding: const EdgeInsets.all(20),
                              itemCount: trees.length,
                              separatorBuilder: (_, _) => const SizedBox(height: 12),
                              itemBuilder: (_, i) {
                                final tree = trees[i];
                                return _TreeCard(
                                  name: tree.name,
                                  description: tree.description ?? '',
                                  members: tree.memberCount,
                                  onTap: () => context.go('/tree/${tree.id}'),
                                );
                              },
                            ),
                          ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _TreeCard extends StatelessWidget {
  final String name;
  final String description;
  final int members;
  final VoidCallback onTap;

  const _TreeCard({
    required this.name,
    required this.description,
    required this.members,
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
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.secondary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.account_tree, color: AppColors.secondary),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 16, color: AppColors.textPrimary,
                  )),
                  if (description.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(description,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    ),
                  const SizedBox(height: 6),
                  Text('$members anggota',
                      style: TextStyle(fontSize: 12, color: AppColors.textHint)),
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
