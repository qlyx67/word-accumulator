'use strict';

function repairUnit6Deck(decks, storage, deckListKey) {
  const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[‘’]/g, "'").trim().replace(/\s+/g, ' ');
  const nameMatches = decks.filter(deck =>
    normalize(deck.name).replace(/\s/g, '') === '大英3unit6' && Array.isArray(deck.words));
  if (nameMatches.length !== 1) return;
  const deck = nameMatches[0];
  const marker = 'word-accumulator:unit6-repair:' + deck.id;
  if (storage.getItem(marker)) return;

  const unit6 = [
    ["whole wheat", "全麦的"],
    ["ham", "火腿"],
    ["grill", "烤"],
    ["toast", "烘烤；吐司"],
    ["historian", "历史学家"],
    ["resourcefulness", "机智；善于应变"],
    ["immigration", "移民；移民入境"],
    ["globalization", "全球化"],
    ["tuna", "金枪鱼"],
    ["originate", "起源；发源"],
    ["conserve", "节省；保护"],
    ["excess", "过量；过度"],
    ["leftover", "剩菜剩饭；剩余的"],
    ["mayonnaise", "蛋黄酱"],
    ["lettuce", "莴苣；生菜"],
    ["convention", "惯例；大会"],
    ["turnover", "流动；营业额"],
    ["canned", "罐装的"],
    ["downside", "不利的一面"],
    ["popularity", "受欢迎；流行"],
    ["unintended", "无意的"],
    ["scrap", "碎片；残羹剩饭"],
    ["conscience", "良心"],
    ["environmentalism", "环境保护主义"],
    ["elite", "精英"],
    ["chafing dish", "保温餐锅；火锅"],
    ["triangle", "三角形"],
    ["toothpick", "牙签"],
    ["combination", "组合；结合体"],
    ["elegance", "高雅"],
    ["permanent", "永久的"],
    ["cuisine", "菜肴；烹饪风格"],
    ["conservative", "保守的"],
    ["conservatism", "保守主义"],
    ["loyalty", "忠诚"],
    ["dainty", "小巧精致的"],
    ["chow mein", "炒面"],
    ["doctorate", "博士学位"],
    ["mystery", "谜；神秘的事"],
    ["specifically", "专门地；具体地"],
    ["bun", "小圆面包"],
    ["gravy", "肉汁"],
    ["classic", "典型的；经典的"],
    ["filling", "容易让人吃饱的"],
    ["munch", "大声咀嚼；用力嚼"],
    ["canteen", "食堂"],
    ["dime", "十美分硬币"],
    ["expat", "居住在国外的人；侨民"],
    ["reach out to", "向……寻求帮助"],
    ["of one's choosing", "自己选择的"],
    ["fill somebody up", "使某人吃饱"],
    ["from scratch", "从零开始"],
    ["come up with", "想出；提出"],
    ["to go", "外带的"],
    ["call for something", "需要某事物"],
    ["to this day", "直到今天"],
    ["thanks to", "由于；多亏"],
    ["confession", "承认；坦白"],
    ["devote", "投入；致力于"],
    ["devoted", "忠诚的；热爱的"],
    ["insatiable", "难以满足的"],
    ["craving", "渴望"],
    ["tropical", "热带的"],
    ["challenging", "有挑战性的"],
    ["calculus", "微积分"],
    ["adjust", "适应；习惯"],
    ["dorm", "学生宿舍；集体寝室"],
    ["zucchini", "西葫芦"],
    ["cucumber", "黄瓜"],
    ["disposal", "支配权；处置"],
    ["peruse", "仔细审阅；细读"],
    ["grimly", "愁苦地；严肃地"],
    ["mealy", "口感干而粉的"],
    ["pinkish", "浅粉色的"],
    ["iceberg lettuce", "卷心莴苣"],
    ["wrap", "包；裹"],
    ["wrapper", "包装纸或包装塑料"],
    ["peel", "果皮；剥皮"],
    ["unworldly", "不谙世故的；淡泊的"],
    ["cultured", "有教养的"],
    ["realization", "意识到；领悟"],
    ["grant", "授予；准予；视……为理所当然"],
    ["motivation", "动机；动力"],
    ["priority", "优先事项"],
    ["golden", "金色的"],
    ["yolk", "蛋黄"],
    ["crunch", "嘎吱声"],
    ["organic", "有机的"],
    ["free-range", "散养的"],
    ["participate", "参加"],
    ["earbud", "入耳式耳机"],
    ["melt", "熔化；融化"],
    ["sustenance", "营养；维持生存的食物"],
    ["profound", "深刻的；重大的"],
    ["far-reaching", "影响深远的"],
    ["grave", "严重的；坟墓"],
    ["prediction", "预测"],
    ["get somebody through", "帮某人熬过困难"],
    ["make fun of", "取笑"],
    ["at one's disposal", "可供某人支配"],
    ["pick out", "辨认出；挑选"],
    ["keep something to oneself", "对某事保密"],
    ["be far removed from something", "与某事物相去甚远"],
    ["rely on", "依赖"],
    ["in season", "当季的"],
    ["next to", "紧接；仅次于"],
    ["for the most part", "通常；大体上"],
    ["down the road", "将来"],
  ];
  const existing = new Set(deck.words.map(word => normalize(word?.term)));
  // Match both the name and chapter contents before modifying a browser's deck.
  if (unit6.filter(([term]) => existing.has(term)).length < 25) return;
  const missing = unit6.filter(([term]) => !existing.has(term));
  if (missing.length) {
    const repaired = {
      ...deck,
      words: [...deck.words, ...missing.map(([term, meaning]) => ({
        term, meaning, pos: '', example: '', exampleZh: '', topic: deck.name,
      }))],
    };
    const index = decks.indexOf(deck);
    const updated = decks.slice();
    updated[index] = repaired;
    storage.setItem(deckListKey, JSON.stringify(updated));
    decks[index] = repaired;
  }
  storage.setItem(marker, '1');
}
