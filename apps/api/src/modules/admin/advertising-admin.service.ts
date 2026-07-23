import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class AdvertisingAdminService {
  private readonly logger = new Logger(AdvertisingAdminService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  // ─── DASHBOARD STATS ───────────────────────────────────────

  async getStats() {
    const [spots, banners, assignments, activeAssignments] = await Promise.all([
      this.prisma.adSpot.count(),
      this.prisma.adBanner.count(),
      this.prisma.adAssignment.count(),
      this.prisma.adAssignment.count({ where: { isActive: true } }),
    ]);

    const totalRevenue = await this.prisma.adAssignment.aggregate({
      _sum: { rate: true },
      where: { rate: { not: null } },
    });

    const spotsWithAssignments = await this.prisma.adSpot.findMany({
      include: {
        assignments: {
          where: { isActive: true },
          include: { banner: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const spotList = spotsWithAssignments.map((s) => ({
      id: s.id,
      key: s.key,
      label: s.label,
      page: s.page,
      position: s.position,
      aspectRatio: s.aspectRatio,
      maxSlots: s.maxSlots,
      isActive: s.isActive,
      activeBanners: s.assignments.length,
      currentBanner: s.assignments[0]?.banner ?? null,
      assignments: s.assignments.map((a) => ({
        id: a.id,
        startDate: a.startDate,
        endDate: a.endDate,
        rate: a.rate,
        isActive: a.isActive,
        banner: a.banner,
      })),
    }));

    return {
      totals: {
        spots,
        banners,
        assignments,
        activeAssignments,
        totalRevenue: totalRevenue._sum.rate ?? 0,
      },
      spots: spotList,
    };
  }

  // ─── SPOTS CRUD ────────────────────────────────────────────

  async createSpot(data: { key: string; label: string; description?: string; page?: string; position?: string; aspectRatio?: string; maxSlots?: number }) {
    const existing = await this.prisma.adSpot.findUnique({ where: { key: data.key } });
    if (existing) throw new BadRequestException('Spot key already exists');
    return this.prisma.adSpot.create({ data });
  }

  async updateSpot(id: string, data: { label?: string; description?: string; page?: string; position?: string; aspectRatio?: string; maxSlots?: number; isActive?: boolean }) {
    const spot = await this.prisma.adSpot.findUnique({ where: { id } });
    if (!spot) throw new NotFoundException('Spot not found');
    return this.prisma.adSpot.update({ where: { id }, data });
  }

  async deleteSpot(id: string) {
    const spot = await this.prisma.adSpot.findUnique({ where: { id } });
    if (!spot) throw new NotFoundException('Spot not found');
    await this.prisma.adSpot.delete({ where: { id } });
    return { deleted: true };
  }

  async listSpots() {
    return this.prisma.adSpot.findMany({
      include: {
        assignments: {
          where: { isActive: true },
          include: { banner: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── BANNERS CRUD ──────────────────────────────────────────

  async createBanner(userId: string, data: { title: string; imageUrl: string; linkUrl?: string; aspectRatio?: string; width?: number; height?: number; isAiGenerated?: boolean; aiPrompt?: string }) {
    return this.prisma.adBanner.create({
      data: { ...data, createdById: userId },
    });
  }

  async updateBanner(id: string, data: { title?: string; imageUrl?: string; linkUrl?: string; aspectRatio?: string; width?: number; height?: number }) {
    const banner = await this.prisma.adBanner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return this.prisma.adBanner.update({ where: { id }, data });
  }

  async deleteBanner(id: string) {
    const banner = await this.prisma.adBanner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    await this.prisma.adBanner.delete({ where: { id } });
    return { deleted: true };
  }

  async listBanners() {
    return this.prisma.adBanner.findMany({
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── ASSIGNMENTS CRUD ──────────────────────────────────────

  async assignBanner(userId: string, data: { spotId: string; bannerId: string; startDate?: string; endDate?: string; rate?: number; discountRole?: string }) {
    const [spot, banner] = await Promise.all([
      this.prisma.adSpot.findUnique({ where: { id: data.spotId } }),
      this.prisma.adBanner.findUnique({ where: { id: data.bannerId } }),
    ]);
    if (!spot) throw new NotFoundException('Spot not found');
    if (!banner) throw new NotFoundException('Banner not found');

    return this.prisma.adAssignment.create({
      data: {
        spotId: data.spotId,
        bannerId: data.bannerId,
        assignedById: userId,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : null,
        rate: data.rate ?? null,
        discountRole: data.discountRole ?? null,
        isActive: true,
      },
      include: { spot: true, banner: true },
    });
  }

  async updateAssignment(id: string, data: { startDate?: string; endDate?: string; rate?: number; discountRole?: string; isActive?: boolean }) {
    const assignment = await this.prisma.adAssignment.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return this.prisma.adAssignment.update({
      where: { id },
      data: {
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        ...(data.rate !== undefined && { rate: data.rate }),
        ...(data.discountRole !== undefined && { discountRole: data.discountRole }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { spot: true, banner: true },
    });
  }

  async deleteAssignment(id: string) {
    const assignment = await this.prisma.adAssignment.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.prisma.adAssignment.delete({ where: { id } });
    return { deleted: true };
  }

  async listAssignments() {
    return this.prisma.adAssignment.findMany({
      include: { spot: true, banner: true, assignedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── PUBLIC: Get active banners for a spot key ─────────────

  async getActiveBannersForSpot(spotKey: string) {
    const now = new Date();
    const spot = await this.prisma.adSpot.findUnique({
      where: { key: spotKey },
    });
    if (!spot || !spot.isActive) return { spot: null, banners: [] };

    const assignments = await this.prisma.adAssignment.findMany({
      where: {
        spotId: spot.id,
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: { banner: true },
      orderBy: { createdAt: 'desc' },
      take: spot.maxSlots,
    });

    return {
      spot: { id: spot.id, key: spot.key, label: spot.label, aspectRatio: spot.aspectRatio, maxSlots: spot.maxSlots },
      banners: assignments.map((a) => ({
        id: a.banner.id,
        title: a.banner.title,
        imageUrl: a.banner.imageUrl,
        linkUrl: a.banner.linkUrl,
        aspectRatio: a.banner.aspectRatio,
      })),
    };
  }

  // ─── PUBLIC: Get all active spots for a page ───────────────

  async getActiveSpotsForPage(page: string) {
    const now = new Date();
    const spots = await this.prisma.adSpot.findMany({
      where: { page, isActive: true },
      include: {
        assignments: {
          where: {
            isActive: true,
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
          include: { banner: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return spots.map((s) => ({
      key: s.key,
      label: s.label,
      aspectRatio: s.aspectRatio,
      maxSlots: s.maxSlots,
      banners: s.assignments.slice(0, s.maxSlots).map((a) => ({
        id: a.banner.id,
        title: a.banner.title,
        imageUrl: a.banner.imageUrl,
        linkUrl: a.banner.linkUrl,
        aspectRatio: a.banner.aspectRatio,
      })),
    }));
  }

  // ─── AI IMAGE GENERATION (OpenRouter) ──────────────────────

  async generateAiImage(params: {
    prompt: string;
    includeText?: boolean;
    textContent?: string;
    fontFamily?: string;
    colorScheme?: string;
    aspectRatio?: string;
    style?: string;
  }): Promise<{ imageUrl: string; prompt: string }> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) throw new BadRequestException('OPENROUTER_API_KEY not configured');

    const { prompt, includeText, textContent, fontFamily, colorScheme, aspectRatio, style } = params;

    // Build a detailed prompt for the image model
    const parts: string[] = [prompt];
    if (style) parts.push(`Style: ${style}`);
    if (includeText && textContent) parts.push(`Include text: "${textContent}"`);
    if (fontFamily) parts.push(`Font: ${fontFamily}`);
    if (colorScheme) parts.push(`Color scheme: ${colorScheme}`);
    if (aspectRatio) parts.push(`Aspect ratio: ${aspectRatio}`);
    if (!includeText) parts.push('No text, image only');

    const fullPrompt = parts.join('. ');

    // Map aspect ratio to dimensions
    const sizeMap: Record<string, string> = {
      '1:1': '1024x1024',
      '3:1': '1536x512',
      '1:2': '512x1024',
      '1:3': '512x1536',
      '16:9': '1536x864',
      '9:16': '864x1536',
    };
    const size = sizeMap[aspectRatio || '1:1'] || '1024x1024';

    this.logger.log(`Generating AI image with prompt: ${fullPrompt.substring(0, 100)}...`);

    // Use OpenRouter chat completions with a multimodal model
    // Models like "google/gemini-2.0-flash-exp:free" support image generation
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': this.configService.get<string>('WEB_URL') || 'http://localhost:3000',
        'X-Title': 'Digsan Ads Builder',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          {
            role: 'user',
            content: `Generate an advertisement banner image. ${fullPrompt}. Size: ${size}. Return only the image.`,
          },
        ],
        response_format: { type: 'image' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      this.logger.error(`OpenRouter API error: ${response.status} ${errText}`);
      throw new BadRequestException(`AI image generation failed: ${response.status}`);
    }

    const data = await response.json() as any;
    const content = data?.choices?.[0]?.message?.content;

    // Try to extract image URL from the response
    let imageUrl: string | null = null;

    if (typeof content === 'string') {
      // Check if content is a URL
      if (content.startsWith('http')) {
        imageUrl = content;
      } else {
        // Try to find a URL in the content
        const urlMatch = content.match(/https?:\/\/[^\s"')\]]+/);
        if (urlMatch) imageUrl = urlMatch[0];
        // Check for base64 data URI
        if (content.startsWith('data:image/')) imageUrl = content;
      }
    } else if (Array.isArray(content)) {
      // Multi-part content — find image part
      for (const part of content) {
        if (part.type === 'image_url' && part.image_url?.url) {
          imageUrl = part.image_url.url;
          break;
        }
      }
    }

    if (!imageUrl) {
      this.logger.error(`No image URL in OpenRouter response: ${JSON.stringify(data).substring(0, 500)}`);
      throw new BadRequestException('AI image generation returned no image. The model may not support image output.');
    }

    return { imageUrl, prompt: fullPrompt };
  }
}
