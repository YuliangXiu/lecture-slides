# cue-cards `q` 字段补写工作流（分片生成 + 门禁 + apply + e2e）

> 来源：`lecture-02` 全量 `q` 补写（2026-09-09，6 session / 685 页 / 10 个 patch）。
> 适用：任意讲次把「本页在回答什么问题」补到与 lecture-01 同口径。

## 0. 铁律

1. **逐字稿本体零改动**。只写 `en.q` / `zh.q` 两个叶子；`lines` / `enter` / `exit` / `facts`
   与 `session{N}.json` 必须字节不变。验收口径 = 对备份逐字段 diff，**非 q 字段 diff 必须为 0**。
2. **风格基准是 lecture-01，不是通用直觉**。动手前先把 L1 已有的 `q` 全部导出做格式校准
   （句长中位数、是否带问号、哪些页留空）。
3. **单次输出会截断**。写满 100+ 条会超输出上限，必须一文件一校验小步推进。

## 1. 盘面

```bash
# 目标清单（建议上限，非硬指标）
tools/cue_out/_q_targets.json          # {session: {sid: {en, zh, ...}}}
# 素材：全部目标页的 lines/enter/exit/facts/title
# 现有 patch（可多批，按 part 递增）
tools/cue_out/_q_patch_session{N}.part{P}.json
```

patch 命名必须匹配 `^_q_patch_session(\d+)\.part(\d+)\.json$`，`cue_q_apply.py` 靠它排序合并。

## 2. 写 patch

结构只含 id 与 q：

```json
{
 "S1.027": {"en": "what was the first 3D body fit to images",
            "zh": "第一次把 3D 人体拟合到图像是什么工作"}
}
```

格式约束见 `references/presenter-mode.md` 的「`q` 字段」段。写之前必做两件事：

- 读该页的 `lines` / `enter` / `exit` / `facts` / `title`，判断「这页到底在回答什么」；
- 查标题是否本身已是疑问句 → 是则不写（用 `cue_q_check.py` 的 warning 兜底）。

## 3. 门禁（硬错误必须为 0）

```bash
python3 tools/cue_q_check.py          # 逐 patch 校验
```

**硬错误**：id 不存在于 `session{N}.json` / 出现 en·zh 之外字段 / 一问一空 /
en 含问号 / zh 含问号 / en 首字母大写 / en 不含 `EN_WH` / zh 不含 `ZH_QW`。
**warning**（只报不改）：词数 3–16、字数 3–34、en 含中文、zh 无中文、标题已疑问句、年份不在逐字稿。

`EN_WH` / `ZH_QW` 是「疑问结构词表」，**正则漏词是高频误报源**。已补：
`有多` / `多久` / `稀疏稠密` / `多[准大小快慢好高低长短强弱难易贵近远粗细轻重…]`。
误报时先判断是「真不是疑问句」还是「词表缺词」——后者补正则，**不要改文案迁就正则**。
补完正则必须回归 L1：`31/31 EN + 31/31 ZH` 零漏判。

## 4. 合并落盘

```bash
python3 tools/cue_q_apply.py          # 扫描 cue_out/ → 合并进 cuecards.json + 6 个分文件
```

只覆盖 `en.q` / `zh.q`；`sort_key` 复现原排序；`json.dump(ensure_ascii=False, indent=1) + "\n"`。
落盘后立刻核对：

```bash
python3 tools/cue_check.py            # cards / errors / warnings
# 再对 _backup/cuecards.pre-q.json 逐字段 diff，确认非 q 字段 diff = 0
```

## 5. 三链路 e2e

```bash
export NODE_PATH=<含 playwright 的 node_modules 所在目录>
node tools/q_coverage_e2e.js                     # q 覆盖 + presenter 抽样 cueQ
node tools/e2e_cue.js "$(pwd)" 8899              # viewer 渲染 + 6 deck __cueFlat
node tools/presenter_e2e.js "$(pwd)" 8877        # presenter 真实链路（按 S 键开窗）
```

**`e2e_cue.js` 的 501 假阳性**：裸 `python3 -m http.server` 不支持 POST，viewer 会
POST `/api/save-feedback` → 501。真放映服务在 `play.command` 的
`python3 - "$PORT" <<'PYEOF' … PYEOF` heredoc 内（`QuietServer` 完整实现 `do_POST`）。
脚本已改为自动抽取该 heredoc 起真服务，并在 `finally` 里快照/还原 `feedback.json`
（真服务会刷新 `saved_at`，items 不变），保证验收零副作用。

