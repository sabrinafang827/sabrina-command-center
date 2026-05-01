import { useState, useEffect, useCallback, useRef, Component } from "react";

class ErrorBoundary extends Component {
  state = {hasError:false};
  static getDerivedStateFromError() { return {hasError:true}; }
  componentDidCatch(e) { console.error("App crashed:",e); }
  reset() {
    fetch(`${FIREBASE_URL}/${DB_KEY}.json`,{method:"DELETE"})
      .then(()=>{ this.setState({hasError:false}); window.location.reload(); });
  }
  render() {
    if(this.state.hasError) return (
      <div style={{minHeight:"100vh",background:"#eef1f8",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,fontFamily:"sans-serif"}}>
        <p style={{color:"#1a2952",fontSize:16,fontWeight:600}}>Oops! Something went wrong.</p>
        <button onClick={()=>this.reset()} style={{background:"#1a2952",color:"#fff",border:"none",borderRadius:8,padding:"10px 24px",fontSize:14,cursor:"pointer"}}>
          Reset & reload
        </button>
      </div>
    );
    return this.props.children;
  }
}

// ── Palette: Option D ─────────────────────────────────────────────────────────
const C = {
  navy:        "#1a2952",
  navyMid:     "#223368",
  navyLight:   "#e4e9f5",
  cobalt:      "#2952A3",
  cobaltLight: "#dce3f4",
  cobaltText:  "#1e3d7a",
  bg:          "#eef1f8",
  bgSoft:      "#e6eaf4",
  white:       "#ffffff",
  text:        "#1a2952",
  textMid:     "#3a4e78",
  textSoft:    "#7a8fb5",
  border:      "#dce0ec",
  borderSoft:  "#e8ebf4",
  green:       "#1e8a5e",
  greenSoft:   "#d4f0e6",
  red:         "#c03a3a",
  redSoft:     "#fde8e8",
  amber:       "#a06010",
  amberSoft:   "#fef3da",
  cream:       "#fffbe8",
  creamText:   "#7a6000",
  creamBorder: "#f0e090",
  butter:      "#fdf6d8",   // warm champagne — notes unselected tabs (now light blue below)
  butterText:  "#7a5c00",   // dark text on champagne
  butterBorder:"#f5e47a",   // champagne border
  butterActive:"#c8b800",   // darker for active border
  lemon:       "#fafacc",   // pale lemon C — header stats
  lemonText:   "#5a5800",   // text on lemon
  lemonBorder: "#d4d428",   // lemon border
};

const uid = () => Math.random().toString(36).slice(2,9);
const today = () => new Date().toISOString().slice(0,10);

const CURRENCIES = [
  {code:"USD",symbol:"$",name:"US Dollar"},
  {code:"TWD",symbol:"NT$",name:"Taiwan Dollar"},
  {code:"EUR",symbol:"€",name:"Euro"},
  {code:"GBP",symbol:"£",name:"British Pound"},
  {code:"JPY",symbol:"¥",name:"Japanese Yen"},
  {code:"AUD",symbol:"A$",name:"Australian Dollar"},
  {code:"CAD",symbol:"C$",name:"Canadian Dollar"},
  {code:"SGD",symbol:"S$",name:"Singapore Dollar"},
  {code:"HKD",symbol:"HK$",name:"Hong Kong Dollar"},
  {code:"KRW",symbol:"₩",name:"Korean Won"},
  {code:"THB",symbol:"฿",name:"Thai Baht"},
];

const fmt = (n, symbol="$") => {
  const abs = Math.abs(n||0);
  const formatted = abs >= 1000 ? symbol + abs.toLocaleString("en-US", {maximumFractionDigits:0}) : symbol + abs.toFixed(abs < 10 ? 2 : 0).replace(/\.00$/,"");
  return (n||0) < 0 ? "-" + formatted : formatted;
};

// ── Firebase config ───────────────────────────────────────────────────────────
const FIREBASE_URL = "https://sabrina-command-center-default-rtdb.firebaseio.com";
const DB_KEY = "commandcenter";

async function loadData() {
  try {
    const res = await fetch(`${FIREBASE_URL}/${DB_KEY}.json`);
    if(!res.ok) return null;
    const d = await res.json();
    if(!d || !d.trips || !Array.isArray(d.trips) || d.trips.length===0) return null;
    // Ensure all trips have required fields
    d.trips = d.trips.map(t=>({
      ...t,
      days: (t.days||[]).map(day=>({
        ...day,
        spots: (day.spots||[]).map(s=>({...s,lat:s.lat||0,lng:s.lng||0,duration:s.duration||"",addedTodo:s.addedTodo||false,loggedExpense:s.loggedExpense||false})),
        todos: (day.todos||[]).map(td=>({...td,done:td.done||false,category:td.category||"Other",deadline:td.deadline||""})),
      })),
      expenses: (t.expenses||[]),
      notes: (t.notes||[]).map(n=>({...n,votes:n.votes||[]})),
      people: t.people||["Me","Partner"],
      exchangeRates: t.exchangeRates||{},
      noteCats: t.noteCats||NOTE_CATS,
    }));
    return d;
  } catch(e) { console.error("Load error",e); return null; }
}

async function saveData(d) {
  try {
    // Strip undefined values by round-tripping through JSON
    const clean = JSON.parse(JSON.stringify(d));
    await fetch(`${FIREBASE_URL}/${DB_KEY}.json`, {
      method: "PUT",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(clean)
    });
  } catch(e) { console.error("Save error",e); }
}

// Poll for remote changes every 5 seconds
function useFirebaseSync(data, setData) {
  const lastSaved = useRef(null);
  useEffect(()=>{
    const interval = setInterval(async()=>{
      try {
        const res = await fetch(`${FIREBASE_URL}/${DB_KEY}.json`);
        if(!res.ok) return;
        const remote = await res.json();
        if(!remote) return;
        const remoteStr = JSON.stringify(remote);
        if(remoteStr !== lastSaved.current) {
          lastSaved.current = remoteStr;
          setData(remote);
        }
      } catch(e){}
    }, 5000);
    return ()=>clearInterval(interval);
  },[setData]);
  return lastSaved;
}

const EXPENSE_CATS = ["Flights","Accommodation","Transport","Food & Drink","Activities","Shopping","Health","Other"];
const TODO_CATS    = ["Activities","Restaurant","Accommodation","Logistics","Shopping","Packing","Health","Other"];
const NOTE_CATS    = ["Restaurant","Café","Bar","Golf","Museum","Hotel","Things to Do","Shopping","Other"];

const SEED = ()=>({
  trips:[{
    id:uid(), name:"Tokyo Spring", emoji:"🌸",
    startDate:"2025-03-28", endDate:"2025-04-04",
    people:["Me","Partner"], budget:4000, currency:"USD", exchangeRates:{JPY:150,EUR:0.92},
    days:[
      { id:uid(), date:"2025-03-28", title:"Arrival & Shinjuku", travelTime:"",
        spots:[
          {id:uid(),name:"Shinjuku Gyoen",note:"Cherry blossoms peak — arrive by 9am",cost:8,paidBy:"Me",split:"50/50",addedTodo:false,loggedExpense:false,duration:"2h",lat:35.6852,lng:139.7100},
          {id:uid(),name:"Omoide Yokocho",note:"Yakitori dinner, cash only",cost:35,paidBy:"Partner",split:"50/50",addedTodo:false,loggedExpense:false,duration:"1.5h",lat:35.6918,lng:139.6994},
        ],
        todos:[{id:uid(),text:"Book Shinjuku Gyoen tickets online",done:false,category:"Logistics",deadline:""}]
      },
      { id:uid(), date:"2025-03-29", title:"Asakusa & Ueno", travelTime:"30 min by metro",
        spots:[
          {id:uid(),name:"Senso-ji Temple",note:"Early morning — free entry",cost:0,paidBy:"",split:"50/50",addedTodo:false,loggedExpense:false,duration:"1h",lat:35.7147,lng:139.7967},
          {id:uid(),name:"Ueno Park hanami",note:"Bring a picnic blanket",cost:20,paidBy:"Me",split:"50/50",addedTodo:false,loggedExpense:false,duration:"2h",lat:35.7146,lng:139.7731},
        ],
        todos:[]
      },
    ],
    expenses:[
      {id:uid(),desc:"Flights (round trip)",amount:1400,paidBy:"Me",split:"50/50",category:"Flights"},
      {id:uid(),desc:"Hotel 7 nights",amount:980,paidBy:"Partner",split:"50/50",category:"Accommodation"},
    ],
    notes:[
      {id:uid(),title:"Ichiran Ramen Shibuya",body:"Famous solo ramen booths. Open 24h. Must try tonkotsu.",category:"Restaurant",pinned:true,votes:[]},
      {id:uid(),title:"Suntory Whisky Bar",body:"Rooftop bar in Shinjuku, great city views at night.",category:"Bar",pinned:false,votes:[]},
    ],
  }],
  activeTrip:0,
});

