import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import worker, {submit, reconcile, verifyTurnstile, CONSENT_VERSION} from '../index.ts';
import {jpegDimensions, stripJpegMetadata, boundedBody, MAX_IMAGE_BYTES} from '../image.ts';

const origin = 'https://aponte-live-api.pontelusocan.workers.dev';
const validVerify = async () => Response.json({success:true,hostname:new URL(origin).hostname,action:'live_submission'});
const input = await sharp({create:{width:2500,height:1400,channels:3,background:'#990022'}}).jpeg().withMetadata({exif:{IFD0:{Artist:'PRIVATE-GPS-TEST'}}}).toBuffer();

function setup() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_submissions.sql', import.meta.url),'utf8'));
  sql.exec(readFileSync(new URL('../migrations/0002_members.sql', import.meta.url),'utf8'));
  sql.exec(readFileSync(new URL('../migrations/0003_member_age_confirmation.sql', import.meta.url),'utf8'));
  sql.exec('CREATE TABLE photo_reviews(submission_id TEXT PRIMARY KEY, decision TEXT NOT NULL)');
  const objects = new Map();
  const state = {failComplete:false,failPut:false,failDelete:false,transformations:0};
  const env = {
    DB:{async batch(statements) {
      sql.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sql.exec('COMMIT'); return results; }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },prepare(query){let values=[];return {
      bind(...v){values=v;return this;},
      async first(){return sql.prepare(query).get(...values)??null;},
      async all(){return {results:sql.prepare(query).all(...values)};},
      async run(){if(state.failComplete&&query.includes("SET processing_state='ready'"))throw Error('D1 unavailable');return {meta:sql.prepare(query).run(...values)};},
    };}},
    PHOTOS:{
      async get(key){ const object = objects.get(key); return object && {body: new Response(object.bytes).body}; },
      async put(key,bytes,options){if(state.failPut)throw Error('R2 unavailable');if(!objects.has(key))objects.set(key,{bytes,customMetadata:options.customMetadata,size:bytes.length});},
      async head(key){return objects.get(key)??null;},
      async delete(key){if(state.failDelete)throw Error('delete unavailable');objects.delete(key);},
    },
    IMAGES:{input(stream){return {transform(options){return {async output(){state.transformations++;const bytes=await new Response(stream).arrayBuffer();const result=await sharp(Buffer.from(bytes)).rotate().resize({width:options.width,height:options.height,fit:'inside',withoutEnlargement:true}).jpeg().toBuffer();return {response(){return new Response(result);}};}};}};}},
    UPLOAD_LIMITER:{async limit(){return {success:true};}},
    ASSETS:{async fetch(){return new Response('static');}},
    ALLOWED_ORIGINS:origin,TURNSTILE_SECRET:'unit-test-secret',UPLOADS_ENABLED:'true',
  };
  return {env,sql,objects,state};
}
function request(id=crypto.randomUUID(), overrides={}) {
  const form = new FormData();
  const fields={name:'Test Participant',description:'Private test',language:'EN',processingConsent:'true',publicationConsent:'false',consentVersion:CONSENT_VERSION,turnstileToken:'valid',...overrides};
  for(const [k,v]of Object.entries(fields))if(v!==null)form.append(k,v);
  form.append('photo',new File([input],'test.jpg',{type:'image/jpeg'}));
  return new Request(origin+'/api/submissions',{method:'POST',headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.1','Idempotency-Key':id},body:form});
}
const rejectsCode=(promise,code)=>assert.rejects(promise,e=>e.code===code);

test('valid upload stores resized, metadata-free JPEG and consent record before confirming',async()=>{
  const {env,sql,objects}=setup();const id=crypto.randomUUID();const response=await submit(request(id),env,origin,validVerify);
  assert.equal(response.status,201);assert.deepEqual(await response.json(),{id,status:'pending'});
  const row=sql.prepare('SELECT * FROM submissions').get();assert.equal(Date.parse(row.expires_at)-Date.parse(row.created_at),90*86400_000);assert.equal(row.processing_state,'ready');assert.equal(row.status,'pending');assert.equal(row.processing_consent,1);assert.equal(row.publication_consent,0);assert.equal(row.consent_version,CONSENT_VERSION);assert.equal(row.environment,'staging');assert.equal(row.country,'');assert.ok(row.consent_at);assert.equal(row.privacy_reference,'/live/privacy/');
  assert.equal(objects.size,1);const saved=objects.get(row.object_key);const metadata=await sharp(saved.bytes).metadata();assert.equal(metadata.width,2048);assert.ok(metadata.height<=2048);assert.equal(metadata.exif,undefined);assert.equal(metadata.xmp,undefined);assert.equal(metadata.icc,undefined);assert.equal(Buffer.from(saved.bytes).includes(Buffer.from('PRIVATE-GPS-TEST')),false);
  assert.equal('latitude'in row,false);assert.equal('email'in row,false);
});
test('duplicate retry returns same id without a second object or transform',async()=>{
  const {env,sql,objects,state}=setup();const id=crypto.randomUUID();await submit(request(id),env,origin,validVerify);const response=await submit(request(id),env,origin,validVerify);assert.equal(response.status,200);assert.equal(objects.size,1);assert.equal(state.transformations,1);assert.equal(sql.prepare('SELECT count(*) AS n FROM submissions').get().n,1);
});
test('same id with different content is rejected',async()=>{const {env}=setup();const id=crypto.randomUUID();await submit(request(id),env,origin,validVerify);await rejectsCode(submit(request(id,{name:'Other'}),env,origin,validVerify),'idempotency_conflict');});
test('concurrent same-id requests cannot create multiple objects',async()=>{const {env,objects,sql}=setup();const id=crypto.randomUUID();const results=await Promise.allSettled([submit(request(id),env,origin,validVerify),submit(request(id),env,origin,validVerify)]);assert.ok(results.some(r=>r.status==='fulfilled'));assert.equal(objects.size,1);assert.equal(sql.prepare('SELECT count(*) AS n FROM submissions').get().n,1);});
test('processing consent and current wording version are enforced',async()=>{for(const fields of [{processingConsent:'false'},{consentVersion:'old'}]){const {env,objects,sql}=setup();await rejectsCode(submit(request(undefined,fields),env,origin,validVerify),'consent_required');assert.equal(objects.size,0);assert.equal(sql.prepare('SELECT count(*) AS n FROM submissions').get().n,0);}});
test('fields, language and unknown GPS fields rejected',async()=>{for(const fields of [{name:''},{description:''},{language:'XX'},{countryCode:'ZZZ'},{latitude:'1'}]){const {env}=setup();await rejectsCode(submit(request(undefined,fields),env,origin,validVerify),'invalid_fields');}});
test('image magic and decompression dimensions checked',()=>{assert.throws(()=>jpegDimensions(new TextEncoder().encode('<svg/>')));const jpeg=Buffer.from(input);let offset=2;while(offset<jpeg.length){const marker=jpeg[offset+1];const len=jpeg.readUInt16BE(offset+2);if(marker===0xc0||marker===0xc2){jpeg.writeUInt16BE(65535,offset+5);assert.throws(()=>jpegDimensions(jpeg),e=>e.code==='image_dimensions');break;}offset+=2+len;}});
test('stream size limit is enforced independent of Content-Length',async()=>{await rejectsCode(boundedBody(new Blob([new Uint8Array(100)]).stream(),99),'image_too_large');});
test('metadata sanitizer rejects truncation and strips appended data',()=>{assert.throws(()=>stripJpegMetadata(new Uint8Array(input).slice(0,-2)));const clean=stripJpegMetadata(new Uint8Array(Buffer.concat([input,Buffer.from('secret trailing bytes')])));assert.equal(Buffer.from(clean).includes(Buffer.from('secret trailing bytes')),false);});
test('Turnstile failures, mismatched host and action fail closed',async()=>{for(const payload of [{success:false},{success:true,hostname:'evil.example',action:'live_submission'},{success:true,hostname:new URL(origin).hostname,action:'other'}])await rejectsCode(verifyTurnstile('token','secret',new URL(origin).hostname,async()=>Response.json(payload)),'verification_required');});
test('R2 success followed by D1 completion failure is repaired on retry',async()=>{const {env,objects,sql,state}=setup();const id=crypto.randomUUID();state.failComplete=true;await assert.rejects(submit(request(id),env,origin,validVerify));assert.equal(objects.size,1);assert.equal(sql.prepare('SELECT processing_state FROM submissions').get().processing_state,'receiving');state.failComplete=false;assert.equal((await submit(request(id),env,origin,validVerify)).status,200);assert.equal(objects.size,1);assert.equal(state.transformations,1);});
test('stale interrupted upload without object becomes retryable and can finish',async()=>{const {env,sql,state}=setup();const id=crypto.randomUUID();state.failPut=true;await assert.rejects(submit(request(id),env,origin,validVerify));sql.exec("UPDATE submissions SET created_at='2020-01-01T00:00:00.000Z'");await reconcile(env);assert.equal(sql.prepare('SELECT processing_state FROM submissions').get().processing_state,'retryable');state.failPut=false;assert.equal((await submit(request(id),env,origin,validVerify)).status,201);});
test('scheduled recovery finalizes stored object after interrupted completion',async()=>{const {env,sql,state}=setup();state.failComplete=true;await assert.rejects(submit(request(),env,origin,validVerify));state.failComplete=false;sql.exec("UPDATE submissions SET created_at='2020-01-01T00:00:00.000Z'");await reconcile(env);assert.equal(sql.prepare('SELECT processing_state FROM submissions').get().processing_state,'ready');});
test('missing stored object cannot receive success on retry',async()=>{const {env,objects}=setup();const id=crypto.randomUUID();await submit(request(id),env,origin,validVerify);objects.clear();await rejectsCode(submit(request(id),env,origin,validVerify),'processing_retry');});
test('staging lifetime budget blocks image processing',async()=>{const {env,sql,state,objects}=setup();sql.exec('UPDATE staging_budget SET attempts=100');await rejectsCode(submit(request(),env,origin,validVerify),'staging_limit');assert.equal(state.transformations,0);assert.equal(objects.size,0);});
test('expiry deletes objects and records; failed deletion resumes safely',async()=>{const {env,sql,objects,state}=setup();await submit(request(),env,origin,validVerify);sql.exec("UPDATE submissions SET expires_at='2020-01-01T00:00:00.000Z'");state.failDelete=true;await assert.rejects(reconcile(env));assert.equal(sql.prepare('SELECT processing_state FROM submissions').get().processing_state,'deleting');state.failDelete=false;await reconcile(env);assert.equal(objects.size,0);assert.equal(sql.prepare('SELECT count(*) AS n FROM submissions').get().n,0);});
test('CORS denies foreign, missing and null origins; no public media routes',async()=>{const {env}=setup();for(const o of ['https://evil.example','','null']){const response=await worker.fetch(new Request(origin+'/api/submissions',{method:'POST',headers:{Origin:o}}),env);assert.equal(response.status,403);assert.equal(response.headers.has('Access-Control-Allow-Origin'),false);}assert.equal((await worker.fetch(new Request(origin+'/api/photos/test',{headers:{Origin:origin}}),env)).status,404);});
test('preflight and method allowlist',async()=>{const {env}=setup();const response=await worker.fetch(new Request(origin+'/api/submissions',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST'}}),env);assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);assert.equal((await worker.fetch(new Request(origin+'/api/submissions',{headers:{Origin:origin}}),env)).status,405);});
test('rate limiter prevents any upload work',async()=>{const {env,state}=setup();env.UPLOAD_LIMITER.limit=async()=>({success:false});await rejectsCode(submit(request(),env,origin,validVerify),'rate_limited');assert.equal(state.transformations,0);});

test('oversized files and disguised non-images are rejected before storage',async()=>{
  for(const [blob,code]of [[new File([new Uint8Array(MAX_IMAGE_BYTES+1)],'big.jpg',{type:'image/jpeg'}),'image_too_large'],[new File(['<svg/>'],'fake.jpg',{type:'image/jpeg'}),'invalid_image'],[new File([input],'fake.png',{type:'image/png'}),'invalid_image']]){
    const {env,objects}=setup();const base=request();const data=await base.formData();data.set('photo',blob);const changed=new Request(base.url,{method:'POST',headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.1','Idempotency-Key':crypto.randomUUID()},body:data});await rejectsCode(submit(changed,env,origin,validVerify),code);assert.equal(objects.size,0);
  }
});
test('D1 reservation failure cannot leave a stored original or object',async()=>{const {env,objects,state}=setup();env.DB.prepare=()=>{throw Error('database unavailable');};await assert.rejects(submit(request(),env,origin,validVerify));assert.equal(objects.size,0);assert.equal(state.transformations,0);});
test('server image decoder failure creates no object and permits retry',async()=>{const {env,sql,objects}=setup();env.IMAGES.input=()=>{throw Error('bad image');};await rejectsCode(submit(request(),env,origin,validVerify),'image_processing');assert.equal(objects.size,0);assert.equal(sql.prepare('SELECT processing_state FROM submissions').get().processing_state,'retryable');});

test('member verifies, uploads privately, sees the Admin decision and can recover access', async (t) => {
  const {env, sql} = setup();
  env.MEMBERS_ENABLED = 'true';
  env.MEMBER_LIMITER = env.UPLOAD_LIMITER;
  env.REVIEW_DB = env.DB;
  env.RESEND_API_KEY = 'test-key';
  env.MEMBER_EMAIL_FROM = 'test@example.com';
  const links = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    const email = JSON.parse(options.body);
    const link = email.text.split('\n\n').find(part => part.startsWith('https://'));
    links.push(new URL(link));
    if (links.at(-1).hash.startsWith('#verify=')) {
      assert.match(email.subject, /^Bem-vindo à A PONTE Live/);
      assert.ok(email.html.includes('color:#0056b3'));
      assert.match(email.html, /<em>.*24 horas.*<\/em>/);
      assert.ok(email.html.includes(link.replaceAll('&', '&amp;')));
    } else {
      assert.equal(email.html, undefined);
    }
    return Response.json({id: 'test-mail'});
  });

  function call(path, data, session, requestOrigin = origin) {
    return worker.fetch(new Request(origin + '/api/members/' + path, {
      method: data ? 'POST' : 'GET',
      headers: {Origin: requestOrigin, 'CF-Connecting-IP': '192.0.2.1',
        ...(session && {Cookie: session}), ...(data && {'Content-Type': 'application/json'})},
      body: data && JSON.stringify(data),
    }), env);
  }
  const info = {email: 'member@example.com', password: 'test-password1', passwordConfirmation: 'test-password1', adult: true, username: 'Joao', relationship: 'customer', language: 'PT', draft: crypto.randomUUID()};
  assert.equal((await call('register', {...info, adult: false})).status, 400);
  assert.equal((await call('register', {...info, passwordConfirmation: 'different'})).status, 400);
  assert.equal((await call('register', {...info, password: '1234567890123456', passwordConfirmation: '1234567890123456'})).status, 400);
  const registration = await call('register', info);
  assert.equal(registration.status, 200);
  const session = registration.headers.get('set-cookie').split(';')[0];
  assert.match(registration.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
  assert.equal((await registration.json()).member.verified, false);
  assert.notEqual(sql.prepare('SELECT password_hash FROM members').get().password_hash, info.password);
  assert.equal(links[0].pathname, '/live/share/');
  const verifyParams = new URLSearchParams(links[0].hash.slice(1));
  assert.equal(verifyParams.get('draft'), info.draft);
  const verify = {token: verifyParams.get('verify')};
  assert.equal((await call('verify', verify)).status, 401);
  assert.equal((await call('verify', verify, session, 'https://other.example')).status, 403);
  assert.equal((await call('photos', undefined, session)).status, 401);

  const id = crypto.randomUUID();
  const upload = () => { const submission = request(id, {name: null}); submission.headers.set('Cookie', session); return submission; };
  await rejectsCode(submit(upload(), env, origin, validVerify), 'sign_in_required');
  assert.equal((await call('verify', verify, session)).status, 200);
  assert.equal((await call('verify', verify, session)).status, 400);
  assert.equal((await submit(upload(), env, origin, validVerify)).status, 201);
  assert.equal((await submit(upload(), env, origin, validVerify)).status, 200);
  assert.equal((await (await call('photos', undefined, session)).json()).photos[0].status, 'pending');
  sql.prepare("INSERT INTO photo_reviews VALUES(?,'selected')").run(id);
  assert.equal((await (await call('photos', undefined, session)).json()).photos[0].status, 'approved');
  sql.prepare("UPDATE photo_reviews SET decision='hidden' WHERE submission_id=?").run(id);
  assert.equal((await (await call('photos', undefined, session)).json()).photos[0].status, 'declined');
  assert.equal((await call('photos/' + id, undefined, session)).headers.get('cache-control'), 'private, no-store');

  const second = await call('register', {...info, email: 'other@example.com', username: 'Other'});
  const secondSession = second.headers.get('set-cookie').split(';')[0];
  const secondVerify = new URLSearchParams(links[1].hash.slice(1)).get('verify');
  assert.equal((await call('verify', {token: secondVerify}, secondSession)).status, 200);
  assert.deepEqual((await (await call('photos', undefined, secondSession)).json()).photos, []);
  assert.equal((await call('photos/' + id, undefined, secondSession)).status, 404);
  assert.equal(sql.prepare('SELECT display_name FROM submissions WHERE id=?').get(id).display_name, info.username);
  const differentOwner = request(id, {name: null});
  differentOwner.headers.set('Cookie', secondSession);
  await rejectsCode(submit(differentOwner, env, origin, validVerify), 'idempotency_conflict');

  assert.equal((await call('forgot', {email: info.email})).status, 200);
  const token = new URLSearchParams(links[2].hash.slice(1)).get('reset');
  const password = 'new-password1';
  assert.equal((await call('reset', {token, password, passwordConfirmation: password})).status, 200);
  assert.equal((await call('reset', {token, password, passwordConfirmation: password})).status, 400);
  assert.equal((await (await call('session', undefined, session)).json()).member, null);
  assert.equal((await call('login', info)).status, 401);
  const login = await call('login', {...info, password});
  assert.equal(login.status, 200);
  const newSession = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('delete-test-account', {}, newSession)).status, 404);
  env.TEST_ACCOUNT_DELETION = 'true';
  assert.equal((await call('delete-test-account', {}, newSession)).status, 200);
  assert.equal((await (await call('session', undefined, newSession)).json()).member, null);
  assert.equal(sql.prepare('SELECT processing_state FROM submissions WHERE id=?').get(id).processing_state, 'deleting');
  assert.equal((await call('register', info)).status, 200);
});
