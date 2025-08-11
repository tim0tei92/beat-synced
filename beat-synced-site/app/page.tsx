
"use client";

import React, { useEffect, useRef, useState } from "react";

function timeFormat(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function Page() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const startTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);

  const [beats, setBeats] = useState<number[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);

  const [basePrompt, setBasePrompt] = useState(
    "surreal motion graphics from the source image, parallax, tasteful morphing, particle trails"
  );
  const [negativePrompt, setNegativePrompt] = useState("text, watermark, nsfw, logo, extra limbs, artifacts");
  const [intensity, setIntensity] = useState<number>(60);
  const [styleStrength, setStyleStrength] = useState<number>(55);
  const [seed, setSeed] = useState<string>("random");
  const [frameRate, setFrameRate] = useState<number>(24);
  const [resolution, setResolution] = useState<"720p" | "1080p" | "4k">("1080p");

  const [isGenerating, setIsGenerating] = useState(false);
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Decode audio
  useEffect(() => {
    if (!audioFile) return;
    const run = async () => {
      try {
        setBeats([]);
        setBpm(null);
        setAnalysisProgress(0);
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        const arrBuf = await audioFile.arrayBuffer();
        const buf = await audioCtxRef.current.decodeAudioData(arrBuf);
        setAudioBuffer(buf);
        setDuration(buf.duration);
      } catch (e) { console.error(e); }
    };
    run();
  }, [audioFile]);

  const analyzeBeats = async () => {
    if (!audioBuffer) return;
    setAnalysisProgress(5);
    const channel = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const hop = Math.floor(sampleRate / 200);
    const envelope: number[] = [];
    for (let i = 0; i < channel.length; i += hop) {
      let sum = 0;
      for (let j = i; j < i + hop && j < channel.length; j++) sum += Math.abs(channel[j]);
      envelope.push(sum / hop);
    }
    setAnalysisProgress(25);
    const win = 10;
    const ma: number[] = [];
    for (let i = 0; i < envelope.length; i++) {
      let s = 0;
      for (let w = i - win; w <= i + win; w++) s += envelope[Math.max(0, Math.min(envelope.length - 1, w))];
      ma.push(s / (2 * win + 1));
    }
    const novelty = envelope.map((v, i) => Math.max(0, v - ma[i] * 1.25));
    setAnalysisProgress(55);
    const peaks: number[] = [];
    const minDist = 8;
    let last = -minDist;
    for (let i = 1; i < novelty.length - 1; i++) {
      if (novelty[i] > novelty[i - 1] && novelty[i] > novelty[i + 1] && novelty[i] > 0.005) {
        if (i - last >= minDist) { peaks.push(i); last = i; }
      }
    }
    setAnalysisProgress(80);
    const secPerFrame = hop / sampleRate;
    const times = peaks.map((p) => p * secPerFrame);
    const iois: number[] = [];
    for (let i = 1; i < times.length; i++) iois.push(times[i] - times[i - 1]);
    const median = (arr: number[]) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };
    const ioi = median(iois);
    const estBpm = ioi ? Math.round(60 / ioi) : null;
    setBeats(times);
    setBpm(estBpm);
    setAnalysisProgress(100);
  };

  const play = () => {
    if (!audioBuffer) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(ctx.destination);
    src.start(0, pauseOffsetRef.current);
    startTimeRef.current = ctx.currentTime - pauseOffsetRef.current;
    sourceRef.current = src;
    setIsPlaying(true);
    src.onended = () => { setIsPlaying(false); pauseOffsetRef.current = 0; };
  };
  const pause = () => {
    if (!audioCtxRef.current || !sourceRef.current) return;
    const ctx = audioCtxRef.current;
    const src = sourceRef.current;
    src.stop();
    pauseOffsetRef.current = ctx.currentTime - startTimeRef.current;
    setIsPlaying(false);
  };
  const reset = () => {
    if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} ; sourceRef.current.disconnect(); sourceRef.current = null; }
    setIsPlaying(false);
    pauseOffsetRef.current = 0;
  };

  // Draw timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const render = () => {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0,0,w,h);
      const channel = audioBuffer.getChannelData(0);
      const step = Math.max(1, Math.floor(channel.length / w));
      ctx.strokeStyle = "#2a2a2a";
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        let min = 1.0, max = -1.0;
        for (let i = 0; i < step; i++) {
          const sample = channel[x*step + i] || 0;
          if (sample < min) min = sample;
          if (sample > max) max = sample;
        }
        const y1 = (1+min)*0.5*h, y2 = (1+max)*0.5*h;
        ctx.moveTo(x,y1); ctx.lineTo(x,y2);
      }
      ctx.stroke();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
      const total = duration || 1;
      beats.forEach((t) => {
        const x = (t/total)*w;
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
      });
      if (audioCtxRef.current && isPlaying) {
        const now = audioCtxRef.current.currentTime - startTimeRef.current;
        const x = (now/total)*w;
        ctx.globalAlpha = 1; ctx.fillStyle = "#facc15"; ctx.fillRect(x-1,0,2,h);
      }
      requestAnimationFrame(render);
    };
    const id = requestAnimationFrame(render);
    return () => cancelAnimationFrame(id);
  }, [audioBuffer, beats, duration, isPlaying]);

  const handleGenerate = async () => {
    if (!imageFile || !audioFile || !audioBuffer) return;
    setIsGenerating(true); setDownloadUrl(null); setJobProgress(0);
    const meta = {
      prompt: basePrompt, negativePrompt, intensity, styleStrength, seed,
      frameRate, resolution, beats, bpm, duration,
      filenames: { image: imageFile.name, audio: audioFile.name },
    };
    const form = new FormData();
    form.append("meta", new Blob([JSON.stringify(meta)], { type: "application/json" }));
    form.append("image", imageFile);
    form.append("audio", audioFile);
    const res = await fetch("/api/generate", { method: "POST", body: form });
    if (!res.ok) { alert("Failed to start job"); setIsGenerating(false); return; }
    const { id } = await res.json(); setJobId(id);
    const poll = async () => {
      const r = await fetch(`/api/jobs/${id}`);
      const data = await r.json();
      setJobProgress(Math.round((data.progress || 0)*100));
      if (data.status === "completed" && data.url) { setDownloadUrl(data.url); setIsGenerating(false); return; }
      if (data.status === "failed") { setIsGenerating(false); alert("Job failed"); return; }
      setTimeout(poll, 1200);
    };
    poll();
  };

  return (
    <div className="container">
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h1>BeatSynced • One Image → Beat‑Reactive Video</h1>
        <div className="small">prototype • local ffmpeg renderer</div>
      </header>

      <div className="row">
        <div className="card">
          <h2>Upload</h2>
          <label className="label">Reference Image</label>
          <input className="input" type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
          {imageFile && <div className="small" style={{marginTop:6}}>{imageFile.name}</div>}

          <label className="label">Audio (Song)</label>
          <input className="input" type="file" accept="audio/*" onChange={e => { setAudioFile(e.target.files?.[0] || null); reset(); }} />
          {audioFile && <div className="small" style={{marginTop:6}}>{audioFile.name}</div>}

          {audioBuffer && (
            <div style={{marginTop:12}}>
              <div style={{display:"flex",justifyContent:"space-between"}} className="small">
                <span>Length</span><span>{timeFormat(duration)}</span>
              </div>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                {!isPlaying ? <button className="btn primary" onClick={play}>▶ Play</button> : <button className="btn" onClick={pause}>⏸ Pause</button>}
                <button className="btn" onClick={reset}>↺ Reset</button>
                <button className="btn" onClick={analyzeBeats}>✨ Detect Beats</button>
              </div>
              {analysisProgress > 0 && analysisProgress < 100 && (
                <div style={{marginTop:8}}>
                  <div className="small">Analyzing…</div>
                  <div className="progress"><div style={{width: analysisProgress + "%"}} /></div>
                </div>
              )}
              {bpm && <div className="small" style={{marginTop:8}}>Estimated BPM: <b style={{color:"#fff"}}>{bpm}</b></div>}
            </div>
          )}
        </div>

        <div className="card">
          <h2>Beat Timeline</h2>
          <canvas ref={canvasRef} width={1200} height={180} />
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8}} className="small">
            <div>Beats: <b style={{color:"#fff"}}>{beats.length}</b></div>
            <div>FPS target: <b style={{color:"#fff"}}>{frameRate}</b></div>
          </div>
        </div>
      </div>

      <div className="row" style={{marginTop:16}}>
        <div className="card">
          <h2>Prompts</h2>
          <label className="label">Base Prompt</label>
          <input className="input" value={basePrompt} onChange={(e)=>setBasePrompt(e.target.value)} />
          <label className="label">Negative Prompt</label>
          <input className="input" value={negativePrompt} onChange={(e)=>setNegativePrompt(e.target.value)} />
          <label className="label">Seed (“random” or number)</label>
          <input className="input" value={seed} onChange={(e)=>setSeed(e.target.value)} />
        </div>
        <div className="card">
          <h2>Style & Motion</h2>
          <label className="label">Motion Intensity: {intensity}%</label>
          <input className="input" type="range" min={0} max={100} value={intensity} onChange={(e)=>setIntensity(parseInt(e.target.value))}/>
          <label className="label">Style Strength: {styleStrength}%</label>
          <input className="input" type="range" min={0} max={100} value={styleStrength} onChange={(e)=>setStyleStrength(parseInt(e.target.value))}/>
          <label className="label">Frame Rate: {frameRate} fps</label>
          <input className="input" type="range" min={12} max={60} value={frameRate} onChange={(e)=>setFrameRate(parseInt(e.target.value))}/>
          <label className="label">Resolution</label>
          <div style={{display:"flex",gap:8}}>
            {["720p","1080p","4k"].map((r) => (
              <button key={r} className={"btn " + (resolution===r?"primary":"")} onClick={()=>setResolution(r as any)}>{r}</button>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Render</h2>
          <button className="btn primary" onClick={handleGenerate} disabled={!imageFile || !audioFile || isGenerating}>
            {!isGenerating ? "✨ Generate" : "⏳ Rendering…"}
          </button>
          {isGenerating && (
            <div style={{marginTop:10}}>
              <div className="small">Processing</div>
              <div className="progress"><div style={{width: jobProgress + "%"}} /></div>
            </div>
          )}
          {downloadUrl && (
            <div style={{marginTop:10}}>
              <a className="link" href={downloadUrl} target="_blank" rel="noreferrer">⬇ Download Video</a>
            </div>
          )}
          <div className="small" style={{marginTop:10}}>Generates a video equal to your song length. Motion and flashes react to detected beats.</div>
        </div>
      </div>

      <div className="footer">
        <div className="small">© {new Date().getFullYear()} BeatSynced — for DJs & Creatives</div>
        <div className="small">Local ffmpeg • WebAudio</div>
      </div>
    </div>
  );
}
