import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { RegisterWorkerDto, WorkerSkillDto, WorkScheduleDto, ServiceAreaDto } from './dto/register-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { SearchWorkerDto } from './dto/search-worker.dto';

@Injectable()
export class WorkerService {
  constructor(private prisma: PrismaService) {}

  // ─── REGISTRATION ───────────────────────────────────────────

  async register(userId: string, dto: RegisterWorkerDto) {
    // Check if already registered
    const existing = await this.prisma.jobWorkerProfile.findUnique({
      where: { userId },
    });
    if (existing) throw new ConflictException('Anda sudah terdaftar sebagai pekerja');

    // Validate skill subcategories exist
    if (dto.skills?.length) {
      const subCatIds = dto.skills.map((s) => s.subCategoryId);
      const found = await this.prisma.jobSubCategory.findMany({
        where: { id: { in: subCatIds } },
        select: { id: true },
      });
      if (found.length !== subCatIds.length) {
        throw new BadRequestException('Satu atau lebih subkategori tidak ditemukan');
      }
    }

    const profile = await this.prisma.jobWorkerProfile.create({
      data: {
        userId,
        gender: dto.gender,
        age: dto.age,
        whatsappNumber: dto.whatsappNumber,
        idCardPhoto: dto.idCardPhoto,
        profilePhoto: dto.profilePhoto,
        bio: dto.bio,
        intro: dto.intro,
        location: dto.location,
        fullAddress: dto.fullAddress,
        bankName: dto.bankName,
        bankAccount: dto.bankAccount,
        bankAccountName: dto.bankAccountName,
        skills: {
          create: dto.skills.map((s) => ({
            subCategoryId: s.subCategoryId,
            pricingType: s.pricingType as any,
            rate: s.rate,
            canProvideEquipment: s.canProvideEquipment ?? false,
            equipmentList: s.equipmentList,
          })),
        },
        workSchedules: dto.workSchedules?.length
          ? {
              create: dto.workSchedules.map((ws) => ({
                dayOfWeek: ws.dayOfWeek,
                startTime: ws.startTime,
                endTime: ws.endTime,
              })),
            }
          : undefined,
        serviceAreas: dto.serviceAreas?.length
          ? {
              create: dto.serviceAreas.map((sa) => ({
                areaName: sa.areaName,
              })),
            }
          : undefined,
      },
      include: {
        skills: { include: { subCategory: { select: { id: true, name: true } } } },
        workSchedules: true,
        serviceAreas: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return profile;
  }

  // ─── PROFILE ────────────────────────────────────────────────

  async getProfile(profileId: string) {
    const profile = await this.prisma.jobWorkerProfile.findUnique({
      where: { id: profileId },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        skills: {
          where: { isActive: true },
          include: { subCategory: { include: { category: { select: { id: true, name: true, slug: true } } } } },
        },
        workSchedules: { where: { isActive: true } },
        serviceAreas: { where: { isActive: true } },
      },
    });
    if (!profile) throw new NotFoundException('Profil pekerja tidak ditemukan');
    return profile;
  }

  async getMyProfile(userId: string) {
    const profile = await this.prisma.jobWorkerProfile.findUnique({
      where: { userId },
      include: {
        skills: {
          include: { subCategory: { include: { category: { select: { id: true, name: true } } } } },
        },
        workSchedules: true,
        serviceAreas: true,
      },
    });
    if (!profile) throw new NotFoundException('Anda belum terdaftar sebagai pekerja');
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateWorkerDto) {
    const profile = await this.prisma.jobWorkerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Anda belum terdaftar sebagai pekerja');

    return this.prisma.jobWorkerProfile.update({
      where: { userId },
      data: {
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.age !== undefined && { age: dto.age }),
        ...(dto.whatsappNumber !== undefined && { whatsappNumber: dto.whatsappNumber }),
        ...(dto.idCardPhoto !== undefined && { idCardPhoto: dto.idCardPhoto }),
        ...(dto.profilePhoto !== undefined && { profilePhoto: dto.profilePhoto }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.intro !== undefined && { intro: dto.intro }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.fullAddress !== undefined && { fullAddress: dto.fullAddress }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName }),
        ...(dto.bankAccount !== undefined && { bankAccount: dto.bankAccount }),
        ...(dto.bankAccountName !== undefined && { bankAccountName: dto.bankAccountName }),
      },
      include: {
        skills: { include: { subCategory: { select: { id: true, name: true } } } },
        workSchedules: true,
        serviceAreas: true,
      },
    });
  }

  // ─── SKILLS MANAGEMENT ──────────────────────────────────────

