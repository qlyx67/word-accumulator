/* One clear entry point, without changing existing study routes or progress. */
(() => {
  const home = document.getElementById('learning-home');
  if (!home) return;
  const card = document.createElement('a');
  card.href = 'exam.html'; card.className = 'exam-entry';
  card.innerHTML = '<span class="exam-entry-icon" aria-hidden="true">▤</span><span><small>备考学习包 · NEW</small><strong>把自己的资料，变成能练的题。</strong><span>图片／文字导入 · 首字母 · 听写 · 双向翻译</span></span><b aria-hidden="true">↗</b>';
  home.prepend(card);
  const style = document.createElement('style');
  style.textContent = '.exam-entry{display:flex;align-items:center;gap:18px;padding:23px 25px;margin:0 0 24px;border:1px solid #b6dfbe40;background:linear-gradient(110deg,#244733a6,#172c25b3);border-radius:19px;text-decoration:none;color:#e4f0e2;transition:background .2s}.exam-entry:hover{background:#294d39}.exam-entry-icon{font-size:29px;color:#c1e4b5}.exam-entry>span:nth-child(2){flex:1}.exam-entry small{display:block;font-size:10px;color:#c1e4b5;letter-spacing:1.2px}.exam-entry strong{display:block;font-size:20px;font-weight:500;margin:5px 0}.exam-entry span span{font-size:11px;color:#a8bcac}.exam-entry b{font-size:23px;color:#c1e4b5;font-weight:400}@media(max-width:640px){.exam-entry{padding:18px;gap:12px;margin-bottom:18px}.exam-entry strong{font-size:16px}.exam-entry span span{font-size:10px}.exam-entry-icon{font-size:23px}}';
  document.head.append(style);
})();
