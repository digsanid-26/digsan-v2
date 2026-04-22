class ChatRoomModel {
  final String id;
  final String? name;
  final String type;
  final String? avatar;
  final int unreadCount;
  final ChatMessageModel? lastMessage;
  final List<ChatMemberModel> members;
  final DateTime createdAt;

  const ChatRoomModel({
    required this.id,
    this.name,
    this.type = 'DIRECT',
    this.avatar,
    this.unreadCount = 0,
    this.lastMessage,
    this.members = const [],
    required this.createdAt,
  });

  factory ChatRoomModel.fromJson(Map<String, dynamic> json) {
    return ChatRoomModel(
      id: json['id'] as String,
      name: json['name'] as String?,
      type: json['type'] as String? ?? 'DIRECT',
      avatar: json['avatar'] as String?,
      unreadCount: json['unreadCount'] as int? ?? 0,
      lastMessage: json['lastMessage'] is Map<String, dynamic>
          ? ChatMessageModel.fromJson(json['lastMessage'])
          : null,
      members: (json['members'] as List?)
              ?.map((m) => ChatMemberModel.fromJson(m as Map<String, dynamic>))
              .toList() ??
          [],
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
    );
  }
}

class ChatMemberModel {
  final String id;
  final String userId;
  final String role;
  final String? userName;
  final String? userAvatar;
  final DateTime? lastRead;
  final bool isMuted;

  const ChatMemberModel({
    required this.id,
    required this.userId,
    this.role = 'member',
    this.userName,
    this.userAvatar,
    this.lastRead,
    this.isMuted = false,
  });

  factory ChatMemberModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return ChatMemberModel(
      id: json['id'] as String,
      userId: json['userId'] as String,
      role: json['role'] as String? ?? 'member',
      userName: user?['name'] as String?,
      userAvatar: user?['avatar'] as String?,
      lastRead: json['lastRead'] != null ? DateTime.tryParse(json['lastRead'].toString()) : null,
      isMuted: json['isMuted'] as bool? ?? false,
    );
  }
}

class ChatMessageModel {
  final String id;
  final String roomId;
  final String senderId;
  final String content;
  final String type;
  final String? senderName;
  final String? senderAvatar;
  final DateTime createdAt;

  const ChatMessageModel({
    required this.id,
    required this.roomId,
    required this.senderId,
    required this.content,
    this.type = 'TEXT',
    this.senderName,
    this.senderAvatar,
    required this.createdAt,
  });

  factory ChatMessageModel.fromJson(Map<String, dynamic> json) {
    final sender = json['sender'] as Map<String, dynamic>?;
    return ChatMessageModel(
      id: json['id'] as String,
      roomId: json['roomId'] as String,
      senderId: json['senderId'] as String,
      content: json['content'] as String,
      type: json['type'] as String? ?? 'TEXT',
      senderName: sender?['name'] as String?,
      senderAvatar: sender?['avatar'] as String?,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
    );
  }
}
