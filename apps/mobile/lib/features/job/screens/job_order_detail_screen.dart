import 'package:flutter/material.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../../core/constants/app_colors.dart';
import '../../../core/di/injection.dart';
import '../../../data/models/job_model.dart';
import '../../../data/repositories/job_repository.dart';

class JobOrderDetailScreen extends StatefulWidget {
  final String orderId;
  const JobOrderDetailScreen({super.key, required this.orderId});

  @override
  State<JobOrderDetailScreen> createState() => _JobOrderDetailScreenState();
}

class _JobOrderDetailScreenState extends State<JobOrderDetailScreen> {
  final _repo = getIt<JobRepository>();
  JobOrderModel? _order;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final order = await _repo.getOrder(widget.orderId);
      setState(() {
        _order = order;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _updateStatus(String status) async {
    try {
      await _repo.updateOrderStatus(widget.orderId, status);
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Status diperbarui ke $status')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal memperbarui status'), backgroundColor: AppColors.error),
        );
      }
    }
  }

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
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_order != null ? '#${_order!.orderNumber}' : 'Detail Order'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _order == null
              ? const Center(child: Text('Order tidak ditemukan'))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      // Status header
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: _statusColor(_order!.status).withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: _statusColor(_order!.status).withValues(alpha: 0.2)),
                        ),
                        child: Column(
                          children: [
                            Icon(
                              _order!.status == 'COMPLETED' ? Icons.check_circle : Icons.pending,
                              size: 48,
                              color: _statusColor(_order!.status),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              _statusLabel(_order!.status),
                              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: _statusColor(_order!.status)),
                            ),
                            const SizedBox(height: 4),
                            Text(timeago.format(_order!.createdAt), style: TextStyle(fontSize: 13, color: AppColors.textHint)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Order info
                      _InfoCard(children: [
                        _InfoRow(label: 'No. Order', value: '#${_order!.orderNumber}'),
                        if (_order!.serviceName != null)
                          _InfoRow(label: 'Jasa', value: _order!.serviceName!),
                        if (_order!.description != null)
                          _InfoRow(label: 'Deskripsi', value: _order!.description!),
                        if (_order!.address != null)
                          _InfoRow(label: 'Alamat', value: _order!.address!),
                        if (_order!.scheduledDate != null)
                          _InfoRow(label: 'Jadwal', value: _order!.scheduledDate!.toLocal().toString().split('.')[0]),
                        if (_order!.providerName != null)
                          _InfoRow(label: 'Pekerja', value: _order!.providerName!),
                        if (_order!.customerName != null)
                          _InfoRow(label: 'Pelanggan', value: _order!.customerName!),
                        if (_order!.totalAmount > 0)
                          _InfoRow(label: 'Total', value: 'Rp ${JobServiceModel.formatPrice(_order!.totalAmount)}', bold: true),
                      ]),

                      // Action buttons
                      if (_order!.status == 'PENDING') ...[
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => _updateStatus('CANCELLED'),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: AppColors.error,
                                  side: const BorderSide(color: AppColors.error),
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                child: const Text('Batalkan'),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: FilledButton(
                                onPressed: () => _updateStatus('CONFIRMED'),
                                style: FilledButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                child: const Text('Konfirmasi'),
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (_order!.status == 'CONFIRMED') ...[
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: () => _updateStatus('IN_PROGRESS'),
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(50),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('Mulai Pengerjaan'),
                        ),
                      ],
                      if (_order!.status == 'IN_PROGRESS') ...[
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: () => _updateStatus('COMPLETED'),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.success,
                            minimumSize: const Size.fromHeight(50),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('Selesaikan Order'),
                        ),
                      ],
                    ],
                  ),
                ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final List<Widget> children;
  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(children: children),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  const _InfoRow({required this.label, required this.value, this.bold = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textPrimary,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
