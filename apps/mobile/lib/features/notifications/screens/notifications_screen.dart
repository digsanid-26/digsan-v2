import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../../core/constants/app_colors.dart';
import '../bloc/notification_bloc.dart';
import '../bloc/notification_event.dart';
import '../bloc/notification_state.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<NotificationBloc>().add(NotificationLoadRequested());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Notifikasi'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        actions: [
          BlocBuilder<NotificationBloc, NotificationState>(
            builder: (context, state) {
              if (state is NotificationLoaded && state.notifications.isNotEmpty) {
                return TextButton(
                  onPressed: () => context.read<NotificationBloc>().add(NotificationMarkAllReadRequested()),
                  child: const Text('Baca Semua', style: TextStyle(fontSize: 13)),
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
      body: BlocConsumer<NotificationBloc, NotificationState>(
        listener: (context, state) {
          if (state is NotificationError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: AppColors.error),
            );
          }
        },
        builder: (context, state) {
          if (state is NotificationLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          final notifications = state is NotificationLoaded ? state.notifications : [];

          if (notifications.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.notifications_off_outlined, size: 64, color: AppColors.textHint),
                  const SizedBox(height: 16),
                  Text('Tidak ada notifikasi',
                      style: TextStyle(fontSize: 16, color: AppColors.textSecondary)),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => context.read<NotificationBloc>().add(NotificationLoadRequested()),
            child: ListView.separated(
              itemCount: notifications.length,
              separatorBuilder: (_, _) => Divider(height: 1, color: AppColors.divider),
              itemBuilder: (_, i) {
                final n = notifications[i];
                final isRead = n.isRead;
                return ListTile(
                  tileColor: isRead ? null : AppColors.primaryLight.withValues(alpha: 0.3),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  leading: CircleAvatar(
                    radius: 20,
                    backgroundColor: isRead
                        ? AppColors.divider
                        : AppColors.primary.withValues(alpha: 0.1),
                    child: Icon(
                      Icons.notifications_outlined,
                      size: 20,
                      color: isRead ? AppColors.textHint : AppColors.primary,
                    ),
                  ),
                  title: Text(
                    n.title,
                    style: TextStyle(
                      fontWeight: isRead ? FontWeight.normal : FontWeight.w600,
                      color: AppColors.textPrimary,
                      fontSize: 14,
                    ),
                  ),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 2),
                      Text(
                        n.message,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        timeago.format(n.createdAt),
                        style: TextStyle(fontSize: 11, color: AppColors.textHint),
                      ),
                    ],
                  ),
                  onTap: isRead
                      ? null
                      : () => context.read<NotificationBloc>().add(NotificationMarkReadRequested(n.id)),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
