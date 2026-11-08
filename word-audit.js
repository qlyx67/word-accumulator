// Corrections corroborated by the PDF index or the corresponding text pages.
{
  const removed = [["植物研究", "software"], ["动物保护", "condense"], ["动物保护", "museum"], ["物品材料", "handkerchief"], ["时尚潮流", "artist"], ["时尚潮流", "buffet"], ["时尚潮流", "drunk"], ["国家政府", "burden"], ["国家政府", "suck"], ["社会经济", "britain"], ["沙场争锋", "morphine"], ["沙场争锋", "negative"], ["自然地理", "putt"], ["饮食健康", "tid"]];
  const corrected = [
  [
    "动物保护",
    "monk",
    {
      "topic": "文化历史"
    }
  ],
  [
    "文化历史",
    "popa",
    {
      "term": "pope",
      "pos": "名词",
      "meaning": "罗马天主教教皇",
      "example": "The pope addressed a large crowd in the square."
    }
  ],
  [
    "植物研究",
    "rainforest",
    {
      "pos": "名词",
      "meaning": "雨林；降水丰富的森林"
    }
  ],
  [
    "法律法规",
    "benchmark",
    {
      "pos": "名词 / 动词",
      "meaning": "基准；衡量标准；用基准测试评估"
    }
  ],
  [
    "语言演化",
    "prefix",
    {
      "pos": "名词 / 动词",
      "meaning": "前缀；称谓；在前面加上"
    }
  ],
  [
    "植物研究",
    "hybridisation",
    {
      "pos": "名词",
      "meaning": "杂交；杂交过程（英式拼写，美式通常写作 hybridization）"
    }
  ],
  [
    "动物保护",
    "hybridise",
    {
      "pos": "动词",
      "meaning": "使杂交；进行杂交（英式拼写，美式通常写作 hybridize）"
    }
  ],
  [
    "建筑场所",
    "ice cream",
    {
      "topic": "饮食健康"
    }
  ],
  [
    "植物研究",
    "radar",
    {
      "topic": "科技发明"
    }
  ]
];
  const added = [
  {
    "topic": "身心健康",
    "term": "temperate",
    "pos": "形容词",
    "meaning": "温和的；适度的；（气候）温带的",
    "example": "She took a temperate approach to the disagreement."
  },
  {
    "topic": "自然地理",
    "term": "thaw",
    "pos": "动词 / 名词",
    "meaning": "解冻；融化；解冻期",
    "example": "The ice began to thaw in the afternoon sun."
  },
  {
    "topic": "娱乐运动",
    "term": "sponsor",
    "pos": "名词 / 动词",
    "meaning": "赞助者；赞助",
    "example": "A local company agreed to sponsor the concert."
  },
  {
    "topic": "自然地理",
    "term": "sprinkle",
    "pos": "动词",
    "meaning": "撒；洒",
    "example": "Sprinkle a little water on the dry soil."
  },
  {
    "topic": "娱乐运动",
    "term": "simulate",
    "pos": "动词",
    "meaning": "模拟；仿真",
    "example": "The software can simulate the effects of a power failure."
  },
  {
    "topic": "娱乐运动",
    "term": "solo",
    "pos": "名词 / 形容词 / 副词",
    "meaning": "独奏；单独的；独自地",
    "example": "She played a short piano solo at the concert."
  },
  {
    "topic": "学校教育",
    "term": "respect",
    "pos": "名词 / 动词",
    "meaning": "尊重；敬意；方面",
    "example": "Good teachers earn the respect of their students."
  },
  {
    "topic": "娱乐运动",
    "term": "recreation",
    "pos": "名词",
    "meaning": "娱乐；消遣",
    "example": "The park provides space for outdoor recreation."
  },
  {
    "topic": "文化历史",
    "term": "priest",
    "pos": "名词",
    "meaning": "神父；牧师；祭司",
    "example": "The priest greeted visitors at the entrance to the church."
  },
  {
    "topic": "学校教育",
    "term": "prize",
    "pos": "名词 / 动词",
    "meaning": "奖品；奖项；珍视",
    "example": "She won first prize in the school science competition."
  },
  {
    "topic": "科技发明",
    "term": "precise",
    "pos": "形容词",
    "meaning": "精确的；明确的",
    "example": "The instrument gives a precise reading of the temperature."
  },
  {
    "topic": "太空探索",
    "term": "molecule",
    "pos": "名词",
    "meaning": "分子",
    "example": "A water molecule contains two hydrogen atoms and one oxygen atom."
  },
  {
    "topic": "文化历史",
    "term": "native",
    "pos": "形容词 / 名词",
    "meaning": "本地的；土生土长的；本地人",
    "example": "The museum displays objects made by native communities."
  },
  {
    "topic": "娱乐运动",
    "term": "medium",
    "pos": "名词 / 形容词",
    "meaning": "媒介；传播渠道；中等的",
    "example": "Radio remained an important medium for news in rural areas."
  },
  {
    "topic": "社会经济",
    "term": "manage",
    "pos": "动词",
    "meaning": "管理；设法做到",
    "example": "She helps manage the family business."
  },
  {
    "topic": "科技发明",
    "term": "lens",
    "pos": "名词",
    "meaning": "透镜；镜头；晶状体",
    "example": "A wide-angle lens captures more of the scene."
  },
  {
    "topic": "文化历史",
    "term": "local",
    "pos": "形容词 / 名词",
    "meaning": "当地的；本地人",
    "example": "Local residents helped restore the old building."
  },
  {
    "topic": "身心健康",
    "term": "lap",
    "pos": "名词 / 动词",
    "meaning": "大腿上方；一圈；轻拍",
    "example": "The child fell asleep with a book on her lap."
  },
  {
    "topic": "娱乐运动",
    "term": "feast",
    "pos": "名词 / 动词",
    "meaning": "盛宴；尽情享用",
    "example": "The village held a feast to celebrate the harvest."
  },
  {
    "topic": "娱乐运动",
    "term": "depict",
    "pos": "动词",
    "meaning": "描绘；描述",
    "example": "The paintings depict scenes from daily life."
  },
  {
    "topic": "娱乐运动",
    "term": "describe",
    "pos": "动词",
    "meaning": "描述；形容",
    "example": "The guide used a map to describe the route."
  },
  {
    "topic": "学校教育",
    "term": "detect",
    "pos": "动词",
    "meaning": "发现；检测出",
    "example": "The experiment was designed to detect tiny changes in pressure."
  },
  {
    "topic": "娱乐运动",
    "term": "disseminate",
    "pos": "动词",
    "meaning": "传播；散布",
    "example": "The organisation uses newsletters to disseminate information."
  },
  {
    "topic": "社会经济",
    "term": "coordinate",
    "pos": "动词 / 名词",
    "meaning": "协调；使配合；坐标",
    "example": "A project manager will coordinate the work of the teams."
  },
  {
    "topic": "娱乐运动",
    "term": "craftsman",
    "pos": "名词",
    "meaning": "工匠；手艺人",
    "example": "A local craftsman repaired the carved wooden door."
  },
  {
    "topic": "娱乐运动",
    "term": "animation",
    "pos": "名词",
    "meaning": "动画；动画制作；活力",
    "example": "The film uses animation to explain how the heart works."
  },
  {
    "topic": "身心健康",
    "term": "biorhythm",
    "pos": "名词",
    "meaning": "生物节律",
    "example": "Working at night can disrupt a person's natural biorhythm."
  },
  {
    "topic": "娱乐运动",
    "term": "aesthetic",
    "pos": "形容词 / 名词",
    "meaning": "审美的；美学的；审美风格",
    "example": "The designer chose wood for both practical and aesthetic reasons."
  },
  {
    "topic": "娱乐运动",
    "term": "badminton",
    "pos": "名词",
    "meaning": "羽毛球运动",
    "example": "They play badminton every Thursday after class."
  },
  {
    "topic": "娱乐运动",
    "term": "band",
    "pos": "名词 / 动词",
    "meaning": "乐队；带；把……用带绑住",
    "example": "A local band performed at the festival."
  },
  {
    "topic": "自然地理",
    "term": "toxic",
    "pos": "形容词",
    "meaning": "有毒的；有害的",
    "example": "The factory was fined for releasing toxic waste into the river."
  },
  {
    "topic": "交通旅行",
    "term": "vessel",
    "pos": "名词",
    "meaning": "船；容器；血管",
    "example": "A rescue vessel reached the island before nightfall."
  },
  {
    "topic": "学校教育",
    "term": "underestimate",
    "pos": "动词 / 名词",
    "meaning": "低估；过低的估计",
    "example": "Do not underestimate how long the project will take."
  },
  {
    "topic": "交通旅行",
    "term": "transfer",
    "pos": "动词 / 名词",
    "meaning": "转移；转乘；调动",
    "example": "We had to transfer to a different bus at the station."
  },
  {
    "topic": "行为动作",
    "term": "undertake",
    "pos": "动词",
    "meaning": "承担；着手做",
    "example": "The team will undertake a review of the existing system."
  },
  {
    "topic": "法律法规",
    "term": "trap",
    "pos": "名词 / 动词",
    "meaning": "陷阱；困住；诱捕",
    "example": "The police set a trap for the thieves."
  },
  {
    "topic": "语言演化",
    "term": "vocabulary",
    "pos": "名词",
    "meaning": "词汇；词汇量",
    "example": "Reading regularly can help you expand your vocabulary."
  },
  {
    "topic": "学校教育",
    "term": "variable",
    "pos": "形容词 / 名词",
    "meaning": "可变的；变量",
    "example": "Temperature was the only variable in the experiment."
  },
  {
    "topic": "植物研究",
    "term": "shade-tolerant",
    "pos": "形容词",
    "meaning": "耐阴的",
    "example": "Shade-tolerant plants grow well beneath taller trees."
  },
  {
    "topic": "学校教育",
    "term": "coed",
    "pos": "形容词 / 名词",
    "meaning": "男女同校的；男女混合的；女学生（较旧用法）",
    "example": "The school became coed in the 1980s."
  },
  {
    "topic": "学校教育",
    "term": "hall",
    "pos": "名词",
    "meaning": "大厅；礼堂；走廊",
    "example": "The graduation ceremony took place in the main hall."
  },
  {
    "topic": "学校教育",
    "term": "elicit",
    "pos": "动词",
    "meaning": "引出；引起",
    "example": "The interview was designed to elicit detailed responses."
  },
  {
    "topic": "身心健康",
    "term": "emotion",
    "pos": "名词",
    "meaning": "情绪；情感",
    "example": "The music conveyed a powerful sense of emotion."
  },
  {
    "topic": "科技发明",
    "term": "engineer",
    "pos": "名词 / 动词",
    "meaning": "工程师；设计；策划",
    "example": "The engineer checked the bridge for signs of damage."
  },
  {
    "topic": "学校教育",
    "term": "enhance",
    "pos": "动词",
    "meaning": "提高；增强",
    "example": "Good lighting can enhance the appearance of a small room."
  },
  {
    "topic": "学校教育",
    "term": "expertise",
    "pos": "名词",
    "meaning": "专业知识；专长",
    "example": "The team needs someone with expertise in data analysis."
  },
  {
    "topic": "动物保护",
    "term": "panda",
    "pos": "名词",
    "meaning": "熊猫",
    "example": "The panda spent most of the afternoon eating bamboo."
  },
  {
    "topic": "动物保护",
    "term": "paw",
    "pos": "名词 / 动词",
    "meaning": "动物的爪；用爪抓",
    "example": "The dog lifted a paw to shake hands."
  },
  {
    "topic": "建筑场所",
    "term": "outward",
    "pos": "形容词 / 副词",
    "meaning": "向外的；外在的；向外",
    "example": "Follow the signs for the outward journey."
  },
  {
    "topic": "时尚潮流",
    "term": "overall",
    "pos": "形容词 / 副词 / 名词",
    "meaning": "总体的；总的来说；工作服",
    "example": "The overall cost was lower than expected."
  },
  {
    "topic": "学校教育",
    "term": "cent",
    "pos": "名词",
    "meaning": "分（货币单位）；百分之一",
    "example": "The price went up by one cent."
  },
  {
    "topic": "法律法规",
    "term": "perform",
    "pos": "动词",
    "meaning": "执行；履行；表演；表现",
    "example": "The inspector must perform a final safety check."
  },
  {
    "topic": "国家政府",
    "term": "institution",
    "pos": "名词",
    "meaning": "机构；制度；惯例",
    "example": "The institution provides support for newly arrived refugees."
  },
  {
    "topic": "建筑场所",
    "term": "interior",
    "pos": "名词 / 形容词",
    "meaning": "内部；内地；内部的",
    "example": "The interior of the building was renovated last year."
  },
  {
    "topic": "太空探索",
    "term": "interstellar",
    "pos": "形容词",
    "meaning": "星际的",
    "example": "The telescope can detect clouds of interstellar dust."
  },
  {
    "topic": "身心健康",
    "term": "care",
    "pos": "名词 / 动词",
    "meaning": "照顾；护理；关心",
    "example": "The hospital provides specialist care for older patients."
  },
  {
    "topic": "身心健康",
    "term": "injection",
    "pos": "名词",
    "meaning": "注射；注入",
    "example": "The nurse gave the patient an injection."
  },
  {
    "topic": "身心健康",
    "term": "injury",
    "pos": "名词",
    "meaning": "受伤；伤害",
    "example": "He returned to work after recovering from his injury."
  },
  {
    "topic": "娱乐运动",
    "term": "imitate",
    "pos": "动词",
    "meaning": "模仿；仿效",
    "example": "Young children often imitate what adults do."
  }
];
  const key = (topic, term) => topic + ':' + term;
  const excluded = new Set(removed.map(([topic, term]) => key(topic, term)));
  const updates = new Map(corrected.map(([topic, term, fields]) => [key(topic, term), fields]));
  const audited = words.filter(word => !excluded.has(key(word.topic, word.term)));
  for (const word of audited) Object.assign(word, updates.get(key(word.topic, word.term)));
  words.splice(0, words.length, ...audited, ...added);
}
