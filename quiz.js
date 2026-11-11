/* Anatomy Atlas - quiz and tab switching */
(function () {
  'use strict';

  var Q = window.BODY_DATA.quiz;
  var body = document.getElementById('quizBody');
  var tabs = document.querySelectorAll('.tab');
  var views = { explore: document.getElementById('explore'), quiz: document.getElementById('quiz') };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function showView(name) {
    Object.keys(views).forEach(function (k) { views[k].classList.toggle('on', k === name); });
    Array.prototype.forEach.call(tabs, function (t) { t.classList.toggle('on', t.getAttribute('data-view') === name); });
    if (name === 'explore' && window.BodyApp) setTimeout(window.BodyApp.resize, 0);
  }
  Array.prototype.forEach.call(tabs, function (t) {
    t.addEventListener('click', function () { showView(t.getAttribute('data-view')); });
  });

  /* ---------- quiz state ---------- */
  var order, idx, score, wrong, opts, answered;

  function intro() {
    body.innerHTML =
      '<h2>Test what you have learned</h2>' +
      '<p class="sub">' + Q.length + ' multiple-choice questions on organs, systems and bones. You get an explanation after every answer.</p>' +
      '<button type="button" class="btn" id="qStart">Start quiz</button>';
    document.getElementById('qStart').onclick = start;
  }

  function start() {
    order = shuffle(Q.map(function (_, i) { return i; }));
    idx = 0; score = 0; wrong = [];
    ask();
  }

  function ask() {
    var q = Q[order[idx]];
    answered = false;
    opts = shuffle(q.options.map(function (t, i) { return { t: t, i: i }; }));
    var pct = Math.round(idx / Q.length * 100);
    var html =
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>' +
      '<div class="qmeta"><span>Question ' + (idx + 1) + ' of ' + Q.length + '</span><span>Score: ' + score + '</span></div>' +
      '<h2>' + esc(q.q) + '</h2><div class="opts">';
    opts.forEach(function (o, n) {
      html += '<button type="button" class="opt" data-n="' + n + '">' + esc(o.t) + '</button>';
    });
    html += '</div><div id="qFeedback"></div>';
    body.innerHTML = html;
    Array.prototype.forEach.call(body.querySelectorAll('.opt'), function (b) {
      b.onclick = function () { choose(+b.getAttribute('data-n')); };
    });
  }

  function choose(n) {
    if (answered) return;
    answered = true;
    var q = Q[order[idx]];
    var ok = opts[n].i === q.answer;
    if (ok) score++; else wrong.push(q);
    Array.prototype.forEach.call(body.querySelectorAll('.opt'), function (b, k) {
      b.disabled = true;
      if (opts[k].i === q.answer) b.classList.add('right');
      else if (k === n) b.classList.add('wrong');
    });
    var last = idx === Q.length - 1;
    document.getElementById('qFeedback').innerHTML =
      '<div class="feedback"><b class="' + (ok ? 'ok' : 'bad') + '">' + (ok ? 'Correct.' : 'Not quite.') + '</b> ' + esc(q.explain) + '</div>' +
      '<div class="actions">' +
        '<button type="button" class="btn" id="qNext">' + (last ? 'See my score' : 'Next question') + '</button>' +
        (q.organ ? '<button type="button" class="btn ghost" id="qLocate">Show in 3D</button>' : '') +
      '</div>';
    document.getElementById('qNext').onclick = function () { idx++; if (idx < Q.length) ask(); else finish(); };
    document.getElementById('qNext').focus();
    var loc = document.getElementById('qLocate');
    if (loc) loc.onclick = function () {
      showView('explore');
      if (window.BodyApp) window.BodyApp.select(q.organ);
    };
  }

  function finish() {
    var pct = Math.round(score / Q.length * 100);
    var msg = pct === 100 ? 'Perfect score.' : pct >= 70 ? 'Well done.' : pct >= 40 ? 'Good start. Review the organs you missed.' : 'Explore the model a little more and try again.';
    var html =
      '<h2>' + msg + '</h2>' +
      '<div class="score-big">' + score + ' / ' + Q.length + '</div>' +
      '<p class="sub">' + pct + '% correct</p>';
    if (wrong.length) {
      html += '<p><b>Questions to review</b></p><ul class="review">';
      wrong.forEach(function (q) {
        html += '<li>' + esc(q.q) + ' <br><span class="sub">Answer: ' + esc(q.options[q.answer]) + '</span></li>';
      });
      html += '</ul>';
    }
    html += '<div class="actions"><button type="button" class="btn" id="qAgain">Try again</button>' +
            '<button type="button" class="btn ghost" id="qBack">Back to 3D model</button></div>';
    body.innerHTML = html;
    document.getElementById('qAgain').onclick = start;
    document.getElementById('qBack').onclick = function () { showView('explore'); };
  }

  intro();
})();
