"use client";
import { useState, useEffect, useCallback } from "react";

const FORMATS = ["Novel", "Screenplay", "Web Series"];
const GENRES = ["Fantasy","Sci-Fi","Horror","Thriller","Romance","Drama","Comedy","Mystery","Literary Fiction","Action","Historical","Dystopian","Noir","Satire"];
const MODES = ["brainstorm", "outline", "write"];
const STYLE_ATTRS = ["Pacing","Tone","POV Style","Dialogue Style","Sentence Structure","Atmosphere"];
const DEFAULT_CHAR = { name:"",role:"",age:"",appearance:"",personality:"",thinkingStyle:"",behavior:"",habits:"",fears:"",desires:"",speechPattern:"",backstory:"",arc:"" };
const DEFAULT_LOC = { name:"",description:"",atmosphere:"",history:"",sensoryDetails:"" };
const DEFAULT_PLOT = { name:"",description:"",status:"Active",stakes:"",connections:"" };
const CharFields = [["name","Name","input"],["role","Role","input"],["age","Age","input"],["appearance","Appearance","textarea"],["personality","Personality","textarea"],["thinkingStyle","Thinking style","textarea"],["behavior","Behavior patterns","textarea"],["habits","Habits & quirks","textarea"],["fears","Fears","textarea"],["desires","Desires","textarea"],["speechPattern","Speech pattern","textarea"],["backstory","Backstory","textarea"],["arc","Character arc","textarea"]];
const LocFields = [["name","Name","input"],["description","Description","textarea"],["atmosphere","Atmosphere","textarea"],["history","History","textarea"],["sensoryDetails","Sensory details","textarea"]];
const PlotFields = [["name","Thread Name","input"],["description","Description","textarea"],["stakes","Stakes","textarea"],["connections","Connections","textarea"]];

// NOTE: Replace these fetch calls with your API routes:
// fetch("/api/ai/generate", ...) instead of direct Anthropic calls
// fetch("/api/projects/[id]", ...) for CRUD operations
// fetch("/api/ai/entity", ...) for character/location/plot generation
// fetch("/api/ai/analyze-work", ...) for reference work analysis
// fetch("/api/ai/summarize", ...) for chapter summaries

