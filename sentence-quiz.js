'use strict';

const sentenceQuestions = [
  ['rainfall', 'The farmers measured the total ___ during the wet season in millimetres.', '名词', 'wet season 和毫米都指向降雨量。', '降雨量', 'sunshine:日照|wind:风|temperature:温度|humidity:湿度|pressure:气压|visibility:能见度'],
  ['evaporate', 'When the puddle warmed up in the sun, the liquid water began to ___ into water vapour.', '动词原形', 'began to 后接动词原形。液态水变成水蒸气是蒸发。', '蒸发', 'freeze:冻结|condense:凝结|melt:融化|settle:沉降|drain:排出|crystallise:结晶'],
  ['fragile', 'The glass sculpture is extremely ___ and could break if it is dropped.', '形容词', 'is extremely 后可接形容词。掉落就可能碎，说明它很脆弱。', '易碎的', 'flexible:柔韧的|durable:耐用的|opaque:不透明的|portable:便携的|elastic:有弹性的|waterproof:防水的'],
  ['allocate', 'The committee must ___ part of its budget to each project before any spending begins.', '动词原形', 'must 后接动词原形。把预算的一部分分给每个项目，用 allocate。', '分配', 'borrow:借入|measure:测量|reclaim:收回|calculate:计算|audit:审计|estimate:估算'],
  ['decline', 'As demand weakened, sales began to ___, falling from 800 units to 500.', '动词原形', 'began to 后接动词原形。从 800 降到 500 表示下滑。', '下降', 'rise:上升|recover:恢复|stabilise:趋稳|double:翻倍|expand:扩张|peak:达到峰值'],
  ['evidence', 'The claim remains unproven because the researchers have not presented any ___ to support it.', '名词', 'any 后可接名词。support a claim 需要证据，而句中说这项主张尚未得到证实。', '证据', 'equipment:设备|funding:资金|permission:许可|training:培训|feedback:反馈|advice:建议'],
  ['habitat', 'The forest is the bird’s natural ___, where it finds food and builds its nests.', '名词', 'natural 修饰名词。能够觅食、筑巢的自然环境就是栖息地。', '栖息地', 'predator:捕食者|diet:饮食|migration:迁徙|camouflage:伪装|offspring:后代|ancestor:祖先'],
  ['accurate', 'The new scale is more ___: its readings are within one gram of the true weight.', '形容词', 'more 后接形容词。读数与真实值非常接近，说明更准确。', '准确的', 'compact:紧凑的|portable:便携的|affordable:价格合理的|visible:可见的|durable:耐用的|efficient:高效的'],
  ['substitute', 'If the recipe calls for butter and you have none, you can ___ margarine for it.', '动词原形', 'can 后接动词原形。substitute A for B 表示用 A 代替 B。', '替代', 'reserve:预留|store:储存|measure:测量|weigh:称重|spread:涂抹|melt:融化'],
  ['survey', 'To find out how students travel to campus, the university conducted a ___ and collected 600 responses.', '名词', 'conducted a 后接可数名词单数。收集大量回答来了解情况，符合调查的语境。', '调查', 'lecture:讲座|demonstration:演示|debate:辩论|ceremony:仪式|workshop:研讨班|competition:竞赛'],
  ['maintain', 'The engineers check and service the equipment regularly to ___ it in good working order.', '动词原形', '不定式 to 后接动词原形。定期检查保养是为了让设备保持良好状态。', '维护；保持', 'replace:更换|dismantle:拆除|install:安装|inspect:检查|transport:运输|discard:丢弃'],
  ['gradually', 'The river level rose ___ over three days, a few centimetres at a time.', '副词', '空格修饰动词 rose。三天里每次只涨几厘米，说明是逐渐上涨。', '逐渐地', 'instantly:立刻|abruptly:突然地|rarely:很少|simultaneously:同时|occasionally:偶尔|accidentally:意外地'],
  ['outcome', 'The treatment was successful, and the patient recovered fully. The doctors were pleased with the ___.', '名词', 'the 后接名词。病人康复是治疗产生的结果。', '结果', 'procedure:步骤|schedule:日程|diagnosis:诊断|symptom:症状|prescription:处方|appointment:预约'],
  ['conserve', 'During the drought, residents were asked to ___ water by taking shorter showers.', '动词原形', 'asked to 后接动词原形。缩短淋浴时间能节约用水。', '节约；保护', 'boil:煮沸|filter:过滤|pump:抽送|collect:收集|test:检测|heat:加热'],
  ['temporary', 'The bridge closure is only ___; traffic will resume on Monday.', '形容词', 'is only 后可接形容词。周一就恢复通行，说明封闭是暂时的。', '暂时的', 'permanent:永久的|annual:每年的|optional:可选的|remote:偏远的|frequent:频繁的|gradual:逐步的'],
  ['expand', 'The library plans to ___ its seating area by adding two new reading rooms.', '动词原形', 'plans to 后接动词原形。新增两间阅览室会扩大座位区域。', '扩大', 'reduce:缩减|reserve:预订|inspect:检查|divide:划分|measure:测量|close:关闭'],
  ['estimate', 'Without exact figures, the team could only ___ the cost using prices from similar projects.', '动词原形', 'could 后接动词原形。缺乏精确数据，只能参考类似项目的价格估算。', '估算', 'reduce:降低|approve:批准|pay:支付|recover:收回|refund:退还|ignore:忽略'],
  ['essential', 'Clean water is ___ for human survival; people cannot live long without it.', '形容词', 'is 后接形容词。离开干净的水就无法长期生存，说明它必不可少。', '必不可少的', 'optional:可选的|rare:罕见的|expensive:昂贵的|temporary:暂时的|convenient:方便的|unusual:不寻常的']
].map(([id, sentence, part, reason, meaning, decoys]) => ({
  id, sentence, part, reason, meaning,
  decoys: decoys.split('|').map(item => item.split(':'))
}));

