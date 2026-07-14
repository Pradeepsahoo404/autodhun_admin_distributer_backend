const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'src/modules');
const files = [
  'channel/channel.service.ts',
  'channel-linking/channel-linking.service.ts',
  'oac/oac.service.ts',
  'content-id/content-id.service.ts',
  'allowlist/allowlist.service.ts',
  'takedown/takedown.service.ts',
  'manual-claiming/manual-claiming.service.ts',
  'profile-linking/profile-linking.service.ts',
  'youtube-claim-release/youtube-claim-release.service.ts',
  'facebook-claim-release/facebook-claim-release.service.ts',
];

for (const rel of files) {
  const fp = path.join(root, rel);
  let s = fs.readFileSync(fp, 'utf8');
  const lines = s.split(/\r?\n/);
  const out = [];
  let skipping = false;
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!skipping && /^function assertOwnership\(/.test(line)) {
      skipping = true;
      depth = 0;
      for (const ch of line) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      if (depth <= 0 && line.includes('}')) skipping = false;
      continue;
    }
    if (skipping) {
      for (const ch of line) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      if (depth <= 0) skipping = false;
      continue;
    }
    out.push(line);
  }
  // remove blank line leftover after removal
  s = out.join('\n').replace(/\n{3,}/g, '\n\n');

  if (
    s.includes('async updateStatus') &&
    !/assertFeatureAccess\(actor, item, 'createdBy'\);\n\s*\n\s*await/.test(s)
  ) {
    s = s.replace(
      /(if \(!item\) throw ApiError\.notFound\([^)]+\);)\n(\n\s*await \w+[Rr]epository\.updateById\(id, \{\n\s*status:)/g,
      "$1\n    assertFeatureAccess(actor, item, 'createdBy');\n$2",
    );
  }

  fs.writeFileSync(fp, s);
  console.log('cleaned', rel, !s.includes('function assertOwnership'));
}
