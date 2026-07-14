import { Types } from 'mongoose';
import { ROLES, TENANT_STATUS } from '@/constants';
import { TenantModel } from '@/modules/tenant/tenant.model';
import { UserModel } from '@/modules/user/user.model';
import { RoleModel } from '@/modules/role/role.model';
import { MusicReleaseModel } from '@/modules/music-release/music-release.model';
import { ChannelModel } from '@/modules/channel/channel.model';
import { ChannelLinkingModel } from '@/modules/channel-linking/channel-linking.model';
import { SupportTicketModel } from '@/modules/support-ticket/support-ticket.model';
import { SUPPORT_TICKET_STATUS } from '@/modules/support-ticket/support-ticket.constants';
import { ApiError } from '@/utils/ApiError';

export interface TenantDashboardRow {
  tenantId: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  admins: number;
  superAdmins: number;
  users: number;
  releases: number;
  channels: number;
  channelLinkings: number;
  openTickets: number;
}

export interface MasterDashboardSummary {
  tenants: number;
  activeTenants: number;
  inactiveTenants: number;
  admins: number;
  superAdmins: number;
  releases: number;
  channels: number;
  openTickets: number;
}

export interface MasterDashboardResponse {
  summary: MasterDashboardSummary;
  tenants: TenantDashboardRow[];
}

class MasterDashboardService {
  async getOverview(tenantIdFilter?: string): Promise<MasterDashboardResponse> {
    const adminRole = await RoleModel.findOne({ slug: ROLES.ADMIN }).select('_id').lean();
    const saRole = await RoleModel.findOne({ slug: ROLES.SUPER_ADMIN }).select('_id').lean();
    const adminRoleId = adminRole?._id?.toString();
    const saRoleId = saRole?._id?.toString();

    const tenantFilter: Record<string, unknown> = {};
    if (tenantIdFilter) {
      if (!Types.ObjectId.isValid(tenantIdFilter)) {
        throw ApiError.badRequest('Invalid tenantId');
      }
      tenantFilter._id = new Types.ObjectId(tenantIdFilter);
    }

    const tenants = await TenantModel.find(tenantFilter).sort({ createdAt: -1 }).lean().exec();
    if (tenants.length === 0) {
      return {
        summary: emptySummary(),
        tenants: [],
      };
    }

    const tenantObjectIds = tenants.map((t) => t._id);
    const users = await UserModel.find({ tenantId: { $in: tenantObjectIds } })
      .select('_id tenantId role')
      .lean()
      .exec();

    const usersByTenant = new Map<string, { ids: Types.ObjectId[]; adminCount: number; saCount: number }>();
    for (const tenant of tenants) {
      usersByTenant.set(tenant._id.toString(), { ids: [], adminCount: 0, saCount: 0 });
    }

    for (const user of users) {
      const tid = user.tenantId?.toString();
      if (!tid) continue;
      const bucket = usersByTenant.get(tid);
      if (!bucket) continue;
      bucket.ids.push(user._id);
      const roleId = user.role?.toString();
      if (adminRoleId && roleId === adminRoleId) bucket.adminCount += 1;
      if (saRoleId && roleId === saRoleId) bucket.saCount += 1;
    }

    const [
      releaseCounts,
      channelCounts,
      linkingCounts,
      openTicketCounts,
    ] = await Promise.all([
      countByTenantId(MusicReleaseModel, tenantObjectIds),
      countByTenantId(ChannelModel, tenantObjectIds),
      countByTenantId(ChannelLinkingModel, tenantObjectIds),
      countByTenantId(SupportTicketModel, tenantObjectIds, {
        status: { $in: [SUPPORT_TICKET_STATUS.OPEN, SUPPORT_TICKET_STATUS.IN_PROGRESS] },
      }),
    ]);

    const rows: TenantDashboardRow[] = tenants.map((tenant) => {
      const tid = tenant._id.toString();
      const bucket = usersByTenant.get(tid) ?? { ids: [], adminCount: 0, saCount: 0 };
      return {
        tenantId: tid,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        createdAt: tenant.createdAt?.toISOString?.() ?? String(tenant.createdAt),
        admins: bucket.adminCount,
        superAdmins: bucket.saCount,
        users: bucket.ids.length,
        releases: releaseCounts.get(tid) ?? 0,
        channels: channelCounts.get(tid) ?? 0,
        channelLinkings: linkingCounts.get(tid) ?? 0,
        openTickets: openTicketCounts.get(tid) ?? 0,
      };
    });

    const summary: MasterDashboardSummary = {
      tenants: rows.length,
      activeTenants: rows.filter((r) => r.status === TENANT_STATUS.ACTIVE).length,
      inactiveTenants: rows.filter((r) => r.status !== TENANT_STATUS.ACTIVE).length,
      admins: rows.reduce((n, r) => n + r.admins, 0),
      superAdmins: rows.reduce((n, r) => n + r.superAdmins, 0),
      releases: rows.reduce((n, r) => n + r.releases, 0),
      channels: rows.reduce((n, r) => n + r.channels, 0),
      openTickets: rows.reduce((n, r) => n + r.openTickets, 0),
    };

    return { summary, tenants: rows };
  }
}

function emptySummary(): MasterDashboardSummary {
  return {
    tenants: 0,
    activeTenants: 0,
    inactiveTenants: 0,
    admins: 0,
    superAdmins: 0,
    releases: 0,
    channels: 0,
    openTickets: 0,
  };
}

async function countByTenantId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: { aggregate: (pipeline: any[]) => { exec: () => Promise<Array<{ _id: Types.ObjectId; count: number }>> } },
  tenantIds: Types.ObjectId[],
  extraMatch: Record<string, unknown> = {},
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (tenantIds.length === 0) return map;

  const rows = await model
    .aggregate([
      { $match: { tenantId: { $in: tenantIds }, ...extraMatch } },
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
    ])
    .exec();

  for (const row of rows) {
    if (row._id) map.set(row._id.toString(), row.count);
  }
  return map;
}

export const masterDashboardService = new MasterDashboardService();
