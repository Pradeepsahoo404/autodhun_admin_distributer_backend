import { PermissionAction } from '@/constants';

/** Pagination request params parsed from the query string. */
export interface PaginationQuery {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  roleId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** A single permission row resolved for the authenticated user, used by the sidebar. */
export interface ResolvedModulePermission {
  moduleId: string;
  name: string;
  slug: string;
  route: string;
  icon: string;
  order: number;
  isPro: boolean;
  group: string;
  parentSlug?: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

/** Effective permission row for the admin matrix (includes inherited child access). */
export interface EffectivePermissionRow {
  moduleId: string;
  name: string;
  slug: string;
  parentSlug?: string;
  group: string;
  order: number;
  isRoot: boolean;
  inheritedFrom?: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export type { PermissionAction };
