#!/usr/bin/env bash
set -euo pipefail
cd /workspace/Couple-Court
node -e "if (process.versions.node.split('.')[0] !== '24') throw new Error('Node.js 24.x is required')"
npm ci --no-audit --no-fund
node scripts/prepare-taro-cache.cjs
npm run typecheck
npm test
npm run build
