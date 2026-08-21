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
      deviceMode: s.deviceMode,
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

  async createSpot(data: { key: string; label: string; description?: string; page?: string; position?: string; aspectRatio?: string; maxSlots?: number; deviceMode?: string }) {
    const existing = await this.prisma.adSpot.findUnique({ where: { key: data.key } });
    if (existing) throw new BadRequestException('Spot key already exists');
    return this.prisma.adSpot.create({ data });
  }

  async updateSpot(id: string, data: { label?: string; description?: string; page?: string; position?: string; aspectRatio?: string; maxSlots?: number; deviceMode?: string; isActive?: boolean }) {
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
      spot: { id: spot.id, key: spot.key, label: spot.label, aspectRatio: spot.aspectRatio, maxSlots: spot.maxSlots, deviceMode: spot.deviceMode },
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
      deviceMode: s.deviceMode,
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
    model?: string;
    attachments?: string[];
  }): Promise<{ imageUrl: string; prompt: string }> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) throw new BadRequestException('OPENROUTER_API_KEY not configured');

    const { prompt, includeText, textContent, fontFamily, colorScheme, aspectRatio, style, model, attachments } = params;

    // Build a detailed prompt for the image model
    const parts: string[] = [prompt];
    if (style) parts.push(`Style: ${style}`);
    if (includeText && textContent) parts.push(`Include text: "${textContent}"`);
    if (fontFamily) parts.push(`Font: ${fontFamily}`);
    if (colorScheme) parts.push(`Color scheme: ${colorScheme}`);
    if (aspectRatio) parts.push(`Aspect ratio: ${aspectRatio}`);
    if (!includeText) parts.push('No text, image only');

    const fullPrompt = parts.join('. ');

    // Use selected model or default — must be a model with image output modality
    const modelName = model || 'google/gemini-2.5-flash-image';

    this.logger.log(`Generating AI image with model ${modelName}, prompt: ${fullPrompt.substring(0, 100)}...`);

    // Build input_references for image-to-image (attachment images)
    const inputReferences: any[] = [];
    if (attachments && attachments.length > 0) {
      for (const url of attachments) {
        if (url) inputReferences.push({ type: 'image_url', image_url: { url } });
      }
    }

    // ─── Strategy 1: Dedicated /api/v1/images endpoint ────────
    // This is the recommended way for image generation models.
    let imageUrl: string | null = null;

    try {
      const imagesBody: any = {
        model: modelName,
        prompt: `Generate an advertisement banner image. ${fullPrompt}. Return only the image.`,
        aspect_ratio: aspectRatio || '1:1',
        n: 1,
      };
      if (inputReferences.length > 0) {
        imagesBody.input_references = inputReferences;
      }

      const imagesResponse = await fetch('https://openrouter.ai/api/v1/images', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(imagesBody),
      });

      if (imagesResponse.ok) {
        const imagesData = await imagesResponse.json() as any;
        // Response format: { data: [{ b64_json: "...", media_type: "image/png" }] }
        if (imagesData?.data?.[0]?.b64_json) {
          const mediaType = imagesData.data[0].media_type || 'image/png';
          const ext = mediaType.includes('jpeg') || mediaType.includes('jpg') ? 'jpg'
            : mediaType.includes('webp') ? 'webp'
            : mediaType.includes('svg') ? 'svg'
            : 'png';
          const buffer = Buffer.from(imagesData.data[0].b64_json, 'base64');
          const filename = `ai-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
          const { writeFileSync, mkdirSync } = await import('fs');
          mkdirSync(`${process.cwd()}/public/uploads/ads`, { recursive: true });
          writeFileSync(`${process.cwd()}/public/uploads/ads/${filename}`, buffer);
          imageUrl = `/api/uploads/ads/${filename}`;
          this.logger.log(`AI image saved via /images endpoint: ${filename}`);
        }
      } else {
        const errText = await imagesResponse.text().catch(() => '');
        this.logger.warn(`/api/v1/images returned ${imagesResponse.status}: ${errText.substring(0, 200)}`);
      }
    } catch (err) {
      this.logger.warn(`Dedicated /images endpoint failed: ${err}, falling back to chat completions`);
    }

    // ─── Strategy 2: Chat completions with modalities (fallback) ──
    // Some models (e.g. Gemini) return images via chat completions with
    // message.images array containing base64 data URLs.
    if (!imageUrl) {
      try {
        const messageContent: any[] = [
          { type: 'text', text: `Generate an advertisement banner image. ${fullPrompt}. Return only the image.` },
        ];
        if (inputReferences.length > 0) {
          for (const ref of inputReferences) {
            messageContent.push(ref);
          }
        }

        const chatResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': this.configService.get<string>('WEB_URL') || 'http://localhost:3000',
            'X-Title': 'Digsan Ads Builder',
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              {
                role: 'user',
                content: messageContent,
              },
            ],
            modalities: ['image', 'text'],
          }),
        });

        if (chatResponse.ok) {
          const chatData = await chatResponse.json() as any;
          const message = chatData?.choices?.[0]?.message;

          // Check message.images array (OpenRouter image generation format)
          if (message?.images && Array.isArray(message.images)) {
            for (const img of message.images) {
              if (img?.image_url?.url) {
                imageUrl = img.image_url.url; // base64 data URL
                break;
              }
            }
          }

          // Fallback: check content array for image_url parts
          if (!imageUrl && Array.isArray(message?.content)) {
            for (const part of message.content) {
              if (part?.type === 'image_url' && part?.image_url?.url) {
                imageUrl = part.image_url.url;
                break;
              }
            }
          }

          // Fallback: check string content for URL or data URI
          if (!imageUrl && typeof message?.content === 'string') {
            const content = message.content;
            if (content.startsWith('data:image/')) {
              imageUrl = content;
            } else {
              const urlMatch = content.match(/https?:\/\/[^\s"')\]]+/);
              if (urlMatch) imageUrl = urlMatch[0];
            }
          }

          if (imageUrl) {
            this.logger.log(`AI image extracted via chat completions fallback`);
          }
        } else {
          const errText = await chatResponse.text().catch(() => '');
          this.logger.error(`Chat completions fallback failed: ${chatResponse.status} ${errText.substring(0, 300)}`);
        }
      } catch (err) {
        this.logger.error(`Chat completions fallback error: ${err}`);
      }
    }

    if (!imageUrl) {
      this.logger.error('No image returned from either /images or chat completions endpoint');
      throw new BadRequestException('AI image generation returned no image. The model may not support image output.');
    }

    // Save image to local storage if it's not already a local URL
    let localUrl: string | null = null;
    try {
      if (imageUrl.startsWith('data:image/')) {
        // Base64 data URI — save directly
        const matches = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const filename = `ai-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
          const { writeFileSync, mkdirSync } = await import('fs');
          mkdirSync(`${process.cwd()}/public/uploads/ads`, { recursive: true });
          writeFileSync(`${process.cwd()}/public/uploads/ads/${filename}`, buffer);
          localUrl = `/api/uploads/ads/${filename}`;
        }
      } else if (imageUrl.startsWith('/api/uploads/')) {
        // Already saved locally by the /images endpoint strategy
        localUrl = imageUrl;
      } else if (imageUrl.startsWith('http')) {
        // External URL — download and save locally
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const contentType = imgRes.headers.get('content-type') || 'image/png';
          const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png';
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          const filename = `ai-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
          const { writeFileSync, mkdirSync } = await import('fs');
          mkdirSync(`${process.cwd()}/public/uploads/ads`, { recursive: true });
          writeFileSync(`${process.cwd()}/public/uploads/ads/${filename}`, buffer);
          localUrl = `/api/uploads/ads/${filename}`;
        }
      }
    } catch (err) {
      this.logger.error(`Failed to save AI image locally: ${err}`);
    }

    return { imageUrl: localUrl || imageUrl, prompt: fullPrompt };
  }
}
