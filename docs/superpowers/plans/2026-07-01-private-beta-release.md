# Private Beta Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package 语境生词本 `0.1.0` as a policy-ready Chrome Web Store Private Beta and prepare the privacy page, listing materials, release checks, tester guide, and 14-day validation runbook.

**Architecture:** The extension remains local-first and gains no analytics, telemetry, payment, or feedback network calls. Release-specific manifest metadata is isolated in a tested manifest factory; a Node CLI validates the generated ZIP and prints its SHA-256. Static documents and store assets live outside the WXT runtime output, while GitHub Pages and Chrome Web Store publishing remain explicit authenticated user gates.

**Tech Stack:** Node.js 22, pnpm, WXT 0.20, TypeScript, Vitest, Playwright, Chrome Manifest V3, static HTML, Chrome Web Store Private distribution, GitHub Pages.

---

## File map

```text
.
├── docs/
│   ├── privacy/
│   │   └── index.html                         # public GitHub Pages privacy policy
│   ├── release/
│   │   ├── beta-runbook.md                    # 14-day WeChat operating schedule
│   │   ├── permissions.md                     # dashboard privacy and permission answers
│   │   ├── questionnaires.md                  # Day 7 and Day 14 question copy
│   │   ├── release-record-template.md         # immutable release evidence fields
│   │   ├── store-listing.md                   # copy-ready store listing
│   │   └── tester-guide.md                    # private tester installation and use
│   └── superpowers/
│       └── plans/
│           └── 2026-07-01-private-beta-release.md
├── scripts/
│   └── verify-release.mjs                     # ZIP structure, manifest, and hash checker
├── src/
│   └── shared/
│       └── manifest.ts                        # testable Beta manifest factory
├── store-assets/
│   ├── README.md                              # asset source and privacy checklist
│   ├── screenshot-hover.png                   # 1280×800 real hover experience
│   ├── screenshot-vocabulary.png              # 1280×800 side-panel library
│   ├── screenshot-digest.png                  # 1280×800 digest/settings
│   └── small-promo.png                        # 440×280 brand-led tile
├── tests/
│   └── unit/
│       ├── manifest.test.ts                   # Beta metadata and permission regression
│       ├── privacy-page.test.ts               # public policy content regression
│       └── release-validation.test.ts         # package validation regression
├── package.json                               # release commands
└── wxt.config.ts                              # delegates manifest creation
```

## Task 1: Make the Beta manifest explicit and testable

**Files:**
- Create: `tests/unit/manifest.test.ts`
- Create: `src/shared/manifest.ts`
- Modify: `wxt.config.ts:1-28`

- [ ] **Step 1: Write the failing manifest test**

Create `tests/unit/manifest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  BETA_DESCRIPTION,
  BETA_NAME,
  createManifest,
} from '../../src/shared/manifest';

describe('Private Beta manifest', () => {
  it('labels the production package as a beta build', () => {
    const manifest = createManifest('production');

    expect(manifest.name).toBe(BETA_NAME);
    expect(manifest.description).toBe(BETA_DESCRIPTION);
    expect(BETA_NAME).toContain('BETA');
    expect(BETA_DESCRIPTION).toContain(
      'THIS EXTENSION IS FOR BETA TESTING',
    );
    expect(manifest.host_permissions).toBeUndefined();
  });

  it('keeps broad website access optional', () => {
    const manifest = createManifest('production');

    expect(manifest.optional_host_permissions).toEqual([
      'http://*/*',
      'https://*/*',
    ]);
    expect(manifest.permissions).toEqual([
      'storage',
      'alarms',
      'notifications',
      'tts',
      'sidePanel',
      'scripting',
    ]);
  });

  it('grants only the local fixture host in test mode', () => {
    expect(createManifest('test').host_permissions).toEqual([
      'http://127.0.0.1/*',
    ]);
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run:

```bash
pnpm test -- tests/unit/manifest.test.ts
```

Expected: FAIL because `src/shared/manifest.ts` does not exist.

- [ ] **Step 3: Implement the manifest factory**

Create `src/shared/manifest.ts`:

```ts
import type { UserManifest } from 'wxt';

export const BETA_NAME = '语境生词本 BETA';
export const BETA_DESCRIPTION = [
  '悬停查词、保存原句并生成每周本地复习周报。',
  'THIS EXTENSION IS FOR BETA TESTING.',
].join(' ');

