/* lab/quiz.js: the predict-first quiz. Six questions, one per bench; the
   answer stays sealed until the visitor commits to a guess. A bench that
   has been made to show its phenomenon earns a "demonstrated" tag. */
export function quiz(button, questions, demonstrated) {
  const overlay = document.createElement('div'); overlay.id = 'quizOverlay'; overlay.hidden = true;
  overlay.innerHTML = '<div class="quizpanel holopanel glass" role="dialog" aria-modal="true" aria-label="Light quiz"></div>';
  document.body.appendChild(overlay);
  const panel = overlay.firstElementChild;
  let qi = 0, score = 0, picks = [];
  const close = () => { overlay.hidden = true; button.focus(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) close(); });
  const materialize = () => { panel.classList.remove('is-in'); void panel.offsetWidth; panel.classList.add('is-in'); };
  const head = () => `<div class="qhead"><span class="qtag">Light quiz</span><span class="qcount num">${Math.min(qi + 1, questions.length)} / ${questions.length}</span><button type="button" class="qclose" aria-label="Close quiz" data-holo-tap>close</button></div>` +
    `<div class="qdots">${questions.map((_, k) => `<i class="${k < qi ? 'done' : k === qi ? 'on' : ''}"></i>`).join('')}</div>`;
  function show() {
    if (qi >= questions.length) return results();
    const q = questions[qi];
    panel.classList.remove('answered');
    panel.innerHTML = head() + `<p class="qfrom">${q.title}${demonstrated[q.id] ? ' <span class="qlabtag">demonstrated on the bench</span>' : ''}</p>` +
      `<p class="q">${q.text}</p><div class="choices">${q.choices.map((c, k) => `<button type="button" data-i="${k}" data-holo-tap>${c}</button>`).join('')}</div>` +
      `<p class="verdict"></p><p class="reveal"></p><div class="qfoot"><button type="button" class="qnext" data-holo-tap>${qi === questions.length - 1 ? 'results' : 'next'}</button><span class="qnote">Commit to a guess. The answer stays sealed until you do.</span></div>`;
    materialize();
    panel.querySelectorAll('.choices button').forEach(b => b.addEventListener('click', () => {
      if (panel.classList.contains('answered')) return;
      const k = +b.dataset.i, right = k === q.answer;
      if (right) score++;
      picks[qi] = right;
      b.classList.add(right ? 'good' : 'bad');
      if (!right) panel.querySelector(`.choices button[data-i="${q.answer}"]`).classList.add('good');
      const v = panel.querySelector('.verdict'); v.textContent = right ? 'Correct' : 'Not this time'; v.classList.add(right ? 'good' : 'bad');
      panel.querySelector('.reveal').textContent = q.reveal; panel.querySelector('.qnote').textContent = '';
      panel.classList.add('answered');
    }));
    panel.querySelector('.qnext').addEventListener('click', () => { qi++; show(); });
    panel.querySelector('.qclose').addEventListener('click', close);
  }
  function results() {
    const n = questions.length;
    const word = score === n ? 'Fully light literate.' : score >= n - 1 ? 'One photon short of perfect.' : score >= Math.ceil(n / 2) ? 'The lab is starting to rub off on you.' : 'Good news: every answer is on a bench, running live.';
    panel.classList.remove('answered');
    panel.innerHTML = head() + `<p class="qfrom">Results</p><p class="score"><span class="num">${score} / ${n}</span> · ${word}</p>` +
      `<p class="reveal" style="display:block">${questions.map((q, k) => (picks[k] ? '✓ ' : '✗ ') + q.title).join('<br>')}</p>` +
      `<div class="qfoot"><button type="button" class="qnext" style="visibility:visible" data-holo-tap>try again</button><button type="button" class="qclose" data-holo-tap>back to the lab</button></div>`;
    materialize();
    panel.querySelector('.qnext').addEventListener('click', () => { qi = 0; score = 0; picks = []; show(); });
    panel.querySelectorAll('.qclose').forEach(b => b.addEventListener('click', close));
  }
  button.addEventListener('click', () => { qi = 0; score = 0; picks = []; overlay.hidden = false; show(); });
}
