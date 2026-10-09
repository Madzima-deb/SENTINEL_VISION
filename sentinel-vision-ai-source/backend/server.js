import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const MODEL_ID = process.env.HF_MODEL_ID || 'facebook/detr-resnet-50';
const ALLOWED_TYPES = new Set(['image/jpeg','image/png','image/webp']);
const MAX_BYTES = 4 * 1024 * 1024;
const events = [];

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '6mb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) return cb(new Error('Only JPEG, PNG, and WebP images are supported.'));
    cb(null, true);
  }
});

app.get('/api/health', (_req,res)=>res.json({ok:true,service:'Sentinel Vision AI backend'}));
app.get('/api/model/status', (_req,res)=>res.json({
  configured: Boolean(process.env.HF_TOKEN),
  model: MODEL_ID,
  provider: 'Hugging Face Inference Providers',
  message: process.env.HF_TOKEN ? 'Hugging Face token is configured.' : 'Add HF_TOKEN to backend/.env to enable real inference.'
}));
app.get('/api/events', (_req,res)=>res.json({events:[...events].sort((a,b)=>b.createdAt-a.createdAt).slice(0,100)}));
app.delete('/api/events/:id', (req,res)=>{
  const index=events.findIndex(e=>e.id===req.params.id);
  if(index<0) return res.status(404).json({error:'Event not found.'});
  events.splice(index,1); return res.json({deleted:true});
});

app.post('/api/detect', upload.single('image'), async (req,res)=>{
  if(!req.file) return res.status(400).json({error:'Choose an image before running detection.'});
  if(!ALLOWED_TYPES.has(req.file.mimetype)) return res.status(415).json({error:'Unsupported image type.'});
  if(!process.env.HF_TOKEN) return res.status(503).json({error:'Hugging Face is not configured. Add HF_TOKEN to backend/.env and restart the server.'});
  try {
    const response=await fetch(`https://router.huggingface.co/hf-inference/models/${MODEL_ID}`,{
      method:'POST',
      headers:{Authorization:`Bearer ${process.env.HF_TOKEN}`,'Content-Type':req.file.mimetype},
      body:req.file.buffer,
      signal:AbortSignal.timeout(30000)
    });
    if(!response.ok) {
      const detail=(await response.text()).slice(0,300);
      if(response.status===401||response.status===403) return res.status(502).json({error:'Hugging Face rejected the token. Verify it has Inference Providers permission.'});
      if(response.status===429) return res.status(429).json({error:'Hugging Face rate limit reached. Wait and retry.'});
      if(response.status===503) return res.status(503).json({error:'Model is loading or temporarily unavailable. Retry shortly.'});
      return res.status(502).json({error:`Hugging Face inference failed (${response.status}): ${detail}`});
    }
    const payload=await response.json();
    if(!Array.isArray(payload)) return res.status(502).json({error:payload?.error || 'Unexpected model response format.'});
    const detections=payload
      .filter(x=>typeof x?.label==='string'&&typeof x?.score==='number')
      .map(x=>({label:x.label,score:Math.max(0,Math.min(1,x.score)),box:x.box||undefined}))
      .filter(x=>x.score>=0.35).slice(0,100);
    const event={
      id:randomUUID(),createdAt:Date.now(),source:'upload',
      fileName:String(req.file.originalname||'uploaded-image').slice(0,140),
      model:MODEL_ID,detections
    };
    events.unshift(event);
    if(events.length>100) events.length=100;
    return res.json(event);
  } catch(err) {
    if(err?.name==='TimeoutError'||err?.name==='AbortError') return res.status(504).json({error:'The model request timed out. Try a smaller image or retry.'});
    return res.status(502).json({error:'Could not reach Hugging Face inference. Check network access and model availability.'});
  }
});

app.use((err,_req,res,_next)=>{
  if(err instanceof multer.MulterError && err.code==='LIMIT_FILE_SIZE') return res.status(413).json({error:'Image must be 4 MB or smaller.'});
  return res.status(400).json({error:err.message||'Invalid request.'});
});

app.listen(PORT,()=>console.log(`Sentinel Vision API listening on http://localhost:${PORT}`));
