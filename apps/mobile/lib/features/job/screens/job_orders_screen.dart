import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../../core/constants/app_colors.dart';
import '../../../core/di/injection.dart';
import '../../../data/models/job_model.dart';
import '../../../data/repositories/job_repository.dart';

class JobOrdersScreen extends StatefulWidget {
  const JobOrdersScreen({super.key});

  @override
  State<JobOrdersScreen> createState() => _JobOrdersScreenState();
}

class _JobOrdersScreenState extends State<JobOrdersScreen> with SingleTickerProviderStateMixin {
  final _repo = getIt<JobRepository>();
  late TabController _tabCtrl;
  List<JobOrderModel> _customerOrders = [];
  List<JobOrderModel> _providerOrders = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _repo.getOrders(role: 'customer'),
        _repo.getOrders(role: 'provider'),
      ]);
      setState(() {
        _customerOrders = results[0];
        _providerOrders = results[1];
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
        title: const Text('Riwayat Order'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        bottom: TabBar(
          controller: _tabCtrl,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(text: 'Sebagai Pelanggan'),
            Tab(text: 'Sebagai Pekerja'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabCtrl,
              children: [
                _OrderList(orders: _customerOrders, onRefresh: _load),
                _OrderList(orders: _providerOrders, onRefresh: _load),
              ],
            ),
    );
  }
}

class _OrderList extends StatelessWidget {
  final List<JobOrderModel> orders;
  final Future<void> Function() onRefresh;

  const _OrderList({required this.orders, required this.onRefresh});

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'COMPLETED': return AppColors.success;
      case 'CANCELLED': return AppColors.error;
      case 'IN_PROGRESS': return AppColors.primary;
      case 'CONFIRMED': return AppColors.secondary;
      default: return AppColors.amber;
    }
  }

  String _statusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING': return 'Menunggu';
      case 'CONFIRMED': return 'Dikonfirmasi';
      case 'IN_PROGRESS': return 'Dikerjakan';
      case 'COMPLETED': return 'Selesai';
      case 'CANCELLED': return 'Dibatalkan';
      default: return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.receipt_long_outlined, size: 64, color: AppColors.textHint),
            const SizedBox(height: 16),
            Text('Belum ada order', style: TextStyle(fontSize: 16, color: AppColors.textSecondary)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.all(20),
        itemCount: orders.length,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (_, i) {
          final o = orders[i];
          final color = _statusColor(o.status);
          return GestureDetector(
            onTap: () => context.push('/job/order/${o.id}'),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          o.serviceName ?? 'Order #${o.orderNumber}',
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: AppColors.textPrimary),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _statusLabel(o.status),
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('#${o.orderNumber}', style: TextStyle(fontSize: 13, color: AppColors.textHint)),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (o.totalAmount > 0)
                        Text(
                          'Rp ${JobServiceModel.formatPrice(o.totalAmount)}',
                          style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.primary),
                        ),
                      const Spacer(),
                      Text(timeago.format(o.createdAt), style: TextStyle(fontSize: 12, color: AppColors.textHint)),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
