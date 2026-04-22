import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TreeService } from './tree.service';
import { CreateTreeDto } from './dto/create-tree.dto';
import { UpdateTreeDto } from './dto/update-tree.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateCardStyleDto } from './dto/card-style.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

// ─── AUTHENTICATED TREE ENDPOINTS ─────────────────────────────

@ApiTags('Family Tree')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('trees')
export class TreeController {
  constructor(private readonly treeService: TreeService) {}

  // ─── TREE CRUD ──────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Get all trees for current user' })
  async findAll(@CurrentUser('id') userId: string) {
    return this.treeService.findAll(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new family tree (auto-adds creator as first member)' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateTreeDto) {
    return this.treeService.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a family tree by ID (with members)' })
  async findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.treeService.findOne(id, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a family tree' })
  async update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() dto: UpdateTreeDto) {
    return this.treeService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a family tree and all its members' })
  async remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.treeService.remove(id, userId);
  }

  // ─── MEMBERS ────────────────────────────────────────────────

  @Get(':id/members')
  @ApiOperation({ summary: 'Get all members of a tree' })
  async getMembers(@Param('id') treeId: string, @CurrentUser('id') userId: string) {
    return this.treeService.getMembers(treeId, userId);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member to a tree' })
  async addMember(
    @Param('id') treeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMemberDto,
  ) {
    return this.treeService.addMember(treeId, userId, dto);
  }

  @Get(':id/members/:memberId')
  @ApiOperation({ summary: 'Get a specific member' })
  async getMember(@Param('id') treeId: string, @Param('memberId') memberId: string) {
    return this.treeService.getMember(treeId, memberId);
  }

  @Put(':id/members/:memberId')
  @ApiOperation({ summary: 'Update a member' })
  async updateMember(
    @Param('id') treeId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.treeService.updateMember(treeId, memberId, userId, dto);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove a member (must have no children)' })
  async removeMember(
    @Param('id') treeId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.treeService.removeMember(treeId, memberId, userId);
  }

  // ─── CARD STYLE ─────────────────────────────────────────────

  @Put(':id/card-style')
  @ApiOperation({ summary: 'Update tree card style (create or update)' })
  async updateCardStyle(
    @Param('id') treeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCardStyleDto,
  ) {
    return this.treeService.updateCardStyle(treeId, userId, dto);
  }

  // ─── INVITATIONS ────────────────────────────────────────────

  @Get(':id/invitations')
  @ApiOperation({ summary: 'Get all invitations for a tree' })
  async getInvitations(@Param('id') treeId: string, @CurrentUser('id') userId: string) {
    return this.treeService.getInvitations(treeId, userId);
  }

  @Post(':id/invitations')
  @ApiOperation({ summary: 'Invite someone to join a tree via email or phone' })
  async createInvitation(
    @Param('id') treeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.treeService.createInvitation(treeId, userId, dto);
  }

  @Delete(':id/invitations/:invitationId')
  @ApiOperation({ summary: 'Cancel a pending invitation' })
  async cancelInvitation(
    @Param('id') treeId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.treeService.cancelInvitation(treeId, invitationId, userId);
  }

  @Post('invitations/:token/accept')
  @ApiOperation({ summary: 'Accept a tree invitation' })
  async acceptInvitation(@Param('token') token: string, @CurrentUser('id') userId: string) {
    return this.treeService.acceptInvitation(token, userId);
  }

  // ─── HUB CONNECTIONS ────────────────────────────────────────

  @Get(':id/connections')
  @ApiOperation({ summary: 'Get hub connections for a tree' })
  async getHubConnections(@Param('id') treeId: string) {
    return this.treeService.getHubConnections(treeId);
  }

  @Post(':id/connections')
  @ApiOperation({ summary: 'Request a hub connection to another tree' })
  async requestHubConnection(
    @Param('id') sourceTreeId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { targetTreeId: string; type: 'MARRIAGE' | 'SIBLING' | 'PARENT_CHILD' | 'EXTENDED' },
  ) {
    return this.treeService.requestHubConnection(sourceTreeId, body.targetTreeId, userId, body.type);
  }

  @Patch('connections/:connectionId')
  @ApiOperation({ summary: 'Accept or reject a hub connection request' })
  async respondHubConnection(
    @Param('connectionId') connectionId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { accept: boolean },
  ) {
    return this.treeService.respondHubConnection(connectionId, userId, body.accept);
  }

  // ─── GRAPH & TRAVERSAL ─────────────────────────────────────

  @Get(':id/graph')
  @ApiOperation({ summary: 'Get family graph (nodes + edges) for visualization' })
  async getFamilyGraph(@Param('id') treeId: string, @CurrentUser('id') userId: string) {
    return this.treeService.getFamilyGraph(treeId, userId);
  }

  @Get(':id/members/:memberId/ancestors')
  @ApiOperation({ summary: 'Get ancestors of a member' })
  @ApiQuery({ name: 'maxDepth', required: false, type: Number })
  async getAncestors(
    @Param('id') treeId: string,
    @Param('memberId') memberId: string,
    @Query('maxDepth') maxDepth?: string,
  ) {
    return this.treeService.getAncestors(treeId, memberId, maxDepth ? parseInt(maxDepth) : 10);
  }

  @Get(':id/members/:memberId/descendants')
  @ApiOperation({ summary: 'Get descendants of a member' })
  @ApiQuery({ name: 'maxDepth', required: false, type: Number })
  async getDescendants(
    @Param('id') treeId: string,
    @Param('memberId') memberId: string,
    @Query('maxDepth') maxDepth?: string,
  ) {
    return this.treeService.getDescendants(treeId, memberId, maxDepth ? parseInt(maxDepth) : 10);
  }

  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get tree statistics (total, gender, generations, etc.)' })
  async getStatistics(@Param('id') treeId: string, @CurrentUser('id') userId: string) {
    return this.treeService.getStatistics(treeId, userId);
  }
}

// ─── PUBLIC TREE ENDPOINTS ────────────────────────────────────

@ApiTags('Public Family Trees')
@Controller('public/trees')
export class PublicTreeController {
  constructor(private readonly treeService: TreeService) {}

  @Get()
  @ApiOperation({ summary: 'Browse public family trees' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findPublicTrees(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.treeService.findPublicTrees(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'View a public family tree' })
  async findOne(@Param('id') id: string) {
    return this.treeService.findOne(id);
  }

  @Get(':id/graph')
  @ApiOperation({ summary: 'Get public family graph for visualization' })
  async getFamilyGraph(@Param('id') treeId: string) {
    return this.treeService.getFamilyGraph(treeId);
  }

  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get public tree statistics' })
  async getStatistics(@Param('id') treeId: string) {
    return this.treeService.getStatistics(treeId);
  }
}
