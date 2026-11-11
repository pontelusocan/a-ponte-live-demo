"use client";
// Temporary staging diagnostic. Accepts only the exact synthetic fixture, never customer photos.
import {useState} from 'react';
import UploadVerification from '@/components/share/UploadVerification';
import {CONSENT_VERSION, toUploadFormData} from '@/lib/share/submission';

export default function UploadCheck() {
  const [file,setFile]=useState<File|null>(null);
  const [id,setId]=useState('');
  const [token,setToken]=useState('');
  const [attempt,setAttempt]=useState(0);
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState('');
  async function choose(next: File|undefined) {
    if(!next)return;
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await next.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!=='e4ffc833efde446c40eb8bed951f94392986d56f90af909cfa815366b6601d35'){setResult('Only the synthetic staging fixture is allowed.');setFile(null);return;}
    setFile(next);setId(crypto.randomUUID());setResult('Synthetic fixture accepted without client re-encoding.');
  }
  async function send() {
    if(!file||!token||!consent||busy)return;
    setBusy(true);
    const data=toUploadFormData({photo:{file,width:2400,height:1600,source:'picker'},description:'Synthetic raw JPEG with metadata; server-side processing validation.',publicationConsent:false,location:null,language:'EN'});
    data.append('processingConsent','true');data.append('consentVersion',CONSENT_VERSION);data.append('turnstileToken',token);
    try {
      const response=await fetch('/api/submissions',{method:'POST',headers:{'Idempotency-Key':id},body:data});
      setResult(`HTTP ${response.status}: ${JSON.stringify(await response.json())}`);
    } catch {setResult('Request not confirmed.');}
    finally {setBusy(false);setToken('');setAttempt(n=>n+1);}
  }
  return <main style={{maxWidth:600,margin:'40px auto',padding:24,color:'#fff',lineHeight:1.6}}>
    <h1>Synthetic staging upload check</h1>
    <p>Diagnostic only. Uses the exact synthetic fixture with EXIF metadata. No customer images, publication, rewards or location.</p>
    <label>Test fixture <input type="file" accept="image/jpeg" disabled={busy} onChange={e=>choose(e.target.files?.[0])}/></label>
    <p>Submission reference: {id||'Choose fixture first'}</p>
    <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I authorize private processing of this synthetic test fixture.</label>
    <UploadVerification attempt={attempt} language="EN" onToken={setToken}/>
    <button onClick={send} disabled={!file||!token||!consent||busy}>{busy?'Sending…':'Send same test submission'}</button>
    <p role="status" style={{overflowWrap:'anywhere'}}>{result}</p>
  </main>;
}
