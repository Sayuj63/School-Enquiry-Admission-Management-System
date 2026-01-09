export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardStats {
  totalEnquiries: number;
  enquiriesToday: number;
  enquiriesThisMonth: number;
  pendingAdmissions: number;
  scheduledCounselling: number;
  recentEnquiries: Array<{
    _id: string;
    tokenId: string;
    childName: string;
    grade: string;
    createdAt: string;
  }>;
}