const sentenceKey = 'word-accumulator.sentence-mistakes.v1';
const sentenceOptionsKey = 'word-accumulator.sentence-options.v1';

function loadSentenceOptions() {
  try { return JSON.parse(localStorage.getItem(sentenceOptionsKey)) || {}; }
  catch { return {}; }
}
let sentenceMistakes = loadSentenceMistakes();
let sentenceQuestion;
let sentenceQueue = [];
let sentenceReview = false;

function loadSentenceMistakes() {
  try {
    const stored = JSON.parse(localStorage.getItem(sentenceKey));
    return new Set(Array.isArray(stored) ? stored : []);
  } catch { return new Set(); }
}

function renderSentenceMistakes() {
  const mistakes = sentenceQuestions.filter(question => sentenceMistakes.has(question.id));
  byId('sentence-count').textContent = mistakes.length + ' 题';
  byId('sentence-empty').hidden = mistakes.length > 0;
  byId('sentence-review').disabled = !mistakes.length;
  byId('sentence-list').replaceChildren(...mistakes.map(question => {
    const item = document.createElement('li');
    const control = button(question.sentence, () => openSentencePractice(true, question));
    control.lang = 'en';
    item.append(control);
    return item;
  }));
}

function openSentencePractice(review, specific) {
  sentenceReview = review;
  sentenceQueue = specific ? [specific] : [];
  if (mode !== 'quiz') activateMode('quiz', false);
  else nextSentence();
}

function nextSentence() {
  const bank = sentenceReview ? sentenceQuestions.filter(item => sentenceMistakes.has(item.id)) : sentenceQuestions;
  if (!sentenceQueue.length) {
    sentenceQueue = shuffle(bank);
    if (sentenceQueue.length > 1 && sentenceQueue.at(-1) === sentenceQuestion) {
      sentenceQueue.unshift(sentenceQueue.pop());
    }
  }
  sentenceQuestion = sentenceQueue.pop();
  const question = sentenceQuestion;
  byId('quiz-prompt').textContent = question?.sentence || '错题本里还没有句子题。';
  byId('quiz-mode').textContent = sentenceReview ? '正在重做句子错题' : '正在练习句子选词';
  byId('quiz-all').hidden = !sentenceReview;
  byId('quiz-explanation').hidden = true;
  byId('quiz-next').hidden = true;
  feedback('quiz-feedback', '');
  const options = byId('quiz-options');
  options.replaceChildren();
  if (!question) return;
  const history = loadSentenceOptions();
  const previous = new Set(Array.isArray(history[question.id]) ? history[question.id].slice(0, 3) : []);
  const decoys = shuffle(question.decoys.filter(([term]) => !previous.has(term))).slice(0, 3);
  history[question.id] = decoys.map(([term]) => term);
  try { localStorage.setItem(sentenceOptionsKey, JSON.stringify(history)); } catch {}
  const choices = shuffle([[question.id, question.meaning], ...decoys]);
  options.replaceChildren(...choices.map(([term]) => {
    const control = button(term, () => {
      const correct = term === question.id;
      for (const option of options.children) {
        option.disabled = true;
        if (option.textContent === question.id) option.classList.add('quiz-correct');
      }
      if (!correct) {
        control.classList.add('quiz-incorrect');
        sentenceMistakes = new Set([...sentenceMistakes, ...loadSentenceMistakes(), question.id]);
        try { localStorage.setItem(sentenceKey, JSON.stringify([...sentenceMistakes])); }
        catch { byId('save-note').textContent = '浏览器拒绝保存进度，刷新可能丢失本次记录。'; }
        renderSentenceMistakes();
      }
      feedback('quiz-feedback', correct ? '答对了！' : '答错了，正确答案是 ' + question.id + '。', correct ? 'good' : 'bad');
      byId('quiz-part').textContent = '空格需要 ' + question.part + '。';
      byId('quiz-reason').textContent = question.reason;
      byId('quiz-meanings').replaceChildren(...choices.map(([word, meaning]) => {
        const item = document.createElement('li');
        item.textContent = word + ' · ' + meaning;
        return item;
      }));
      byId('quiz-explanation').hidden = false;
      byId('quiz-next').hidden = false;
      byId('quiz-next').focus();
    });
    control.lang = 'en';
    return control;
  }));
}

byId('quiz-next').addEventListener('click', () => nextSentence());
byId('quiz-all').addEventListener('click', () => openSentencePractice(false));
byId('sentence-review').addEventListener('click', () => openSentencePractice(true));
window.addEventListener('storage', event => {
  if (event.key === sentenceKey || event.key === null) {
    sentenceMistakes = loadSentenceMistakes();
    renderSentenceMistakes();
  }
});
renderSentenceMistakes();
