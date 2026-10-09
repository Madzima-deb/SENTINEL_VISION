import { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, Camera, Car, CheckCircle2, Clock3, FileImage, History, LayoutDashboard, LoaderCircle, Play, RefreshCw, ScanLine, ShieldCheck, Smartphone, Trash2, Upload, Video, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const vehicleLabels = ['car','truck','bus','motorcycle','bicycle'];

function pretty(label='') { return label.replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase()); }
function dateLabel(value) { return new Date(value).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}); }

export default function App() {
  const [page,setPage] = useState('Overview');
  const [status,setStatus] = useState({configured:false,model:'facebook/detr-resnet-50',message:'Checking model…'});
  const [events,setEvents] = useState([]);
  const [file,setFile] = useState(null);
  const [preview,setPreview] = useState('');
  const [detections,setDetections] = useState([]);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [filter,setFilter] = useState('All');
  const [query,setQuery] = useState('');
  const [cameraOn,setCameraOn] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);

  async function refresh() {
    try {
      const [s,e] = await Promise.all([
        fetch(`${API}/api/model/status`).then(r=>r.json()),
        fetch(`${API}/api/events`).then(r=>r.json())
      ]);
      setStatus(s); setEvents(e.events || []);
    } catch { setError('Could not connect to the backend. Start the API in the backend folder.'); }
  }
  useEffect(()=>{ refresh(); return ()=>stopCamera(); },[]);
  useEffect(()=>{ if(cameraOn && videoRef.current && streamRef.current) videoRef.current.srcObject=streamRef.current; },[cameraOn,page]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current=null; setCameraOn(false);
  }
  async function startCamera() {
    setError(''); setNotice('');
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera needs HTTPS or localhost and a supported browser.'); return; }
    try {
      stopCamera();
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      streamRef.current=stream; setCameraOn(true);
      if(videoRef.current) videoRef.current.srcObject=stream;
    } catch(e) { setError(e.name==='NotAllowedError'?'Camera permission was denied. Allow access in browser settings.':'Could not open camera. Check browser permissions and try again.'); }
  }
  function selectFile(f) {
    if(!f) return;
    setError(''); setNotice(''); setDetections([]); setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  async function capture() {
    const video=videoRef.current;
    if(!video || !video.videoWidth) { setError('Camera is not ready yet.'); return; }
    const scale=Math.min(1,1600/video.videoWidth,1600/video.videoHeight);
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(video.videoWidth*scale); canvas.height=Math.round(video.videoHeight*scale);
    canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
    canvas.toBlob(blob=>{
      if(blob) { const f=new File([blob],'camera-frame.jpg',{type:'image/jpeg'}); selectFile(f); setNotice('Frame captured. Select Run detection to analyze it.'); }
    },'image/jpeg',0.82);
  }
  async function runDetection() {
    if(!file) { setError('Choose an image or capture a camera frame first.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const form=new FormData(); form.append('image',file);
      const response=await fetch(`${API}/api/detect`,{method:'POST',body:form});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || 'Detection failed.');
      setDetections(data.detections || []);
      setNotice(`Analysis complete · ${data.detections?.length || 0} detections returned by the model.`);
      await refresh();
    } catch(e) { setError(e.message || 'Detection failed. Check the backend and model token.'); }
    finally { setBusy(false); }
  }
  async function deleteEvent(id) {
    try {
      const r=await fetch(`${API}/api/events/${encodeURIComponent(id)}`,{method:'DELETE'});
      if(!r.ok) throw new Error('Could not delete event.');
      setEvents(items=>items.filter(x=>x.id!==id));
    } catch(e) { setError(e.message); }
  }

  const people=events.reduce((n,e)=>n+e.detections.filter(d=>d.label.toLowerCase()==='person').length,0);
  const vehicles=events.reduce((n,e)=>n+e.detections.filter(d=>vehicleLabels.includes(d.label.toLowerCase())).length,0);
  const filtered=events.filter(e=>{
    const textMatch=!query || e.fileName.toLowerCase().includes(query.toLowerCase()) || e.detections.some(d=>d.label.toLowerCase().includes(query.toLowerCase()));
    const typeMatch=filter==='All' || (filter==='People'?e.detections.some(d=>d.label.toLowerCase()==='person'):e.detections.some(d=>vehicleLabels.includes(d.label.toLowerCase())));
    return textMatch && typeMatch;
  });

  const nav=[['Overview',LayoutDashboard],['Live Monitor',Video],['History',History],['Analytics',BarChart3],['Settings',Activity]];
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><ShieldCheck/></div><div><b>Sentinel<span>Vision</span></b><small>AI SECURITY OPERATIONS</small></div></div>
      <div className="section-label">WORKSPACE</div>
      <nav>{nav.map(([label,Icon])=><button key={label} className={page===label?'nav active':'nav'} onClick={()=>setPage(label)}><Icon size={18}/>{label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="status-line"><i className={status.configured?'green':'amber'}/><b>{status.configured?'Model connected':'Setup required'}</b></div><p>{status.message}</p><button className="text-btn" onClick={()=>setPage('Settings')}>Integration settings →</button><div className="privacy"><ShieldCheck size={16}/> Images are processed, not saved.</div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="muted">Sentinel workspace</span><span className="slash">/</span><b>{page}</b></div><div className="top-actions"><span className="pill"><i className={status.configured?'green':'amber'}/>{status.configured?'Inference ready':'Model not configured'}</span><button className="icon-btn" onClick={refresh} title="Refresh"><RefreshCw size={17}/></button></div></header>
      <section className="content">
        {error && <div className="message error"><AlertTriangle size={17}/><span>{error}</span><button onClick={()=>setError('')}><X size={15}/></button></div>}
        {notice && <div className="message success"><CheckCircle2 size={17}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
        {page==='Overview' && <>
          <div className="eyebrow"><Activity size={14}/> SECURITY INTELLIGENCE</div><h1>Good day, Operator.</h1><p className="sub">Monitor your environment, analyze frames, and review model-backed detections.</p>
          <div className="stats">
            <Stat icon={ScanLine} label="ANALYZED EVENTS" value={events.length} foot="Saved detection records"/>
            <Stat icon={Smartphone} label="PEOPLE DETECTED" value={people} foot="Across recorded events"/>
            <Stat icon={Car} label="VEHICLES DETECTED" value={vehicles} foot="Cars, buses, trucks and more"/>
            <Stat icon={Activity} label="MODEL STATUS" value={status.configured?'Ready':'Setup'} foot={status.model}/>
          </div>
          <div className="grid-two">
            <div className="panel"><div className="panel-head"><div><h2>Quick actions</h2><p>Choose how to start an analysis.</p></div><ScanLine/></div><div className="action-list"><button onClick={()=>setPage('Live Monitor')}><span className="action-icon"><Upload/></span><span><b>Analyze an image</b><small>Upload a JPEG, PNG, or WebP file</small></span><span className="arrow">→</span></button><button onClick={()=>{setPage('Live Monitor');}}><span className="action-icon"><Camera/></span><span><b>Open camera monitor</b><small>Capture a frame from this device</small></span><span className="arrow">→</span></button><button onClick={()=>setPage('History')}><span className="action-icon"><History/></span><span><b>Review history</b><small>Search previous detection results</small></span><span className="arrow">→</span></button></div></div>
            <div className="panel"><div className="panel-head"><div><h2>Recent activity</h2><p>Your latest model responses.</p></div><Clock3/></div>{events.slice(0,5).length?events.slice(0,5).map(e=><EventRow key={e.id} event={e}/>):<Empty icon={History} title="No activity yet" text="Run your first detection to populate history."/>}</div>
          </div>
        </>}
        {page==='Live Monitor' && <>
          <div className="eyebrow"><Video size={14}/> LIVE MONITORING</div><h1>Analyze a visual frame.</h1><p className="sub">Use an uploaded image or explicitly start your device camera. Analysis is triggered manually.</p>
          <div className="monitor-grid">
            <div className="panel monitor-panel"><div className="panel-head"><div><h2>Image source</h2><p>Upload an image or capture a camera frame.</p></div><FileImage/></div>
              <div className="dropzone" onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();selectFile(e.dataTransfer.files?.[0]);}}><input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>selectFile(e.target.files?.[0])}/><Upload size={25}/><b>Drop an image here or browse files</b><small>JPEG, PNG, WebP · max 4 MB</small></div>
              <div className="or"><span>OR USE CAMERA</span></div>
              <div className="camera-stage">{cameraOn?<video ref={videoRef} autoPlay playsInline muted/>:<div className="camera-placeholder"><Camera size={34}/><b>Camera is off</b><small>Press Start camera to request permission.</small></div>}</div>
              <div className="controls"><button className="btn secondary" onClick={cameraOn?stopCamera:startCamera}><Camera size={16}/>{cameraOn?'Stop camera':'Start camera'}</button><button className="btn secondary" onClick={capture} disabled={!cameraOn}><ScanLine size={16}/>Capture frame</button></div>
              {preview&&<div className="selected"><img src={preview} alt="Selected preview"/><div><b>{file?.name}</b><small>{file?`${(file.size/1024).toFixed(0)} KB`:'Selected image'}</small></div><button className="icon-btn" onClick={()=>{setFile(null);setPreview('');setDetections([])}}><X size={16}/></button></div>}
              <button className="btn primary full" onClick={runDetection} disabled={busy||!file}>{busy?<><LoaderCircle className="spin" size={17}/>Analyzing image…</>:<><Play size={17}/>Run detection</>}</button>
              <p className="hint">Camera access is user-initiated. No continuous recording is performed.</p>
            </div>
            <div className="panel results-panel"><div className="panel-head"><div><h2>Detection results</h2><p>Real response from the configured model.</p></div><CrosshairIcon/></div>
              {preview&&<img className="result-preview" src={preview} alt="Frame to analyze"/>}
              {detections.length?<><div className="result-count">{detections.length} detections</div>{detections.map((d,i)=><div className="detection" key={i}><span className="detection-icon"><ScanLine size={16}/></span><div className="detection-label"><b>{pretty(d.label)}</b><small>{d.box?`Box: ${Math.round(d.box.xmin||0)}, ${Math.round(d.box.ymin||0)} – ${Math.round(d.box.xmax||0)}, ${Math.round(d.box.ymax||0)}`:'Bounding box unavailable'}</small></div><strong>{Math.round(d.score*100)}%</strong></div>)}</>:<Empty icon={ScanLine} title="Awaiting analysis" text="Choose an image, then run detection to see model results."/>}
            </div>
          </div>
        </>}
        {page==='History' && <>
          <div className="eyebrow"><History size={14}/> EVENT LOG</div><h1>Detection history.</h1><p className="sub">Search, filter, and remove locally recorded model responses.</p>
          <div className="panel"><div className="toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search filename or label…"/><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>People</option><option>Vehicles</option></select><span className="muted">{filtered.length} records</span></div>
            {filtered.length?filtered.map(e=><div className="history-row" key={e.id}><div className="event-icon"><FileImage/></div><div className="event-main"><b>{e.fileName}</b><small>{dateLabel(e.createdAt)} · {e.source} · {e.model}</small><div className="chips">{e.detections.slice(0,6).map((d,i)=><span key={i}>{pretty(d.label)} {Math.round(d.score*100)}%</span>)}</div></div><button className="icon-btn danger" title="Delete event" onClick={()=>deleteEvent(e.id)}><Trash2 size={16}/></button></div>):<Empty icon={History} title="No matching events" text="Run an analysis or change your filters."/>}
          </div>
        </>}
        {page==='Analytics' && <>
          <div className="eyebrow"><BarChart3 size={14}/> DETECTION ANALYTICS</div><h1>Understand the activity.</h1><p className="sub">A simple summary of detections returned by your model.</p>
          <div className="stats"><Stat icon={ScanLine} label="EVENTS" value={events.length} foot="Total recorded requests"/><Stat icon={Smartphone} label="PEOPLE" value={people} foot="Person detections"/><Stat icon={Car} label="VEHICLES" value={vehicles} foot="Vehicle detections"/></div>
          <div className="panel"><div className="panel-head"><div><h2>Detection mix</h2><p>Counts are derived from saved model results.</p></div><BarChart3/></div>{[['People',people],['Vehicles',vehicles],['Other objects',Math.max(0,events.reduce((n,e)=>n+e.detections.length,0)-people-vehicles)]].map(([label,count])=><div className="bar-item" key={label}><div><span>{label}</span><b>{count}</b></div><div className="bar-track"><i style={{width:`${Math.min(100,Number(count)/Math.max(1,people+vehicles)*100)}%`}}/></div></div>)}</div>
        </>}
        {page==='Settings' && <>
          <div className="eyebrow"><Activity size={14}/> INTEGRATION SETTINGS</div><h1>System configuration.</h1><p className="sub">Secrets remain on the backend; the browser receives status only.</p>
          <div className="panel settings"><div className="panel-head"><div><h2>Hugging Face inference</h2><p>Server-side connection for object detection.</p></div><ShieldCheck/></div><div className="setting-row"><span>Provider</span><b>Hugging Face Inference Providers</b></div><div className="setting-row"><span>Model</span><code>{status.model}</code></div><div className="setting-row"><span>Credential</span><b className={status.configured?'good':'warn'}>{status.configured?'Configured':'Missing HF_TOKEN'}</b></div><div className="setting-row"><span>Status</span><b>{status.message}</b></div><div className="note"><ShieldCheck size={17}/><span>Set <code>HF_TOKEN</code> in <code>backend/.env</code>. Never put your token in frontend environment variables or commit it to GitHub.</span></div><button className="btn secondary" onClick={refresh}><RefreshCw size={16}/>Refresh status</button></div>
        </>}
        <footer><span>© {new Date().getFullYear()} Sentinel Vision AI</span><span><i className="green"/> Model-backed results only · Privacy-minded by design</span></footer>
      </section>
    </main>
  </div>;
}
function Stat({icon:Icon,label,value,foot}) { return <div className="stat"><div className="stat-top"><span>{label}</span><Icon size={18}/></div><strong>{value}</strong><small>{foot}</small></div>; }
function EventRow({event}) { return <div className="recent-row"><div className="event-icon"><FileImage size={17}/></div><div className="event-main"><b>{event.fileName}</b><small>{dateLabel(event.createdAt)} · {event.detections.length} detections</small></div><span className="arrow">→</span></div>; }
function Empty({icon:Icon,title,text}) { return <div className="empty"><Icon size={24}/><b>{title}</b><p>{text}</p></div>; }
function CrosshairIcon(){return <ScanLine/>;}
