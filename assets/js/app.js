const ITEMS = [
 ["Luces traseras","De freno: mínimo dos de color rojo. Direccionales: mínimo dos de color blanco. Retroceso: mínimo dos de color blanco"],
 ["Alarma trasera","Función automática con cambio de reversa / Que se oiga a mínimo 50 metros"],
 ["Llantas","Libres de rajaduras y sin desgaste excesivo"],
 ["Placa de montacargas","En buen estado y legible"],
 ["Tanque de combustible","Sin fugas / ajustado / con tapa original y ajustada"],
 ["Nivel de agua refrigeración / mangueras","Nivel correcto / mangueras sin fugas"],
 ["Estado de las líneas hidráulicas","Líneas sin fugas y en buen estado"],
 ["Niveles de aceite motor / hidráulico","Niveles de acuerdo al fabricante"],
 ["Cableado eléctrico","Aislado / sin roturas / ajustados"],
 ["Nivel de aceite","Sin fugas / bien asegurado / nivel de acuerdo al fabricante"],
 ["Espejo retrovisor interior","Sin rotura / sin manchas / ajustado"],
 ["Vidrio parabrisas","Sin rotura / sin manchas / distorsiones"],
 ["Estado de cabina del operador","Protegida y en buen estado en general"],
 ["Indicador de presión de aceite","Que se ilumine al encender el motor"],
 ["Indicador de combustible","La barra o indicador debe mostrar el nivel de combustible"],
 ["Sillas / apoyo para la cabeza","Atornillados al piso / apoyo para la cabeza asegurado"],
 ["Pedales de freno / clutch / acelerador","Con forro / sin juego excesivo"],
 ["Mástil / carro de levantar / horquillas (cuchillas)","En buen estado, sin fuga de aceite / al levantar y descender el carro funciona sin mayor detalle / las cuchillas no presentan excesivo desgaste, ruptura o doblado"],
 ["Cinturón de seguridad","Dos de 3 puntos de apoyo"],
 ["Pito","Funcionando / que se oiga a mínimo 50 metros"],
 ["Timón o volante","Funcionando en perfectas condiciones"],
 ["Frenos","Pedales con antideslizante / nivel de líquido de acuerdo al fabricante"],
 ["Horómetro","Funcionando, legible y dentro del rango del mantenimiento"]
];
const DIAS = [["lun","Lun","Lunes"],["mar","Mar","Martes"],["mie","Mié","Miércoles"],
              ["jue","Jue","Jueves"],["vie","Vie","Viernes"],["sab","Sáb","Sábado"],["dom","Dom","Domingo"]];
const META = ["inspector","encargado","sucursal","marca","ubicacion","semanaDel","semanaAl","mes",
              "hrsIni","hrsFin","obs","segFecha","segResp","firmaJefe","firmaOperador"];

