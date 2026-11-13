function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function matchesMemberSearch(member, query, extraFields = []) {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  const text = normalizeText([
    member.nombre,
    member.numero_documento,
    member.email,
    ...extraFields,
  ].filter(Boolean).join(' '));
  return terms.every((term) => text.includes(term));
}
