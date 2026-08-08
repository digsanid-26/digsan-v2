const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

async function jobRequest<T>(endpoint: string, options: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((json as any).message || `HTTP ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return (json as any).data ?? json;
}

// ─── Types ──────────────────────────────────────────────────────

export interface JobCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image?: string;
  order: number;
  isActive: boolean;
  subCategories?: JobSubCategory[];
}

export interface JobSubCategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image?: string;
  order: number;
  isActive: boolean;
  services?: JobService[];
  category?: JobCategory;
}

export interface JobService {
  id: string;
  subCategoryId: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image?: string;
  basePrice: string;
  priceUnit: string;
  duration?: number;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  viewCount: number;
  orderCount: number;
  subCategory?: JobSubCategory;
}

export interface JobWorkerProfile {
  id: string;
  userId: string;
  gender?: string;
  age?: number;
  whatsappNumber?: string;
  profilePhoto?: string;
  bio?: string;
  intro?: string;
  location?: string;
  fullAddress?: string;
  providerStatus: string;
  rating?: string;
  totalJobs: number;
  totalReviews: number;
  user?: { id: string; name: string; avatar?: string | null };
  skills?: {
    id: string;
    subCategoryId: string;
    pricingType: string;
    rate: string;
    canProvideEquipment: boolean;
    equipmentList?: string;
    isActive: boolean;
    subCategory?: { id: string; name: string; category?: { id: string; name: string; slug: string } };
  }[];
  workSchedules?: { id: string; dayOfWeek: string; startTime: string; endTime: string; isActive: boolean }[];
  serviceAreas?: { id: string; areaName: string; isActive: boolean }[];
}

export interface JobOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  providerId?: string | null;
  serviceId: string;
  subCategoryId?: string;
  addressId: string;
  serviceName: string;
  categoryName?: string;
  description?: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  pricingType: string;
  basePrice: string;
  serviceFee: string;
  totalPrice: string;
  status: string;
  customerNotes?: string;
  providerNotes?: string;
  confirmedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  service?: { id: string; name: string; slug: string };
  subCategory?: { id: string; name: string };
  address?: { id: string; label: string; fullAddress: string };
  customer?: { id: string; name: string; email?: string; phone?: string; avatar?: string | null };
  provider?: { id: string; name: string; email?: string; phone?: string; avatar?: string | null };
  payment?: { id: string; status: string; method: string; amount?: string };
  review?: any;
  images?: { id: string; imageUrl: string }[];
}

// ─── API Methods ────────────────────────────────────────────────

export const jobApi = {
  // Catalog (public)
  getCategories: () => jobRequest<JobCategory[]>('/jobs/catalog/categories'),

  getCategoryBySlug: (slug: string) => jobRequest<JobCategory>(`/jobs/catalog/categories/${slug}`),

  getServices: (params?: { categoryId?: string; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.categoryId) qs.set('categoryId', params.categoryId);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return jobRequest<{ services: JobService[]; total: number; page: number; limit: number }>(
      `/jobs/catalog/services${q ? `?${q}` : ''}`,
    );
  },

  getServiceBySlug: (slug: string) => jobRequest<JobService>(`/jobs/catalog/services/${slug}`),

  // Workers (public)
  searchWorkers: (params?: {
    search?: string;
    location?: string;
    subCategoryId?: string;
    minRating?: number;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.location) qs.set('location', params.location);
    if (params?.subCategoryId) qs.set('subCategoryId', params.subCategoryId);
    if (params?.minRating !== undefined) qs.set('minRating', String(params.minRating));
    if (params?.sortBy) qs.set('sortBy', params.sortBy);
    if (params?.sortOrder) qs.set('sortOrder', params.sortOrder);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return jobRequest<{ workers: JobWorkerProfile[]; total: number; page: number; totalPages: number }>(
      `/jobs/workers${q ? `?${q}` : ''}`,
    );
  },

  getWorkerProfile: (id: string) => jobRequest<JobWorkerProfile>(`/jobs/workers/profile/${id}`),

  // Orders (auth)
  getOrders: (token: string, params?: { role?: 'customer' | 'provider'; status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.role) qs.set('role', params.role);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return jobRequest<{ orders: JobOrder[]; total: number; page: number; totalPages: number }>(
      `/jobs/orders${q ? `?${q}` : ''}`,
      {},
      token,
    );
  },

  getOrder: (token: string, id: string) => jobRequest<JobOrder>(`/jobs/orders/${id}`, {}, token),

  createOrder: (token: string, data: {
    serviceId: string;
    addressId: string;
    providerId?: string;
    subCategoryId?: string;
    description?: string;
    scheduledDate: string;
    scheduledTime: string;
    duration: number;
    pricingType?: string;
    customerNotes?: string;
  }) => jobRequest<JobOrder>('/jobs/orders', { method: 'POST', body: JSON.stringify(data) }, token),

  updateOrderStatus: (token: string, id: string, data: { action: string; notes?: string; reason?: string }) =>
    jobRequest<JobOrder>(`/jobs/orders/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }, token),

  // Reviews (public + auth)
  getProviderReviews: (providerId: string, page?: number, limit?: number) => {
    const qs = new URLSearchParams();
    if (page) qs.set('page', String(page));
    if (limit) qs.set('limit', String(limit));
    const q = qs.toString();
    return jobRequest<any>(`/jobs/reviews/provider/${providerId}${q ? `?${q}` : ''}`);
  },

  createReview: (token: string, data: { orderId: string; rating: number; comment?: string }) =>
    jobRequest<any>('/jobs/reviews', { method: 'POST', body: JSON.stringify(data) }, token),
};