### 5.1 e2e 会清空 `feedback.json`（2026-09-09 实锤，必读）

**症状**：跑完 e2e，`02-script/data/feedback.json` 从 N 条变 `count:0 / items:[]`。

**机理**：headless 浏览器的 localStorage 是空桶，而 viewer 初始化末尾**无条件**调
`fbScheduleSave()` → 600ms 后 POST `/api/save-feedback` 把 `fbCollect()` 的空数组写回，
服务端 `_save_feedback` 直接 `_atomic_write_json` 覆盖。清空按钮反而不会触发
（它要求 `items.length > 0`）。时间戳格式可区分：`...T..:..:...Z`（ISO）= 前端 save；
`YYYY-MM-DD HH:MM:SS` = 服务端 clear。

**这是「临时存储被覆盖」，不是数据丢失**：权威账本 `feedback-history.json` 的
`records` 完好。恢复方法（19 条实测）：

```python
import json
hist = json.load(open('02-script/data/feedback-history.json'))
ORDER = {'insert-before':0,'ppt':1,'script':2,'insert-after':3}
items = [{'sess':v['sess'],'page':v['page'],'sid':v['sid'],'type':v['type'],'text':v['text']}
         for k,v in hist['records'].items() if '#' not in k]   # #n 变体不进临时存储
items.sort(key=lambda it:(it['sess'],it['page'],ORDER.get(it['type'],9)))
json.dump({'saved_at':'<ISO>','count':len(items),'items':items},
          open('02-script/data/feedback.json','w'), ensure_ascii=False, indent=2)
```

**脚本侧硬要求**（已落地 `e2e_cue.js` / `q_coverage_e2e.js` / `presenter_e2e.js`）：
① 运行前读快照并**另存持久备份**到 `os.tmpdir()`（macOS 是 `/var/folders/...`，不是 `/tmp`），
防进程被强杀时 `finally` 未执行；② **等 `server.kill('SIGTERM')` 的 `exit` 事件后再还原**
（见下条，否则还原被迟到的 POST 覆盖）；③ `finally` 还原后**回读比对**；
④ 跑完必须 `md5` 对比运行前后。

**`server.kill()` 是异步的 → 还原会被覆盖（2026-09-09 二次实锤）**：
`spawn` 出来的服务进程收到 SIGTERM 后**不立即死**，若此刻还有 viewer 的
`POST /api/save-feedback` 在途，它会在我们 `writeFileSync(fbPath, fbSnapshot)`
**之后**才落盘 —— `saved_at` 被刷掉，md5 变化。`items` 内容不变，所以肉眼与
「items 比对」都看不出问题，但**文件确实被改了**。

修复：`await killAndWait(server)` —— 等 `exit` 事件（3s 兜底 SIGKILL）再还原：

```javascript
function killAndWait(proc) {
  return new Promise((resolve) => {
    if (!proc || proc.exitCode !== null || proc.signalCode) return resolve();
    proc.once('exit', resolve);
    try { proc.kill('SIGTERM'); } catch (e) { return resolve(); }
    setTimeout(() => { try { proc.kill('SIGKILL'); } catch (e) {} resolve(); }, 3000);
  });
}
```

**验收判据**：修复后连跑 `q_coverage_e2e.js` + `e2e_cue.js`，`feedback.json` 的
**md5 前后完全一致**（实测 `06682fc490ff4de725d169d8c25f82a8` 未变）。
只比 `items` 不够——`saved_at` 是文件内容的一部分。

### 5.2 deck 层终检（`_shared/deck-engine/`，只读，不碰 `feedback.json`）

`q` 改完之后还要过 deck 渲染层。这两个脚本从 `_shared` 直接跑，**自带 http 服务、自动选端口**，
不需要传端口，也不写任何数据文件——可以安全地跟在 5.1 后面跑。

```bash
export NODE_PATH=<含 playwright 的 node_modules 所在目录>
DECK_ENGINE="<课程根>/_shared/deck-engine"

# 单 deck 逐页体检（几何溢出 / 破图 / 坏视频 / 空讲稿 / toc 链接数 / JS 报错）
node "$DECK_ENGINE/check_deck.mjs" "03-slides/session-1"     # → {"status":"ALL CLEAN",...}
# 跨 deck 终检（离线合规 + 控件 UX + presenter 双向导航）
node "$DECK_ENGINE/final_accept.mjs" "http://127.0.0.1:<port>/<lecture>/03-slides" \
     session-1 session-2 session-3 session-4 session-5 session-6
```