// ── UI Primitives ─────────────────────────────────────────────────────────────
const Inp = ({style,...p}) => (
  <input style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 11px",fontSize:13,color:C.text,outline:"none",fontFamily:"inherit",...style}} {...p}/>
);
const Sel = ({style,...p}) => (
  <select style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",fontSize:13,color:C.text,fontFamily:"inherit",outline:"none",cursor:"pointer",...style}} {...p}/>
);
const PBtn = ({children,onClick,style,...p}) => (
  <button onClick={onClick} style={{background:C.navy,color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600,...style}} {...p}>{children}</button>
);
const GBtn = ({children,onClick,style,...p}) => (
  <button onClick={onClick} style={{background:"transparent",color:C.textMid,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer",fontFamily:"inherit",...style}} {...p}>{children}</button>
);
const NavTab = ({active,onClick,children}) => (
  <button onClick={onClick} style={{background:"none",border:"none",borderBottom:`2px solid ${active?C.cobalt:"transparent"}`,padding:"12px 20px",fontSize:13,color:active?C.navy:C.textSoft,cursor:"pointer",fontFamily:"inherit",fontWeight:active?700:400,transition:"all .18s",whiteSpace:"nowrap"}}>{children}</button>
);
const SubTab = ({active,onClick,children}) => (
  <button onClick={onClick} style={{background:active?C.cobaltLight:"transparent",color:active?C.cobaltText:C.textSoft,border:`1px solid ${active?C.cobalt:C.border}`,borderRadius:20,padding:"5px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:active?600:400,whiteSpace:"nowrap",transition:"all .15s"}}>{children}</button>
);
const Tag = ({children,color="cobalt",style}) => {
  const map={cobalt:[C.navyLight,C.cobaltText],green:[C.greenSoft,C.green],red:[C.redSoft,C.red],amber:[C.amberSoft,C.amber],gray:[C.bgSoft,C.textSoft],cream:[C.cream,C.creamText]};
  const [bg,tc]=map[color]||map.cobalt;
  return <span style={{display:"inline-flex",alignItems:"center",background:bg,color:tc,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600,...style}}>{children}</span>;
};
const Card = ({children,style,...p}) => (
  <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,...style}} {...p}>{children}</div>
);
const SectionHead = ({children,style}) => (
  <p style={{margin:"0 0 6px",fontSize:10,fontWeight:700,color:C.textSoft,textTransform:"uppercase",letterSpacing:.9,...style}}>{children}</p>
);

// ── Trip Settings Modal ───────────────────────────────────────────────────────
function TripSettings({trip,onUpdate,onClose}) {
  const [form,setForm] = useState({
    name:trip.name||"My Trip",
    emoji:trip.emoji||"✈️",
    startDate:trip.startDate||today(),
    endDate:trip.endDate||today(),
    currency:trip.currency||"USD",
    people:[...(trip.people||["Me","Partner"])],
  });
  const save = () => {
    if(!form.name.trim()) return;
    onUpdate({
      ...trip,
      name:form.name.trim(),
      emoji:form.emoji||"✈️",
      startDate:form.startDate||trip.startDate,
      endDate:form.endDate||trip.endDate,
      currency:form.currency||"USD",
      people:form.people.filter(p=>p.trim()).length>0 ? form.people.filter(p=>p.trim()) : trip.people,
    });
    onClose();
  };
  const updatePerson = (i,v) => { const p=[...form.people]; p[i]=v; setForm(f=>({...f,people:p})); };
  const addPerson = () => setForm(f=>({...f,people:[...f.people,""]}));
  const removePerson = (i) => setForm(f=>({...f,people:f.people.filter((_,j)=>j!==i)}));

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,41,82,.45)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.white,borderRadius:16,padding:"28px 32px",width:440,maxWidth:"90vw",boxShadow:"0 8px 40px rgba(26,41,82,.18)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{margin:0,fontSize:18,fontWeight:700,color:C.navy,fontFamily:"'DM Serif Display',Georgia,serif"}}>Trip settings</h2>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,color:C.textSoft,cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:"0 0 56px"}}>
              <SectionHead>Emoji</SectionHead>
              <Inp value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} style={{width:"100%",textAlign:"center",fontSize:18}}/>
            </div>
            <div style={{flex:1}}>
              <SectionHead>Trip name</SectionHead>
              <Inp value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{width:"100%"}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}>
              <SectionHead>Start date</SectionHead>
              <Inp type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={{width:"100%"}}/>
            </div>
            <div style={{flex:1}}>
              <SectionHead>End date</SectionHead>
              <Inp type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} style={{width:"100%"}}/>
            </div>
          </div>
          <div>
            <SectionHead>Currency</SectionHead>
            <Sel value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} style={{width:"100%"}}>
              {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.symbol} {c.name}</option>)}
            </Sel>
          </div>
          <div>
            <SectionHead>Travelers</SectionHead>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {form.people.map((p,i)=>(
                <div key={i} style={{display:"flex",gap:6}}>
                  <Inp value={p} onChange={e=>updatePerson(i,e.target.value)} placeholder={`Traveler ${i+1}`} style={{flex:1}}/>
                  {form.people.length>1&&<button onClick={()=>removePerson(i)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"0 10px",color:C.red,cursor:"pointer",fontSize:16}}>×</button>}
                </div>
              ))}
              <button onClick={addPerson} style={{background:"none",border:`1px dashed ${C.border}`,borderRadius:8,padding:"7px",fontSize:12,color:C.textSoft,cursor:"pointer",fontFamily:"inherit"}}>+ Add traveler</button>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:22,justifyContent:"flex-end"}}>
          <GBtn onClick={onClose} style={{fontSize:13}}>Cancel</GBtn>
          <PBtn onClick={save} style={{fontSize:13}}>Save changes</PBtn>
        </div>
      </div>
    </div>
  );
}