export function createManifest(mode: string): UserManifest {
  return {
    name: BETA_NAME,
    description: BETA_DESCRIPTION,
    permissions: [
      'storage',
      'alarms',
      'notifications',
      'tts',
      'sidePanel',
      'scripting',
    ],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    host_permissions: mode === 'test'
      ? ['http://127.0.0.1/*']
      : undefined,
    action: {
      default_title: '打开语境生词本',
    },
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
  };
}
```

- [ ] **Step 4: Delegate WXT configuration to the factory**

Replace `wxt.config.ts` with:

```ts
import { defineConfig } from 'wxt';
import { createManifest } from './src/shared/manifest';

export default defineConfig({
  manifestVersion: 3,
  manifest: ({ mode }) => createManifest(mode),
});
```

- [ ] **Step 5: Verify the test and generated manifest**

Run:

```bash
pnpm test -- tests/unit/manifest.test.ts
pnpm typecheck
pnpm build
node -e "const m=require('./.output/chrome-mv3/manifest.json'); console.log(JSON.stringify({name:m.name,description:m.description,version:m.version,host_permissions:m.host_permissions},null,2))"
```

Expected:

- 3 manifest tests pass;
- TypeScript exits with code 0;
- WXT build exits with code 0;
- generated name is `语境生词本 BETA`;
- generated version is `0.1.0`;
- generated production manifest has no required `host_permissions`.

- [ ] **Step 6: Commit the manifest change**

```bash
git add src/shared/manifest.ts tests/unit/manifest.test.ts wxt.config.ts
git commit -m "build: label private beta manifest"
```

## Task 2: Publish a static, regression-tested privacy page

**Files:**
- Create: `tests/unit/privacy-page.test.ts`
- Create: `docs/privacy/index.html`

- [ ] **Step 1: Write the failing privacy page test**

Create `tests/unit/privacy-page.test.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const privacyPath = new URL('../../docs/privacy/index.html', import.meta.url);