**`check_deck.mjs` 关键约定**：
- 参数是 **deck 目录**（`03-slides/session-N`），它自己推 `LECTURE_ROOT = dir/../../`
  作 http 根 —— 所以目录层级必须是 `lecture/03-slides/session-N`，否则 notes fetch 404。
- **隐藏页走 `?embed=1` 单独一趟**：正常模式 `go()` 对隐藏页会顺延到下一张可见页，
  逐页循环若按 raw 索引跑会把同一张可见页重复体检、隐藏页永远测不到。
  `tocLinks` 的期望值是 `visTotal`（可见页数）不是 `total`，用 `total` 会把每个隐藏页
  误报成「toc 少一条」。
- 判据阈值：`bottom > 1082` / `right > 1922` 才算溢出（2px 亚像素余量）。

**`final_accept.mjs` 关键约定**：
- 第一个参数是 **http_base，且必须含 `/03-slides`**（脚本内部拼 `base + '/' + deck + '/index.html'`）；
  漏了 `/03-slides` 会全线 404 并 `waitForFunction` 超时。
- 它**不会自己起服务**，必须先有一个 http 服务在跑（可用 `play.command` 的放映服务，
  或 `python3 -m http.server <port> --directory <lecture_root>`）。
- B站 iframe 的第三方请求与报错在 `BILI_OK` 白名单内，**不计入离线违规**。
- 每个 deck 结束会 `ctx.close()`，大 deck（S5=250 页）耗时明显，串行跑别并发。

## 6. Pitfalls

- **BSD grep 静默假阴性**：macOS 含中文/多模式的 `grep` 会漏匹配，一律改用 Python。
- **macOS `find -newermt` 不支持相对时间**，必须绝对时间；且云盘同步会污染时间戳，
  **逐文件 `json.load` + md5 是唯一可靠的盘点手段**。
- **并发 worker 写同一 patch 文件**会出现两套版本。处置：逐文件 `json.load` + 门禁复核，
  两套均合规时保留覆盖更多的版本；`cue_q_apply.py` 的 `conflicts` 计数应保持 0。
- **node e2e 必须带 `NODE_PATH`**，否则 `Cannot find module 'playwright'`。
- **e2e 脚本参数不能省**：`node tools/e2e_cue.js <root_dir> <port>`。
  `q_coverage_e2e.js` 的 `rootDir` 默认 `.`，漏传会静默用 cwd——若 cwd 不对就全线 404。
- **多个 e2e 不要并发**：都起 http 服务且都开 headless 浏览器，并发会争端口/内存，
  表现为「服务器起不来 → viewer 得 0 卡」。串行跑，每个之间确认端口已释放
  （`lsof -nP -iTCP:<port> -sTCP:LISTEN`）。异常退出会留下服务进程，先 `kill` 再重跑。
- **端口被别的服务占用 → 假失败（2026-09-09 实锤）**：`spawn` 起服务失败时**不报错**，
  浏览器照常连 `127.0.0.1:<port>`，于是**读到了另一个讲次的数据**。实测症状：
  `e2e_cue.js` 报 `viewer .slide 期望 685，实得 76` + `deck S4/S5/S6 无法加载` + `501`
  —— 76/27/28/21 正是 lecture-01 的规模，因为 8942 端口上跑着 L1 的服务。
  **诊断法**：`lsof -p <pid> | grep cwd` 看服务的工作目录；`curl` 拿到的字节数与磁盘文件不等也是信号。
  两个脚本已加 `assertPortFree()` 端口预检，占用则 `exit(2)` 并打印占用进程。
- **e2e 数字先对量级**：685 / 250 / 198 是 L2 的量级。看到 76 / 27 这类数字，
  第一反应是「连错服务或连错目录」，不是「数据坏了」。
- **跑 e2e 前先确认目录里没有别的流程在写**（如 polish-slides）。同一目录两条流水线并发，
  `bak/`、`/tmp/polish/` 会出现另一套产物，且 `feedback.json` 可能被对方正常消费清空，
  容易被误判成自己的 bug。用 `find . -newermt "<绝对时间>" -type f` 排查。
- **覆盖率不是越高越好**。L1 基线 31/76 = 40.8%，L2 收口 215/685 = 31.4% 已接近同口径；
  强行填满会产出大量非疑问句。按内容类型自然分布才是对的。
- **`presenter_e2e.js` 也已加 `assertPortFree()`**。它只用 GET（裸 `http.server` 够用），
  但同样会因端口被占而读到别的讲次的数据。
