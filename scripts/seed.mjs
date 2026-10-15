#!/usr/bin/env node
// Seeds demo data through the API so the UI has something to show on first run.
//
//   ADMIN_EMAIL=you@example.com node scripts/seed.mjs
//
// Requires the app running with GOOGLE_DEV_MODE=true and ADMIN_EMAILS containing ADMIN_EMAIL.
// All books and questions are SAMPLE content for demonstration, not real regulations.
// Safe to re-run: it stops if the sample exam already exists.

const API = process.env.API_URL || 'http://localhost:8080';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
if (!ADMIN_EMAIL) {
  console.error('Set ADMIN_EMAIL to an address listed in ADMIN_EMAILS on the app.');
  process.exit(1);
}

let token;
async function call(path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${data?.message || text}`);
  return data;
}

const csv = (rows) => ['Question,Option A,Option B,Option C,Option D,Correct Answer,Explanation,Paragraph Citation',
  ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');

const TOPICS = [
  { paper: 0, title: 'Introduction and General Principles (Sample)', tier: 1, weightage: 20,
    book: '# Introduction and General Principles\n\n*Sample content for demonstration only.*\n\n## 1.1 Scope\n\nThese rules apply to all personnel of the department unless an exemption is expressly granted in writing by the competent authority.\n\n## 1.2 Definitions\n\nA **competent authority** is the officer empowered to sanction the matter in question. A **subordinate** is any person whose work is supervised by another officer.\n\n## 1.3 Delegation\n\nPowers may be delegated only in writing, and the delegating authority remains **accountable** for their exercise.',
    mcqs: [
      ['Who is a competent authority under the sample rules?', 'Any senior clerk', 'The officer empowered to sanction the matter', 'The head of another department', 'A retired officer', 'B', 'The competent authority is defined as the officer empowered to sanction the matter.', 'Sample Handbook 1.2'],
      ['Powers may be delegated:', 'Orally', 'Only in writing', 'Without any record', 'Only to retired staff', 'B', 'Delegation must be in writing.', 'Sample Handbook 1.3'],
      ['After delegating a power, the delegating authority:', 'Loses all accountability', 'Remains accountable', 'Must resign', 'Is exempt from audit', 'B', 'Accountability stays with the delegating authority.', 'Sample Handbook 1.3'],
      ['The sample rules apply to:', 'Contractors only', 'All departmental personnel unless exempted in writing', 'Only the head office', 'Only temporary staff', 'B', 'Scope covers all personnel unless an exemption is granted in writing.', 'Sample Handbook 1.1'],
      ['A subordinate is a person who:', 'Is supervised by another officer', 'Supervises the department', 'Is a member of the public', 'Has retired', 'A', 'A subordinate works under the supervision of another officer.', 'Sample Handbook 1.2'],
    ] },
  { paper: 0, title: 'Maintenance of Records (Sample)', tier: 1, weightage: 15,
    book: '# Maintenance of Records\n\n*Sample content for demonstration only.*\n\n## 2.1 Registers\n\nEvery office shall maintain a register of incoming and outgoing correspondence. Entries must be made on the **same day** of receipt or dispatch.\n\n## 2.2 Retention\n\nFinancial records are retained for a minimum of **seven years** before they may be weeded out.',
    mcqs: [
      ['Entries in the correspondence register must be made:', 'Within a month', 'On the same day', 'At year end', 'Only on request', 'B', 'Entries are made the same day of receipt or dispatch.', 'Sample Handbook 2.1'],
      ['Minimum retention period for financial records:', 'One year', 'Three years', 'Seven years', 'Twenty years', 'C', 'Financial records are kept at least seven years.', 'Sample Handbook 2.2'],
      ['Which register is mandatory in every office?', 'Incoming and outgoing correspondence', 'Visitors to the canteen', 'Vehicle servicing only', 'None', 'A', 'Every office maintains a correspondence register.', 'Sample Handbook 2.1'],
      ['Records may be weeded out:', 'Immediately', 'After the minimum retention period', 'Never', 'Only by contractors', 'B', 'Weeding is allowed only after retention ends.', 'Sample Handbook 2.2'],
      ['Dispatch entries are made:', 'On the day of dispatch', 'A week later', 'Quarterly', 'Annually', 'A', 'Same day entries are required.', 'Sample Handbook 2.1'],
    ] },
  { paper: 1, title: 'Leave and Attendance (Sample)', tier: 2, weightage: 25,
    book: '# Leave and Attendance\n\n*Sample content for demonstration only.*\n\n## 3.1 Casual leave\n\nCasual leave of up to **eight days** may be taken in a calendar year and is not combined with other leave without sanction.\n\n## 3.2 Earned leave\n\nEarned leave accrues at the rate of **thirty days per year** of service, subject to a ceiling.',
    mcqs: [
      ['Casual leave allowed in a calendar year (sample rule):', 'Two days', 'Eight days', 'Thirty days', 'Unlimited', 'B', 'The sample rule allows up to eight days.', 'Sample Handbook 3.1'],
      ['Earned leave accrues at:', 'Thirty days per year of service', 'One day per year', 'No fixed rate', 'Ten days per month', 'A', 'Accrual is thirty days per year, subject to a ceiling.', 'Sample Handbook 3.2'],
      ['Casual leave combined with other leave needs:', 'Nothing', 'Sanction', 'A medical certificate always', 'Court order', 'B', 'Combination requires sanction.', 'Sample Handbook 3.1'],
      ['Earned leave is subject to:', 'A ceiling', 'No limits at all', 'Annual forfeiture', 'Lottery', 'A', 'The accrual has a ceiling.', 'Sample Handbook 3.2'],
      ['Casual leave is counted per:', 'Calendar year', 'Decade', 'Career', 'Quarter-century', 'A', 'It is a calendar year entitlement.', 'Sample Handbook 3.1'],
    ] },
  { paper: 1, title: 'Disciplinary Procedure: Case Studies (Sample)', tier: 3, weightage: 40,
    book: '# Disciplinary Procedure: Case Studies\n\n*Sample content for demonstration only.*\n\n## 4.1 Natural justice\n\nNo penalty is imposed without giving the employee a **reasonable opportunity** to be heard.\n\n## 4.2 Show-cause notice\n\nA show-cause notice must state the allegation and allow a stated period for reply.',
    mcqs: [
      ['Before a penalty is imposed the employee must be given:', 'A reasonable opportunity to be heard', 'A promotion', 'Nothing', 'A transfer', 'A', 'Natural justice requires a hearing.', 'Sample Handbook 4.1'],
      ['A show-cause notice must:', 'State the allegation and a reply period', 'Be oral', 'Omit the allegation', 'Be anonymous', 'A', 'It must state the allegation and allow time to reply.', 'Sample Handbook 4.2'],
      ['Which principle bars a penalty without hearing?', 'Natural justice', 'Seniority', 'Rotation', 'Budgeting', 'A', 'Natural justice.', 'Sample Handbook 4.1'],
      ['The reply period in a show-cause notice is:', 'Stated in the notice', 'Always zero', 'Decided later secretly', 'Not allowed', 'A', 'The notice states the period.', 'Sample Handbook 4.2'],
      ['Penalty without a hearing is:', 'Contrary to natural justice', 'Preferred', 'Mandatory', 'Customary', 'A', 'It violates natural justice.', 'Sample Handbook 4.1'],
    ] },
];

const DICTIONARY = [
  { word: 'competent authority', definition: 'The officer empowered to sanction or decide a given matter.', translation: 'सक्षम प्राधिकारी', legalContext: 'Used throughout delegation and sanction rules.' },
  { word: 'subordinate', definition: 'A person whose work is supervised by another officer.', translation: 'अधीनस्थ', legalContext: 'Relevant to disciplinary jurisdiction.' },
  { word: 'delegation', definition: 'Handing a power to another officer while retaining accountability.', translation: 'प्रत्यायोजन', legalContext: 'Must be in writing.' },
  { word: 'accountable', definition: 'Answerable for the exercise of a power or duty.', translation: 'जवाबदेह', legalContext: '' },
  { word: 'weeding out', definition: 'Destroying records after their retention period has ended.', translation: 'अभिलेख छंटाई', legalContext: 'Allowed only after the minimum retention period.' },
  { word: 'show-cause notice', definition: 'A notice asking a person to explain why action should not be taken.', translation: 'कारण बताओ नोटिस', legalContext: 'First step in disciplinary procedure.' },
];

async function main() {
  const login = await call('/api/auth/login', 'POST', { idToken: `dev:${ADMIN_EMAIL}|Demo Admin` });
  token = login.token;

  const exams = await call('/api/exams');
  if (exams.some((e) => e.name === 'SAS (Sample)')) {
    console.log('Sample data already present, nothing to do.');
    return;
  }

  const exam = await call('/api/admin/exams', 'POST', { name: 'SAS (Sample)' });
  const papers = [];
  for (const [i, name] of ['Paper I: Financial Rules', 'Paper II: Service Regulations'].entries()) {
    papers.push(await call('/api/admin/papers', 'POST', { examId: exam.id, name, sortOrder: i + 1 }));
  }
  for (const t of TOPICS) {
    const topic = await call('/api/admin/topics', 'POST',
      { paperId: papers[t.paper].id, title: t.title, tier: t.tier, weightage: t.weightage, chapterTitles: [] });
    await call(`/api/admin/topics/${topic.id}/book`, 'PUT', { text: t.book });
    const r = await call(`/api/admin/topics/${topic.id}/mcqs?mode=ADD`, 'POST', { text: csv(t.mcqs) });
    console.log(`Topic "${t.title}": ${r.added} questions${r.errors.length ? `, ${r.errors.length} errors` : ''}`);
  }
  const d = await call('/api/admin/dictionary', 'POST', DICTIONARY);
  console.log(`Dictionary: ${d.added} words`);

  await call('/api/admin/payment-config', 'PUT', {
    upiId: 'demo@upi', accountName: 'RegExam Demo', supportEmail: 'support@example.com', whatsappNumber: '919999999999' });
  await call('/api/admin/plans', 'POST', { name: 'Part I Access - 90 Days', examId: exam.id, priceInr: 999, durationDays: 90,
    features: ['Full rulebook access', 'Unlimited practice MCQs', 'Timed mock tests'], active: true });
  await call('/api/admin/plans', 'POST', { name: 'Part II Access - 180 Days', examId: exam.id, priceInr: 1799, durationDays: 180,
    features: ['Everything in Part I', 'Tier qualifying exams', 'Priority support'], active: true });
  await call('/api/admin/tier-policy', 'PUT', { coverageRequiredPct: 80, qualifyingScorePct: 50, cooldownHours: 48,
    tier2UnlockDate: null, tier3UnlockDate: null, universalOverride: false });

  for (let i = 0; i < 3; i++) {
    const c = await call('/api/admin/invites', 'POST');
    console.log(`Invite code: ${c.code}`);
  }
  console.log('Seed complete. Use an invite code to register a student, then approve their payment as admin.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