describe('public privacy page', () => {
  it('discloses local processing, stored fields, and deletion controls', async () => {
    const html = await readFile(privacyPath, 'utf8');

    expect(html).toContain('语境生词本隐私政策');
    expect(html).toContain('仅保存在用户设备');
    expect(html).toContain('不会将收藏内容或浏览活动发送');
    expect(html).toContain('导出数据');
    expect(html).toContain('删除全部本地数据');
  });

  it('contains no remote scripts, forms, or tracking pixels', async () => {
    const html = await readFile(privacyPath, 'utf8');

    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<form/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/https?:\/\//i);
  });
});
```

- [ ] **Step 2: Run the test and verify the missing file failure**

Run:

```bash
pnpm test -- tests/unit/privacy-page.test.ts
```

Expected: FAIL with an `ENOENT` error for `docs/privacy/index.html`.

- [ ] **Step 3: Create the static privacy page**

Create `docs/privacy/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>语境生词本隐私政策</title>
    <meta
      name="description"
      content="语境生词本 Chrome 扩展的隐私政策"
    >
    <style>
      :root {
        color: #17221c;
        background: #f7f6f0;
        font: 17px/1.75 system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }
      body {
        max-width: 760px;
        margin: 0 auto;
        padding: 48px 24px 80px;
      }
      h1,
      h2 {
        line-height: 1.25;
      }
      h2 {
        margin-top: 2em;
      }
      .effective-date {
        color: #536159;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>语境生词本隐私政策</h1>
      <p class="effective-date">生效日期：2026-07-01</p>

      <h2>处理的数据</h2>
      <p>
        语境生词本只在用户主动授权的网站中读取可见文字。当用户稳定悬停
        英文单词时，扩展会提取该单词及其所在句子，用于本地释义、发音、
        收藏和周报。
      </p>
      <p>
        扩展不会读取密码框、表单输入、可编辑区域、Cookie 或网页存储，
        不会保存完整网页或网页 HTML。
      </p>

      <h2>存储与使用</h2>
      <p>
        用户收藏的单词、句子、页面标题、来源地址、设置和周报仅保存在
        用户设备的 Chrome 扩展存储中，只用于提供扩展界面中描述的功能。
      </p>

      <h2>共享与传输</h2>
      <p>
        扩展不包含广告、分析或遥测，不会将收藏内容或浏览活动发送给
        开发者或任何第三方服务器。Chrome 可在用户主动使用整句翻译时
        管理其内置本地翻译模型。
      </p>

      <h2>用户控制</h2>
      <p>
        用户可以在侧边栏导出数据、关闭来源地址保存，或使用“删除全部
        本地数据”清空内容。卸载扩展也会删除本地扩展数据。
      </p>

      <h2>政策更新</h2>
      <p>
        如果扩展的数据处理方式发生变化，本页面会在新版本发布前更新。
      </p>
    </main>
  </body>
</html>
```

- [ ] **Step 4: Verify the page**

Run:

```bash
pnpm test -- tests/unit/privacy-page.test.ts
pnpm typecheck
```

Expected: 2 privacy page tests pass and TypeScript exits with code 0.

- [ ] **Step 5: Preview locally**

Run:

```bash
python3 -m http.server 4180 --directory docs
```

Open `http://127.0.0.1:4180/privacy/` and verify:

- the policy is readable at 320 px and desktop widths;
- no browser console errors appear;
- Network shows only the HTML document;
- the wording matches `PRIVACY.md`.

Stop the server with `Ctrl+C`.

- [ ] **Step 6: Commit the privacy page**

```bash
git add docs/privacy/index.html tests/unit/privacy-page.test.ts
git commit -m "docs: add public privacy page"
```

## Task 3: Add deterministic release-package validation

**Files:**
- Create: `tests/unit/release-validation.test.ts`
- Create: `scripts/verify-release.mjs`
- Modify: `package.json:6-17`

- [ ] **Step 1: Write failing validation tests**

Create `tests/unit/release-validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

// The production CLI is JavaScript so Node can run it without a TS loader.
// @ts-expect-error JavaScript CLI intentionally has no declaration file.
import {
  validateArchiveEntries,
  validateManifest,
} from '../../scripts/verify-release.mjs';

describe('release package validation', () => {
  it('accepts a root manifest and runtime files', () => {
    expect(() => validateArchiveEntries([
      'manifest.json',
      'background.js',
      'sidepanel.html',
      'dictionary/a.json',
    ])).not.toThrow();
  });

  it('rejects nested manifests and development files', () => {
    expect(() => validateArchiveEntries([
      'contextual-vocabulary/manifest.json',
      'contextual-vocabulary/background.js',
    ])).toThrow('MANIFEST_NOT_AT_ARCHIVE_ROOT');

    expect(() => validateArchiveEntries([
      'manifest.json',
      'src/shared/models.ts',
    ])).toThrow('FORBIDDEN_ARCHIVE_ENTRY:src/shared/models.ts');
  });

  it('requires the approved beta name and package version', () => {
    expect(() => validateManifest({
      manifest_version: 3,
      name: '语境生词本 BETA',
      description: 'THIS EXTENSION IS FOR BETA TESTING.',
      version: '0.1.0',
    }, '0.1.0')).not.toThrow();

    expect(() => validateManifest({
      manifest_version: 3,
      name: '语境生词本',
      description: '普通版本',
      version: '0.1.0',
    }, '0.1.0')).toThrow('INVALID_BETA_NAME');
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run:

```bash
pnpm test -- tests/unit/release-validation.test.ts
```

Expected: FAIL because `scripts/verify-release.mjs` does not exist.

- [ ] **Step 3: Implement the release validator**

Create `scripts/verify-release.mjs`:

```js
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const forbiddenPrefixes = [
  '.env',
  'docs/',
  'playwright-report/',
  'src/',
  'store-assets/',
  'test-results/',
  'tests/',
];

export function validateArchiveEntries(entries) {
  if (!entries.includes('manifest.json')) {
    throw new Error('MANIFEST_NOT_AT_ARCHIVE_ROOT');
  }

  for (const entry of entries) {
    if (forbiddenPrefixes.some((prefix) => entry.startsWith(prefix))) {
      throw new Error(`FORBIDDEN_ARCHIVE_ENTRY:${entry}`);
    }
  }
}

export function validateManifest(manifest, expectedVersion) {
  if (manifest.manifest_version !== 3) {
    throw new Error('INVALID_MANIFEST_VERSION');
  }
  if (manifest.name !== '语境生词本 BETA') {
    throw new Error('INVALID_BETA_NAME');
  }
  if (!manifest.description.includes(
    'THIS EXTENSION IS FOR BETA TESTING',
  )) {
    throw new Error('MISSING_BETA_DESCRIPTION');
  }
  if (manifest.version !== expectedVersion) {
    throw new Error(
      `VERSION_MISMATCH:${manifest.version}:${expectedVersion}`,
    );
  }
}

function unzip(args) {
  const result = spawnSync('unzip', args, {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'UNZIP_FAILED');
  }

  return result.stdout;
}

export function verifyRelease() {
  const zipPath = [
    '.output/',
    packageJson.name,
    '-',
    packageJson.version,
    '-chrome.zip',
  ].join('');
  const entries = unzip(['-Z1', zipPath])
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
  validateArchiveEntries(entries);

  const manifest = JSON.parse(unzip(['-p', zipPath, 'manifest.json']));
  validateManifest(manifest, packageJson.version);

  const sha256 = createHash('sha256')
    .update(readFileSync(zipPath))
    .digest('hex');
  const result = {
    zipPath,
    version: manifest.version,
    entries: entries.length,
    sha256,
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    verifyRelease();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 4: Add release scripts**

Add these entries to `package.json` under `scripts`:

```json
{
  "release:check": "pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e",
  "release:package": "pnpm zip && node scripts/verify-release.mjs",
  "release:all": "pnpm release:check && pnpm release:package"
}
```

Keep all existing scripts unchanged.

- [ ] **Step 5: Verify validator tests and the real ZIP**

Run:

```bash
pnpm test -- tests/unit/release-validation.test.ts
pnpm release:package
unzip -l .output/contextual-vocabulary-0.1.0-chrome.zip | sed -n '1,20p'
```

Expected:

- 3 validator tests pass;
- WXT creates `.output/contextual-vocabulary-0.1.0-chrome.zip`;
- validator prints `version: 0.1.0` and a 64-character SHA-256;
- archive listing begins with `manifest.json` at the root;
- no `src/`, `tests/`, `docs/`, `.env`, or `store-assets/` entries appear.

- [ ] **Step 6: Commit release validation**

```bash
git add package.json scripts/verify-release.mjs tests/unit/release-validation.test.ts
git commit -m "build: validate beta release package"
```

## Task 4: Prepare copy-ready Chrome Web Store material

**Files:**
- Create: `docs/release/store-listing.md`
- Create: `docs/release/permissions.md`

- [ ] **Step 1: Create the store listing copy**

Create `docs/release/store-listing.md` with these sections and final copy:

```markdown
# Chrome Web Store Private Beta Listing

## Product details

- Name: 语境生词本 BETA
- Category: Productivity
- Primary language: 中文（简体）
- Short description: 悬停查词、保存原句并生成每周本地复习周报。THIS EXTENSION IS FOR BETA TESTING.

## Detailed description

语境生词本帮助你在真实英文网页里积累生词，而不是把单词和原句分开。

主要功能：

- 稳定悬停英文单词后显示本地释义；
- 使用 Chrome 系统语音朗读单词；
- 收藏单词、原句、页面标题和可选来源地址；
- 在侧边栏按单词查看遇见过的语境；
- 每周在本机生成复习周报；
- 支持导出、导入和删除全部本地数据。

隐私说明：

- 词典随扩展打包，不连接在线词典；
- 生词、原句、设置和周报只保存在本机；
- 不包含广告、分析或遥测；
- 不会把浏览活动发送给开发者或第三方服务器；
- 网页访问权限由用户主动授予，也可以随时撤销。

THIS EXTENSION IS FOR BETA TESTING. 本版本仅向受邀测试者开放，用于验证持续使用、稳定性和付费意愿。

## Support

Private Beta 的问题和反馈通过测试微信群收集。测试者不应在群内发送包含私人网页内容的截图或导出数据。
```

- [ ] **Step 2: Create dashboard privacy and permission answers**

Create `docs/release/permissions.md`:

```markdown
# Chrome Web Store Privacy and Permission Answers

## Single purpose

在用户主动授权的英文网页中提供本地悬停查词、原句收藏和本地周报复习。

## Permission justifications

- storage: 保存用户设置和临时页面导航状态；生词和周报保存在扩展本地 IndexedDB。
- alarms: 按用户设置的本地时间创建每周复习周报。
- notifications: 周报生成后显示 Chrome 系统通知。
- tts: 使用 Chrome 系统语音朗读用户选择的英文单词。
- sidePanel: 在 Chrome 侧边栏展示当前生词、生词库、周报和设置。
- scripting: 用户授予网页权限后，注册悬停查词内容脚本；撤销权限后取消注册。
- optional host permissions: 只有用户主动同意后，才在 HTTP/HTTPS 网页读取稳定悬停的可见单词及其原句。扩展不读取密码框、表单输入或可编辑区域。

## Remote code

No. 扩展不执行远程代码。运行代码、词典和样式均包含在扩展包内。

## Data disclosure

保守申报 Website content 和 Web history：扩展可处理用户主动授权网页中的可见单词、原句、页面标题和来源地址。数据仅用于用户可见的查词、收藏和周报功能，只保存在用户设备中，不发送给开发者或第三方。

## Limited use certification

扩展仅将权限获得的数据用于商店页面和扩展界面明确描述的单一用途，不用于广告、画像、转售、信用评估或与功能无关的用途，也不允许人工读取用户内容。

## Reviewer instructions

1. 安装后点击工具栏图标打开侧边栏。
2. 点击“允许在英语网页上取词”并授予测试网页权限。
3. 打开普通英文文章，将鼠标稳定停留在英文单词上。
4. 检查本地释义、收藏、侧边栏生词和设置。
5. 该扩展不需要账号、付费账户或测试凭据。
```

- [ ] **Step 3: Review policy consistency**

Compare:

```bash
rg -n "本机|第三方|遥测|来源地址|输入|权限" \
  PRIVACY.md \
  docs/privacy/index.html \
  docs/release/store-listing.md \
  docs/release/permissions.md
```

Expected: all four files consistently state local storage, no telemetry, no third-party transfer, optional source URL storage, and user-authorized website access.

- [ ] **Step 4: Commit store material**

```bash
git add docs/release/store-listing.md docs/release/permissions.md
git commit -m "docs: prepare Chrome Web Store listing"
```

## Task 5: Prepare the tester and 14-day operating kit

**Files:**
- Create: `docs/release/tester-guide.md`
- Create: `docs/release/beta-runbook.md`
- Create: `docs/release/questionnaires.md`
- Create: `docs/release/release-record-template.md`

- [ ] **Step 1: Write the tester guide**

Create `docs/release/tester-guide.md` with:

```markdown
# 语境生词本 BETA 测试者指南

## 测试时间

本轮测试持续 14 天，版本免费，仅用于产品验证。

## 安装

1. 使用报名时提供的 Google 账号登录 Chrome。
2. 打开群内发送的 Chrome Web Store Private 链接。
3. 点击“添加至 Chrome”。
4. 点击扩展图标并固定“语境生词本 BETA”。

## 首次使用

1. 打开侧边栏。
2. 点击“允许在英语网页上取词”并确认权限。
3. 打开一篇普通英文文章。
4. 将鼠标稳定停留在英文单词上。
5. 收藏至少 3 个单词，并在侧边栏确认原句。

## 数据与隐私

生词、原句、来源、设置和周报只保存在本机。请不要在微信群发送包含私人网页、账号、输入内容或完整导出文件的截图。

## 反馈

Day 7 和 Day 14 会在群内发送简短问卷。遇到无法安装、无法查词、数据丢失或错误读取输入框等问题，请立即在群内说明 Chrome 版本、操作系统、复现步骤和不含私人内容的截图。

## 退出测试

可以随时在侧边栏导出数据或删除全部本地数据。卸载扩展也会删除本地扩展数据。
```

- [ ] **Step 2: Write the 14-day runbook**

Create `docs/release/beta-runbook.md` with:

```markdown
# 14 天 Private Beta 运营手册

## 样本

- 目标邀请：12 人
- 最少有效样本：8 人
- 上限：20 人
- 有效样本：完成 Day 0 核心流程并提交 Day 14 问卷

## Day 0

- 发送商店链接和测试者指南。
- 确认每人完成安装、授权、查词、收藏 3 个词和打开侧边栏。
- 记录无法安装、无法授权和核心流程阻塞。

## Day 3

在群内询问：是否仍能正常查词和收藏；是否出现误触发、无法发音或侧边栏异常；是否有阻止继续使用的问题。

## Day 7

- 发送 Day 7 脉冲问卷。
- 确认过去一周使用天数和周报查看情况。
- 汇总 P0、P1、P2 问题，不按群消息数量判断严重度。

## Day 14

- 发送最终问卷。
- 计算激活、第二周留存、周报查看、核心流程和付费意愿。
- 邀请一名高频用户、一名流失用户和一名严重问题用户做 15 分钟访谈。

## 通过指标

- 至少 80% 的受邀测试者完成 Day 0 核心流程。
- 至少 60% 的有效样本在第二周仍使用，且 14 天内使用不少于 3 天。
- 至少 50% 的有效样本看到并打开过一次周报。
- P0 为 0，至少 80% 的有效样本完成授权、查词、收藏和查看生词。
- 至少 30% 的有效样本明确表示愿意付费。

## 故障处理

- P0：隐私泄露、数据丢失或读取输入框内容。立即暂停内测、停止邀请并暂时下架。
- P1：无法安装、授权、查词或收藏。48 小时内提交只包含必要修复的更高版本。
- P2：样式、文案或非阻塞兼容问题。登记后批量处理。
- 有已验证旧版本时优先回滚；首版无旧版本时停止分发并提交最小热修复。
- 任何热修复都必须重新通过完整发布门槛，不夹带新功能。

## 决策

- 第二周使用达到 60% 且 P0 为 0：进入扩量或付费方案设计。
- 第二周使用未达到 60%：先验证场景和核心价值。
- 使用达标但付费意愿低于 30%：调整定位、价值表达或价格假设。
- 稳定性未达到 80%：暂停扩量并修复核心流程。
```

- [ ] **Step 3: Write copy-ready questionnaires**

Create `docs/release/questionnaires.md`:

```markdown
# Private Beta 问卷

## Day 7 脉冲问卷

1. 过去 7 天你使用了几天？0 / 1 / 2 / 3–4 / 5–7
2. 你是否成功完成悬停查词？是 / 否
3. 你是否收藏过生词和原句？是 / 否
4. 你是否看到并打开周报？看到且打开 / 看到但未打开 / 未看到
5. 当前最有价值的功能是什么？查词 / 发音 / 原句收藏 / 生词库 / 周报
6. 是否有问题阻止你继续使用？没有 / 有，请描述复现步骤

## Day 14 最终问卷

1. 第二周你是否仍在使用？是 / 否
2. 14 天内总共使用了几天？0 / 1–2 / 3–5 / 6–9 / 10–14
3. 以下流程是否成功：授权网页、悬停查词、收藏、查看生词、查看周报。
4. 未来一个月你愿意继续使用吗？愿意 / 不确定 / 不愿意
5. 如果产品保持当前价值，你愿意付费吗？愿意 / 不确定 / 不愿意
6. 你偏好哪种方式？一次性购买 / 订阅 / 都不接受 / 不确定
7. 你能接受的价格是多少？填写人民币金额和一次性或每月。
8. 最重要的一个价值点是什么？
9. 最影响继续使用的一个问题是什么？
10. 是否愿意参加 15 分钟访谈？愿意 / 不愿意
```

- [ ] **Step 4: Write the release evidence template**

Create `docs/release/release-record-template.md`:

```markdown
# Private Beta Release Record

每个发布版本复制本文件并命名为 `release-版本号.md`，填写以下证据：

- Manifest version
- Git commit
- ZIP filename
- SHA-256
- Generated at
- Typecheck result
- Unit/integration test result
- Production build result
- E2E result
- Manual macOS/Chrome result
- ZIP inspection result
- Privacy URL and unauthenticated access result
- Chrome Web Store submission date
- Review status
- Published date
- Known compatibility risks
- Rollback or hotfix version
```

- [ ] **Step 5: Verify that all agreed metrics are present**

Run:

```bash
rg -n "12 人|8 人|14 天|80%|60%|50%|30%|P0|P1|P2" docs/release
```

Expected: the operating kit contains all sample, duration, success, and severity thresholds from the approved design.

- [ ] **Step 6: Commit the operating kit**

```bash
git add \
  docs/release/tester-guide.md \
  docs/release/beta-runbook.md \
  docs/release/questionnaires.md \
  docs/release/release-record-template.md
git commit -m "docs: add private beta operating kit"
```

## Task 6: Produce privacy-safe Chrome Web Store assets

**Files:**
- Create: `store-assets/README.md`
- Create: `store-assets/screenshot-hover.png`
- Create: `store-assets/screenshot-vocabulary.png`
- Create: `store-assets/screenshot-digest.png`
- Create: `store-assets/small-promo.png`

- [ ] **Step 1: Create the asset manifest**

Create `store-assets/README.md`:

```markdown
# Chrome Web Store Assets

| File | Size | Content |
|---|---:|---|
| screenshot-hover.png | 1280×800 | Demo article with the real hover tooltip |
| screenshot-vocabulary.png | 1280×800 | Side panel with fictional vocabulary data |
| screenshot-digest.png | 1280×800 | Weekly digest and local settings |
| small-promo.png | 440×280 | Brand-led tile using the extension icon |

All screenshots use fictional demo content. Before commit, inspect every image for accounts, tabs, bookmarks, local paths, notifications, URLs, personal text, and extension developer IDs.
```

- [ ] **Step 2: Capture the real hover experience**

Run:

```bash
pnpm build:e2e
node scripts/serve-fixtures.mjs
```

In Chrome:

1. Open `chrome://extensions`, enable Developer mode, and load `.output/chrome-mv3-test`.
2. Open the extension side panel and confirm the local fixture permission is active.
3. Open `http://127.0.0.1:4173/article.html`.
4. Set the content area to 1280×800.
5. Hover `ultimately` until the real tooltip appears.
6. Capture only the demo article and extension experience as `store-assets/screenshot-hover.png`.

Stop the fixture server after capture.

- [ ] **Step 3: Capture vocabulary and digest screens**

Use the same demo page to save fictional words. Open the side panel and capture:

- the 生词库 route as `store-assets/screenshot-vocabulary.png`;
- the 周报 route as `store-assets/screenshot-digest.png`.

To generate the fictional digest, open the side-panel DevTools console and run:

```js
await chrome.runtime.sendMessage({ type: 'TEST_FIRE_ALARM' });
```

Crop or pad each final image to exactly 1280×800 without altering product behavior.

- [ ] **Step 4: Create the small promotional tile**

Use the image generation skill at execution time to create one 440×280 PNG:

- warm cream background with a saturated forest-green field;
- existing extension icon centered at correct visual weight;
- no Google branding, browser logos, screenshots, tiny text, pricing, ratings, or unsupported claims;
- readable at half size and with defined outer edges.

Save the approved result as `store-assets/small-promo.png`.

- [ ] **Step 5: Verify dimensions and visually inspect**

Run:

```bash
sips -g pixelWidth -g pixelHeight \
  store-assets/screenshot-hover.png \
  store-assets/screenshot-vocabulary.png \
  store-assets/screenshot-digest.png \
  store-assets/small-promo.png
```

Expected: three images are 1280×800 and `small-promo.png` is 440×280.

Open all four files and confirm the privacy checklist in `store-assets/README.md`.

- [ ] **Step 6: Commit store assets**

```bash
git add store-assets
git commit -m "assets: add private beta store graphics"
```

## Task 7: Run a complete release rehearsal

**Files:**
- Create: `docs/release/release-0.1.0.md`
- Modify: `docs/manual-test-2026-06-30.md`

- [ ] **Step 1: Run all automated release gates**

Run:

```bash
pnpm install --frozen-lockfile
pnpm release:all
```

Expected:

- TypeScript exits with code 0;
- all Vitest files pass;
- all 3 Playwright E2E tests pass;
- WXT builds and zips successfully;
- validator prints the ZIP path, version `0.1.0`, entry count, and SHA-256.

If E2E cannot bind `127.0.0.1:4173` in a sandbox, rerun the same command with permission to bind the local test port. Do not change product code or test ports for that environment error.

- [ ] **Step 2: Inspect the package manually**

Run:

```bash
unzip -Z1 .output/contextual-vocabulary-0.1.0-chrome.zip
unzip -p .output/contextual-vocabulary-0.1.0-chrome.zip manifest.json
shasum -a 256 .output/contextual-vocabulary-0.1.0-chrome.zip
```

Expected:

- `manifest.json` is at archive root;
- name is `语境生词本 BETA`;
- version is `0.1.0`;
- description contains `THIS EXTENSION IS FOR BETA TESTING`;
- no development or secret files are present;
- SHA-256 matches the validator output.

- [ ] **Step 3: Complete the macOS/Chrome manual matrix**

Load `.output/chrome-mv3` and execute every applicable row in `docs/manual-test-2026-06-30.md`. Update the result and evidence for current Chrome/macOS. Keep Windows and previous stable rows explicitly blocked until a tester supplies those environments.

- [ ] **Step 4: Create the immutable release record**

Copy `docs/release/release-record-template.md` to `docs/release/release-0.1.0.md`. Replace each evidence line with the actual output from Steps 1–3. The file must contain the exact Git commit and the exact 64-character SHA-256; do not write secrets, browser cookies, developer tokens, or tester email addresses.

- [ ] **Step 5: Verify repository state**

Run:

```bash
git diff --check
git status --short
```

Expected: only the manual matrix and `release-0.1.0.md` are uncommitted.

- [ ] **Step 6: Commit release evidence**

```bash
git add docs/manual-test-2026-06-30.md docs/release/release-0.1.0.md
git commit -m "docs: record private beta release evidence"
```

## Task 8: Publish GitHub Pages and submit the Private listing

**Files:**
- Modify after submission: `docs/release/release-0.1.0.md`

- [ ] **Step 1: Stop at the external-account gate**

Before changing external state, ask the user to:

- authorize the GitHub repository that will host `docs/privacy/index.html`;
- confirm whether the current repository may be pushed to that remote;
- sign in to GitHub without sharing tokens in chat;
- sign in to the Chrome Web Store Developer Dashboard;
- complete the one-time developer registration, email verification, and 2-Step Verification;
- provide tester Google accounts directly in the dashboard, not in source files or chat logs.

The current local repository has no `origin`; do not invent a remote URL or make the repository public without explicit authorization.

- [ ] **Step 2: Publish the privacy page**

After the user authorizes a GitHub remote:

1. Push the reviewed branch.
2. Configure GitHub Pages to publish from the `docs/` directory.
3. Open the generated `/privacy/` URL in a signed-out browser.
4. Confirm HTTP 200, readable policy text, and no external requests.
5. Record the exact URL and verification date in `docs/release/release-0.1.0.md`.

- [ ] **Step 3: Configure the Chrome Web Store item**

In Developer Dashboard:

1. Create a new extension item.
2. Upload `.output/contextual-vocabulary-0.1.0-chrome.zip`.
3. Paste `docs/release/store-listing.md`.
4. Upload the 128×128 icon, three screenshots, and `small-promo.png`.
5. Paste the single-purpose and permission answers from `docs/release/permissions.md`.
6. Declare no remote code.
7. Conservatively disclose Website content and Web history, local-only processing, and no third-party transfer.
8. Set the verified GitHub Pages privacy URL.
9. Set visibility to Private.
10. Add trusted testers in the dashboard only.
11. Submit for review.

- [ ] **Step 4: Record submission state**

Add the submission date and dashboard status to `docs/release/release-0.1.0.md`. Do not store publisher IDs, tester emails, payment details, cookies, OAuth tokens, or screenshots containing account data.

- [ ] **Step 5: Verify the approved tester journey**

After approval, use a trusted tester account that is not the publisher:

1. Open the Private store URL.
2. Install the extension.
3. Complete the Day 0 tester guide.
4. Confirm automatic installation works without Developer mode.
5. Confirm no external business network requests occur.

- [ ] **Step 6: Start the 14-day trial**

Send the store URL and `docs/release/tester-guide.md` to the WeChat group. Follow `docs/release/beta-runbook.md` on Day 0, Day 3, Day 7, and Day 14. Do not expand beyond 20 testers during this run.

- [ ] **Step 7: Commit the final publication record**

```bash
git add docs/release/release-0.1.0.md
git commit -m "docs: record private beta publication"
```

## Final verification

Run:

```bash
pnpm release:all
git diff --check
git status --short --branch
```

Expected:

- all type, unit, integration, build, E2E, ZIP, and manifest checks pass;
- the working tree is clean;
- GitHub Pages privacy URL is publicly reachable;
- Chrome Web Store item is approved or has an accurately recorded review status;
- no analytics, telemetry, feedback API, payment, or cloud user-data storage was introduced.