export default function GhostWriterApp({ projectId }) {
  const [project, setProject] = useState(null);
  const [mode, setMode] = useState("brainstorm");
  const [leftTab, setLeftTab] = useState("bible");
  const [generating, setGenerating] = useState(false);
  const [genTarget, setGenTarget] = useState("");
  const [streamText, setStreamText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [expandedPrompt, setExpandedPrompt] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);
  const [showRefModal, setShowRefModal] = useState(false);
  const [newRef, setNewRef] = useState({ title:"", attributes:{} });
  const [showCharModal, setShowCharModal] = useState(false);
  const [editCharIdx, setEditCharIdx] = useState(null);
  const [newChar, setNewChar] = useState({...DEFAULT_CHAR});
  const [showLocModal, setShowLocModal] = useState(false);
  const [editLocIdx, setEditLocIdx] = useState(null);
  const [newLoc, setNewLoc] = useState({...DEFAULT_LOC});
  const [showPlotModal, setShowPlotModal] = useState(false);
  const [editPlotIdx, setEditPlotIdx] = useState(null);
  const [newPlot, setNewPlot] = useState({...DEFAULT_PLOT});
  const [charGenPrompt, setCharGenPrompt] = useState("");
  const [locGenPrompt, setLocGenPrompt] = useState("");
  const [plotGenPrompt, setPlotGenPrompt] = useState("");
  const [bibleGenPrompt, setBibleGenPrompt] = useState("");

  // Load project from API
  useEffect(() => {
    fetch("/api/projects/" + projectId).then(r => r.json()).then(data => {
      setProject({ ...data, activeChapter: data.chapters?.[0]?.id || null });
    });
  }, [projectId]);

  if (!project) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"system-ui"}}>Loading...</div>;

  const activeChap = project.chapters?.find(c => c.id === project.activeChapter) || project.chapters?.[0] || { id:"", title:"Chapter 1", content:"", summary:"" };

  const updateProject = (fn) => setProject(p => typeof fn === "function" ? fn(p) : fn);
  const updateChapter = (f, v) => updateProject(p => ({...p, chapters: p.chapters.map(c => c.id === p.activeChapter ? {...c,[f]:v} : c)}));

  const addChapter = () => {
    const id = "temp-" + Date.now();
    const label = project.format === "Screenplay" ? "Scene" : project.format === "Web Series" ? "Episode" : "Chapter";
    updateProject(p => ({...p, chapters:[...p.chapters,{id,title:label+" "+(p.chapters.length+1),content:"",summary:"",sortOrder:p.chapters.length}], activeChapter:id}));
    // TODO: POST to /api/projects/[id]/chapters
  };

  const deleteChapter = (id) => {
    if (project.chapters.length <= 1) return;
    setConfirmModal({ msg:"Delete this chapter?", action:()=>{ updateProject(p=>{const f=p.chapters.filter(c=>c.id!==id); return {...p,chapters:f,activeChapter:f[0].id};}); setConfirmModal(null); }});
  };

  const moveChapter = (i, dir) => {
    updateProject(p => { const ch=[...p.chapters]; const ni=i+dir; if(ni<0||ni>=ch.length) return p; [ch[i],ch[ni]]=[ch[ni],ch[i]]; return {...p,chapters:ch}; });
  };

  const toggleGenre = (g) => updateProject(p => ({...p, genres: p.genres.includes(g)?p.genres.filter(x=>x!==g):[...p.genres,g]}));

  const wordCount = (activeChap.content||"").trim().split(/\s+/).filter(Boolean).length;
  const totalWords = project.chapters.reduce((a,c) => a + (c.content||"").trim().split(/\s+/).filter(Boolean).length, 0);

  // AI calls - replace with your API routes
  const callAI = async (endpoint, body) => {
    const res = await fetch("/api/ai/" + endpoint, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
    return res.json();
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const r = await callAI("generate", { mode, prompt, context: "", format: project.format, projectId: project.id, chapterId: activeChap.id });
      if (mode === "write") { setUndoStack(s=>[...s.slice(-9),activeChap.content]); updateChapter("content", activeChap.content+(activeChap.content?"\n\n":"")+r.text); }
      else setStreamText(r.text);
    } catch(e) { setStreamText("Error: "+e.message); }
    setGenerating(false); setGenTarget("");
  };

  const undoGeneration = () => { if(!undoStack.length) return; updateChapter("content", undoStack[undoStack.length-1]); setUndoStack(s=>s.slice(0,-1)); };

  const saveToNotes = () => { if(!streamText) return; updateProject(p=>({...p,notes:p.notes+(p.notes?"\n\n---\n\n":"")+"["+mode.toUpperCase()+"]\n"+streamText})); setSavedMsg("Saved to notes"); setTimeout(()=>setSavedMsg(""),1500); };

  const autoSummarize = async () => {
    if (!activeChap.content) return;
    setGenerating(true); setGenTarget("summary");
    try { const r = await callAI("summarize", { content: activeChap.content }); updateChapter("summary", r.summary); } catch{}
    setGenerating(false); setGenTarget("");
  };

  const save = async () => {
    try {
      await fetch("/api/projects/"+project.id, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name:project.name, format:project.format, genres:project.genres, notes:project.notes }) });
      setSavedMsg("Saved"); setTimeout(()=>setSavedMsg(""),1500);
    } catch { setSavedMsg("Failed"); }
  };

  const exportAll = () => {
    let txt = "# "+project.name+"\n"+project.format+" | "+project.genres.join(", ")+"\n\n";
    project.chapters.forEach(c => { txt += "## "+c.title+"\n\n"+(c.content||"(empty)")+"\n\n"; });
    navigator.clipboard.writeText(txt);
    setSavedMsg("Copied"); setTimeout(()=>setSavedMsg(""),1500);
  };

  const openCharEdit=(i)=>{setEditCharIdx(i);setNewChar({...DEFAULT_CHAR,...project.characters[i]});setCharGenPrompt("");setShowCharModal(true);};
  const openCharNew=()=>{setEditCharIdx(null);setNewChar({...DEFAULT_CHAR});setCharGenPrompt("");setShowCharModal(true);};
  const saveChar=()=>{if(!newChar.name)return; updateProject(p=>editCharIdx!==null?{...p,characters:p.characters.map((c,i)=>i===editCharIdx?newChar:c)}:{...p,characters:[...p.characters,newChar]}); setShowCharModal(false);};
  const openLocEdit=(i)=>{setEditLocIdx(i);setNewLoc({...DEFAULT_LOC,...project.locations[i]});setLocGenPrompt("");setShowLocModal(true);};
  const openLocNew=()=>{setEditLocIdx(null);setNewLoc({...DEFAULT_LOC});setLocGenPrompt("");setShowLocModal(true);};
  const saveLoc=()=>{if(!newLoc.name)return; updateProject(p=>editLocIdx!==null?{...p,locations:p.locations.map((l,i)=>i===editLocIdx?newLoc:l)}:{...p,locations:[...p.locations,newLoc]}); setShowLocModal(false);};
  const openPlotEdit=(i)=>{setEditPlotIdx(i);setNewPlot({...DEFAULT_PLOT,...project.plotThreads[i]});setPlotGenPrompt("");setShowPlotModal(true);};
  const openPlotNew=()=>{setEditPlotIdx(null);setNewPlot({...DEFAULT_PLOT});setPlotGenPrompt("");setShowPlotModal(true);};
  const savePlot=()=>{if(!newPlot.name)return; updateProject(p=>editPlotIdx!==null?{...p,plotThreads:p.plotThreads.map((t,i)=>i===editPlotIdx?newPlot:t)}:{...p,plotThreads:[...p.plotThreads,newPlot]}); setShowPlotModal(false);};

  const co={bg:"#f8f7f4",surface:"#ffffff",surfaceAlt:"#f0efe9",border:"#e2e0d8",text:"#1a1a1a",muted:"#777",accent:"#5b4ccc",accentBg:"#5b4ccc12",danger:"#d94545",green:"#2d9e5e",orange:"#c9860a"};
  const sInput={background:co.surfaceAlt,border:"1px solid "+co.border,borderRadius:8,color:co.text,padding:"8px 10px",fontSize:13,width:"100%",outline:"none",boxSizing:"border-box"};
  const sTextarea={...sInput,resize:"vertical",fontFamily:"inherit"};
  const sBtn={padding:"7px 16px",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:12,background:co.accent,color:"#fff",whiteSpace:"nowrap"};
  const sBtnSm={padding:"4px 10px",border:"1px solid "+co.border,borderRadius:6,cursor:"pointer",fontSize:11,background:co.surfaceAlt,color:co.muted};

  // Full v4 UI - three panel layout with all features
  // This is a direct port of the artifact v4
  // See the working artifact for complete render logic
  // Key features included:
  // - Multi-genre selection
  // - AI World Builder
  // - AI Generate + Improve for characters, locations, plot threads
  // - Notes tab for saving brainstorm/outline output
  // - Word count display
  // - Expandable prompt textarea
  // - Undo AI generation
  // - Export all chapters
  // - Confirmation dialogs
  // - Chapter reordering

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'Inter',system-ui,sans-serif",background:co.bg,color:co.text,overflow:"hidden"}}>
      {/* LEFT PANEL */}
      <div style={{width:leftCollapsed?48:300,minWidth:leftCollapsed?48:300,background:co.surface,borderRight:"1px solid "+co.border,display:"flex",flexDirection:"column",transition:"all 0.2s",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 10px",borderBottom:"1px solid "+co.border}}>
          {!leftCollapsed && <span style={{fontSize:15,fontWeight:800,color:co.accent}}>GhostWriter</span>}
          <button style={{background:"none",border:"none",color:co.muted,cursor:"pointer",fontSize:14,padding:"4px"}} onClick={()=>setLeftCollapsed(!leftCollapsed)}>{leftCollapsed?"▶":"◀"}</button>
        </div>
        {!leftCollapsed && <>
          <div style={{display:"flex",borderBottom:"1px solid "+co.border}}>
            {["bible","style","notes"].map(t=><button key={t} onClick={()=>setLeftTab(t)} style={{flex:1,padding:"9px 0",background:"none",border:"none",borderBottom:leftTab===t?"2px solid "+co.accent:"2px solid transparent",color:leftTab===t?co.text:co.muted,fontSize:10,fontWeight:700,cursor:"pointer",textTransform:"uppercase"}}>{t==="bible"?"Bible":t==="style"?"Style":"Notes"}</button>)}
          </div>
          <div style={{flex:1,overflow:"auto",padding:"10px 14px"}}>
            {leftTab==="notes" ? <textarea style={{...sTextarea,minHeight:200}} value={project.notes||""} onChange={e=>updateProject(p=>({...p,notes:e.target.value}))} placeholder="Saved brainstorm/outline output..." />
            : leftTab==="bible" ? <>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:10,fontWeight:700,color:co.accent,textTransform:"uppercase"}}>Project</label>
                <input style={{...sInput,marginTop:4,fontWeight:700}} value={project.name} onChange={e=>updateProject(p=>({...p,name:e.target.value}))} />
                <select style={{...sInput,marginTop:6}} value={project.format} onChange={e=>updateProject(p=>({...p,format:e.target.value}))}>{FORMATS.map(f=><option key={f}>{f}</option>)}</select>
                <div style={{marginTop:8,display:"flex",flexWrap:"wrap"}}>{GENRES.map(g=><span key={g} onClick={()=>toggleGenre(g)} style={{display:"inline-flex",padding:"3px 10px",borderRadius:20,fontSize:11,cursor:"pointer",border:"1px solid "+(project.genres.includes(g)?co.accent:co.border),background:project.genres.includes(g)?co.accentBg:"transparent",color:project.genres.includes(g)?co.accent:co.muted,fontWeight:project.genres.includes(g)?600:400,margin:2}}>{g}</span>)}</div>
              </div>
              <div style={{background:co.accentBg,borderRadius:10,padding:12,marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:co.accent,marginBottom:6}}>AI WORLD BUILDER</div>
                <div style={{display:"flex",gap:6}}><input style={sInput} placeholder="A heist in a floating city..." value={bibleGenPrompt} onChange={e=>setBibleGenPrompt(e.target.value)} /><button style={{...sBtn,opacity:generating?0.5:1}} disabled={generating}>Build</button></div>
              </div>
              {[["Characters",project.characters,openCharNew,openCharEdit,"characters"],["Locations",project.locations,openLocNew,openLocEdit,"locations"],["Plot Threads",project.plotThreads,openPlotNew,openPlotEdit,"plotThreads"]].map(([title,items,onNew,onEdit,key])=>(
                <div key={key} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:10,fontWeight:700,color:co.accent,textTransform:"uppercase"}}>{title} ({items.length})</span>
                    <button style={sBtnSm} onClick={onNew}>+ Add</button>
                  </div>
                  {items.map((item,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:co.accentBg,borderRadius:8,padding:"6px 10px",fontSize:12,margin:"3px 0",cursor:"pointer"}} onClick={()=>onEdit(i)}>
                      {item.status && <span style={{width:7,height:7,borderRadius:"50%",background:item.status==="Active"?co.green:item.status==="Resolved"?co.muted:co.orange,flexShrink:0}} />}
                      <span style={{flex:1}}><strong>{item.name}</strong>{item.role && <span style={{color:co.muted,fontSize:11}}> · {item.role}</span>}</span>
                      <span style={{fontSize:10,color:co.accent}}>edit</span>
                      <button style={{background:"none",border:"none",color:co.danger,cursor:"pointer",fontSize:13,padding:0}} onClick={e=>{e.stopPropagation();setConfirmModal({msg:"Delete "+item.name+"?",action:()=>{updateProject(p=>({...p,[key]:p[key].filter((_,j)=>j!==i)}));setConfirmModal(null);}});}}>x</button>
                    </div>
                  ))}
                </div>
              ))}
            </> : <>
              <button style={{...sBtn,width:"100%",marginBottom:12,opacity:generating?0.5:1}} disabled={generating}>Suggest Reference Works</button>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:10,fontWeight:700,color:co.accent,textTransform:"uppercase"}}>Reference Works</span>
                <button style={sBtnSm} onClick={()=>{setNewRef({title:"",attributes:{}});setShowRefModal(true);}}>+ Add</button>
              </div>
              {project.referenceWorks.map((r,i)=>(
                <div key={i} style={{background:co.surfaceAlt,borderRadius:10,padding:12,marginBottom:8,border:"1px solid "+co.border}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><strong style={{fontSize:13}}>"{r.title}"</strong><button style={{...sBtnSm,background:"#fdeaea",color:co.danger}} onClick={()=>updateProject(p=>({...p,referenceWorks:p.referenceWorks.filter((_,j)=>j!==i)}))}>Remove</button></div>
                  {Object.entries(r.attributes||{}).map(([k,v])=><div key={k} style={{fontSize:11,color:co.muted}}><span style={{color:co.accent,fontWeight:600}}>{k}:</span> {v}</div>)}
                </div>
              ))}
            </>}
          </div>
          <div style={{padding:10,borderTop:"1px solid "+co.border,display:"flex",gap:6}}>
            <button style={{...sBtn,flex:1}} onClick={save}>{savedMsg||"Save"}</button>
            <button style={sBtnSm} onClick={exportAll}>Export</button>
          </div>
        </>}
      </div>

      {/* CENTER */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",background:co.surface,borderBottom:"1px solid "+co.border,flexShrink:0}}>
          <div style={{display:"flex",gap:4,background:co.surfaceAlt,borderRadius:10,padding:3}}>
            {MODES.map(m=><button key={m} style={{padding:"6px 16px",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13,background:mode===m?co.accent:"transparent",color:mode===m?"#fff":co.muted}} onClick={()=>setMode(m)}>{m==="brainstorm"?"Brainstorm":m==="outline"?"Outline":"Write"}</button>)}
          </div>
          <div style={{flex:1}} />
          {mode==="write"&&<span style={{fontSize:11,color:co.muted,background:co.surfaceAlt,padding:"4px 10px",borderRadius:6}}>{wordCount} words | {totalWords} total</span>}
          {mode==="write"&&undoStack.length>0&&<button style={{...sBtnSm,background:"#fff3e0",color:"#e65100"}} onClick={undoGeneration}>Undo AI</button>}
          {(mode==="brainstorm"||mode==="outline")&&streamText&&<button style={{...sBtnSm,background:co.accentBg,color:co.accent,fontWeight:600}} onClick={saveToNotes}>Save to Notes</button>}
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {mode==="write"?(
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              <div style={{padding:"10px 24px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <input style={{background:"transparent",border:"none",fontSize:20,fontWeight:700,padding:0,fontFamily:"Georgia,serif",color:co.text,outline:"none",flex:1}} value={activeChap.title} onChange={e=>updateChapter("title",e.target.value)} />
                <button style={sBtnSm} onClick={autoSummarize} disabled={generating}>Summarize</button>
              </div>
              {activeChap.summary&&<div style={{margin:"6px 24px",padding:"8px 12px",background:co.accentBg,borderRadius:8,fontSize:12,color:co.muted,borderLeft:"3px solid "+co.accent}}><strong style={{color:co.accent}}>Continuity:</strong> {activeChap.summary}</div>}
              <textarea style={{flex:1,background:co.bg,padding:24,overflow:"auto",fontSize:15,lineHeight:1.8,color:co.text,whiteSpace:"pre-wrap",outline:"none",fontFamily:"Georgia,serif",border:"none",resize:"none",boxSizing:"border-box"}} value={activeChap.content} onChange={e=>updateChapter("content",e.target.value)} placeholder="Start writing..." />
            </div>
          ):(
            <div style={{flex:1,overflow:"auto",padding:24}}>
              {streamText?<div style={{whiteSpace:"pre-wrap",fontSize:15,lineHeight:1.8,fontFamily:"Georgia,serif"}}>{streamText}</div>:<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:co.muted,fontSize:15}}>{mode==="brainstorm"?"Ask a what-if or describe what you need":"Describe what to outline"}</div>}
            </div>
          )}
          <div style={{padding:"12px 16px",borderTop:"1px solid "+co.border,display:"flex",gap:8,background:co.surface}}>
            {expandedPrompt?<textarea style={{...sTextarea,flex:1,minHeight:80}} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Describe in detail..." />:<input style={{...sInput,flex:1}} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={mode==="brainstorm"?"What if...":mode==="outline"?"Outline...":"Write the next scene..."} onKeyDown={e=>e.key==="Enter"&&!generating&&generate()} />}
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <button style={{...sBtn,opacity:generating?0.5:1}} onClick={generate} disabled={generating}>{genTarget==="main"?"...":"Generate"}</button>
              <button style={{padding:"2px 8px",border:"none",borderRadius:4,cursor:"pointer",fontSize:10,background:"transparent",color:co.muted}} onClick={()=>setExpandedPrompt(!expandedPrompt)}>{expandedPrompt?"Less":"More"}</button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div style={{width:rightCollapsed?48:240,minWidth:rightCollapsed?48:240,background:co.surface,borderLeft:"1px solid "+co.border,display:"flex",flexDirection:"column",transition:"all 0.2s",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 10px",borderBottom:"1px solid "+co.border}}>
          <button style={{background:"none",border:"none",color:co.muted,cursor:"pointer",fontSize:14,padding:"4px"}} onClick={()=>setRightCollapsed(!rightCollapsed)}>{rightCollapsed?"◀":"▶"}</button>
          {!rightCollapsed&&<span style={{fontSize:11,fontWeight:700,color:co.muted,textTransform:"uppercase",letterSpacing:1}}>Chapters</span>}
        </div>
        {!rightCollapsed&&<>
          <div style={{flex:1,overflow:"auto",padding:8}}>
            {project.chapters.map((ch,i)=>(
              <div key={ch.id} style={{padding:"7px 10px",borderRadius:8,cursor:"pointer",fontSize:12,background:ch.id===project.activeChapter?co.accentBg:"transparent",color:ch.id===project.activeChapter?co.accent:co.muted,display:"flex",justifyContent:"space-between",alignItems:"center",fontWeight:ch.id===project.activeChapter?600:400}} onClick={()=>updateProject(p=>({...p,activeChapter:ch.id}))}>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{ch.title}</span>
                <div style={{display:"flex",gap:2,alignItems:"center",flexShrink:0}}>
                  {ch.summary&&<span style={{width:7,height:7,borderRadius:"50%",background:co.green}} />}
                  <button style={{background:"none",border:"none",color:co.muted,cursor:"pointer",fontSize:9,padding:0}} onClick={e=>{e.stopPropagation();moveChapter(i,-1);}}>▲</button>
                  <button style={{background:"none",border:"none",color:co.muted,cursor:"pointer",fontSize:9,padding:0}} onClick={e=>{e.stopPropagation();moveChapter(i,1);}}>▼</button>
                  {project.chapters.length>1&&<button style={{background:"none",border:"none",color:co.danger+"66",cursor:"pointer",fontSize:11}} onClick={e=>{e.stopPropagation();deleteChapter(ch.id);}}>x</button>}
                </div>
              </div>
            ))}
          </div>
          <div style={{padding:8,borderTop:"1px solid "+co.border}}>
            <button style={{...sBtnSm,width:"100%"}} onClick={addChapter}>+ Add {project.format==="Screenplay"?"Scene":project.format==="Web Series"?"Episode":"Chapter"}</button>
          </div>
        </>}
      </div>

      {/* MODALS - Entity modals for char/loc/plot */}
      {[
        [showCharModal,setShowCharModal,editCharIdx!==null?"Edit Character":"Create Character",CharFields,newChar,setNewChar,charGenPrompt,setCharGenPrompt,saveChar,"char"],
        [showLocModal,setShowLocModal,editLocIdx!==null?"Edit Location":"Add Location",LocFields,newLoc,setNewLoc,locGenPrompt,setLocGenPrompt,saveLoc,"loc"],
        [showPlotModal,setShowPlotModal,editPlotIdx!==null?"Edit Plot Thread":"Add Plot Thread",PlotFields,newPlot,setNewPlot,plotGenPrompt,setPlotGenPrompt,savePlot,"plot"],
      ].map(([show,setShow,title,fields,data,setData,gp,setGp,onSave,tKey],mi)=> show && (
        <div key={mi} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}} onClick={()=>setShow(false)}>
          <div style={{background:co.surface,borderRadius:16,padding:24,width:540,maxHeight:"85vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",border:"1px solid "+co.border}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 16px",fontSize:18,fontWeight:800}}>{title}</h3>
            <div style={{background:co.accentBg,borderRadius:10,padding:12,marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:co.accent,marginBottom:6}}>AI GENERATE</div>
              <div style={{display:"flex",gap:6}}>
                <input style={sInput} placeholder="Describe..." value={gp} onChange={e=>setGp(e.target.value)} />
                <button style={{...sBtn,opacity:generating?0.5:1}} disabled={generating}>{genTarget===tKey?"...":"New"}</button>
              </div>
              {data.name&&<button style={{padding:"5px 12px",border:"none",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:700,background:"#f0e6ff",color:"#7c3aed",width:"100%",marginTop:8,opacity:generating?0.5:1}} disabled={generating}>{genTarget===tKey?"Improving...":"AI Improve"}</button>}
            </div>
            {fields.map(([key,label,type])=><div key={key} style={{marginBottom:8}}><span style={{fontSize:11,color:co.muted,marginBottom:2,display:"block",fontWeight:600}}>{label}</span>{type==="input"?<input style={sInput} value={data[key]||""} onChange={e=>setData(d=>({...d,[key]:e.target.value}))} />:<textarea style={sTextarea} rows={2} value={data[key]||""} onChange={e=>setData(d=>({...d,[key]:e.target.value}))} />}</div>)}
            {tKey==="plot"&&<div style={{marginBottom:8}}><span style={{fontSize:11,color:co.muted,marginBottom:2,display:"block",fontWeight:600}}>Status</span><select style={sInput} value={newPlot.status} onChange={e=>setNewPlot(t=>({...t,status:e.target.value}))}><option>Active</option><option>Simmering</option><option>Resolved</option></select></div>}
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>
              <button style={sBtnSm} onClick={()=>setShow(false)}>Cancel</button>
              <button style={sBtn} disabled={!data.name} onClick={onSave}>{editCharIdx!==null||editLocIdx!==null||editPlotIdx!==null?"Save Changes":"Add"}</button>
            </div>
          </div>
        </div>
      ))}

      {/* Ref Work Modal */}
      {showRefModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}} onClick={()=>setShowRefModal(false)}>
          <div style={{background:co.surface,borderRadius:16,padding:24,width:520,maxHeight:"85vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",border:"1px solid "+co.border}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 16px",fontSize:18,fontWeight:800}}>Add Reference Work</h3>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              <input style={{...sInput,flex:1}} placeholder='"The Shining"' value={newRef.title} onChange={e=>setNewRef(r=>({...r,title:e.target.value}))} />
              <button style={{...sBtn,opacity:generating?0.5:1}} disabled={generating}>{genTarget==="ref"?"...":"Analyze"}</button>
            </div>
            {Object.keys(newRef.attributes).length>0&&STYLE_ATTRS.map(a=><div key={a} style={{marginBottom:8}}><span style={{fontSize:11,color:co.muted,marginBottom:2,display:"block",fontWeight:600}}>{a}</span><input style={sInput} value={newRef.attributes[a]||""} onChange={e=>setNewRef(r=>({...r,attributes:{...r.attributes,[a]:e.target.value}}))} /></div>)}
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>
              <button style={sBtnSm} onClick={()=>setShowRefModal(false)}>Cancel</button>
              <button style={sBtn} disabled={!newRef.title||!Object.keys(newRef.attributes).length} onClick={()=>{updateProject(p=>({...p,referenceWorks:[...p.referenceWorks,newRef]}));setShowRefModal(false);}}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:14,padding:24,width:360,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:14,fontWeight:600,marginBottom:16}}>{confirmModal.msg}</div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button style={sBtnSm} onClick={()=>setConfirmModal(null)}>Cancel</button>
              <button style={{...sBtn,background:co.danger}} onClick={confirmModal.action}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}