const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../engine.js');
const run = (header, ...rows) => A.analyse([header, ...rows].join('\n'));
const check = (p, name) => p.checks.checks.find(c => c.name === name);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('explicit USD wins over Anthropic-shaped metadata', () => {
  near(run('model,cost_usd,cost_type,token_type', 'claude-sonnet-5,100,tokens,input').reported, 100);
});
test('explicit cents are converted once', () => near(run('model,cost_cents', 'claude-sonnet-5,100').reported, 1));
test('Anthropic amount with documented cost/token columns is cents', () => {
  near(run('model,amount,cost_type,token_type', 'claude-sonnet-5,100,tokens,input').reported, 1);
});
test('ambiguous units can be changed without mutating input', () => {
  const s='model,cost\ngpt-6-sol,100';
  near(A.analyse(s).reported,100); near(A.analyse(s,{unit:'cents'}).reported,1);
});
test('unknown model with a reported cost keeps the amount', () => near(run('model,cost_usd','unlisted,10').reported,10));
test('unknown model is never assigned a token price', () => {
  const p=run('model,input_tokens,output_tokens','unlisted,1000000,0');
  assert.equal(p.error,'all-unpriced'); assert.equal(p.total,0);
});
test('missing batch data is unavailable', () => assert.equal(check(run('model,cost_usd','gpt-6-sol,100'),'Batch share').status,'not_available'));
test('missing cache tokens are unavailable', () => assert.equal(check(run('model,input_tokens,output_tokens,cost_usd','gpt-6-sol,1000000,0,100'),'Cache share').status,'not_available'));
test('input-only cost description is not evidence of zero cache', () => {
  const p=run('model,description,cost_usd','gpt-6-sol,Input Tokens,100');
  assert.equal(check(p,'Cache share').status,'not_available'); assert.equal(p.cacheShare,undefined);
});
for (const [model,amount] of [['claude-opus-5-5',.2],['claude-fable-5-1',.25],['claude-sonnet-5',.2]]) {
  test(`cache read uses the ${model} rate`,()=>near(run('model,input_tokens,cache_read_input_tokens,output_tokens',`${model},0,1000000,0`).estimated,amount));
}
test('one-hour cache write uses the one-hour rate',()=>near(run('model,input_tokens,cache_creation_1h_input_tokens,output_tokens','claude-sonnet-5,0,1000000,0').estimated,4));
test('cache aggregate is not added to its breakdown',()=>near(run('model,input_tokens,cache_creation_input_tokens,cache_creation_5m_input_tokens,cache_creation_1h_input_tokens,output_tokens','claude-sonnet-5,0,3000000,1000000,2000000,0').estimated,10.5));
test('OpenAI input includes cache reads',()=>near(run('model,input_tokens,input_cached_tokens,output_tokens','gpt-6-sol,1000000,500000,0').estimated,1.1));
test('Anthropic input excludes cache reads',()=>near(run('model,input_tokens,cache_read_input_tokens,output_tokens','claude-sonnet-5,1000000,500000,0').estimated,2.1));
test('batch discount applies to token estimates',()=>near(run('model,service_tier,input_tokens,output_tokens','gpt-6-sol,batch,1000000,0').estimated,1));
test('OpenAI explicit cache writes use their own price',()=>near(run('model,input_tokens,input_cache_write_tokens,output_tokens','gpt-5.6-sol,1000000,1000000,0').estimated,5));
test('reported and estimated cost stay separate',()=>{
  const p=run('model,cost_usd,input_tokens,output_tokens','gpt-6-sol,100,,','gpt-6-sol,,1000000,0');
  near(p.reported,100);near(p.estimated,2);
});
for (const value of ['-1','NaN','Infinity','broken','1.5']) {
  test(`invalid tokens ${value} never become a valid estimate`,()=>{
    const p=run('model,input_tokens,output_tokens',`claude-sonnet-5,1000000,${value}`);
    assert.equal(p.counts.invalid,1); assert.equal(p.counts.used,0); assert.equal(p.total,0);
  });
}
test('invalid tokens preserve explicit cost but disable token-derived checks',()=>{
  const p=run('model,cost_usd,input_tokens,cache_read_input_tokens,output_tokens','claude-sonnet-5,100,-10,5,0');
  near(p.reported,100);assert.equal(p.counts.invalidTokens,1);assert.equal(check(p,'Cache share').status,'not_available');
});
test('cached tokens cannot exceed inclusive input',()=>{
  const p=run('model,input_tokens,input_cached_tokens,output_tokens','gpt-6-sol,100,200,0');
  assert.equal(p.counts.invalid,1);assert.equal(p.counts.used,0);
});
test('missing output is not a complete cost estimate',()=>{
  const p=run('model,input_tokens','gpt-6-sol,1000000');
  assert.equal(p.counts.unpriced,1);assert.equal(p.counts.used,0);
});
test('malformed reported cost does not silently become an estimate',()=>{
  const p=run('model,cost_usd,input_tokens,output_tokens','gpt-6-sol,broken,1000000,0');
  assert.equal(p.counts.invalid,1);assert.equal(p.counts.estimated,0);
});
for (const tier of ['experimental','scale','priority','fast']) {
  test(`explicit ${tier} tier is never priced as standard`,()=>{
    const p=run('model,service_tier,input_tokens,output_tokens',`gpt-6-sol,${tier},1000000,0`);
    assert.equal(p.counts.unpriced,1);assert.equal(p.counts.used,0);
  });
}
test('partial coverage is partial even above 95 percent',()=>{
  const p=run('model,service_tier,cost_usd','gpt-6-sol,standard,97','unknown,,3');
  assert.equal(check(p,'Model price scenarios').status,'partially_checked');
  assert.equal(check(p,'Batch share').status,'partially_checked');
  assert.match(check(p,'Batch share').detail,/97%/);
});
test('cost-based cache estimate needs both input and cache lines per model',()=>{
  const p=run('model,description,cost_usd','gpt-6-sol,Input Tokens,2','gpt-6-sol,Cached Input Tokens,0.2','claude-sonnet-5,Input Tokens,2');
  near(p.cacheShare,.5); assert.equal(check(p,'Cache share').status,'partially_checked');
  assert.match(check(p,'Cache share').detail,/estimated/i);
});
test('cache write description is classified before generic cache match',()=>{
  const p=run('model,token_type,cost_usd','claude-sonnet-5,cache_creation_input_tokens,2.5');
  assert.equal(p.items[0].kind,'cw');
});
for(const date of ['2026-02-30','02/30/2026','2026-13-01','2026-02-30T12:00:00Z','2026-02-29']) {
  test(`invalid calendar date ${date} is rejected`,()=>assert.equal(A.toDay(date),''));
}
test('valid leap day and timezone timestamps work',()=>{
  assert.equal(A.toDay('2024-02-29'),'2024-02-29');assert.equal(A.toDay('2026-09-01T23:00:00-05:00'),'2026-09-02');
});
test('invalid dates retain costs without invented daily buckets',()=>{
  const p=run('date,model,cost_usd','2026-02-30,gpt-6-sol,100');
  near(p.reported,100);assert.equal(p.days.length,0);assert.equal(p.counts.badDate,1);
});
test('BOM, semicolon, decimal comma and CRLF parse',()=>near(A.analyse('\ufeffmodel;cost_usd\r\ngpt-6-sol;12,34\r\n').reported,12.34));
test('quoted model labels and escaped quotes parse',()=>{
  const p=A.parseCSV('model,cost_usd\n"a, ""model""",12');assert.equal(p.rows[1][0],'a, "model"');
});
test('unclosed CSV quote is an explicit error',()=>assert.equal(A.analyse('model,cost_usd\n"gpt-6-sol,100').error,'malformed-csv'));
test('wrong column count is reported and excluded',()=>{
  const p=run('model,cost_usd','gpt-6-sol,100,unexpected','gpt-6-sol,20');near(p.reported,20);assert.equal(p.counts.invalid,1);
});
test('credits, other currencies and Total rows remain separate',()=>{
  const p=run('model,cost_usd,currency','gpt-6-sol,100,USD','gpt-6-sol,-10,USD','gpt-6-sol,20,EUR','Total,110,USD');
  near(p.reported,100);near(p.credits,-10);assert.equal(p.counts.currency,1);assert.equal(p.counts.total,1);
});
test('zero cost is a valid report',()=>{
  const p=run('model,cost_usd','gpt-6-sol,0');assert.equal(p.error,undefined);assert.equal(p.counts.zero,1);
});
test('prototype-like and HTML model names are plain data',()=>{
  const p=run('model,cost_usd','__proto__,10','<img src=x onerror=alert(1)>,20');near(p.reported,30);assert.equal(p.items.length,2);
});
test('small cost keeps cents',()=>assert.equal(A.fmt(.2),'$0.20'));
test('demo is deterministic and contains a spend spike',()=>{
  assert.equal(A.demoCSV(),A.demoCSV());const p=A.analyse(A.demoCSV());assert.equal(p.counts.used,93);assert.ok(p.checks.findings.some(x=>x.type==='spike'));
});
test('model migration is a scenario without confirmed overpayment',()=>{
  const p=run('model,cost_usd','claude-opus-4-1,150');assert.equal(p.checks.scenarios.length,1);
  assert.doesNotMatch(JSON.stringify(p.checks),/confirmed|extra paid|per year/i);
});
