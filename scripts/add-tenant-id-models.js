const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src/modules');
const models = [
  'channel/channel.model.ts',
  'channel-linking/channel-linking.model.ts',
  'support-ticket/support-ticket.model.ts',
  'oac/oac.model.ts',
  'content-id/content-id.model.ts',
  'allowlist/allowlist.model.ts',
  'takedown/takedown.model.ts',
  'manual-claiming/manual-claiming.model.ts',
  'profile-linking/profile-linking.model.ts',
  'youtube-claim-release/youtube-claim-release.model.ts',
  'facebook-claim-release/facebook-claim-release.model.ts',
  'music-release/music-release.model.ts',
  'issues-shared/issues-entry.model.ts',
  'reference-overlaps/reference-overlaps.model.ts',
  'release-catalog/release-label.model.ts',
  'release-catalog/release-artist.model.ts',
  'label-transfer/label-transfer.model.ts',
  'label-update/label-update.model.ts',
];

for (const rel of models) {
  const file = path.join(root, rel);
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes('tenantIdField') || /tenantId\??:/.test(s.split('interface')[1] || '')) {
    // still add if schema missing
  }
  if (s.includes('tenantId: tenantIdField')) {
    console.log('skip', rel);
    continue;
  }

  if (!s.includes("import { tenantIdField }")) {
    s = s.replace(
      /from 'mongoose';/,
      "from 'mongoose';\nimport { tenantIdField } from '@/utils/tenantFields';",
    );
  }

  if (!/tenantId\??:\s*Types\.ObjectId/.test(s)) {
    if (/\n\s*createdBy:/.test(s)) {
      s = s.replace(/\n(\s*)createdBy:/, '\n$1tenantId?: Types.ObjectId | null;\n$1createdBy:');
    } else if (/\n\s*createdAt:/.test(s)) {
      s = s.replace(/\n(\s*)createdAt:/, '\n$1tenantId?: Types.ObjectId | null;\n$1createdAt:');
    }
  }

  if (!s.includes('tenantId: tenantIdField')) {
    s = s.replace(
      /\n(\s*)createdBy:\s*\{\s*type:\s*Schema\.Types\.ObjectId,\s*ref:\s*'User'/,
      '\n$1tenantId: tenantIdField,\n$1createdBy: { type: Schema.Types.ObjectId, ref: \'User\'',
    );
  }

  if (!s.includes('tenantId: tenantIdField')) {
    // label-transfer / label-update may not use createdBy the same way
    s = s.replace(
      /\n(\s*)(fromAdminId|owner|ownedBy|transferredBy):\s*\{/,
      '\n$1tenantId: tenantIdField,\n$1$2: {',
    );
  }

  fs.writeFileSync(file, s);
  console.log(s.includes('tenantId: tenantIdField') ? 'updated' : 'FAILED', rel);
}
