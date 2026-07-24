// Run: npx tsx scripts/test-outlook-validate.ts — 只测纯解析/夹紧,不打网络
import { parseOutlook } from '../src/analysis/outlook';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const good = parseOutlook(JSON.stringify({
  score: 82, headline: '状态良好',
  current: [{ title: 'LTFT 偏高', detail: '均值 5.5%', severity: 'watch', action: '查真空管' }],
  future: [{ title: 'x', detail: 'y', severity: 'info' }],
  normal: ['冷却系统正常'],
}));
assert(good.score === 82 && good.verdictTone === 'good' && good.verdictLabel === '总体良好', 'score/verdict');
assert(good.current[0].tone === 'watch' && good.current[0].action === '查真空管', 'current 映射');
assert(good.future[0].action === undefined, '无 action 不给建议框');

// score 越界夹紧;≥60 <80 → 需要留意;<60 → 建议检查
assert(parseOutlook('{"score": 250, "headline":"h","current":[],"future":[],"normal":[]}').score === 100, '夹紧 100');
assert(parseOutlook('{"score": 65, "headline":"h","current":[],"future":[],"normal":[]}').verdictLabel === '需要留意', '60-79');
assert(parseOutlook('{"score": 30, "headline":"h","current":[],"future":[],"normal":[]}').verdictTone === 'inspect', '<60 inspect');
// 包 fences 也能解析(minimax.ts 同款取外层大括号)
assert(parseOutlook('```json\n{"score": 70, "headline":"h","current":[],"future":[],"normal":[]}\n```').score === 70, '剥 fences');
// 坏字段丢弃,不炸
const dirty = parseOutlook('{"score":"bad","headline":123,"current":[{"title":"t"}],"future":"no","normal":[1,"ok"]}');
assert(dirty.score === 50 && typeof dirty.headline === 'string', '坏 score/headline 有默认');
assert(dirty.current.length === 0 && dirty.future.length === 0 && dirty.normal.length === 1, '坏条目过滤');

console.log('PASS test-outlook-validate');