const store = {
  get(k){ try { return localStorage.getItem(k); } catch { return null; } },
  set(k,v){ try { localStorage.setItem(k,v); } catch { /* dispositivo sin almacenamiento */ } }
};
const esc = value => String(value ?? "").replace(/[&<>"']/g,
  c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const app = {
  dia:"lun", rec:null, records:[], db:null, user:null, usuario:"",

  /* ---------- ciclo de vida ---------- */
  async init(){
    this.usuario = store.get("mc_user") || "";
    document.getElementById("s_usuario").value = this.usuario;
    document.getElementById("s_usuario").addEventListener("input", e=>{
      this.usuario = e.target.value.trim(); store.set("mc_user", this.usuario);
    });
    const hoy = new Date().getDay();
    this.dia = DIAS[(hoy+6)%7][0];
    this.rec = this.blank();
    if(this.usuario) this.rec.meta.inspector = this.usuario;
    this.buildDaybar(); this.buildItems(); this.bindMeta(); this.paint();
    document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>this.tab(b));
    const cfg = window.APP_CONFIG || {};
    if(!cfg.supabaseUrl || !cfg.publishableKey || !window.supabase){
      this.updatePill("err");
      document.getElementById("authStatus").textContent = "Configura URL y clave publicable en assets/js/config.js.";
      return;
    }
    this.db = window.supabase.createClient(cfg.supabaseUrl, cfg.publishableKey);
    const {data:{session},error} = await this.db.auth.getSession();
    if(error) this.toast(error.message,true);
    this.user = session?.user || null;
    if(this.user && !(await this.isAllowed())){ await this.db.auth.signOut(); this.user=null; }
    this.updatePill();
    if(this.user) await this.sync(false);
  },
  async signIn(){
    if(!this.db) return this.toast("Falta configurar Supabase.",true);
    const email=document.getElementById("s_email").value.trim();
    const password=document.getElementById("s_password").value;
    const {data,error}=await this.db.auth.signInWithPassword({email,password});
    document.getElementById("s_password").value="";
    if(error) return this.toast("No se pudo iniciar sesión: "+error.message,true);
    this.user=data.user;
    if(!(await this.isAllowed())){
      await this.db.auth.signOut(); this.user=null; this.updatePill();
      return this.toast("Esta cuenta aún no está autorizada.",true);
    }
    this.updatePill(); await this.sync(true);
  },
  async isAllowed(){
    const {data,error}=await this.db.from("app_users").select("user_id").eq("user_id",this.user.id).maybeSingle();
    if(error) this.toast("Error al comprobar acceso: "+error.message,true);
    return !!data;
  },
  async signOut(){
    if(this.db) await this.db.auth.signOut();
    this.user=null; this.records=[]; this.rec=this.blank(); this.paint(); this.renderRecords();
    this.updatePill(); this.toast("Sesión cerrada.");
  },
  blank(){
    const items={};
    ITEMS.forEach((_,i)=>items[i]={aplica:"SI",dias:{}});
    return {id:"r"+Date.now()+Math.random().toString(36).slice(2,7),
            meta:Object.fromEntries(META.map(k=>[k,""])), items, updatedAt:0, updatedBy:""};
  },
  tab(b){
    document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    document.getElementById("view-"+b.dataset.view).classList.add("active");
    if(b.dataset.view==="registros") this.renderRecords();
  },

  /* ---------- construcción de la interfaz ---------- */
  buildDaybar(){
    const bar=document.getElementById("daybar");
    bar.innerHTML = DIAS.map(([k,corto])=>
      `<button class="daybtn" data-d="${k}" onclick="app.setDia('${k}')">
         <div class="d">${corto}</div><div class="n" id="cnt_${k}">0/23</div></button>`).join("");
  },
  buildItems(){
    document.getElementById("itemList").innerHTML = ITEMS.map(([n,std],i)=>`
      <div class="item" id="it_${i}">
        <div>
          <div class="item-name"><span class="item-num">${String(i+1).padStart(2,"0")}</span>${n}</div>
          <div class="item-std">${std}</div>
          <div class="strip" id="st_${i}"></div>
        </div>
        <div class="controls">
          <span class="aplica">Aplica</span>
          <div class="seg">
            <button id="ap_si_${i}" onclick="app.setAplica(${i},'SI')">Sí</button>
            <button id="ap_no_${i}" onclick="app.setAplica(${i},'NO')">No</button>
          </div>
          <div class="seg">
            <button id="c_${i}" onclick="app.setEstado(${i},'C')">C</button>
            <button id="nc_${i}" onclick="app.setEstado(${i},'NC')">NC</button>
          </div>
        </div>
      </div>`).join("");
  },
  bindMeta(){
    META.forEach(k=>{
      const el=document.getElementById("m_"+k); if(!el) return;
      el.addEventListener("input",()=>{ this.rec.meta[k]=el.value; if(k==="semanaDel") this.paintDays(); });
    });
  },

  /* ---------- captura ---------- */
  setDia(d){ this.dia=d; this.paint(); },
  setAplica(i,v){ this.rec.items[i].aplica = v; if(v==="NO") this.rec.items[i].dias={}; this.paint(); },
  setEstado(i,v){
    const it=this.rec.items[i];
    if(it.aplica==="NO") return this.toast("Ese ítem está marcado como no aplica.",true);
    it.dias[this.dia] = it.dias[this.dia]===v ? null : v;
    this.paint();
  },
  markAll(v){
    ITEMS.forEach((_,i)=>{ if(this.rec.items[i].aplica!=="NO") this.rec.items[i].dias[this.dia]=v; });
    this.paint();
  },
  clearDay(){ ITEMS.forEach((_,i)=>{ delete this.rec.items[i].dias[this.dia]; }); this.paint(); },

  /* ---------- pintado ---------- */
  paint(){
    document.getElementById("dayTitle").textContent = DIAS.find(d=>d[0]===this.dia)[2];
    ITEMS.forEach((_,i)=>{
      const it=this.rec.items[i], est=it.dias[this.dia]||null, na=it.aplica==="NO";
      document.getElementById("it_"+i).classList.toggle("na",na);
      document.getElementById("ap_si_"+i).className = it.aplica==="SI"?"on-neutral":"";
      document.getElementById("ap_no_"+i).className = it.aplica==="NO"?"on-neutral":"";
      document.getElementById("c_"+i).className  = est==="C"?"on-c":"";
      document.getElementById("nc_"+i).className = est==="NC"?"on-nc":"";
      document.getElementById("st_"+i).innerHTML = DIAS.map(([k])=>{
        const e=it.dias[k]; return `<span class="${e==="C"?"c":e==="NC"?"nc":""} ${k===this.dia?"today":""}"></span>`;
      }).join("");
    });
    this.paintDays();
    META.forEach(k=>{ const el=document.getElementById("m_"+k); if(el && el.value!==(this.rec.meta[k]||"")) el.value=this.rec.meta[k]||""; });
  },
  paintDays(){
    const base = this.rec.meta.semanaDel ? new Date(this.rec.meta.semanaDel+"T12:00:00") : null;
    DIAS.forEach(([k],idx)=>{
      const btn=document.querySelector(`.daybtn[data-d="${k}"]`);
      let hechos=0, fallas=0, aplican=0;
      ITEMS.forEach((_,i)=>{ const it=this.rec.items[i];
        if(it.aplica==="NO") return; aplican++;
        if(it.dias[k]) hechos++; if(it.dias[k]==="NC") fallas++; });
      const lbl = base ? new Date(base.getTime()+idx*864e5).getDate() : `${hechos}/${aplican}`;
      document.getElementById("cnt_"+k).textContent = base ? `${lbl} · ${hechos}/${aplican}` : `${hechos}/${aplican}`;
      btn.classList.toggle("active",k===this.dia);
      btn.classList.toggle("done",hechos===aplican && aplican>0 && fallas===0);
      btn.classList.toggle("alert",fallas>0);
    });
    let hechos=0,aplican=0,fallas=0;
    ITEMS.forEach((_,i)=>{ const it=this.rec.items[i]; if(it.aplica==="NO") return;
      aplican++; if(it.dias[this.dia]) hechos++; if(it.dias[this.dia]==="NC") fallas++; });
    document.getElementById("counter").innerHTML =
      `Día: <b>${hechos}/${aplican}</b> revisados${fallas?` · <span class="bad">${fallas} NC</span>`:""}`;
  },

  /* ---------- guardar y registros ---------- */
  async guardar(){
    if(!this.db || !this.user) { this.tabTo("ajustes"); return this.toast("Inicia sesión para guardar.",true); }
    if(!this.rec.meta.ubicacion){ this.tabTo("inspeccion"); return this.toast("Escribe la ubicación o número de unidad.",true); }
    const record=JSON.parse(JSON.stringify(this.rec));
    const version=record.version || 0;
    delete record.version;
    record.updatedAt=Date.now();
    record.updatedBy=this.usuario || this.user.email || "sin nombre";
    let result;
    if(version===0){
      result=await this.db.from("inspections").insert({id:record.id,record,
        created_by:this.user.id,updated_by:this.user.id}).select("id,record,version,updated_at").single();
    } else {
      result=await this.db.from("inspections")
        .update({record,version:version+1,updated_by:this.user.id})
        .eq("id",record.id).eq("version",version).is("deleted_at",null)
        .select("id,record,version,updated_at").maybeSingle();
    }
    if(result.error){ this.toast("No se guardó: "+result.error.message,true); return; }
    if(!result.data){
      this.toast("Otra persona modificó esta semana. Actualiza Registros y revisa antes de guardar.",true);
      return;
    }
    this.rec=this.fromRow(result.data);
    this.paint(); await this.sync(false); this.toast("Semana guardada en línea.");
  },
  fromRow(row){
    return {...row.record, version:row.version,
      updatedAt:Date.parse(row.updated_at)||row.record.updatedAt||0};
  },
  nuevo(){
    if(!confirm("¿Empezar una semana en blanco? Guarda la actual si aún no lo has hecho.")) return;
    this.rec=this.blank(); if(this.usuario) this.rec.meta.inspector=this.usuario;
    this.paint(); this.tabTo("inspeccion"); this.toast("Semana nueva lista.");
  },
  abrir(id){
    const r=this.records.find(x=>x.id===id); if(!r) return;
    this.rec=JSON.parse(JSON.stringify(r)); this.paint(); this.tabTo("inspeccion");
  },
  async borrar(id){
    if(!this.user || !this.db) return this.toast("Inicia sesión.",true);
    if(!confirm("¿Archivar esta semana? Se conservará en el historial de cambios.")) return;
    const r=this.records.find(x=>x.id===id); if(!r) return;
    const {data,error}=await this.db.from("inspections")
      .update({deleted_at:new Date().toISOString(),version:r.version+1,updated_by:this.user.id})
      .eq("id",id).eq("version",r.version).is("deleted_at",null)
      .select("id").maybeSingle();
    if(error || !data) return this.toast(error?.message || "El registro cambió. Actualiza antes de archivar.",true);
    if(this.rec.id===id) this.rec=this.blank();
    this.paint(); await this.sync(false); this.toast("Semana archivada.");
  },
  async historial(id){
    if(!this.db || !this.user) return;
    const {data,error}=await this.db.from("inspection_history")
      .select("version,changed_at,changed_by,action,record")
      .eq("inspection_id",id).order("version",{ascending:false});
    if(error) return this.toast("No se pudo leer el historial: "+error.message,true);
    const box=document.getElementById("historyBox");
    box.hidden=false;
    box.innerHTML=`<h3>Historial de ${esc(id)}</h3>`+(data.length?data.map(h=>
      `<details><summary>Versión ${h.version} · ${esc(new Date(h.changed_at).toLocaleString())} · ${esc(h.action)} · ${esc(h.record?.updatedBy||h.changed_by||"")}</summary><pre>${esc(JSON.stringify(h.record,null,2))}</pre></details>`).join(""):
      "<p>No hay versiones registradas.</p>");
    box.scrollIntoView({behavior:"smooth"});
  },
  tabTo(v){ this.tab(document.querySelector(`.tabs button[data-view="${v}"]`)); },
  renderRecords(){
    const q=(document.getElementById("filtro").value||"").toLowerCase();
    const vivos=this.records.filter(r=>r.meta);
    const lista=vivos.filter(r=>!q || (r.meta.ubicacion+" "+r.meta.sucursal+" "+r.meta.marca).toLowerCase().includes(q))
                     .sort((a,b)=>b.updatedAt-a.updatedAt);
    const box=document.getElementById("recList");
    if(!lista.length){
      box.innerHTML=`<div class="empty"><strong>Sin semanas guardadas</strong>
        Llena la inspección y usa Guardar semana para que aparezca aquí.</div>`; return;
    }
    box.innerHTML = lista.map(r=>{
      let nc=0, hechos=0, aplican=0;
      ITEMS.forEach((_,i)=>{ const it=r.items[i]; if(!it||it.aplica==="NO") return;
        aplican+=7; DIAS.forEach(([k])=>{ if(it.dias[k]) hechos++; if(it.dias[k]==="NC") nc++; }); });
      const tag = nc ? `<span class="tag bad">${nc} no cumple</span>`
                     : hechos ? `<span class="tag">Sin hallazgos</span>`
                              : `<span class="tag grey">Sin datos</span>`;
      const f = r.meta.semanaDel ? r.meta.semanaDel+" → "+(r.meta.semanaAl||"") : "semana sin fecha";
      return `<div class="rec">
        <div class="rec-main">
          <div class="rec-title">${esc(r.meta.ubicacion||"Unidad sin número")} · ${esc(r.meta.marca||"—")}</div>
          <div class="rec-meta">${esc(r.meta.sucursal||"—")} · ${esc(f)} · ${hechos} de ${aplican} casillas · ${esc(r.updatedBy||"")}</div>
        </div>
        ${tag}
        <button class="btn sm" onclick="app.abrir('${r.id}')">Abrir</button>
        <button class="btn sm" onclick="app.historial('${r.id}')">Historial</button>
        <button class="btn sm danger" onclick="app.borrar('${r.id}')">Archivar</button>
      </div>`;
    }).join("");
  },

  /* ---------- lectura compartida ---------- */
  updatePill(estado){
    const p=document.getElementById("syncPill"), t=document.getElementById("syncTxt");
    p.className="pill"+(estado==="err"?" err":this.user?" on":"");
    t.textContent=estado==="wait"?"Actualizando…":estado==="err"?"Configura Supabase":
      this.user?"En línea · "+(this.user.email||"usuario"):"Inicia sesión";
    document.getElementById("authStatus").textContent=this.user?
      "Sesión activa: "+this.user.email:"Inicia sesión para ver y guardar registros.";
  },
  async sync(aviso){
    if(!this.db || !this.user){ if(aviso) this.tabTo("ajustes"); return; }
    this.updatePill("wait");
    try{
      const rows=[]; const size=500;
      for(let offset=0;;offset+=size){
        const {data,error}=await this.db.from("inspections")
          .select("id,record,version,updated_at")
          .is("deleted_at",null).order("id").range(offset,offset+size-1);
        if(error) throw error;
        rows.push(...data);
        if(data.length<size) break;
      }
      this.records=rows.map(row=>this.fromRow(row));
      this.renderRecords(); this.updatePill("ok");
      if(aviso) this.toast("Registros actualizados.");
    }catch(e){ this.updatePill(); this.toast("No se pudo consultar: "+e.message,true); }
  },

  /* ---------- respaldo ---------- */
  exportJSON(){
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify({registros:this.records},null,2)],{type:"application/json"}));
    a.download="checklist-montacargas-respaldo.json"; a.click();
  },
  importJSON(ev){
    const f=ev.target.files[0]; ev.target.value=""; if(!f) return;
    if(!this.user || !this.db) return this.toast("Inicia sesión antes de importar.",true);
    const fr=new FileReader();
    fr.onload=async()=>{ try{
      const d=JSON.parse(fr.result), lista=d.registros||d;
      if(!Array.isArray(lista)) throw new Error("Formato incorrecto");
      let imported=0, skipped=0;
      for(const r of lista){
        if(!r?.id || !r.meta || !r.items || r.borrado){ skipped++; continue; }
        const record=JSON.parse(JSON.stringify(r)); delete record.version;
        const {error}=await this.db.from("inspections")
          .insert({id:r.id,record,created_by:this.user.id,updated_by:this.user.id});
        if(error){ if(error.code==="23505") skipped++; else throw error; }
        else imported++;
      }
      await this.sync(false); this.toast(`Importados: ${imported}. Omitidos: ${skipped}.`);
    }catch(e){ this.toast("No se importó el respaldo: "+e.message,true); } };
    fr.readAsText(f);
  },

  /* ---------- salidas ---------- */
  excel(){
    if(typeof XLSX==="undefined") return this.toast("La librería de Excel no cargó. Revisa la conexión.",true);
    const m=this.rec.meta, A=[];
    A.push(["CHECK LIST DE MONTACARGAS"]);
    A.push(["Departamento de Seguridad y Salud Ocupacional / Recursos Humanos"]);
    A.push([]);
    A.push(["Inspeccionado por:",m.inspector,"","Marca",m.marca,"","Hrs inicial",m.hrsIni,"Hrs final",m.hrsFin]);
    A.push(["Encargado de bodega:",m.encargado,"","Semana",m.semanaDel,"Al",m.semanaAl,"","Mes de",m.mes]);
    A.push(["Sucursal o CD:",m.sucursal,"","Ubicación",m.ubicacion]);
    A.push([]);
    const h1=["ITEM","ESTÁNDAR","Aplica",""], h2=["","","SÍ","NO"];
    DIAS.forEach(([,c])=>{ h1.push(c.toUpperCase(),""); h2.push("C","NC"); });
    A.push(h1); A.push(h2);
    ITEMS.forEach(([n,std],i)=>{
      const it=this.rec.items[i], fila=[n,std,it.aplica==="SI"?"X":"",it.aplica==="NO"?"X":""];
      DIAS.forEach(([k])=>fila.push(it.dias[k]==="C"?"X":"", it.dias[k]==="NC"?"X":""));
      A.push(fila);
    });
    A.push([]);
    A.push(["Observaciones / recomendaciones:",m.obs]);
    A.push(["Fecha de seguimiento:",m.segFecha,"","Responsable:",m.segResp]);
    A.push([]);
    A.push(["Gerente o jefe de bodega:",m.firmaJefe,"","Operador de montacargas:",m.firmaOperador]);
    A.push(["C: Cumple / NC: No cumple · El gerente o jefe de bodega debe verificar que el formato esté totalmente completo · SKU 408716"]);
    const ws=XLSX.utils.aoa_to_sheet(A);
    ws["!cols"]=[{wch:34},{wch:52},{wch:5},{wch:5},...Array(14).fill({wch:4})];
    ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:8}},{s:{r:1,c:0},e:{r:1,c:8}},
      {s:{r:7,c:0},e:{r:8,c:0}},{s:{r:7,c:1},e:{r:8,c:1}},{s:{r:7,c:2},e:{r:7,c:3}},
      ...DIAS.map((_,i)=>({s:{r:7,c:4+i*2},e:{r:7,c:5+i*2}}))];
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Check List");
    XLSX.writeFile(wb,`ChecklistMontacargas_${(m.ubicacion||"unidad").replace(/\s+/g,"")}_${m.semanaDel||""}.xlsx`);
  },
  print(){
    const m=this.rec.meta;
    let html=`<h1>Check list de montacargas · Vidrí</h1>
      <div style="font-size:9px;margin-bottom:4px">Departamento de Seguridad y Salud Ocupacional / Recursos Humanos</div>
      <table><tr><td><b>Inspeccionado por:</b> ${m.inspector||""}</td><td><b>Marca:</b> ${m.marca||""}</td>
      <td><b>Hrs inicial:</b> ${m.hrsIni||""}</td><td><b>Hrs final:</b> ${m.hrsFin||""}</td></tr>
      <tr><td><b>Encargado de bodega:</b> ${m.encargado||""}</td><td><b>Semana:</b> ${m.semanaDel||""} al ${m.semanaAl||""}</td>
      <td colspan="2"><b>Mes de:</b> ${m.mes||""}</td></tr>
      <tr><td><b>Sucursal o CD:</b> ${m.sucursal||""}</td><td colspan="3"><b>Ubicación:</b> ${m.ubicacion||""}</td></tr></table>
      <table><thead><tr><th rowspan="2">Ítem</th><th rowspan="2">Estándar</th><th colspan="2">Aplica</th>
      ${DIAS.map(([,c])=>`<th colspan="2">${c}</th>`).join("")}</tr>
      <tr><th>Sí</th><th>No</th>${DIAS.map(()=>"<th>C</th><th>NC</th>").join("")}</tr></thead><tbody>`;
    ITEMS.forEach(([n,std],i)=>{
      const it=this.rec.items[i];
      html+=`<tr><td>${n}</td><td class="est">${std}</td>
        <td class="mk">${it.aplica==="SI"?"X":""}</td><td class="mk">${it.aplica==="NO"?"X":""}</td>
        ${DIAS.map(([k])=>`<td class="mk">${it.dias[k]==="C"?"X":""}</td><td class="mk">${it.dias[k]==="NC"?"X":""}</td>`).join("")}</tr>`;
    });
    html+=`</tbody></table>
      <table><tr><td style="height:52px"><b>Observaciones / recomendaciones:</b><br>${(m.obs||"").replace(/\n/g,"<br>")}</td></tr>
      <tr><td><b>Fecha de seguimiento:</b> ${m.segFecha||""} &nbsp;&nbsp; <b>Responsable:</b> ${m.segResp||""}</td></tr></table>
      <table style="margin-top:22px"><tr><td style="text-align:center;border:none;padding-top:16px">
      ______________________________<br>Gerente o jefe de bodega<br>${m.firmaJefe||""}</td>
      <td style="text-align:center;border:none;padding-top:16px">
      ______________________________<br>Operador de montacargas<br>${m.firmaOperador||""}</td></tr></table>
      <div style="font-size:8px;margin-top:8px">C: Cumple / NC: No cumple · El gerente o jefe de bodega debe verificar que el formato esté totalmente completo · Tener siempre presente el contacto técnico / mecánico · SKU 408716</div>`;
    document.getElementById("printArea").innerHTML=html;
    window.print();
  },

  toast(msg,bad){
    const t=document.getElementById("toast");
    t.textContent=msg; t.className="show"+(bad?" bad":"");
    clearTimeout(this._t); this._t=setTimeout(()=>t.className="",2800);
  }
};
app.init().catch(e=>app.toast("Error de inicio: "+e.message,true));
