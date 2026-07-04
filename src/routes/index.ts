import { Router } from 'express';
import { authRoutes } from '@/modules/auth/auth.routes';
import { userRoutes } from '@/modules/user/user.routes';
import { roleRoutes } from '@/modules/role/role.routes';
import { moduleRoutes } from '@/modules/module/module.routes';
import { permissionRoutes } from '@/modules/permission/permission.routes';
import { dashboardRoutes } from '@/modules/dashboard/dashboard.routes';
import { youtubeClaimReleaseRoutes } from '@/modules/youtube-claim-release/youtube-claim-release.routes';
import { facebookClaimReleaseRoutes } from '@/modules/facebook-claim-release/facebook-claim-release.routes';
import { contentIdRoutes } from '@/modules/content-id/content-id.routes';
import { oacRoutes } from '@/modules/oac/oac.routes';
import { profileLinkingRoutes } from '@/modules/profile-linking/profile-linking.routes';
import { allowlistRoutes } from '@/modules/allowlist/allowlist.routes';
import { manualClaimingRoutes } from '@/modules/manual-claiming/manual-claiming.routes';
import { takedownRoutes } from '@/modules/takedown/takedown.routes';
import { referenceOverlapsRoutes } from '@/modules/reference-overlaps/reference-overlaps.routes';
import { registeredIssuesModules } from '@/modules/issues-shared/issues-module.registry';
import { notificationRoutes } from '@/modules/notification/notification.routes';
import { cronjobSettingsRoutes } from '@/modules/cronjob-settings/cronjob-settings.routes';
import { musicReleaseRoutes } from '@/modules/music-release/music-release.routes';
import { releaseCatalogRoutes } from '@/modules/release-catalog/release-catalog.routes';
import { labelTransferRoutes } from '@/modules/label-transfer/label-transfer.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'API is healthy', uptime: process.uptime() });
});

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/modules', moduleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/youtube-claim-releases', youtubeClaimReleaseRoutes);
router.use('/facebook-claim-releases', facebookClaimReleaseRoutes);
router.use('/content-id', contentIdRoutes);
router.use('/oac', oacRoutes);
router.use('/profile-linking', profileLinkingRoutes);
router.use('/allowlist', allowlistRoutes);
router.use('/manual-claiming', manualClaimingRoutes);
router.use('/takedown', takedownRoutes);
router.use('/reference-overlaps', referenceOverlapsRoutes);
for (const mod of registeredIssuesModules) {
  router.use(mod.apiPath, mod.routes);
}
router.use('/notifications', notificationRoutes);
router.use('/cronjob-settings', cronjobSettingsRoutes);
router.use('/music-releases', musicReleaseRoutes);
router.use('/release-catalog', releaseCatalogRoutes);
router.use('/label-transfers', labelTransferRoutes);

export const apiRouter = router;
