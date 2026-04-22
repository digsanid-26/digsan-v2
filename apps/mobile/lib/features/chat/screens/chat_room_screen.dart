import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/di/injection.dart';
import '../../../core/network/api_client.dart';

class ChatRoomScreen extends StatefulWidget {
  final String roomId;
  const ChatRoomScreen({super.key, required this.roomId});

  @override
  State<ChatRoomScreen> createState() => _ChatRoomScreenState();
}

class _ChatRoomScreenState extends State<ChatRoomScreen> {
  final _api = getIt<ApiClient>();
  final _msgController = TextEditingController();
  final _scrollController = ScrollController();
  List<dynamic> _messages = [];
  Map<String, dynamic>? _room;
  bool _loading = true;
  bool _sending = false;
  String? _currentUserId;

  @override
  void initState() {
    super.initState();
    _loadRoom();
  }

  @override
  void dispose() {
    _msgController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadRoom() async {
    try {
      final profileRes = await _api.dio.get('/users/me');
      final profile = profileRes.data is Map && profileRes.data['data'] != null
          ? profileRes.data['data']
          : profileRes.data;
      _currentUserId = profile['id'];

      final roomRes = await _api.dio.get('/chat/rooms/${widget.roomId}');
      _room = roomRes.data is Map && roomRes.data['data'] != null
          ? roomRes.data['data']
          : roomRes.data;

      final msgRes = await _api.dio.get('/chat/rooms/${widget.roomId}/messages');
      final msgData = msgRes.data is Map && msgRes.data['data'] != null
          ? msgRes.data['data']
          : msgRes.data;
      final msgList = msgData is Map && msgData['messages'] != null
          ? msgData['messages'] as List
          : msgData is List
              ? msgData
              : [];

      // Mark as read (fire and forget)
      try { await _api.dio.post('/chat/rooms/${widget.roomId}/read'); } catch (_) {}

      setState(() {
        _messages = msgList.reversed.toList();
        _loading = false;
      });

      _scrollToBottom();
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _msgController.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final res = await _api.dio.post(
        '/chat/rooms/${widget.roomId}/messages',
        data: {'content': text},
      );
      final msg = res.data is Map && res.data['data'] != null
          ? res.data['data']
          : res.data;
      _msgController.clear();
      setState(() {
        _messages.add(msg);
        _sending = false;
      });
      _scrollToBottom();
    } catch (_) {
      setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final roomName = _room?['name'] ?? 'Chat';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(roomName),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0.5,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Messages
                Expanded(
                  child: _messages.isEmpty
                      ? Center(
                          child: Text('Belum ada pesan',
                              style: TextStyle(color: AppColors.textSecondary)),
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          itemCount: _messages.length,
                          itemBuilder: (_, i) {
                            final msg = _messages[i] as Map<String, dynamic>;
                            final isMe = msg['senderId'] == _currentUserId;
                            return _MessageBubble(
                              content: msg['content'] ?? '',
                              senderName: msg['sender']?['name'] ?? '',
                              isMe: isMe,
                              time: msg['createdAt'] != null
                                  ? _formatTime(msg['createdAt'])
                                  : '',
                            );
                          },
                        ),
                ),
                // Input
                Container(
                  padding: EdgeInsets.only(
                    left: 16,
                    right: 8,
                    top: 8,
                    bottom: MediaQuery.of(context).padding.bottom + 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border(top: BorderSide(color: AppColors.border)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _msgController,
                          decoration: InputDecoration(
                            hintText: 'Ketik pesan...',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(24),
                              borderSide: BorderSide(color: AppColors.border),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(24),
                              borderSide: BorderSide(color: AppColors.border),
                            ),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            filled: true,
                            fillColor: AppColors.background,
                          ),
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => _sendMessage(),
                        ),
                      ),
                      const SizedBox(width: 6),
                      IconButton(
                        onPressed: _sending ? null : _sendMessage,
                        icon: Icon(
                          Icons.send_rounded,
                          color: _sending ? AppColors.textHint : AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  String _formatTime(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }
}

class _MessageBubble extends StatelessWidget {
  final String content;
  final String senderName;
  final bool isMe;
  final String time;

  const _MessageBubble({
    required this.content,
    required this.senderName,
    required this.isMe,
    required this.time,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isMe ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: isMe ? const Radius.circular(16) : const Radius.circular(4),
            bottomRight: isMe ? const Radius.circular(4) : const Radius.circular(16),
          ),
          border: isMe ? null : Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!isMe && senderName.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  senderName,
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary),
                ),
              ),
            Text(
              content,
              style: TextStyle(
                color: isMe ? Colors.white : AppColors.textPrimary,
                fontSize: 14.5,
              ),
            ),
            const SizedBox(height: 4),
            Align(
              alignment: Alignment.bottomRight,
              child: Text(
                time,
                style: TextStyle(
                  fontSize: 10,
                  color: isMe ? Colors.white.withValues(alpha: 0.7) : AppColors.textHint,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
