const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src/modules');

/** Controllers that pass only id + isSuperAdmin — switch to requestActor */
const controllers = [
  'channel/channel.controller.ts',
  'channel-linking/channel-linking.controller.ts',
  'support-ticket/support-ticket.controller.ts',
  'oac/oac.controller.ts',
  'content-id/content-id.controller.ts',
  'allowlist/allowlist.controller.ts',
  'takedown/takedown.controller.ts',
  'manual-claiming/manual-claiming.controller.ts',
  'profile-linking/profile-linking.controller.ts',
  'youtube-claim-release/youtube-claim-release.controller.ts',
  'facebook-claim-release/facebook-claim-release.controller.ts',
  'reference-overlaps/reference-overlaps.controller.ts',
  'issues-shared/issues-entry.controller.ts',
  'music-release/music-release.controller.ts',
  'label-transfer/label-transfer.controller.ts',
  'label-update/label-update.controller.ts',
  'release-catalog/release-catalog.controller.ts',
];

for (const rel of controllers) {
  const file = path.join(root, rel);
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes('requestActor')) {
    console.log('ctrl skip', rel);
    continue;
  }
  if (!s.includes("from 'express'")) {
    console.log('ctrl no express', rel);
    continue;
  }
  s = s.replace(
    /from 'express';/,
    "from 'express';\nimport { requestActor } from '@/utils/requestActor';",
  );

  // helper pattern: return { id: req.user!.id, isSuperAdmin: ... }
  s = s.replace(
    /return\s*\{\s*id:\s*req\.user!\.id,\s*isSuperAdmin:\s*req\.user!\.isSuperAdmin\s*\};/g,
    'return requestActor(req);',
  );

  // inline object patterns
  s = s.replace(
    /\{\s*id:\s*req\.user!\.id,\s*isSuperAdmin:\s*req\.user!\.isSuperAdmin,\s*\}/g,
    'requestActor(req)',
  );
  s = s.replace(
    /\{\s*id:\s*req\.user!\.id,\s*isSuperAdmin:\s*req\.user!\.isSuperAdmin\s*\}/g,
    'requestActor(req)',
  );
  // music release may pass name too
  s = s.replace(
    /\{\s*id:\s*req\.user!\.id,\s*isSuperAdmin:\s*req\.user!\.isSuperAdmin,\s*name:\s*req\.user!\.name\s*\}/g,
    'requestActor(req)',
  );

  fs.writeFileSync(file, s);
  console.log('ctrl', rel);
}

/** Pattern A services — createdBy ownership clone */
const patternA = [
  { file: 'channel/channel.service.ts', entity: 'channels', notFound: 'Channel not found' },
  { file: 'channel-linking/channel-linking.service.ts', entity: 'channel linking entries', notFound: null },
  { file: 'oac/oac.service.ts', entity: 'OAC entries', notFound: 'OAC entry not found' },
  { file: 'content-id/content-id.service.ts', entity: 'Content ID entries', notFound: null },
  { file: 'allowlist/allowlist.service.ts', entity: 'allowlist entries', notFound: null },
  { file: 'takedown/takedown.service.ts', entity: 'takedown entries', notFound: null },
  { file: 'manual-claiming/manual-claiming.service.ts', entity: 'manual claiming entries', notFound: null },
  { file: 'profile-linking/profile-linking.service.ts', entity: 'profile linking entries', notFound: null },
  { file: 'youtube-claim-release/youtube-claim-release.service.ts', entity: 'YouTube claim releases', notFound: null },
  { file: 'facebook-claim-release/facebook-claim-release.service.ts', entity: 'Facebook claim releases', notFound: null },
];

const scopeImport = `import {
  assertFeatureAccess,
  createdByFeatureScope,
  requireWriteTenantId,
  type TenantActor,
} from '@/utils/tenantScope';`;

for (const { file } of patternA) {
  const fp = path.join(root, file);
  let s = fs.readFileSync(fp, 'utf8');
  if (s.includes('createdByFeatureScope')) {
    console.log('svc skip', file);
    continue;
  }

  if (!s.includes("from '@/utils/tenantScope'")) {
    s = s.replace(/import \{ ApiError \} from '@\/utils\/ApiError';/, (m) => `${m}\n${scopeImport}`);
  }

  // Replace interface Actor with TenantActor alias usage
  s = s.replace(/interface Actor \{[\s\S]*?\n\}/, 'type Actor = TenantActor;');

  // Remove local assertOwnership function
  s = s.replace(/function assertOwnership\([\s\S]*?\n\}\n\n/, '');

  // Replace scope method
  s = s.replace(
    /private scope\(actor: Actor\) \{\s*return actor\.isSuperAdmin \? \{\} : \{ createdBy: actor\.id \};\s*\}/,
    'private scope(actor: Actor) {\n    return createdByFeatureScope(actor);\n  }',
  );

  // Replace assertOwnership( calls
  s = s.replace(/assertOwnership\(([^,]+),\s*actor\)/g, 'assertFeatureAccess(actor, $1, \'createdBy\')');

  // Stamp tenantId on create — find create(...) blocks with createdBy: actor.id
  s = s.replace(
    /(async create\([\s\S]*?const created = await \w+\.create\(\{)([\s\S]*?)(createdBy: actor\.id as never,)/,
    (match, a, mid, createdByLine) => {
      if (mid.includes('tenantId') || match.includes('requireWriteTenantId')) return match;
      return `${a}\n      tenantId: requireWriteTenantId(actor) as never,${mid}${createdByLine}`;
    },
  );

  // updateStatus: after finding item, assert tenant
  s = s.replace(
    /(async updateStatus\([\s\S]*?if \(!item\) throw ApiError\.notFound\([^)]+\);\n)/,
    `$1\n    assertFeatureAccess(actor, item, 'createdBy');\n`,
  );

  fs.writeFileSync(fp, s);
  console.log('svc', file);
}

console.log('done');