// ── Expanded Spot Panel ───────────────────────────────────────────────────────
function ExpandedSpot({spot,dayId,trip,currSymbol,onUpdate,onAddTodo,onLogExpense,onRemove,onFieldChange}) {
  const [showBudget,setShowBudget] = useState(false);
  return (
    <div style={{borderTop:`1px solid ${C.border}`,background:C.bg}}>
      {/* Main row: duration + actions */}
      <div style={{padding:"12px 14px",display:"flex",flexWrap:"wrap",gap:14,alignItems:"flex-start"}}>
        <div style={{flex:"0 1 140px"}}>
          <SectionHead>Duration</SectionHead>
          <Inp placeholder="e.g. 2h" value={spot.duration||""} style={{width:"100%",marginTop:6}}
            onChange={e=>onFieldChange("duration",e.target.value)}/>
        </div>
        <div style={{flex:"1 1 220px"}}>
          <SectionHead>Quick actions</SectionHead>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
            {!spot.addedTodo
              ? <GBtn onClick={onAddTodo} style={{fontSize:12,padding:"5px 12px"}}>+ To-dos</GBtn>
              : <Tag color="green" style={{padding:"5px 12px"}}>✓ In to-dos</Tag>}
            <GBtn onClick={()=>setShowBudget(b=>!b)} style={{fontSize:12,padding:"5px 12px",color:showBudget?C.cobalt:C.textMid,borderColor:showBudget?C.cobalt:C.border}}>
              {showBudget?"▲ Budget":"▼ Budget"}
            </GBtn>
            <GBtn onClick={onRemove} style={{fontSize:12,padding:"5px 12px",color:C.red,borderColor:"rgba(192,58,58,.25)"}}>Remove</GBtn>
          </div>
        </div>
      </div>
      {/* Collapsible budget row */}
      {showBudget&&(
        <div style={{padding:"10px 14px 14px",borderTop:`1px solid ${C.borderSoft}`,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          <Inp type="number" placeholder={`Amount ${currSymbol}`} value={spot.cost||""} style={{width:95}}
            onChange={e=>onFieldChange("cost",+e.target.value)}/>
          <select value={spot.paidBy} onChange={e=>onFieldChange("paidBy",e.target.value)}
            style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",fontSize:13,color:spot.paidBy?C.text:C.textSoft,fontFamily:"inherit",outline:"none",flex:1,minWidth:90}}>
            <option value="">Who paid?</option>{trip.people.map(p=><option key={p}>{p}</option>)}
          </select>
          <select value={spot.split} onChange={e=>onFieldChange("split",e.target.value)}
            style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",fontSize:13,color:C.text,fontFamily:"inherit",outline:"none",minWidth:90}}>
            <option>50/50</option><option>Paid all</option><option>Me only</option><option>Partner only</option>
          </select>
          {!spot.loggedExpense&&spot.cost>0&&spot.paidBy
            ? <GBtn onClick={onLogExpense} style={{fontSize:12,padding:"5px 12px"}}>+ Log to budget</GBtn>
            : spot.loggedExpense&&<Tag color="cobalt" style={{padding:"5px 12px"}}>✓ In budget</Tag>}
        </div>
      )}
    </div>
  );
}

// ── Itinerary Hub ─────────────────────────────────────────────────────────────
function ItineraryHub({trip,onUpdate,currSymbol}) {
  const [aiLoading,setAiLoading]   = useState(null);
  const [chatDay,setChatDay]       = useState(null);
  const [chatMsgs,setChatMsgs]     = useState({});
  const [chatInput,setChatInput]   = useState("");
  const [expandedSpot,setExpanded] = useState(null);
  const [addingSpot,setAddingSpot] = useState(null);
  const [newSpot,setNewSpot]       = useState({name:"",note:"",cost:"",paidBy:"",split:"50/50",duration:"",lat:"",lng:""});
  const [editingDay,setEditingDay] = useState(null);
  const [addingDay,setAddingDay]   = useState(false);
  const [newDay,setNewDay]         = useState({date:today(),title:"",travelTime:""});
  const [dragInfo,setDragInfo]     = useState(null); // {dayId, fromIdx}
  const [dragOver,setDragOver]     = useState(null); // {dayId, idx}
  const chatEndRef = useRef(null);

  const totalSpot = trip.days.flatMap(d=>d.spots).reduce((a,s)=>a+(+s.cost||0),0);
  const totalExp  = trip.expenses.reduce((a,e)=>a+(+e.amount||0),0);
  const total     = totalSpot+totalExp;
  const allTodos  = trip.days.flatMap(d=>d.todos);
  const doneTodos = allTodos.filter(t=>t.done).length;

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}); },[chatMsgs,chatDay]);

  // AI auto-category for todo
  const guessCat = (name) => {
    const n = name.toLowerCase();
    if(/restaurant|ramen|sushi|dinner|lunch|eat|food|cafe|café|bar|drink|izakaya|yakitori|brunch/.test(n)) return "Restaurant";
    if(/hotel|hostel|airbnb|check.?in|check.?out|accommodation/.test(n)) return "Accommodation";
    if(/train|bus|flight|taxi|metro|subway|transport|transfer|airport/.test(n)) return "Logistics";
    if(/shop|market|mall|buy|souvenir|store/.test(n)) return "Shopping";
    if(/pack|luggage|suitcase|bag/.test(n)) return "Packing";
    return "Activities";
  };

  const addTodoFromSpot=(dayId,spot)=>{
    const autoCat = guessCat(spot.name + " " + (spot.note||""));
    const days=trip.days.map(d=>d.id!==dayId?d:{
      ...d,
      spots:d.spots.map(s=>s.id===spot.id?{...s,addedTodo:true}:s),
      todos:[...d.todos,{id:uid(),text:spot.name+(spot.note?` — ${spot.note}`:""),done:false,category:autoCat,deadline:""}]
    });
    onUpdate({...trip,days});
  };

  const logExpense=(dayId,spot)=>{
    if(!spot.cost||!spot.paidBy) return;
    const expense={id:uid(),desc:spot.name,amount:+spot.cost,paidBy:spot.paidBy,split:spot.split,category:"Activities"};
    const days=trip.days.map(d=>d.id===dayId?{...d,spots:d.spots.map(s=>s.id===spot.id?{...s,loggedExpense:true}:s)}:d);
    onUpdate({...trip,expenses:[...trip.expenses,expense],days});
  };

  const saveSpot=(dayId)=>{
    if(!newSpot.name.trim()) return;
    const spot={id:uid(),...newSpot,cost:+newSpot.cost||0,lat:+newSpot.lat||0,lng:+newSpot.lng||0,addedTodo:false,loggedExpense:false};
    onUpdate({...trip,days:trip.days.map(d=>d.id===dayId?{...d,spots:[...d.spots,spot]}:d)});
    setNewSpot({name:"",note:"",cost:"",paidBy:"",split:"50/50",duration:"",lat:"",lng:""}); setAddingSpot(null);
  };

  const updateSpotField=(dayId,spotId,field,val)=>{
    const days=trip.days.map(d=>d.id===dayId?{...d,spots:d.spots.map(s=>s.id===spotId?{...s,[field]:val}:s)}:d);
    onUpdate({...trip,days});
  };

  const removeSpot=(dayId,sid)=>onUpdate({...trip,days:trip.days.map(d=>d.id===dayId?{...d,spots:d.spots.filter(s=>s.id!==sid)}:d)});
  const removeDay=(dayId)=>onUpdate({...trip,days:trip.days.filter(d=>d.id!==dayId)});
  const saveNewDay=()=>{
    if(!newDay.title.trim()) return;
    onUpdate({...trip,days:[...trip.days,{id:uid(),...newDay,spots:[],todos:[]}]});
    setNewDay({date:today(),title:"",travelTime:""}); setAddingDay(false);
  };

  // Drag to reorder
  const onDragStart=(dayId,idx)=>setDragInfo({dayId,idx});
  const onDragOverSpot=(dayId,idx)=>{ if(dragInfo) setDragOver({dayId,idx}); };
  const onDrop=(dayId)=>{
    if(!dragInfo||dragInfo.dayId!==dayId) return;
    const fromIdx=dragInfo.idx;
    const toIdx=dragOver?.idx??fromIdx;
    if(fromIdx===toIdx){setDragInfo(null);setDragOver(null);return;}
    const days=trip.days.map(d=>{
      if(d.id!==dayId) return d;
      const spots=[...d.spots];
      const [moved]=spots.splice(fromIdx,1);
      spots.splice(toIdx,0,moved);
      return {...d,spots};
    });
    onUpdate({...trip,days});
    setDragInfo(null); setDragOver(null);
  };

  const sendChat=async(day)=>{
    const input=chatInput.trim(); if(!input) return;
    const prev=chatMsgs[day.id]||[];
    const next=[...prev,{role:"user",text:input}];
    setChatMsgs(m=>({...m,[day.id]:next})); setChatInput(""); setAiLoading(day.id);
    const history=next.map(m=>({role:m.role==="user"?"user":"assistant",content:m.text}));
    const sys=`You are a friendly travel planning assistant for the trip "${trip.name}" (${trip.startDate}–${trip.endDate}). Current day: "${day.title}" on ${day.date}. Existing spots: ${day.spots.map(s=>s.name).join(", ")||"none"}. When suggesting spots to add, output: <suggestions>[{"name":"...","note":"...","cost":0,"duration":"Xh"}]</suggestions> then a short friendly message. Otherwise chat naturally.`;
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,system:sys,messages:history})});
      const data=await res.json();
      const raw=data.content?.[0]?.text||"";
      const match=raw.match(/<suggestions>([\s\S]*?)<\/suggestions>/);
      if(match){
        try{
          const list=JSON.parse(match[1]);
          const spots=list.map(s=>({id:uid(),name:s.name,note:s.note,cost:s.cost||0,duration:s.duration||"",paidBy:"",split:"50/50",addedTodo:false,loggedExpense:false}));
          onUpdate({...trip,days:trip.days.map(d=>d.id===day.id?{...d,spots:[...d.spots,...spots]}:d)});
        }catch(e){}
      }
      const display=raw.replace(/<suggestions>[\s\S]*?<\/suggestions>/g,"✓ Spots added to your day!").trim();
      setChatMsgs(m=>({...m,[day.id]:[...(m[day.id]||[]),{role:"assistant",text:display}]}));
    }catch(e){console.error(e);}
    setAiLoading(null);
  };

  const [showSummary,setShowSummary] = useState(false);

  return (
    <div>
      {/* Collapsible summary ribbon */}
      <div style={{marginBottom:20}}>
        <button onClick={()=>setShowSummary(s=>!s)} style={{
          display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",
          fontSize:12,color:C.textSoft,fontFamily:"inherit",padding:"0 0 4px",
        }}>
          <span style={{fontSize:10,transition:"transform .2s",display:"inline-block",transform:showSummary?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
          {showSummary?"Hide budget summary":"Show budget summary"}
        </button>
        {showSummary&&(
          <div style={{display:"flex",gap:10,marginTop:10,flexWrap:"wrap"}}>
            {[
              {label:"Budget",val:fmt(trip.budget||0,currSymbol),bg:C.navy,tc:"#fff",lc:"rgba(255,255,255,.55)"},
              {label:"Spent",val:fmt(total,currSymbol),bg:C.cobaltLight,tc:C.navy,lc:C.cobalt},
              {label:"Remaining",val:fmt((trip.budget||0)-total,currSymbol),bg:(trip.budget||0)-total<0?C.redSoft:C.greenSoft,tc:(trip.budget||0)-total<0?C.red:C.green,lc:(trip.budget||0)-total<0?C.red:C.green},
              {label:"Checklist",val:`${doneTodos}/${allTodos.length}`,bg:C.white,tc:C.navy,lc:C.textSoft},
            ].map(({label,val,bg,tc,lc})=>(
              <div key={label} style={{flex:"1 1 130px",background:bg,borderRadius:12,padding:"13px 16px",border:`1px solid ${C.border}`}}>
                <p style={{margin:0,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.7,color:lc}}>{label}</p>
                <p style={{margin:"5px 0 0",fontSize:20,fontWeight:700,color:tc,fontFamily:"'DM Serif Display',Georgia,serif"}}>{val}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {trip.days.map((day,di)=>{
        const dayDuration = day.spots.reduce((a,s)=>{
          const h = parseFloat((s.duration||"").replace(/[^0-9.]/g,""))||0;
          return a+h;
        },0);
        return (
          <div key={day.id} style={{marginBottom:28}}>
            {/* Day header */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,paddingBottom:10,borderBottom:`2px solid ${C.borderSoft}`}}>
              <span style={{background:C.navy,color:"#fff",borderRadius:6,padding:"3px 10px",fontSize:10,fontWeight:700,letterSpacing:.7,flexShrink:0}}>DAY {di+1}</span>
              {editingDay===day.id
                ? <Inp value={day.title} autoFocus style={{flex:1,fontSize:15,fontWeight:700}} onChange={e=>onUpdate({...trip,days:trip.days.map(d=>d.id===day.id?{...d,title:e.target.value}:d)})} onBlur={()=>setEditingDay(null)}/>
                : <span onClick={()=>setEditingDay(day.id)} style={{flex:1,fontSize:15,fontWeight:700,color:C.navy,cursor:"text"}}>{day.title}</span>
              }
              <span style={{fontSize:12,color:C.textSoft}}>{day.date}</span>
              {dayDuration>0&&<Tag color="cobalt" style={{fontSize:11}}>{dayDuration}h total</Tag>}
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:12}}>🚌</span>
                <Inp placeholder="Travel time" value={day.travelTime||""} style={{width:120,fontSize:12,padding:"4px 8px"}}
                  onChange={e=>onUpdate({...trip,days:trip.days.map(d=>d.id===day.id?{...d,travelTime:e.target.value}:d)})}/>
              </div>
              <button onClick={()=>removeDay(day.id)} style={{background:"none",border:"none",color:C.textSoft,cursor:"pointer",fontSize:16,padding:"0 4px"}}>×</button>
            </div>

            {/* Spots — draggable */}
            <div
              style={{display:"flex",flexDirection:"column",gap:6,marginLeft:4}}
              onDragOver={e=>{e.preventDefault();}}
              onDrop={()=>onDrop(day.id)}
            >
              {day.spots.map((spot,si)=>{
                const isDragTarget = dragOver?.dayId===day.id && dragOver?.idx===si && dragInfo?.dayId===day.id && dragInfo?.idx!==si;
                return (
                  <div key={spot.id}
                    draggable
                    onDragStart={()=>onDragStart(day.id,si)}
                    onDragOver={e=>{e.preventDefault();onDragOverSpot(day.id,si);}}
                    style={{opacity:dragInfo?.dayId===day.id&&dragInfo?.idx===si?.5:1,transition:"opacity .15s"}}>
                    {isDragTarget&&<div style={{height:3,background:C.cobalt,borderRadius:2,marginBottom:4}}/>}
                    <Card style={{overflow:"hidden"}}>
                      <div onClick={()=>setExpanded(expandedSpot===spot.id?null:spot.id)}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",background:expandedSpot===spot.id?C.bg:C.white}}>
                        {/* Drag handle */}
                        <span style={{cursor:"grab",color:C.textSoft,fontSize:14,flexShrink:0,userSelect:"none"}} onMouseDown={e=>e.stopPropagation()}>⠿</span>
                        <span style={{width:22,height:22,borderRadius:"50%",background:C.navyLight,color:C.cobaltText,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{si+1}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{margin:0,fontSize:13,fontWeight:600,color:C.navy}}>{spot.name}</p>
                          {spot.note&&<p style={{margin:"2px 0 0",fontSize:12,color:C.textSoft,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{spot.note}</p>}
                        </div>
                        <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
                          {spot.duration&&<Tag color="gray">{spot.duration}</Tag>}
                          {spot.addedTodo&&<Tag color="green">✓ todo</Tag>}
                          {spot.loggedExpense&&<Tag color="cobalt">✓ logged</Tag>}
                          <span style={{color:C.textSoft,fontSize:11,marginLeft:2}}>{expandedSpot===spot.id?"▲":"▼"}</span>
                        </div>
                      </div>
                      {expandedSpot===spot.id&&(
                        <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 14px",background:C.bg,display:"flex",flexWrap:"wrap",gap:16}}>
                          <div style={{flex:"1 1 260px"}}>
                            <SectionHead>Cost & split</SectionHead>
                            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                              <Inp type="number" placeholder={`Amount ${currSymbol}`} value={spot.cost||""} style={{width:90}}
                                onChange={e=>updateSpotField(day.id,spot.id,"cost",+e.target.value)}/>
                              <Sel value={spot.paidBy} style={{flex:1,minWidth:90}} onChange={e=>updateSpotField(day.id,spot.id,"paidBy",e.target.value)}>
                                <option value="">Who paid?</option>{trip.people.map(p=><option key={p}>{p}</option>)}
                              </Sel>
                              <Sel value={spot.split} style={{minWidth:90}} onChange={e=>updateSpotField(day.id,spot.id,"split",e.target.value)}>
                                <option>50/50</option><option>Paid all</option><option>Me only</option><option>Partner only</option>
                              </Sel>
                            </div>
                          </div>
                          <div style={{flex:"0 1 130px"}}>
                            <SectionHead>Duration</SectionHead>
                            <Inp placeholder="e.g. 2h" value={spot.duration||""} style={{width:"100%",marginTop:6}}
                              onChange={e=>updateSpotField(day.id,spot.id,"duration",e.target.value)}/>
                          </div>
                          <div style={{flex:"1 1 200px"}}>
                            <SectionHead>Quick actions</SectionHead>
                            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                              {!spot.addedTodo?<GBtn onClick={()=>addTodoFromSpot(day.id,spot)} style={{fontSize:12,padding:"5px 12px"}}>+ To-dos</GBtn>:<Tag color="green" style={{padding:"5px 12px"}}>✓ In to-dos</Tag>}
                              {!spot.loggedExpense&&spot.cost>0&&spot.paidBy?<GBtn onClick={()=>logExpense(day.id,spot)} style={{fontSize:12,padding:"5px 12px"}}>+ Budget</GBtn>:spot.loggedExpense?<Tag color="cobalt" style={{padding:"5px 12px"}}>✓ In budget</Tag>:null}
                              <GBtn onClick={()=>removeSpot(day.id,spot.id)} style={{fontSize:12,padding:"5px 12px",color:C.red,borderColor:"rgba(192,58,58,.25)"}}>Remove</GBtn>
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>
                );
              })}

              {/* Inline todos */}
              {day.todos.length>0&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:5,paddingLeft:4,paddingTop:2}}>
                  {day.todos.map(t=>(
                    <span key={t.id} onClick={()=>{
                      const days=trip.days.map(d=>d.id===day.id?{...d,todos:d.todos.map(td=>td.id===t.id?{...td,done:!td.done}:td)}:d);
                      onUpdate({...trip,days});
                    }} style={{display:"inline-flex",alignItems:"center",gap:4,cursor:"pointer",background:t.done?C.greenSoft:C.bg,border:`1px solid ${t.done?"rgba(30,138,94,.3)":C.border}`,borderRadius:16,padding:"3px 10px",fontSize:11,color:t.done?C.green:C.textSoft}}>
                      {t.done?"✓ ":""}{t.text}{t.deadline?` · ${t.deadline}`:""}
                    </span>
                  ))}
                </div>
              )}

              {/* Add spot / AI */}
              {addingSpot===day.id?(
                <Card style={{padding:"12px 14px"}}>
                  <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:7}}>
                    <Inp placeholder="Spot or activity name" value={newSpot.name} onChange={e=>setNewSpot(s=>({...s,name:e.target.value}))} style={{flex:"2 1 160px"}}/>
                    <Inp placeholder="Note / tip" value={newSpot.note} onChange={e=>setNewSpot(s=>({...s,note:e.target.value}))} style={{flex:"2 1 160px"}}/>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                    <Inp type="number" placeholder={`Cost ${currSymbol}`} value={newSpot.cost} onChange={e=>setNewSpot(s=>({...s,cost:e.target.value}))} style={{width:90}}/>
                    <Inp placeholder="Duration (e.g. 2h)" value={newSpot.duration} onChange={e=>setNewSpot(s=>({...s,duration:e.target.value}))} style={{width:110}}/>
                    <Inp placeholder="Lat" value={newSpot.lat} onChange={e=>setNewSpot(s=>({...s,lat:e.target.value}))} style={{width:90}}/>
                    <Inp placeholder="Lng" value={newSpot.lng} onChange={e=>setNewSpot(s=>({...s,lng:e.target.value}))} style={{width:90}}/>
                    <Sel value={newSpot.paidBy} onChange={e=>setNewSpot(s=>({...s,paidBy:e.target.value}))} style={{minWidth:100}}>
                      <option value="">Who paid?</option>{trip.people.map(p=><option key={p}>{p}</option>)}
                    </Sel>
                    <Sel value={newSpot.split} onChange={e=>setNewSpot(s=>({...s,split:e.target.value}))} style={{minWidth:90}}>
                      <option>50/50</option><option>Paid all</option><option>Me only</option><option>Partner only</option>
                    </Sel>
                    <PBtn onClick={()=>saveSpot(day.id)} style={{fontSize:12,padding:"7px 14px"}}>Save</PBtn>
                    <GBtn onClick={()=>setAddingSpot(null)} style={{fontSize:12}}>Cancel</GBtn>
                  </div>
                </Card>
              ):(
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setAddingSpot(day.id)} style={{background:"none",border:`1px dashed ${C.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,color:C.textSoft,cursor:"pointer",fontFamily:"inherit"}}>+ Add spot</button>
                  <button onClick={()=>setChatDay(chatDay===day.id?null:day.id)} style={{background:"none",border:`1px dashed ${C.cobaltLight}`,borderRadius:8,padding:"6px 14px",fontSize:12,color:C.cobalt,cursor:"pointer",fontFamily:"inherit"}}>✦ AI chat</button>
                </div>
              )}

              {/* AI Chat */}
              {chatDay===day.id&&(
                <Card style={{overflow:"hidden",border:`1px solid ${C.cobaltLight}`}}>
                  <div style={{background:C.navy,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{width:24,height:24,borderRadius:"50%",background:C.cobalt,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff"}}>✦</span>
                      <span style={{fontSize:13,fontWeight:600,color:"#fff"}}>AI Assistant — {day.title}</span>
                    </div>
                    <button onClick={()=>setChatDay(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,.45)",cursor:"pointer",fontSize:16}}>×</button>
                  </div>
                  <div style={{height:220,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:10,background:C.bg}}>
                    {!(chatMsgs[day.id]?.length)&&(
                      <div style={{textAlign:"center",padding:"24px 0",color:C.textSoft,fontSize:13,lineHeight:1.6}}>
                        Ask me anything about <strong style={{color:C.cobalt}}>{day.title}</strong>!<br/>I can suggest spots, restaurants, tips, or add places directly to your day.
                      </div>
                    )}
                    {(chatMsgs[day.id]||[]).map((m,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                        <div style={{maxWidth:"80%",padding:"9px 13px",borderRadius:m.role==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",background:m.role==="user"?C.navy:C.white,color:m.role==="user"?"#fff":C.text,fontSize:13,lineHeight:1.5,border:m.role==="assistant"?`1px solid ${C.border}`:"none"}}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    {aiLoading===day.id&&(
                      <div style={{display:"flex",gap:5,padding:"4px 2px"}}>
                        {[0,1,2].map(i=><span key={i} style={{width:7,height:7,borderRadius:"50%",background:C.cobalt,display:"inline-block",animation:`bounce .9s ${i*.18}s infinite`}}/>)}
                      </div>
                    )}
                    <div ref={chatEndRef}/>
                  </div>
                  <div style={{padding:"10px 12px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8,background:C.white}}>
                    <Inp placeholder="Ask about this day…" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendChat(day)} style={{flex:1}}/>
                    <PBtn onClick={()=>sendChat(day)} style={{fontSize:12,padding:"7px 14px"}}>Send</PBtn>
                  </div>
                </Card>
              )}
            </div>
          </div>
        );
      })}

      {addingDay?(
        <Card style={{padding:"12px 16px"}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Inp placeholder="Day title" value={newDay.title} onChange={e=>setNewDay(d=>({...d,title:e.target.value}))} style={{flex:"2 1 150px"}}/>
            <Inp type="date" value={newDay.date} onChange={e=>setNewDay(d=>({...d,date:e.target.value}))} style={{flex:"1 1 130px"}}/>
            <Inp placeholder="Travel time" value={newDay.travelTime} onChange={e=>setNewDay(d=>({...d,travelTime:e.target.value}))} style={{flex:"2 1 160px"}}/>
            <PBtn onClick={saveNewDay} style={{fontSize:12}}>Add day</PBtn>
            <GBtn onClick={()=>setAddingDay(false)} style={{fontSize:12}}>Cancel</GBtn>
          </div>
        </Card>
      ):(
        <button onClick={()=>setAddingDay(true)} style={{background:"none",border:`1px dashed ${C.border}`,borderRadius:8,padding:"7px 18px",fontSize:13,color:C.textSoft,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>+ Add day</button>
      )}

      <ItineraryMap trip={trip}/>

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}} .leaflet-container{font-family:'Nunito',sans-serif!important;}`}</style>
    </div>
  );
}

// ── Budget Panel ──────────────────────────────────────────────────────────────
function BudgetPanel({trip,onUpdate,currSymbol}) {
  const [budgetTab,setBudgetTab] = useState("summary");
  const [summaryGroup,setSummaryGroup] = useState("category");
  const [addingExp,setAddingExp] = useState(false);
  const [showRates,setShowRates] = useState(false);

  // Multi-currency: rates stored as {CODE: rateToBase}, e.g. {JPY:150, EUR:0.92}
  // base currency = trip.currency
  const rates = trip.exchangeRates || {};
  const baseCurr = CURRENCIES.find(c=>c.code===(trip.currency||"USD"))||CURRENCIES[0];

  // Convert any amount+currency to base
  const toBase = (amount, code) => {
    if(!code || code===baseCurr.code) return +amount||0;
    const rate = rates[code];
    if(!rate) return +amount||0;
    return (+amount||0) / rate;
  };

  const [form,setForm] = useState({
    desc:"", amount:"", currency:baseCurr.code,
    paidBy:trip.people[0], split:"50/50", category:"Food & Drink"
  });

  const people = trip.people;
  const expenses = trip.expenses||[];

  // All expenses converted to base
  const spotItems = trip.days.flatMap(d=>d.spots.filter(s=>s.cost>0&&s.paidBy).map(s=>({...s,dayTitle:d.title,dayId:d.id})));
  const allExp = [
    ...expenses.map(e=>({...e, amountBase: toBase(e.amount, e.currency||baseCurr.code)})),
    ...spotItems.map(s=>({id:"spot-"+s.id,desc:s.name,amount:+s.cost,amountBase:toBase(s.cost,baseCurr.code),currency:baseCurr.code,paidBy:s.paidBy,split:s.split,category:"Activities",dayTitle:s.dayTitle,dayId:s.dayId,isSpot:true}))
  ];
  const total = allExp.reduce((a,e)=>a+(e.amountBase||0),0);
  const budget = trip.budget||0;
  const pct = budget ? Math.min((total/budget)*100,100) : 0;

  // Balances in base currency
  const bal={};people.forEach(p=>bal[p]=0);
  allExp.forEach(e=>{
    const amt=e.amountBase||0, n=people.length;
    if(e.split==="50/50"){const sh=amt/n;people.forEach(p=>{bal[p]+=p===e.paidBy?amt-sh:-sh;});}
    else if(e.split==="Paid all"){people.forEach(p=>{bal[p]+=p===e.paidBy?amt*(n-1):-amt;});}
  });
  const settlements=[];const b={...bal};
  const deb=people.filter(p=>b[p]<-.01).sort((a,c)=>b[a]-b[c]);
  const cre=people.filter(p=>b[p]>.01).sort((a,c)=>b[c]-b[a]);
  let di=0,ci=0;
  while(di<deb.length&&ci<cre.length){
    const pay=Math.min(-b[deb[di]],b[cre[ci]]);
    settlements.push({from:deb[di],to:cre[ci],amount:pay});
    b[deb[di]]+=pay;b[cre[ci]]-=pay;
    if(Math.abs(b[deb[di]])<.01)di++;if(Math.abs(b[cre[ci]])<.01)ci++;
  }
  const perPerson={};
  people.forEach(p=>{
    const paid=allExp.filter(e=>e.paidBy===p).reduce((a,e)=>a+(e.amountBase||0),0);
    perPerson[p]={paid};
  });

  const catTotals=EXPENSE_CATS.map(c=>({key:c,label:c,v:allExp.filter(e=>e.category===c).reduce((a,e)=>a+(e.amountBase||0),0)})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  const dayTotals=trip.days.map(d=>({key:d.id,label:d.title||d.date,v:allExp.filter(e=>e.dayId===d.id).reduce((a,e)=>a+(e.amountBase||0),0)})).filter(x=>x.v>0);

  const addExpense=()=>{
    if(!form.desc||!form.amount) return;
    onUpdate({...trip,expenses:[...expenses,{id:uid(),...form,amount:+form.amount}]});
    setForm({desc:"",amount:"",currency:baseCurr.code,paidBy:people[0],split:"50/50",category:"Food & Drink"});
    setAddingExp(false);
  };

  const updateRate=(code,val)=>{
    onUpdate({...trip,exchangeRates:{...rates,[code]:+val||0}});
  };

  // currencies in use (from expenses)
  const usedCurrencies=[...new Set(expenses.map(e=>e.currency||baseCurr.code).filter(c=>c!==baseCurr.code))];

  return (
    <div>
      {/* Header */}
      <Card style={{padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:10}}>
          <div>
            <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:C.textSoft,textTransform:"uppercase",letterSpacing:.7}}>
              Total spent <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>· base {baseCurr.code}</span>
            </p>
            <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:3}}>
              <span style={{fontSize:36,fontWeight:700,color:pct>90?C.red:C.navy,fontFamily:"'DM Serif Display',Georgia,serif",lineHeight:1}}>{fmt(total,baseCurr.symbol)}</span>
              {budget>0&&<span style={{fontSize:14,color:C.textSoft}}>of {fmt(budget,baseCurr.symbol)}</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
            <div>
              <p style={{margin:"0 0 4px",fontSize:11,color:C.textSoft}}>Trip budget ({baseCurr.code})</p>
              <Inp type="number" value={trip.budget||""} placeholder="Set budget" onChange={e=>onUpdate({...trip,budget:+e.target.value})} style={{width:140,textAlign:"right",fontSize:15,fontWeight:700}}/>
            </div>
          </div>
        </div>
        <div style={{height:8,background:C.bg,borderRadius:4,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:pct>90?C.red:C.cobalt,borderRadius:4,transition:"width .5s"}}/>
        </div>
        {budget>0&&<p style={{margin:"6px 0 0",fontSize:12,color:pct>90?C.red:C.textSoft}}>{pct>100?`${fmt(total-budget,baseCurr.symbol)} over budget`:`${fmt(budget-total,baseCurr.symbol)} remaining · ${Math.round(pct)}% used`}</p>}

        {/* Exchange rates panel */}
        <div style={{marginTop:14,borderTop:`1px solid ${C.borderSoft}`,paddingTop:12}}>
          <button onClick={()=>setShowRates(r=>!r)} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:C.textSoft,fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,padding:0}}>
            <span style={{fontSize:10,display:"inline-block",transform:showRates?"rotate(90deg)":"rotate(0deg)",transition:"transform .2s"}}>▶</span>
            {showRates?"Hide exchange rates":"Manage exchange rates"}
            {usedCurrencies.length>0&&<span style={{fontSize:11,color:C.cobalt,fontWeight:600}}> · {usedCurrencies.join(", ")} active</span>}
          </button>
          {showRates&&(
            <div style={{marginTop:12}}>
              <p style={{fontSize:12,color:C.textSoft,marginBottom:10}}>Set rates relative to your base currency <strong style={{color:C.navy}}>{baseCurr.code} ({baseCurr.symbol})</strong>. E.g. if 1 USD = 150 JPY, enter 150 for JPY.</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {CURRENCIES.filter(c=>c.code!==baseCurr.code).map(c=>(
                  <div key={c.code} style={{display:"flex",alignItems:"center",gap:6,background:C.bg,borderRadius:8,padding:"6px 10px",border:`1px solid ${rates[c.code]?C.cobalt:C.border}`}}>
                    <span style={{fontSize:12,fontWeight:700,color:rates[c.code]?C.cobaltText:C.textSoft,minWidth:36}}>{c.code}</span>
                    <span style={{fontSize:11,color:C.textSoft}}>1 {baseCurr.code} =</span>
                    <Inp type="number" placeholder="rate" value={rates[c.code]||""} onChange={e=>updateRate(c.code,e.target.value)} style={{width:75,padding:"4px 7px",fontSize:12}}/>
                    <span style={{fontSize:11,color:C.textSoft}}>{c.symbol}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap"}}>
        {[["summary","Summary"],["detail","All Expenses"],["splitwise","Splitwise"]].map(([id,label])=>(
          <SubTab key={id} active={budgetTab===id} onClick={()=>setBudgetTab(id)}>{label}</SubTab>
        ))}
      </div>

      {budgetTab==="summary"&&(
        <div>
          <div style={{display:"flex",gap:6,marginBottom:16,alignItems:"center"}}>
            <span style={{fontSize:13,color:C.textSoft,marginRight:4}}>Group by:</span>
            {[["category","Category"],["day","Day"]].map(([id,label])=>(
              <SubTab key={id} active={summaryGroup===id} onClick={()=>setSummaryGroup(id)}>{label}</SubTab>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10,maxWidth:560}}>
            {(summaryGroup==="category"?catTotals:dayTotals).map(({key,label,v})=>(
              <div key={key} style={{display:"flex",alignItems:"center",gap:14}}>
                <span style={{width:140,fontSize:13,color:C.textMid,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span>
                <div style={{flex:1,height:10,background:C.bg,borderRadius:5,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${total?Math.round(v/total*100):0}%`,background:C.cobalt,borderRadius:5,transition:"width .5s"}}/>
                </div>
                <span style={{fontSize:14,fontWeight:700,color:C.navy,minWidth:65,textAlign:"right"}}>{fmt(v,baseCurr.symbol)}</span>
                <span style={{fontSize:12,color:C.textSoft,minWidth:32,textAlign:"right"}}>{total?Math.round(v/total*100):0}%</span>
              </div>
            ))}
            {(summaryGroup==="category"?catTotals:dayTotals).length===0&&<p style={{color:C.textSoft,fontSize:13,padding:"20px 0"}}>No expenses logged yet.</p>}
          </div>
        </div>
      )}

      {budgetTab==="detail"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
            <PBtn onClick={()=>setAddingExp(a=>!a)} style={{fontSize:12,padding:"6px 14px"}}>+ Add expense</PBtn>
          </div>
          {addingExp&&(
            <Card style={{padding:"12px 16px",marginBottom:12}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
                <Inp placeholder="Description" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} style={{flex:"2 1 150px"}}/>
                <Sel value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{flex:"1 1 130px"}}>{EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}</Sel>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
                {/* Currency + amount side by side */}
                <Sel value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} style={{width:90}}>
                  {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code}</option>)}
                </Sel>
                <Inp type="number" placeholder="Amount" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={{width:110}}/>
                {/* Show converted amount if foreign currency */}
                {form.currency!==baseCurr.code&&form.amount&&rates[form.currency]&&(
                  <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:C.cobalt,padding:"0 6px"}}>
                    ≈ {fmt(toBase(form.amount,form.currency),baseCurr.symbol)} {baseCurr.code}
                  </div>
                )}
                {form.currency!==baseCurr.code&&!rates[form.currency]&&(
                  <div style={{display:"flex",alignItems:"center",fontSize:12,color:C.amber,padding:"0 6px"}}>
                    ⚠ Set {form.currency} rate above
                  </div>
                )}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                <Sel value={form.paidBy} onChange={e=>setForm(f=>({...f,paidBy:e.target.value}))}>{people.map(p=><option key={p}>{p}</option>)}</Sel>
                <Sel value={form.split} onChange={e=>setForm(f=>({...f,split:e.target.value}))}>
                  <option>50/50</option><option>Paid all</option><option>Me only</option><option>Partner only</option>
                </Sel>
                <PBtn onClick={addExpense} style={{fontSize:12,padding:"7px 14px"}}>Save</PBtn>
                <GBtn onClick={()=>setAddingExp(false)} style={{fontSize:12}}>Cancel</GBtn>
              </div>
            </Card>
          )}
          <Card style={{overflow:"hidden"}}>
            {allExp.length===0&&<div style={{padding:32,textAlign:"center",color:C.textSoft,fontSize:13}}>No expenses yet</div>}
            {allExp.map((e,i)=>{
              const eCurr = CURRENCIES.find(c=>c.code===(e.currency||baseCurr.code))||baseCurr;
              const isForeign = eCurr.code!==baseCurr.code;
              return (
              <div key={e.id||i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<allExp.length-1?`1px solid ${C.borderSoft}`:"none",background:e.isSpot?"rgba(228,233,245,.3)":C.white}}>
                <Tag color="cobalt">{e.category}</Tag>
                <span style={{flex:1,fontSize:13,color:C.navy}}>{e.desc}</span>
                {e.isSpot&&<Tag color="gray" style={{fontSize:10}}>itinerary</Tag>}
                <span style={{fontSize:12,color:C.textSoft,whiteSpace:"nowrap"}}>{e.paidBy} · {e.split}</span>
                <div style={{textAlign:"right",minWidth:80}}>
                  {isForeign&&<div style={{fontSize:11,color:C.textSoft}}>{fmt(e.amount,eCurr.symbol)} {eCurr.code}</div>}
                  <span style={{fontSize:14,fontWeight:700,color:C.navy}}>{fmt(e.amountBase,baseCurr.symbol)}</span>
                </div>
                {!e.isSpot&&<button onClick={()=>onUpdate({...trip,expenses:expenses.filter(x=>x.id!==e.id)})} style={{background:"none",border:"none",cursor:"pointer",color:C.textSoft,fontSize:14}}>×</button>}
              </div>
            );})}
          </Card>
        </div>
      )}

      {budgetTab==="splitwise"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Card style={{padding:20}}>
            <p style={{margin:"0 0 4px",fontSize:14,fontWeight:700,color:C.navy}}>What each person paid</p>
            <p style={{margin:"0 0 16px",fontSize:11,color:C.textSoft}}>All amounts in {baseCurr.code}</p>
            {people.map(p=>{
              const items=allExp.filter(e=>e.paidBy===p);
              const paid=items.reduce((a,e)=>a+(e.amountBase||0),0);
              return (
                <div key={p} style={{marginBottom:18}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                    <span style={{fontSize:14,fontWeight:700,color:C.navy}}>{p}</span>
                    <span style={{fontSize:20,fontWeight:700,color:C.cobalt,fontFamily:"'DM Serif Display',serif"}}>{fmt(paid,baseCurr.symbol)}</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    {items.slice(0,6).map((e,i)=>{
                      const eCurr=CURRENCIES.find(c=>c.code===(e.currency||baseCurr.code))||baseCurr;
                      const isForeign=eCurr.code!==baseCurr.code;
                      return (
                        <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.textSoft}}>
                          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{e.desc}</span>
                          <span style={{marginLeft:8,flexShrink:0}}>
                            {isForeign?`${fmt(e.amount,eCurr.symbol)} → `:""}
                            {fmt(e.amountBase,baseCurr.symbol)}
                          </span>
                        </div>
                      );
                    })}
                    {items.length>6&&<span style={{fontSize:11,color:C.textSoft}}>+{items.length-6} more</span>}
                  </div>
                </div>
              );
            })}
          </Card>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card style={{padding:18}}>
              <p style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:C.navy}}>Settlement</p>
              {settlements.length===0
                ? <div style={{background:C.greenSoft,borderRadius:8,padding:"12px 14px",fontSize:13,color:C.green,fontWeight:600}}>✓ All settled up!</div>
                : settlements.map((s,i)=>(
                  <div key={i} style={{background:C.cobaltLight,border:`1px solid rgba(41,82,163,.2)`,borderRadius:10,padding:"14px 16px",marginBottom:8}}>
                    <div style={{fontSize:13,color:C.textMid,marginBottom:4}}><strong style={{color:C.navy}}>{s.from}</strong> owes <strong style={{color:C.navy}}>{s.to}</strong></div>
                    <div style={{fontSize:28,fontWeight:700,color:C.navy,fontFamily:"'DM Serif Display',serif"}}>{fmt(s.amount,baseCurr.symbol)}</div>
                  </div>
                ))
              }
            </Card>
            <Card style={{padding:18}}>
              <p style={{margin:"0 0 12px",fontSize:14,fontWeight:700,color:C.navy}}>Running balance</p>
              {people.map(p=>(
                <div key={p} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:13,color:C.textMid,fontWeight:500}}>{p}</span>
                    <span style={{fontSize:13,fontWeight:700,color:bal[p]>0?C.green:bal[p]<0?C.red:C.textSoft}}>{bal[p]>0?"+":""}{fmt(bal[p],baseCurr.symbol)}</span>
                  </div>
                  <div style={{height:5,background:C.bg,borderRadius:3}}>
                    <div style={{height:"100%",width:`${Math.min(Math.abs(bal[p])/Math.max(...people.map(x=>Math.abs(bal[x])),1)*100,100)}%`,background:bal[p]>0?C.green:C.red,borderRadius:3}}/>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Todos Panel ───────────────────────────────────────────────────────────────
function TodosPanel({trip,onUpdate}) {
  const [text,setText]       = useState("");
  const [linkDay,setLinkDay] = useState(trip.days[0]?.id||"");
  const [cat,setCat]         = useState(TODO_CATS[0]);
  const [deadline,setDeadline] = useState("");
  const [filter,setFilter]   = useState("all");
  const [groupBy,setGroupBy] = useState("day");
  const [editingTodo,setEditingTodo] = useState(null); // {dayId,id}
  const [editForm,setEditForm] = useState({});

  const allTodos=trip.days.flatMap(d=>d.todos.map(t=>({...t,dayId:d.id,dayTitle:d.title})));
  const done=allTodos.filter(t=>t.done).length;
  const now=today();
  const overdue=allTodos.filter(t=>!t.done&&t.deadline&&t.deadline<now).length;

  const addTodo=()=>{
    if(!text.trim()||!linkDay) return;
    const days=trip.days.map(d=>d.id===linkDay?{...d,todos:[...d.todos,{id:uid(),text,done:false,category:cat,deadline}]}:d);
    onUpdate({...trip,days}); setText(""); setDeadline("");
  };
  const toggle=(dayId,id)=>{const days=trip.days.map(d=>d.id===dayId?{...d,todos:d.todos.map(t=>t.id===id?{...t,done:!t.done}:t)}:d);onUpdate({...trip,days});};
  const remove=(dayId,id)=>{const days=trip.days.map(d=>d.id===dayId?{...d,todos:d.todos.filter(t=>t.id!==id)}:d);onUpdate({...trip,days});};
  const startEdit=(t)=>{ setEditingTodo({dayId:t.dayId,id:t.id}); setEditForm({text:t.text,category:t.category,deadline:t.deadline||""}); };
  const saveEdit=()=>{
    const days=trip.days.map(d=>d.id===editingTodo.dayId?{...d,todos:d.todos.map(t=>t.id===editingTodo.id?{...t,...editForm}:t)}:d);
    onUpdate({...trip,days}); setEditingTodo(null);
  };

  const visible=allTodos.filter(t=>filter==="all"?true:filter==="done"?t.done:filter==="overdue"?(!t.done&&t.deadline&&t.deadline<now):!t.done);

  const TodoItem=({t})=>{
    const isOverdue=!t.done&&t.deadline&&t.deadline<now;
    const isEditing=editingTodo?.id===t.id;
    return (
      <div style={{background:C.white,border:`1px solid ${isOverdue?C.red:t.done?"rgba(30,138,94,.2)":C.border}`,borderRadius:10,overflow:"hidden",transition:"all .15s"}}>
        {isEditing?(
          <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
            <Inp value={editForm.text} onChange={e=>setEditForm(f=>({...f,text:e.target.value}))} style={{width:"100%"}}/>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              <Sel value={editForm.category} onChange={e=>setEditForm(f=>({...f,category:e.target.value}))} style={{flex:"1 1 120px"}}>{TODO_CATS.map(c=><option key={c}>{c}</option>)}</Sel>
              <Inp type="date" value={editForm.deadline} onChange={e=>setEditForm(f=>({...f,deadline:e.target.value}))} style={{flex:"1 1 120px"}}/>
              <PBtn onClick={saveEdit} style={{fontSize:12,padding:"6px 12px"}}>Save</PBtn>
              <GBtn onClick={()=>setEditingTodo(null)} style={{fontSize:12,padding:"6px 10px"}}>Cancel</GBtn>
            </div>
          </div>
        ):(
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",opacity:t.done?.6:1}}>
            <button onClick={()=>toggle(t.dayId,t.id)} style={{width:18,height:18,borderRadius:"50%",flexShrink:0,cursor:"pointer",background:t.done?C.green:"transparent",border:`2px solid ${t.done?C.green:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:700}}>{t.done?"✓":""}</button>
            <span style={{flex:1,fontSize:13,color:C.navy,textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
            <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
              {groupBy==="day"&&<Tag color="cobalt">{t.category}</Tag>}
              {groupBy==="category"&&<span style={{fontSize:11,color:C.textSoft,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"2px 8px"}}>{t.dayTitle}</span>}
              {t.deadline&&<Tag color={isOverdue?"red":"gray"} style={{fontSize:10}}>{isOverdue?"⚠ ":""}{t.deadline}</Tag>}
              <button onClick={()=>startEdit(t)} style={{background:"none",border:"none",cursor:"pointer",color:C.textSoft,fontSize:13,padding:"0 2px"}}>✎</button>
              <button onClick={()=>remove(t.dayId,t.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.textSoft,fontSize:14}}>×</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{maxWidth:680}}>
      <Card style={{padding:"14px 18px",marginBottom:18}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:700,color:C.navy}}>Overall progress</span>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            {overdue>0&&<Tag color="red">{overdue} overdue</Tag>}
            <span style={{fontSize:13,color:C.textSoft}}>{done} / {allTodos.length} done</span>
          </div>
        </div>
        <div style={{height:7,background:C.bg,borderRadius:4}}>
          <div style={{height:"100%",width:allTodos.length?`${Math.round(done/allTodos.length*100)}%`:"0%",background:C.green,borderRadius:4,transition:"width .3s"}}/>
        </div>
      </Card>

      {/* Add */}
      <Card style={{padding:"12px 14px",marginBottom:14}}>
        <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
          <Inp placeholder="Add a to-do…" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTodo()} style={{flex:"2 1 180px"}}/>
          <Sel value={cat} onChange={e=>setCat(e.target.value)} style={{flex:"1 1 120px"}}>{TODO_CATS.map(c=><option key={c}>{c}</option>)}</Sel>
          <Sel value={linkDay} onChange={e=>setLinkDay(e.target.value)} style={{flex:"1 1 110px"}}>{trip.days.map(d=><option key={d.id} value={d.id}>{d.title||d.date}</option>)}</Sel>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
            <span style={{fontSize:12,color:C.textSoft,whiteSpace:"nowrap"}}>Deadline (optional):</span>
            <Inp type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} style={{flex:1,minWidth:120}}/>
          </div>
          <PBtn onClick={addTodo}>Add</PBtn>
        </div>
      </Card>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {[["all","All"],["pending","Pending"],["done","Done"],["overdue","Overdue"]].map(([f,label])=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:"4px 12px",borderRadius:16,fontSize:12,cursor:"pointer",fontFamily:"inherit",background:filter===f?C.navy:"transparent",color:filter===f?"#fff":C.textSoft,border:`1px solid ${filter===f?C.navy:C.border}`}}>{label}</button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:12,color:C.textSoft}}>Group:</span>
          {[["day","Day"],["category","Category"]].map(([id,label])=>(
            <SubTab key={id} active={groupBy===id} onClick={()=>setGroupBy(id)}>{label}</SubTab>
          ))}
        </div>
      </div>

      {groupBy==="day"&&trip.days.map(day=>{
        const items=visible.filter(t=>t.dayId===day.id);
        if(!items.length) return null;
        return <div key={day.id} style={{marginBottom:18}}><SectionHead style={{marginBottom:8}}>{day.title||day.date}</SectionHead><div style={{display:"flex",flexDirection:"column",gap:4}}>{items.map(t=><TodoItem key={t.id} t={t}/>)}</div></div>;
      })}
      {groupBy==="category"&&TODO_CATS.map(c=>{
        const items=visible.filter(t=>t.category===c);
        if(!items.length) return null;
        return <div key={c} style={{marginBottom:18}}><SectionHead style={{marginBottom:8}}>{c}</SectionHead><div style={{display:"flex",flexDirection:"column",gap:4}}>{items.map(t=><TodoItem key={t.id} t={t}/>)}</div></div>;
      })}
      {visible.length===0&&<div style={{textAlign:"center",padding:48,color:C.textSoft,fontSize:13}}>Nothing here yet</div>}
    </div>
  );
}

// ── Notes Panel ───────────────────────────────────────────────────────────────
function NotesPanel({trip,onUpdate}) {
  const [filter,setFilter]   = useState("All");
  const [adding,setAdding]   = useState(false);
  const [form,setForm]       = useState({title:"",body:"",category:"",pinned:false});
  const [editing,setEditing] = useState(null);
  const [addToDay,setAddToDay] = useState(null);
  const [selectedDay,setSelectedDay] = useState(trip.days[0]?.id||"");
  const [editingCats,setEditingCats] = useState(false);
  const [newCat,setNewCat] = useState("");

  const notes = trip.notes||[];
  // categories stored on trip, fallback to NOTE_CATS constant
  const noteCats = trip.noteCats||NOTE_CATS;

  const saveCats = (cats) => onUpdate({...trip, noteCats:cats});
  const addCat = () => {
    const t = newCat.trim();
    if(!t||noteCats.includes(t)) return;
    saveCats([...noteCats, t]);
    setNewCat("");
  };
  const removeCat = (c) => {
    saveCats(noteCats.filter(x=>x!==c));
    if(filter===c) setFilter("All");
  };

  const saveNote=()=>{
    const cat = form.category||noteCats[0]||"Other";
    if(!form.title.trim()) return;
    if(editing){onUpdate({...trip,notes:notes.map(n=>n.id===editing?{...n,...form,category:cat}:n)});setEditing(null);}
    else onUpdate({...trip,notes:[...notes,{id:uid(),...form,category:cat,votes:[]}]});
    setForm({title:"",body:"",category:noteCats[0]||"",pinned:false}); setAdding(false);
  };
  const startEdit=n=>{setForm({title:n.title,body:n.body,category:n.category,pinned:n.pinned});setEditing(n.id);setAdding(true);};
  const removeNote=id=>onUpdate({...trip,notes:notes.filter(n=>n.id!==id)});
  const togglePin=id=>onUpdate({...trip,notes:notes.map(n=>n.id===id?{...n,pinned:!n.pinned}:n)});
  const toggleVote=(noteId,person)=>{
    onUpdate({...trip,notes:notes.map(n=>{
      if(n.id!==noteId) return n;
      const votes=n.votes||[];
      return {...n,votes:votes.includes(person)?votes.filter(v=>v!==person):[...votes,person]};
    })});
  };
  const promoteToItinerary=(note)=>{
    const dayId=selectedDay||trip.days[0]?.id;
    if(!dayId) return;
    const spot={id:uid(),name:note.title,note:note.body||"",cost:0,paidBy:"",split:"50/50",addedTodo:false,loggedExpense:false,duration:"",lat:0,lng:0};
    const days=trip.days.map(d=>d.id===dayId?{...d,spots:[...d.spots,spot]}:d);
    onUpdate({...trip,days}); setAddToDay(null);
  };

  const allCats = ["All",...noteCats];
  const visible  = filter==="All"?notes:notes.filter(n=>n.category===filter);
  const pinned   = visible.filter(n=>n.pinned);
  const unpinned = visible.filter(n=>!n.pinned);
  const catColor = c=>c==="Restaurant"||c==="Café"?"amber":c==="Bar"?"cobalt":c==="Golf"?"green":"gray";

  const NoteCard=({n})=>{
    const votes=n.votes||[];
    const bothVoted=votes.length===trip.people.length;
    return (
      <Card style={{padding:"14px 16px",border:bothVoted?`1px solid ${C.cobalt}`:undefined}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:8}}>
          <p style={{margin:0,fontSize:13,fontWeight:700,color:C.navy,flex:1}}>{n.title}</p>
          <div style={{display:"flex",gap:2,flexShrink:0}}>
            <button onClick={()=>togglePin(n.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:n.pinned?C.amber:"#bbb",padding:"0 2px"}}>📌</button>
            <button onClick={()=>startEdit(n)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:C.textSoft,padding:"0 3px"}}>✎</button>
            <button onClick={()=>removeNote(n.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:15,color:C.textSoft,padding:"0 2px"}}>×</button>
          </div>
        </div>
        {n.body&&<p style={{margin:"0 0 10px",fontSize:13,color:C.textMid,lineHeight:1.55}}>{n.body}</p>}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginTop:8}}>
          <Tag color={catColor(n.category)}>{n.category}</Tag>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            {trip.people.map(p=>(
              <button key={p} onClick={()=>toggleVote(n.id,p)} style={{
                background:votes.includes(p)?C.cobaltLight:"transparent",
                color:votes.includes(p)?C.cobaltText:C.textSoft,
                border:`1px solid ${votes.includes(p)?C.cobalt:C.border}`,
                borderRadius:16,padding:"3px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600,
              }}>{votes.includes(p)?"♥":"♡"} {p}</button>
            ))}
            {bothVoted&&<Tag color="cobalt" style={{fontSize:10}}>Both love it!</Tag>}
          </div>
        </div>
        {addToDay===n.id?(
          <div style={{display:"flex",gap:6,marginTop:10,padding:"8px 10px",background:C.bg,borderRadius:8,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:12,color:C.textMid}}>Add to:</span>
            <Sel value={selectedDay} onChange={e=>setSelectedDay(e.target.value)} style={{flex:1,minWidth:120,fontSize:12,padding:"5px 8px"}}>
              {trip.days.map(d=><option key={d.id} value={d.id}>{d.title||d.date}</option>)}
            </Sel>
            <PBtn onClick={()=>promoteToItinerary(n)} style={{fontSize:12,padding:"5px 12px"}}>Add</PBtn>
            <GBtn onClick={()=>setAddToDay(null)} style={{fontSize:12,padding:"5px 10px"}}>Cancel</GBtn>
          </div>
        ):(
          <button onClick={()=>setAddToDay(n.id)} style={{marginTop:10,background:"none",border:`1px dashed ${C.border}`,borderRadius:7,padding:"4px 12px",fontSize:11,color:C.textSoft,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>+ Add to itinerary</button>
        )}
      </Card>
    );
  };

  return (
    <div>
      {/* Filter tabs — butter yellow + manage categories */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
          {allCats.map(c=>(
            <button key={c} onClick={()=>setFilter(c)} style={{
              padding:"4px 12px",borderRadius:16,fontSize:12,cursor:"pointer",fontFamily:"inherit",
              background:filter===c?C.navy:C.cobaltLight,
              color:filter===c?"#fff":C.cobaltText,
              border:`1px solid ${filter===c?C.navy:C.cobalt}`,
              fontWeight:filter===c?700:400,
              transition:"all .15s"
            }}>{c}</button>
          ))}
          <button onClick={()=>setEditingCats(e=>!e)} style={{
            padding:"4px 10px",borderRadius:16,fontSize:11,cursor:"pointer",fontFamily:"inherit",
            background:"transparent",color:C.textSoft,border:`1px dashed ${C.border}`,
          }}>⚙ categories</button>
        </div>
        <PBtn onClick={()=>{setAdding(a=>!a);setEditing(null);setForm({title:"",body:"",category:noteCats[0]||"",pinned:false});}} style={{fontSize:12,padding:"6px 14px"}}>+ Add note</PBtn>
      </div>

      {/* Category editor */}
      {editingCats&&(
        <Card style={{padding:"14px 16px",marginBottom:14}}>
          <SectionHead style={{marginBottom:10}}>Manage categories</SectionHead>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
            {noteCats.map(c=>(
              <div key={c} style={{display:"inline-flex",alignItems:"center",gap:4,background:C.butter,border:`1px solid ${C.butterBorder}`,borderRadius:16,padding:"3px 10px"}}>
                <span style={{fontSize:12,color:C.butterText,fontWeight:600}}>{c}</span>
                <button onClick={()=>removeCat(c)} style={{background:"none",border:"none",cursor:"pointer",color:C.butterText,fontSize:13,lineHeight:1,padding:"0 2px",opacity:.7}}>×</button>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <Inp placeholder="New category name…" value={newCat} onChange={e=>setNewCat(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCat()} style={{flex:1}}/>
            <PBtn onClick={addCat} style={{fontSize:12,padding:"6px 14px"}}>Add</PBtn>
            <GBtn onClick={()=>setEditingCats(false)} style={{fontSize:12}}>Done</GBtn>
          </div>
        </Card>
      )}

      {/* Add/edit note form */}
      {adding&&(
        <Card style={{padding:"14px 16px",marginBottom:16}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
            <Inp placeholder="Place name" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{flex:"2 1 200px"}}/>
            <Sel value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{flex:"1 1 120px"}}>
              {noteCats.map(c=><option key={c}>{c}</option>)}
            </Sel>
          </div>
          <textarea placeholder="Address, notes, tips, why you want to visit…" value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}
            style={{width:"100%",minHeight:80,background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 11px",fontSize:13,color:C.text,fontFamily:"inherit",resize:"vertical",outline:"none",marginBottom:8}}/>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <PBtn onClick={saveNote} style={{fontSize:12,padding:"6px 14px"}}>{editing?"Update":"Save"}</PBtn>
            <GBtn onClick={()=>{setAdding(false);setEditing(null);}} style={{fontSize:12}}>Cancel</GBtn>
            <label style={{display:"flex",alignItems:"center",gap:5,fontSize:13,color:C.textMid,cursor:"pointer",marginLeft:4}}>
              <input type="checkbox" checked={form.pinned} onChange={e=>setForm(f=>({...f,pinned:e.target.checked}))}/> Pin to top
            </label>
          </div>
        </Card>
      )}

      {pinned.length>0&&<div style={{marginBottom:18}}><SectionHead style={{marginBottom:8}}>Pinned</SectionHead><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>{pinned.map(n=><NoteCard key={n.id} n={n}/>)}</div></div>}
      {unpinned.length>0&&<div>{pinned.length>0&&<SectionHead style={{marginBottom:8}}>All notes</SectionHead>}<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>{unpinned.map(n=><NoteCard key={n.id} n={n}/>)}</div></div>}
      {visible.length===0&&<div style={{textAlign:"center",padding:48,color:C.textSoft,fontSize:13}}>No notes yet — save restaurants, bars, or ideas here!</div>}
    </div>
  );
}

// ── Leaflet Map ───────────────────────────────────────────────────────────────
function ItineraryMap({trip}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const allSpots = trip.days.flatMap((d,di)=>
    d.spots.map((s,si)=>({...s,dayIdx:di,spotIdx:si,dayTitle:d.title}))
  ).filter(s=>s.lat&&s.lng);

  // default center — use first spot with coords or Tokyo
  const hasCoords = allSpots.length > 0;
  const centerLat = hasCoords ? allSpots[0].lat : 35.6762;
  const centerLng = hasCoords ? allSpots[0].lng : 139.6503;

  useEffect(()=>{
    if(!mapRef.current) return;
    const init=()=>{
      if(!window.L){ setTimeout(init,100); return; }
      if(mapInstanceRef.current){ mapInstanceRef.current.remove(); mapInstanceRef.current=null; }

      const L = window.L;

    const map = L.map(mapRef.current,{zoomControl:true,scrollWheelZoom:false}).setView([centerLat,centerLng],12);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      attribution:'© OpenStreetMap',maxZoom:19
    }).addTo(map);

    // Day color palette for pins
    const dayColors=["#1a2952","#2952A3","#1e8a5e","#a06010","#c03a3a","#7a3a80","#0e7490"];

    markersRef.current = allSpots.map((spot,i)=>{
      const color = dayColors[spot.dayIdx % dayColors.length];
      const icon = L.divIcon({
        className:"",
        html:`<div style="width:28px;height:28px;border-radius:50%;background:${color};border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25);font-family:'Nunito',sans-serif">${spot.spotIdx+1}</div>`,
        iconSize:[28,28],iconAnchor:[14,14],popupAnchor:[0,-16]
      });
      const marker = L.marker([spot.lat,spot.lng],{icon}).addTo(map);
      marker.bindPopup(`
        <div style="font-family:'Nunito',sans-serif;min-width:140px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <div style="width:18px;height:18px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0">${spot.spotIdx+1}</div>
            <strong style="font-size:13px;color:#1a2952">${spot.name}</strong>
          </div>
          <div style="font-size:11px;color:#7a8fb5;margin-bottom:2px">Day ${spot.dayIdx+1} · ${spot.dayTitle}</div>
          ${spot.note?`<div style="font-size:12px;color:#3a4e78">${spot.note}</div>`:""}
          ${spot.duration?`<div style="font-size:11px;color:#7a8fb5;margin-top:3px">${spot.duration}</div>`:""}
        </div>
      `,{maxWidth:220});
      return marker;
    });

    if(allSpots.length>1){
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(.2));
    }
    }; // end init
    init();
    return ()=>{ if(mapInstanceRef.current){mapInstanceRef.current.remove();mapInstanceRef.current=null;} };
  },[trip.days]);

  return (
    <div style={{marginTop:32}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <SectionHead style={{margin:0}}>Trip map</SectionHead>
        {!hasCoords&&<span style={{fontSize:12,color:C.textSoft}}>Add coordinates to spots to see them pinned</span>}
      </div>
      {/* Day legend */}
      {trip.days.some(d=>d.spots.length>0)&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          {trip.days.map((d,di)=>{
            const colors=["#1a2952","#2952A3","#1e8a5e","#a06010","#c03a3a","#7a3a80","#0e7490"];
            if(!d.spots.length) return null;
            return (
              <div key={d.id} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:C.textMid}}>
                <span style={{width:10,height:10,borderRadius:"50%",background:colors[di%colors.length],display:"inline-block",flexShrink:0}}/>
                Day {di+1} · {d.title}
              </div>
            );
          })}
        </div>
      )}
      <div ref={mapRef} style={{height:420,borderRadius:12,border:`1px solid ${C.border}`,overflow:"hidden",background:C.bgSoft}}/>
    </div>
  );
}

// ── Trip Switcher ─────────────────────────────────────────────────────────────
function TripSwitcher({trips,active,onSelect,onCreate}) {
  const [creating,setCreating]=useState(false);
  const [form,setForm]=useState({name:"",emoji:"✈️",startDate:today(),endDate:today()});
  const save=()=>{
    if(!form.name.trim()) return;
    onCreate({id:uid(),...form,days:[],expenses:[],people:["Me","Partner"],budget:0,currency:"USD",exchangeRates:{},notes:[]});
    setForm({name:"",emoji:"✈️",startDate:today(),endDate:today()}); setCreating(false);
  };
  const inp={background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.2)",borderRadius:8,padding:"5px 9px",fontSize:12,color:"#fff",fontFamily:"inherit",outline:"none"};
  return (
    <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
      {trips.map((t,i)=>(
        <button key={t.id} onClick={()=>onSelect(i)} style={{padding:"4px 13px",borderRadius:16,fontSize:12,cursor:"pointer",fontFamily:"inherit",background:active===i?"rgba(255,255,255,.18)":"transparent",color:"rgba(255,255,255,.9)",border:`1px solid ${active===i?"rgba(255,255,255,.5)":"rgba(255,255,255,.2)"}`,transition:"all .18s"}}>{t.emoji} {t.name}</button>
      ))}
      {creating?(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"7px 10px"}}>
          <input placeholder="✈️" value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} style={{...inp,width:40}}/>
          <input placeholder="Trip name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{...inp,width:130}}/>
          <input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={{...inp,width:130}}/>
          <input type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} style={{...inp,width:130}}/>
          <button onClick={save} style={{background:"#fff",color:C.navy,border:"none",borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Create</button>
          <button onClick={()=>setCreating(false)} style={{background:"none",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
        </div>
      ):(
        <button onClick={()=>setCreating(true)} style={{padding:"4px 12px",borderRadius:16,fontSize:12,cursor:"pointer",fontFamily:"inherit",background:"transparent",color:"rgba(255,255,255,.4)",border:"1px dashed rgba(255,255,255,.2)"}}>+ New trip</button>
      )}
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
function App() {
  const [data,setData]=useState(null);
  const [tab,setTab]=useState("itinerary");
  const [saving,setSaving]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const lastSaved = useRef(null);

  useEffect(()=>{
    // Load Leaflet CSS
    if(!document.getElementById("leaflet-css")){
      const link=document.createElement("link");
      link.id="leaflet-css"; link.rel="stylesheet";
      link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    // Load Leaflet JS
    if(!window.L){
      const script=document.createElement("script");
      script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      document.head.appendChild(script);
    }
    loadData().then(d=>{
      const seed = d||SEED();
      setData(seed);
      lastSaved.current = JSON.stringify(seed);
    });
  },[]);

  // Poll Firebase every 8s for changes from the other person
  const isSaving = useRef(false);
  useEffect(()=>{
    const interval = setInterval(async()=>{
      if(isSaving.current) return; // don't overwrite while saving
      try {
        const res = await fetch(`${FIREBASE_URL}/${DB_KEY}.json`);
        if(!res.ok) return;
        const remote = await res.json();
        if(!remote) return;
        const remoteStr = JSON.stringify(remote);
        if(remoteStr !== lastSaved.current) {
          lastSaved.current = remoteStr;
          setData(remote);
        }
      } catch(e){}
    }, 8000);
    return ()=>clearInterval(interval);
  },[]);

  const persist=useCallback(async nd=>{
    isSaving.current = true;
    setData(nd);
    setSaving(true);
    const str = JSON.stringify(nd);
    lastSaved.current = str;
    await saveData(nd);
    setSaving(false);
    setTimeout(()=>{ isSaving.current = false; }, 3000); // wait 3s before polling again
  },[]);

  if(!data) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.textSoft,fontFamily:"Georgia,serif",fontSize:16}}>Loading…</div>;

  const trip=data.trips?.[data.activeTrip]||data.trips?.[0];
  if(!trip) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <p style={{color:C.textSoft,fontSize:16}}>Something went wrong loading your trip.</p>
      <button onClick={async()=>{ await fetch(`${FIREBASE_URL}/${DB_KEY}.json`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(SEED())}); window.location.reload(); }}
        style={{background:C.navy,color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontSize:14,cursor:"pointer"}}>Reset & reload</button>
    </div>
  );

  const setTrip=t=>persist({...data,trips:data.trips.map((x,i)=>i===data.activeTrip?t:x)});
  const currObj=CURRENCIES.find(c=>c.code===(trip.currency||"USD"))||CURRENCIES[0];
  const currSymbol=currObj.symbol;
  const todoLeft=(trip.days||[]).flatMap(d=>d.todos||[]).filter(t=>t&&!t.done).length;

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Nunito','Helvetica Neue',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Nunito:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        input:focus,select:focus,textarea:focus{outline:none!important;border-color:${C.cobalt}!important;box-shadow:0 0 0 3px rgba(41,82,163,.12)!important;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:5px;}
        button:hover{opacity:.82;}
        option{background:#fff;color:${C.navy};}
        ::placeholder{color:${C.textSoft};}
        .leaflet-popup-content-wrapper{border-radius:10px!important;box-shadow:0 4px 16px rgba(26,41,82,.15)!important;}
        .leaflet-popup-content{margin:10px 14px!important;}
      `}</style>

      {showSettings&&<TripSettings trip={trip} onUpdate={setTrip} onClose={()=>setShowSettings(false)}/>}

      {/* Top nav */}
      <div style={{background:C.navy,padding:"0 28px",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(26,41,82,.2)"}}>
        <div style={{maxWidth:1120,margin:"0 auto",display:"flex",alignItems:"center",gap:16,height:54}}>
          <span style={{fontSize:17,fontWeight:700,fontFamily:"'DM Serif Display',Georgia,serif",color:"#fff",letterSpacing:.3,flexShrink:0}}>Sabrina's Command Center</span>
          <div style={{width:1,height:18,background:"rgba(255,255,255,.15)",flexShrink:0}}/>
          <div style={{flex:1,overflow:"hidden"}}>
            <TripSwitcher trips={data.trips} active={data.activeTrip} onSelect={i=>persist({...data,activeTrip:i})} onCreate={t=>persist({...data,trips:[...data.trips,t],activeTrip:data.trips.length})}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            {saving?<span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>saving…</span>:<><span style={{width:6,height:6,borderRadius:"50%",background:C.green,display:"inline-block"}}/><span style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>live sync</span></>}
            <button onClick={()=>setShowSettings(true)} title="Trip settings" style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"rgba(255,255,255,.35)",padding:"4px 6px",lineHeight:1,transition:"color .15s"}} onMouseEnter={e=>e.target.style.color="rgba(255,255,255,.8)"} onMouseLeave={e=>e.target.style.color="rgba(255,255,255,.35)"}>⚙</button>
          </div>
        </div>
      </div>

      {/* Trip header */}
      <div style={{background:C.navyMid,padding:"16px 28px",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
        <div style={{maxWidth:1120,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:14}}>
          <div>
            <h1 style={{fontSize:24,fontWeight:700,fontFamily:"'DM Serif Display',Georgia,serif",color:"#fff",letterSpacing:-.2}}>{trip.emoji} {trip.name}</h1>
            <p style={{fontSize:13,color:"rgba(255,255,255,.45)",marginTop:3}}>{trip.startDate} → {trip.endDate} · {trip.people.join(" & ")} · {currObj.code}</p>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            {/* Header stats — pale lemon: Days + To-dos */}
            {[{n:trip.days.length,l:"Days"},{n:todoLeft,l:"To-dos"}].map(({n,l})=>(
              <div key={l} style={{textAlign:"center",padding:"8px 16px",background:C.lemon,borderRadius:10,border:`1px solid ${C.lemonBorder}`}}>
                <p style={{fontSize:20,fontWeight:700,fontFamily:"'DM Serif Display',serif",color:C.navy}}>{n}</p>
                <p style={{fontSize:10,color:C.lemonText,marginTop:2,textTransform:"uppercase",letterSpacing:.5}}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"0 28px",position:"sticky",top:54,zIndex:90,boxShadow:"0 1px 4px rgba(26,41,82,.05)"}}>
        <div style={{maxWidth:1120,margin:"0 auto",display:"flex",overflowX:"auto"}}>
          {[["itinerary","Itinerary"],["budget","Budget"],["todos","To-dos"],["notes","Notes"]].map(([id,label])=>(
            <NavTab key={id} active={tab===id} onClick={()=>setTab(id)}>{label}</NavTab>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:1120,margin:"0 auto",padding:"28px 28px"}}>
        {tab==="itinerary"&&<ItineraryHub trip={trip} onUpdate={setTrip} currSymbol={currSymbol}/>}
        {tab==="budget"&&<BudgetPanel trip={trip} onUpdate={setTrip} currSymbol={currSymbol}/>}
        {tab==="todos"&&<TodosPanel trip={trip} onUpdate={setTrip}/>}
        {tab==="notes"&&<NotesPanel trip={trip} onUpdate={setTrip}/>}
      </div>
    </div>
  );
}

export default function Root() {
  return <ErrorBoundary><App/></ErrorBoundary>;
}
