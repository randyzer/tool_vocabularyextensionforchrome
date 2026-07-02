# 离线词典维护

## 数据来源

运行时词典派生自 [ECDICT](https://github.com/skywind3000/ECDICT) 的完整
`ecdict.csv`，并合并仓库维护的自定义词条和 blocklist。扩展运行时只读取随安装包
发布的 JSON 分片，不访问 ECDICT 或任何词典服务器。

每次更新都会在 `public/dictionary/manifest.json` 中记录固定的 ECDICT commit、
提交时间、下载 URL 和源文件 SHA-256。

## 本地更新

```bash
pnpm dict:update
pnpm dict:check
pnpm test
pnpm typecheck
pnpm build
```

`dict:update` 需要网络。它优先使用 `GITHUB_TOKEN` 或 `GH_TOKEN` 查询最新 commit；
没有 token 且 GitHub 匿名 API 限流时，会回退到公开 Git 只读协议。不要把 token
写入仓库或发送到聊天中。

`dict:build` 使用 `data/source/` 中已有且通过 SHA-256 校验的本地输入重新生成
分片，不联网。`dict:check` 只读检查已提交词典，不修改文件。`data/source/` 被
Git 忽略，不应提交。

## 添加或修正词条

编辑 `data/custom-words.csv`，字段为：

```text
word,phonetic,part_of_speech,definitions_zh,source,note
```

多个词性或释义使用 `|` 分隔。`source` 和中文释义为必填项。自定义词条覆盖同名
ECDICT 词条。

修改后运行：

```bash
pnpm dict:build
pnpm dict:check
```

## 排除词条

在 `data/dictionary-blocklist.txt` 中每行添加一个规范化英文单词。空行和以 `#`
开头的注释会被忽略。blocklist 优先于 ECDICT 和自定义词条。

修改后同样运行 `pnpm dict:build` 和 `pnpm dict:check`。

## 审核更新 PR

1. 检查 manifest 中的 ECDICT commit、固定 URL 与 SHA-256。
2. 检查新增、删除、修改词条统计。
3. 调查总词条数或分片体积的异常变化。
4. 检查自定义覆盖和 blocklist 结果。
5. 确认词典检查、测试、类型检查和生产构建通过。
6. 合并后运行 `pnpm zip` 生成新的扩展安装包。

生成器要求至少 50,000 个词条，且相对已提交词典的数量变化不得超过 10%。门槛
失败时应调查来源或过滤规则，不要直接降低门槛。

## GitHub Actions 设置

`.github/workflows/update-dictionary.yml` 每月检查一次，也可手动触发。只有词典文件
变化时，它才会创建或更新 `automation/dictionary-update` PR；不会自动合并或
发布。

仓库需要在 GitHub 的 **Settings → Actions → General** 中允许 GitHub Actions
创建 Pull Request。首次推送工作流后，建议手动运行一次确认权限和分支策略。
