import assert from "node:assert/strict";
import test from "node:test";
import { parseFencedCode } from "../scripts/markdown-code.mjs";

test("a shorter nested fence remains inside its outer Markdown example", () => {
  const block = '````markdown\n```text\nprotected payload\n```\n````';
  const result = parseFencedCode('Before.\n'+block+'\nAfter.');
  assert.deepEqual(result.blocks, [block]);
  assert.equal(result.prose.includes('protected payload'), false);
  assert.equal(result.prose.includes('After.'), true);
  assert.equal(result.unclosed, false);
  assert.notDeepEqual(result.blocks, parseFencedCode(block.replace('protected payload','changed payload')).blocks);
});

test("a different fence character and text after a marker cannot close a block", () => {
  const block = '~~~text\n```\n~~~still code\npayload\n~~~~';
  assert.deepEqual(parseFencedCode(block).blocks, [block]);
});

test("duplicate code blocks remain separate occurrences", () => {
  const block = '```text\nsame payload\n```';
  assert.deepEqual(parseFencedCode(block+'\n\n'+block).blocks, [block,block]);
});

test("an unclosed block protects its remaining payload", () => {
  const result = parseFencedCode('Before.\n```text\npayload');
  assert.equal(result.unclosed,true);
  assert.deepEqual(result.blocks,['```text\npayload']);
  assert.equal(result.prose.includes('payload'),false);
});
