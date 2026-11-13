import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { matchesMemberSearch } from './memberSearch.js';

const member = {
  nombre: 'Ana María Gómez',
  numero_documento: '0012345678',
  email: 'ana@example.com',
  plan: 'Mensual',
  telefono: '3001234567',
};

test('matches names without accents, case or exact word order', () => {
  assert.equal(matchesMemberSearch(member, 'GOMEZ ana'), true);
  assert.equal(matchesMemberSearch(member, 'maria gom'), true);
  assert.equal(matchesMemberSearch(member, 'ana carlos'), false);
});

test('matches document and email without losing leading zeros', () => {
  assert.equal(matchesMemberSearch(member, '001234'), true);
  assert.equal(matchesMemberSearch(member, 'EXAMPLE.COM'), true);
  assert.equal(matchesMemberSearch(member, '009999'), false);
});

test('preserves extra directory fields and handles empty data', () => {
  assert.equal(matchesMemberSearch(member, 'mensual', [member.plan, member.telefono]), true);
  assert.equal(matchesMemberSearch(member, '300123', [member.plan, member.telefono]), true);
  assert.equal(matchesMemberSearch({}, '   '), true);
  assert.equal(matchesMemberSearch({}, 'ana'), false);
});
