export interface NormalizeRule {
  value: string;
  regex: RegExp;
}

function sanitize(text: string): string {
  if (!text) return "";
  return text.replace(/\s+/g, "").replace(/[^\uAC00-\uD7A3]/g, "");
}

function stripSuffix(clean: string): string {
  return clean.replace(/(증가|증강|증|즘가|승가|즈기)$/g, "");
}

function normalizeArts(clean: string): string | null {
  const hasArts = /아[츠즈측특트]/.test(clean);
  if (!hasArts) return null;

  const hasOriginium = /오리?지?늄/.test(clean);
  const hasDamage = /피[해헤패하]/.test(clean);
  const hasIncrease = /(증|중|즌|즁|강[도토두로]?)/.test(clean);

  if (hasOriginium) return "아츠강도";
  if (hasDamage) return "아츠피해";
  if (hasIncrease) return "아츠강도";
  return "아츠강도";
}

const RULES: NormalizeRule[] = [
  {
    value: "궁극기획득효율",
    regex: /궁[극국귱].*획[득듬]|획[득듬].*궁[극국귱]/,
  },
  { value: "치명타확률", regex: /치[명망].*확[률를]|확[률를].*치[명망]/ },
  { value: "치유효율", regex: /치[유우]/ },
  { value: "주요능력치", regex: /주[요오].*능[력럭]치|능[력럭]치.*주[요오]/ },

  { value: "공격력", regex: /걱럭|격턱|공[격걱]|격력|공력|^럭$/ },
  { value: "생명력", regex: /생[명멍먕]/ },
  { value: "민첩", regex: /민[첩접쳡]|미[첩접]/ },
  { value: "지능", regex: /^지[능늄]$|^시능$|^자능$/ },
  { value: "의지", regex: /의[지자]|으지/ },
  { value: "힘", regex: /^힘$|흐임|그[룹룰옵루룬]|^[으우]루$|^루$/ },

  { value: "물리피해", regex: /물[리이]|는그리|그리톨/ },
  { value: "냉기피해", regex: /냉[기기]/ },
  { value: "열기피해", regex: /열[기이]/ },
  { value: "전기피해", regex: /전[기이]/ },
  { value: "자연피해", regex: /자[연현]/ },

  { value: "방출", regex: /방[출줄쥴]|밤출|크|기구/ },
  { value: "흐름", regex: /흐[름륾]|으름|^고$/ },
  { value: "고통", regex: /고[통충동]/ },
  { value: "어둠", regex: /^어[둠눔롬놈돔룸룸니ㄴㅁ]$|^[어엄움]$/ },

  { value: "억제", regex: /억[제재]/ },
  { value: "잔혹", regex: /잔[혹흑]/ },
  { value: "추격", regex: /추[격굑]|족/ },
  { value: "기예", regex: /기[예얘]/ },
  { value: "골절", regex: /골[절졀]/ },
  { value: "분쇄", regex: /분[쇄쉐]/ },
  { value: "사기", regex: /사[기귀]/ },
  { value: "의료", regex: /의[료로]|^그$/ },
  { value: "효율", regex: /[효요][율률]|푸/ },
];

export function normalizeWithVanillaRules(text: string): string {
  const clean = stripSuffix(sanitize(text));
  if (!clean) return "";

  const arts = normalizeArts(clean);
  if (arts) return arts;

  for (const rule of RULES) {
    if (rule.regex.test(clean)) return rule.value;
  }

  return clean;
}
