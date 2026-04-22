import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../../core/constants/app_colors.dart';
import '../../../data/models/chat_model.dart';
import '../bloc/chat_bloc.dart';
import '../bloc/chat_event.dart';
import '../bloc/chat_state.dart';

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ChatBloc>().add(ChatRoomsLoadRequested());
  }

  String _roomDisplayName(ChatRoomModel room) {
    if (room.name != null && room.name!.isNotEmpty) return room.name!;
    return room.type == 'DIRECT' ? 'Direct Message' : 'Group Chat';
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, 16),
            child: Text(
              'Chat',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
          ),
          Expanded(
            child: BlocConsumer<ChatBloc, ChatState>(
              listener: (context, state) {
                if (state is ChatError) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(state.message), backgroundColor: AppColors.error),
                  );
                }
              },
              buildWhen: (_, state) => state is ChatLoading || state is ChatRoomsLoaded || state is ChatError,
              builder: (context, state) {
                final isLoading = state is ChatLoading;
                final rooms = state is ChatRoomsLoaded ? state.rooms : <ChatRoomModel>[];

                if (isLoading) return const Center(child: CircularProgressIndicator());

                if (rooms.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.chat_bubble_outline, size: 64, color: AppColors.textHint),
                        const SizedBox(height: 16),
                        Text('Belum ada percakapan',
                            style: TextStyle(fontSize: 16, color: AppColors.textSecondary)),
                      ],
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async => context.read<ChatBloc>().add(ChatRoomsLoadRequested()),
                  child: ListView.separated(
                    itemCount: rooms.length,
                    separatorBuilder: (_, _) => Divider(height: 1, color: AppColors.divider, indent: 76),
                    itemBuilder: (_, i) {
                      final room = rooms[i];
                      final lastMsg = room.lastMessage;
                      final unread = room.unreadCount;
                      final isDirect = room.type == 'DIRECT';

                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                        leading: CircleAvatar(
                          radius: 24,
                          backgroundColor: isDirect
                              ? AppColors.primary.withValues(alpha: 0.1)
                              : AppColors.secondary.withValues(alpha: 0.1),
                          child: Icon(
                            isDirect ? Icons.person : Icons.group,
                            color: isDirect ? AppColors.primary : AppColors.secondary,
                          ),
                        ),
                        title: Text(
                          _roomDisplayName(room),
                          style: TextStyle(
                            fontWeight: unread > 0 ? FontWeight.bold : FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        subtitle: Text(
                          lastMsg?.content ?? 'Belum ada pesan',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            color: unread > 0 ? AppColors.textPrimary : AppColors.textSecondary,
                            fontWeight: unread > 0 ? FontWeight.w500 : FontWeight.normal,
                          ),
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            if (lastMsg != null)
                              Text(
                                timeago.format(lastMsg.createdAt, locale: 'en_short'),
                                style: TextStyle(fontSize: 11, color: AppColors.textHint),
                              ),
                            if (unread > 0) ...[
                              const SizedBox(height: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  '$unread',
                                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ],
                        ),
                        onTap: () => context.go('/chat/${room.id}'),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
