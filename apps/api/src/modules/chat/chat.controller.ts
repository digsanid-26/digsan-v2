import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import {
  CreateDirectRoomDto,
  CreateGroupRoomDto,
  SendMessageDto,
  MessageQueryDto,
  AddMemberDto,
} from './dto/chat.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ─── ROOMS ──────────────────────────────────────────────────

  @Get('rooms')
  @ApiOperation({ summary: 'Get all chat rooms for current user' })
  async getRooms(@CurrentUser() user: any) {
    return this.chatService.getUserRooms(user.id);
  }

  @Post('rooms/direct')
  @ApiOperation({ summary: 'Get or create a direct chat room' })
  async createDirectRoom(@CurrentUser() user: any, @Body() dto: CreateDirectRoomDto) {
    return this.chatService.getOrCreateDirectRoom(user.id, dto.targetUserId);
  }

  @Post('rooms/group')
  @ApiOperation({ summary: 'Create a group chat room' })
  async createGroupRoom(@CurrentUser() user: any, @Body() dto: CreateGroupRoomDto) {
    return this.chatService.createGroupRoom(user.id, dto.name, dto.memberIds, dto.type);
  }

  @Get('rooms/:roomId')
  @ApiOperation({ summary: 'Get room details' })
  async getRoom(@CurrentUser() user: any, @Param('roomId') roomId: string) {
    return this.chatService.getRoomById(user.id, roomId);
  }

  // ─── MESSAGES ───────────────────────────────────────────────

  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Get messages in a room (paginated)' })
  async getMessages(
    @CurrentUser() user: any,
    @Param('roomId') roomId: string,
    @Query() query: MessageQueryDto,
  ) {
    return this.chatService.getMessages(user.id, roomId, query);
  }

  @Post('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Send a message to a room' })
  async sendMessage(
    @CurrentUser() user: any,
    @Param('roomId') roomId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.id, roomId, dto.content, dto.type, dto.metadata);
  }

  @Delete('messages/:messageId')
  @ApiOperation({ summary: 'Delete a message (soft delete)' })
  async deleteMessage(@CurrentUser() user: any, @Param('messageId') messageId: string) {
    return this.chatService.deleteMessage(user.id, messageId);
  }

  // ─── READ RECEIPTS ─────────────────────────────────────────

  @Post('rooms/:roomId/read')
  @ApiOperation({ summary: 'Mark room messages as read' })
  async markAsRead(@CurrentUser() user: any, @Param('roomId') roomId: string) {
    return this.chatService.markAsRead(user.id, roomId);
  }

  // ─── MEMBERS ────────────────────────────────────────────────

  @Post('rooms/:roomId/members')
  @ApiOperation({ summary: 'Add member to group room' })
  async addMember(
    @CurrentUser() user: any,
    @Param('roomId') roomId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.chatService.addMember(user.id, roomId, dto.userId);
  }

  @Delete('rooms/:roomId/members/:userId')
  @ApiOperation({ summary: 'Remove member from group room' })
  async removeMember(
    @CurrentUser() user: any,
    @Param('roomId') roomId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.chatService.removeMember(user.id, roomId, targetUserId);
  }
}
