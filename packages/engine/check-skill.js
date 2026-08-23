#!/usr/bin/env node
/* ==========================================================================
   check-skill — reads the skill markdown and fails on what must not be there,
   or on what is missing.

   Why: a skill is a contract for agent behaviour, and it rots quietly. In the
   old SKILL.md the header sent the reader to styles.css as the source of
   truth while the changelog below described a different architecture. Anyone
   reading top-down built against stale code. The regexes catch exactly that.

   Run:  node packages/engine/check-skill.js [paths…]
   With no arguments it checks the engine skill and every brand skill.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

/* Shared rules: apply to any skill in the repository. */
const COMMON = {
  forbidden: [
    [/\b20\d\d-\d\d-\d\d\b/, 'a date in the file — history lives in git, not in text'],
    [/\/Users\/[a-z]/i,      'an absolute path from someone\'s machine'],
    [/v\d+\.\d+\s+20\d\d/,   'a changelog stamped with dates']
  ],
  required: [
    [/^---\r?\n[\s\S]*?^name:/m, 'front matter with a name field'],
    [/description:/,           'a description field — this is how the skill is found']
  ]
};

const RULES = {
  'packages/engine/ENGINE_SKILL.md': {
    required: [
      [/## Router/i,                  'the scenario router agents must run first'],
      [/manifest/i,                  'a section about the manifest'],
      [/token-map|descriptor/i,      'how token sections are described'],
      [/data-pick/,                  'the data-pick requirement in examples'],
      [/http:\/\//,                  'the requirement to serve over http'],
      [/Mismatch protocol|mismatch protocol/i, 'the mismatch protocol for unknown values'],
      [/bridge is not answering|not answering/i, 'guidance when Figma access fails'],
      [/Never invent|Do not invent|do not invent/i, 'anti-hallucination rule'],
      [/var\(--/,                     'components must use custom properties'],
      [/check-sections|check-css|check-tokens/i, 'mandatory verification commands'],
      [/Forbidden|forbidden/,        'a list of prohibitions']
    ],
    forbidden: [
      [/styles\.css[^\n]{0,40}source of truth/i, 'styles.css named as the source of truth'],
      [/\bSDM\b(?![^\n]*(example|e\.g))/,        'the engine skill must not know about SDM']
    ]
  },

  'brands/*/SKILL.md': {
    required: [
      [/source of truth/i,               'an explicitly named source of truth'],
      [/tokens\.css/,                    'a link to the token file'],
      [/get_selection|Figma/,            'a block about reading the design'],
      [/bridge is not answering|not answering|no connection/i, 'the "no connection" table'],
      [/Mismatch protocol|mismatch protocol/i, 'the mismatch protocol'],
      [/three options|3 options/i,       'the requirement to offer three options'],
      [/Not in the system yet|not in the system/i, 'a list of what the system lacks'],
      [/Changelog/i,                     'changelog']
    ],
    forbidden: [
      [/styles\.css\s+(wins|is right)/i, 'styles.css declared to outrank the system'],
      /* Old tints may be mentioned — but only as a mismatch. A line without a
         negation reads as "here is the current value". */
      [/(#CDE1F4|#CBCFE7|#BCE3ED)(?![^\n]*\b(not|no longer|replaced|old|was|instead|styles\.css)\b)/i,
       'an old tint presented as current'],
      [/using (existing )?classes from `?styles\.css/i, 'sends the reader to build against styles.css']
    ]
  }
};

function rulesFor(rel) {
  for (const pattern of Object.keys(RULES)) {
    const rx = new RegExp('^' + pattern.replace(/\*/g, '[^/]+') + '$');
    if (rx.test(rel)) return RULES[pattern];
  }
  return null;
}

function check(file) {
  const rel = path.relative(ROOT, file);
  const text = fs.readFileSync(file, 'utf8');
  const own = rulesFor(rel) || {};
  const problems = [];

  /* Forbidden strings are searched per paragraph, not per line: markdown wraps
     sentences, and the caveat "this is not the current value" regularly lands
     on the line next to the value itself. The reported line number is still
     exact — hunting by eye through 150 lines is the work this check saves. */
  const lines = text.split('\n');
  const paraOf = [];              // for each line — the text of its paragraph
  let start = 0;
  lines.forEach((line, i) => {
    if (line.trim() === '' || i === lines.length - 1) {
      const para = lines.slice(start, i + 1).join(' ');
      for (let k = start; k <= i; k++) paraOf[k] = para;
      start = i + 1;
    }
  });

  [].concat(COMMON.forbidden, own.forbidden || []).forEach(([rx, why]) => {
    lines.forEach((line, i) => {
      if (!rx.test(line)) return;
      if (paraOf[i] && !rx.test(paraOf[i])) return;   // caveat nearby — not a violation
      problems.push(`${rel}:${i + 1}  ${why}\n      ${line.trim().slice(0, 90)}`);
    });
  });

  [].concat(COMMON.required, own.required || []).forEach(([rx, what]) => {
    if (!rx.test(text)) problems.push(`${rel}  missing required: ${what}`);
  });

  return problems;
}

function findSkills() {
  const out = [];
  const engine = path.join(ROOT, 'packages/engine/ENGINE_SKILL.md');
  if (fs.existsSync(engine)) out.push(engine);

  const DATA = require('./data-root.js');
  const dataRoot = DATA.dataRoot(ROOT);
  if (fs.existsSync(dataRoot)) {
    fs.readdirSync(dataRoot).forEach(b => {
      const f = path.join(dataRoot, b, 'SKILL.md');
      if (fs.existsSync(f)) out.push(f);
    });
  }

  const repoBrands = path.join(ROOT, 'brands');
  if (fs.existsSync(repoBrands)) {
    fs.readdirSync(repoBrands).forEach(b => {
      const f = path.join(repoBrands, b, 'SKILL.md');
      if (fs.existsSync(f)) out.push(f);
    });
  }
  return out;
}

const files = process.argv.length > 2
  ? process.argv.slice(2).map(f => path.resolve(f))
  : findSkills();

if (!files.length) {
  console.error('nothing to check: no skills found');
  process.exit(1);
}

let failed = 0;
files.forEach(f => {
  const problems = check(f);
  if (problems.length) {
    failed += problems.length;
    problems.forEach(p => console.log('  ✗ ' + p));
  } else {
    console.log('  ✓ ' + path.relative(ROOT, f));
  }
});

console.log(failed ? `\n${failed} violation(s)` : '\nskills are fine');
process.exit(failed ? 1 : 0);
