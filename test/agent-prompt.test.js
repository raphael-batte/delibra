'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const PROMPT = require(path.join(__dirname, '../packages/engine/agent-prompt.js'));

describe('agent-prompt', function () {
  it('workspace prompt names delibra repository', function () {
    const text = PROMPT.buildWorkspacePrompt({ root: '/Users/me/Work/delibra' });
    assert.match(text, /Repository delibra/);
    assert.match(text, /DeLibra/);
    assert.match(text, /ENGINE_SKILL\.md/);
  });

  it('fill prompt points at brand folder and skill router', function () {
    const text = PROMPT.buildFillPrompt({
      brandPath: 'brands/sdm',
      skillPath: 'packages/engine/ENGINE_SKILL.md',
      galleryUrl: 'http://localhost:8777/sdm'
    });
    assert.match(text, /brands\/sdm/);
    assert.match(text, /## Router/);
    assert.match(text, /localhost:8777\/sdm/);
  });
});
