import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePolicy, POLICY_OUT, renderPolicies } from './policy';

describe('parsePolicy', () => {
  const md = '# Title **bold**\n\nDRAFT, not legal advice\n\n## 1. Scope\nOne line\ncontinues here.\n\n- first `code`\n- second\n1. numbered\n\n| a | b |\n|---|---|\n';
  it('turns headings, paragraphs and lists into blocks, drops the draft banner and inline marks', () => {
    expect(parsePolicy(md)).toEqual({
      title: 'Title bold',
      blocks: [{ type: 'h', text: '1. Scope' }, { type: 'p', text: 'One line continues here.' }, { type: 'li', text: 'first code' }, { type: 'li', text: 'second' }, { type: 'li', text: 'numbered' }, { type: 'p', text: 'a b' }],
      ready: true,
    });
  });
  it('is not ready while a placeholder for a person remains', () => expect(parsePolicy('# T\nOperated by TBD (human).').ready).toBe(false));
});

describe('generated policies', () => {
  it('are current (run `pnpm policy`)', () => expect(readFileSync(POLICY_OUT, 'utf8')).toBe(renderPolicies()));
  it('are not ready until the owner fills in the placeholders', () => {
    const src = renderPolicies();
    expect(src).toContain('"ready"');
  });
});