  async addSkill(userId: string, dto: WorkerSkillDto) {
    const profile = await this.ensureWorkerProfile(userId);

    const existing = await this.prisma.jobWorkerSkill.findFirst({
      where: { profileId: profile.id, subCategoryId: dto.subCategoryId },
    });
    if (existing) throw new ConflictException('Skill untuk subkategori ini sudah ada');

    return this.prisma.jobWorkerSkill.create({
      data: {
        profileId: profile.id,
        subCategoryId: dto.subCategoryId,
        pricingType: dto.pricingType as any,
        rate: dto.rate,
        canProvideEquipment: dto.canProvideEquipment ?? false,
        equipmentList: dto.equipmentList,
      },
      include: { subCategory: { select: { id: true, name: true } } },
    });
  }

  async removeSkill(userId: string, skillId: string) {
    const profile = await this.ensureWorkerProfile(userId);
    const skill = await this.prisma.jobWorkerSkill.findFirst({
      where: { id: skillId, profileId: profile.id },
    });
    if (!skill) throw new NotFoundException('Skill tidak ditemukan');

    await this.prisma.jobWorkerSkill.delete({ where: { id: skillId } });
    return { message: 'Skill berhasil dihapus' };
  }

  // ─── SCHEDULE MANAGEMENT ────────────────────────────────────

  async updateSchedule(userId: string, schedules: WorkScheduleDto[]) {
    const profile = await this.ensureWorkerProfile(userId);

    // Replace all schedules
    await this.prisma.jobWorkSchedule.deleteMany({ where: { profileId: profile.id } });

    if (schedules.length > 0) {
      await this.prisma.jobWorkSchedule.createMany({
        data: schedules.map((s) => ({
          profileId: profile.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });
    }

    return this.prisma.jobWorkSchedule.findMany({
      where: { profileId: profile.id },
    });
  }

  // ─── SERVICE AREAS ──────────────────────────────────────────

  async updateServiceAreas(userId: string, areas: ServiceAreaDto[]) {
    const profile = await this.ensureWorkerProfile(userId);

    // Replace all areas
    await this.prisma.jobServiceArea.deleteMany({ where: { profileId: profile.id } });

    if (areas.length > 0) {
      await this.prisma.jobServiceArea.createMany({
        data: areas.map((a) => ({
          profileId: profile.id,
          areaName: a.areaName,
        })),
      });
    }

    return this.prisma.jobServiceArea.findMany({
      where: { profileId: profile.id },
    });
  }

  // ─── SEARCH ─────────────────────────────────────────────────

  async search(dto: SearchWorkerDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {
      providerStatus: 'APPROVED',
    };

    // Filter by subcategory skill
    if (dto.subCategoryId) {
      where.skills = {
        some: { subCategoryId: dto.subCategoryId, isActive: true },
      };
    }

    // Filter by location
    if (dto.location) {
      where.OR = [
        { location: { contains: dto.location, mode: 'insensitive' } },
        { serviceAreas: { some: { areaName: { contains: dto.location, mode: 'insensitive' }, isActive: true } } },
      ];
    }

    // Filter by text search
    if (dto.search) {
      const searchFilter = [
        { bio: { contains: dto.search, mode: 'insensitive' } },
        { intro: { contains: dto.search, mode: 'insensitive' } },
        { user: { name: { contains: dto.search, mode: 'insensitive' } } },
      ];
      if (where.OR) {
        // Combine with existing OR
        where.AND = [{ OR: where.OR }, { OR: searchFilter }];
        delete where.OR;
      } else {
        where.OR = searchFilter;
      }
    }

    // Filter by minimum rating
    if (dto.minRating !== undefined) {
      where.rating = { gte: dto.minRating };
    }

    // Sort
    const sortField = dto.sortBy ?? 'rating';
    const sortOrder = dto.sortOrder ?? 'desc';
    const orderBy: any = {};
    if (sortField === 'rating') orderBy.rating = sortOrder;
    else if (sortField === 'totalJobs') orderBy.totalJobs = sortOrder;
    else orderBy.createdAt = sortOrder;

    const [workers, total] = await Promise.all([
      this.prisma.jobWorkerProfile.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          skills: {
            where: { isActive: true },
            include: { subCategory: { select: { id: true, name: true } } },
          },
          serviceAreas: { where: { isActive: true }, select: { areaName: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.jobWorkerProfile.count({ where }),
    ]);

    return {
      workers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── HELPERS ────────────────────────────────────────────────

  private async ensureWorkerProfile(userId: string) {
    const profile = await this.prisma.jobWorkerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Anda belum terdaftar sebagai pekerja');
    return profile;
  }
}
