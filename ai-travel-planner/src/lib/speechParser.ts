// 中文口述解析工具：从自由文本中提取目的地、天数、预算、人数、偏好
// 规则式实现，避免引入额外 NLP 依赖；后续可替换成 LLM 精细抽取。
// 输入示例："帮我规划下明年春节去东京玩5天，预算一万二，三个人，主要美食和动漫文化"

export type SpeechParseResult = {
  destination?: string;
  days?: number;
  budget?: number | "";
  partySize?: number | "";
  preferences?: string;
};

// 地名简单匹配：可扩展；当前尝试匹配词尾“市/州/岛/国”或常见热门城市关键字
const CITY_HINT = /([\u4e00-\u9fa5A-Za-z]{2,}(?:市|州|岛|国|县)|东京|大阪|京都|札幌|名古屋|冲绳|横滨|上海|北京|广州|深圳|杭州|南京|成都|西安|青岛|厦门|香港|澳门|台北|新加坡|巴塞罗那|巴黎|伦敦|纽约|洛杉矶|罗马|米兰|悉尼)/i;

// 数字提取（支持中文数字到万级；返回阿拉伯数值）
function cnNumToArabic(input: string): number | null {
  input = input.trim();
  if (/^\d+$/.test(input)) return Number(input);
  // 处理 “一万二”“三千五”“五十”“十二”“两百” 等形式
  // 映射表
  const map: Record<string, number> = { 零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9 }; // 两=2
  let total = 0;
  let current = 0;
  const unitMap: Record<string, number> = { 十:10, 百:100, 千:1000, 万:10000 };
  const chars = input.split("");
  for (const ch of chars) {
    if (map[ch] != null) {
      current = map[ch];
    } else if (unitMap[ch]) {
      const unit = unitMap[ch];
      if (current === 0 && (ch === "十")) current = 1; // “十” 前省略一 => 10
  current = current * unit;
  total += current;
  current = 0;
    } else if (/\d/.test(ch)) {
      return Number(input.replace(/[^0-9]/g, ""));
    }
  }
  total += current;
  if (total === 0) return null;
  return total;
}

// 预算识别：匹配 “预算xxx”“大概xxx块/元”“xxx元预算”等
const BUDGET_PATTERNS = [
  /(预算|花费|大概|大约|大概预算|控制在|不超过)\s*([\d,\.]+)\s*(?:元|块|人民币)?/i,
  /(预算|花费|大概|大约|控制在|不超过)\s*([一二两三四五六七八九十百千万〇零]+)\s*(?:元|块)/i,
];

// 天数匹配： “5天” “三天” “5日” “三晚” “玩 4 天”
const DAYS_PATTERN = /([\d]+|[一二两三四五六七八九十百千〇零]+)\s*(?:天|日|晚)/i;

// 人数匹配： “2人” “两个人” “我们三人”
const PEOPLE_PATTERN = /(\d+|[一二两三四五六七八九十百千〇零两]+)\s*人/;

// 偏好关键词列表（可以累积多个）
const PREF_KEYWORDS = ["美食", "动漫", "文化", "历史", "亲子", "购物", "自然", "摄影", "博物馆", "建筑", "夜景", "海岛", "艺术", "冒险", "徒步", "滑雪", "温泉"];

export function parseSpeechToForm(text: string): SpeechParseResult {
  const raw = text.trim();
  if (!raw) return {};

  let destination: string | undefined;
  const cityMatch = raw.match(CITY_HINT);
  if (cityMatch) destination = cityMatch[0];

  let days: number | undefined;
  const daysMatch = raw.match(DAYS_PATTERN);
  if (daysMatch) {
    const val = cnNumToArabic(daysMatch[1]);
    if (val && val > 0 && val < 100) days = val;
  }

  let partySize: number | "" | undefined;
  const peopleMatch = raw.match(PEOPLE_PATTERN);
  if (peopleMatch) {
    const val = cnNumToArabic(peopleMatch[1]);
    if (val && val > 0 && val < 100) partySize = val;
  }

  let budget: number | "" | undefined;
  for (const p of BUDGET_PATTERNS) {
    const m = raw.match(p);
    if (m) {
      const numRaw = m[2].replace(/[,，]/g, "");
      const num = cnNumToArabic(numRaw) ?? Number(numRaw);
      if (Number.isFinite(num) && num > 0) {
        budget = num;
        break;
      }
    }
  }

  // 偏好：从文本中找出所有关键词，去重后按出现顺序
  const prefsFound: string[] = [];
  for (const kw of PREF_KEYWORDS) {
    if (raw.includes(kw)) prefsFound.push(kw);
  }
  const preferences = prefsFound.length ? prefsFound.join("、") : undefined;

  return { destination, days, budget, partySize, preferences };
}

// 简单单元测试（仅在开发环境可快速调用）
// console.log(parseSpeechToForm("帮我规划去东京五天预算一万二三个人主要美食动漫"));
