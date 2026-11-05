/* JSON Desk website — small, dependency-free behaviour */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Header gets a hairline once the page scrolls. */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Highlight the current section in a sticky list (feature directory or page contents). */
  function trackSections(navSelector) {
    var nav = document.querySelector(navSelector);
    if (!nav || !('IntersectionObserver' in window)) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    var byId = {};
    var targets = [];
    links.forEach(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) { byId[el.id] = a; targets.push(el); }
    });
    if (!targets.length) return;
    var visible = {};
    var setActive = function (id) {
      links.forEach(function (a) { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
      if (byId[id]) { byId[id].classList.add('is-active'); byId[id].setAttribute('aria-current', 'true'); }
    };
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      for (var i = 0; i < targets.length; i++) {
        if (visible[targets[i].id]) { setActive(targets[i].id); return; }
      }
    }, { rootMargin: '-20% 0px -65% 0px' });
    targets.forEach(function (t) { observer.observe(t); });
  }
  trackSections('.dir-nav');
  trackSections('.toc');

  /* Open the matching FAQ answer when a link points at it. */
  function openFromHash() {
    if (!location.hash) return;
    var el = document.getElementById(location.hash.slice(1));
    if (el && el.tagName === 'DETAILS') el.open = true;
  }
  openFromHash();
  window.addEventListener('hashchange', openFromHash);

  /* ---------- Converter demo on the home page ---------- */

  var out = document.getElementById('demo-output');
  if (!out) return;

  var samples = {
    swift: [
      'struct Root: Codable {',
      '    let id: Int',
      '    let name: String',
      '    let email: String',
      '    let verified: Bool',
      '    let plan: Plan',
      '    let tags: [String]',
      '}',
      '',
      'struct Plan: Codable {',
      '    let tier: String',
      '    let seats: Int',
      '}'
    ],
    kotlin: [
      'data class Root(',
      '    val id: Int,',
      '    val name: String,',
      '    val email: String,',
      '    val verified: Boolean,',
      '    val plan: Plan,',
      '    val tags: List<String>',
      ')',
      '',
      'data class Plan(',
      '    val tier: String,',
      '    val seats: Int',
      ')'
    ],
    typescript: [
      'interface Root {',
      '  id: number;',
      '  name: string;',
      '  email: string;',
      '  verified: boolean;',
      '  plan: Plan;',
      '  tags: string[];',
      '}',
      '',
      'interface Plan {',
      '  tier: string;',
      '  seats: number;',
      '}'
    ],
    go: [
      'type Root struct {',
      '    ID       int      `json:"id"`',
      '    Name     string   `json:"name"`',
      '    Email    string   `json:"email"`',
      '    Verified bool     `json:"verified"`',
      '    Plan     Plan     `json:"plan"`',
      '    Tags     []string `json:"tags"`',
      '}',
      '',
      'type Plan struct {',
      '    Tier  string `json:"tier"`',
      '    Seats int    `json:"seats"`',
      '}'
    ],
    python: [
      'from dataclasses import dataclass',
      '',
      '@dataclass',
      'class Plan:',
      '    tier: str',
      '    seats: int',
      '',
      '@dataclass',
      'class Root:',
      '    id: int',
      '    name: str',
      '    email: str',
      '    verified: bool',
      '    plan: Plan',
      '    tags: list[str]'
    ],
    yaml: [
      'id: 1042',
      'name: Meera Joshi',
      'email: meera@example.com',
      'verified: true',
      'plan:',
      '  tier: pro',
      '  seats: 5',
      'tags:',
      '  - design',
      '  - api'
    ],
    xml: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<root>',
      '  <id>1042</id>',
      '  <name>Meera Joshi</name>',
      '  <email>meera@example.com</email>',
      '  <verified>true</verified>',
      '  <plan>',
      '    <tier>pro</tier>',
      '    <seats>5</seats>',
      '  </plan>',
      '  <tags>',
      '    <item>design</item>',
      '    <item>api</item>',
      '  </tags>',
      '</root>'
    ],
    toml: [
      'id = 1042',
      'name = "Meera Joshi"',
      'email = "meera@example.com"',
      'verified = true',
      'tags = ["design", "api"]',
      '',
      '[plan]',
      'tier = "pro"',
      'seats = 5'
    ]
  };

  var keywords = {
    swift: 'struct|let|var|class|enum',
    kotlin: 'data|class|val|var',
    typescript: 'interface|type|export',
    go: 'type|struct',
    python: 'from|import|class',
    yaml: 'true|false|null',
    xml: '',
    toml: 'true|false'
  };
  var builtins = {
    swift: 'Codable|Int|String|Bool|Double',
    kotlin: 'Int|String|Boolean|List|Double',
    typescript: 'number|string|boolean',
    go: 'int|string|bool|float64',
    python: 'int|str|bool|list|float|dataclass',
    yaml: '', xml: '', toml: ''
  };

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function wrap(cls, s) { return '<span class="' + cls + '">' + esc(s) + '</span>'; }

  function highlightLine(lang, line) {
    if (lang === 'xml') {
      return line.replace(/(<\??\/?)([\w:-]+)([^>]*?)(\??>)|([^<]+)/g, function (m, open, tag, attrs, close, text) {
        if (text !== undefined) return esc(text);
        var a = attrs.replace(/([\w:-]+)(=)("[^"]*")/g, '\u0001$1\u0002$2\u0003$3\u0004');
        a = esc(a).replace(/\u0001(.*?)\u0002(.*?)\u0003(.*?)\u0004/g, '<span class="t-key">$1</span>$2<span class="t-str">$3</span>');
        return esc(open) + wrap('t-kw', tag) + a + esc(close);
      });
    }
    if (lang === 'yaml') {
      var m = line.match(/^(\s*-?\s*)([\w-]+)(:)(.*)$/);
      if (m) return esc(m[1]) + wrap('t-key', m[2]) + esc(m[3]) + yamlValue(m[4]);
      var li = line.match(/^(\s*-\s*)(.*)$/);
      if (li) return esc(li[1]) + yamlValue(li[2]);
      return esc(line);
    }
    if (lang === 'toml') {
      if (/^\s*\[.*\]\s*$/.test(line)) return wrap('t-type', line);
      var t = line.match(/^(\s*)([\w-]+)(\s*=\s*)(.*)$/);
      if (t) return esc(t[1]) + wrap('t-key', t[2]) + esc(t[3]) + generic('toml', t[4]);
      return esc(line);
    }
    return generic(lang, line);
  }

  function yamlValue(v) {
    if (!v) return '';
    var lead = v.match(/^\s*/)[0], body = v.slice(lead.length);
    if (/^-?\d+(\.\d+)?$/.test(body)) return esc(lead) + wrap('t-num', body);
    if (/^(true|false|null)$/.test(body)) return esc(lead) + wrap('t-kw', body);
    return esc(lead) + wrap('t-str', body);
  }

  function generic(lang, line) {
    var kw = keywords[lang], bi = builtins[lang];
    var parts = [
      '(\\/\\/.*$|#.*$)',
      '("(?:\\\\.|[^"\\\\])*"|`[^`]*`)',
      '(@\\w+)',
      kw ? '\\b(' + kw + ')\\b' : '(?!)',
      bi ? '\\b(' + bi + ')\\b' : '(?!)',
      '\\b([A-Z][A-Za-z0-9]*)\\b',
      '\\b(\\d+(?:\\.\\d+)?)\\b'
    ];
    var re = new RegExp(parts.join('|'), 'g');
    var html = '', last = 0, m;
    while ((m = re.exec(line))) {
      html += esc(line.slice(last, m.index));
      if (m[1]) html += lang === 'python' || lang === 'toml' || m[1].indexOf('//') === 0 ? wrap('t-com', m[1]) : esc(m[1]);
      else if (m[2]) html += wrap('t-str', m[2]);
      else if (m[3]) html += wrap('t-kw', m[3]);
      else if (m[4]) html += wrap('t-kw', m[4]);
      else if (m[5]) html += wrap('t-type', m[5]);
      else if (m[6]) html += wrap('t-type', m[6]);
      else if (m[7]) html += wrap('t-num', m[7]);
      last = re.lastIndex;
      if (m[0] === '') re.lastIndex++;
    }
    return html + esc(line.slice(last));
  }

  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-lang]'));
  var label = document.getElementById('demo-target');
  var lines = document.getElementById('demo-lines');

  function render(lang, animate) {
    var src = samples[lang];
    out.classList.remove('reveal');
    out.innerHTML = src.map(function (l, i) {
      var d = animate ? ' style="animation-delay:' + (i * 28) + 'ms"' : '';
      return '<span class="ln"' + d + '>' + highlightLine(lang, l) + '</span>';
    }).join('');
    if (animate && !reduceMotion) { void out.offsetWidth; out.classList.add('reveal'); }
    tabs.forEach(function (b) {
      var on = b.getAttribute('data-lang') === lang;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    var active = tabs.filter(function (b) { return b.getAttribute('data-lang') === lang; })[0];
    if (label && active) label.textContent = active.textContent;
    if (lines) lines.textContent = src.length + ' lines';
  }

  tabs.forEach(function (b, i) {
    b.addEventListener('click', function () { render(b.getAttribute('data-lang'), true); });
    b.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var next = tabs[(i + d + tabs.length) % tabs.length];
      next.focus(); next.click();
    });
  });

  /* Highlight static JSON blocks (the input pane, the API response). */
  Array.prototype.forEach.call(document.querySelectorAll('pre[data-json]'), function (input) {
    input.innerHTML = input.textContent.replace(/^\n|\n\s*$/g, '').split('\n').map(function (l) {
      var h = l.replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)/g, function (m, s, colon, lit, num) {
        if (s) return colon ? '\u0001k' + s + '\u0002' + colon : '\u0001s' + s + '\u0002';
        if (lit) return '\u0001w' + lit + '\u0002';
        return '\u0001n' + num + '\u0002';
      });
      h = esc(h).replace(/\u0001([kswn])(.*?)\u0002/g, function (m, t, v) {
        return '<span class="' + ({ k: 't-key', s: 't-str', w: 't-kw', n: 't-num' })[t] + '">' + v + '</span>';
      });
      return '<span class="ln">' + h + '</span>';
    }).join('');
  });

  render('swift', true);
})();
