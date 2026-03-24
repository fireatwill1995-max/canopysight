/** Paginated response wrapper. */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/** Sort direction. */
export type SortDirection = "asc" | "desc";

/** Generic sort parameter. */
export interface SortParam<TField extends string = string> {
  field: TField;
  direction: SortDirection;
}

/** Generic filter parameter. */
export interface FilterParam<TField extends string = string> {
  field: TField;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "in";
  value: string | number | boolean | string[] | number[];
}

/** Standard API response envelope. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    requestId?: string;
    timestamp: string;
    duration?: number;
  };
}

/** Standard API error response. */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: Record<string, string[]>;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
  };
}
