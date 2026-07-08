/**
 * Standardized API response types for consistent frontend consumption.
 */

/** Successful API response */
export interface ApiSuccess<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

/** Error API response */
export interface ApiError {
  success?: false;
  error: string;
  details?: Record<string, string[]>;
}

/** Paginated API response */
export interface ApiPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Generic API response union */
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

/** Pagination query parameters */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}
