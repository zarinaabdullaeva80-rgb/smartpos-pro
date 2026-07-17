import{b as ut,r as c,a7 as h,w as xt,j as t,i as K,S as $,k as L,h as ht,P as yt,X as V,ai as mt}from"./index-Cvq3XXbB.js";/* empty css               */import{u as gt}from"./useActionHandler-DRw5PXMW.js";import{E as bt}from"./ExportButton-BvLGI-wO.js";import{P as vt}from"./plus-CNvNHaHV.js";import{P as ft}from"./play-DI4usGW4.js";import"./xlsx-BQptaUDQ.js";import"./download-C7-aeBBX.js";import"./file-spreadsheet-B8TtXQ38.js";const $t=()=>{var X;const{t:l}=ut(),[f,A]=c.useState([]),[a,B]=c.useState(null),[G,J]=c.useState([]),[E,D]=c.useState(!1),[Z,j]=c.useState(!1),[g,Q]=c.useState(!1),[y,I]=c.useState(""),[w,tt]=c.useState(""),[R,et]=c.useState(""),[m,P]=c.useState(""),[_,st]=c.useState(!1),{handleSuccess:k,handleError:u}=gt(),F=c.useRef(null),z=c.useRef({}),[p,M]=c.useState("documents"),[q,rt]=c.useState([]),[C,T]=c.useState(!1),[b,H]=c.useState(""),W=async()=>{T(!0);try{const e=await h.getHistory();rt(e.data||e||[])}catch(e){console.error("Error loading inventory history:",e),u("Не удалось загрузить историю корректировок")}finally{T(!1)}},Y=c.useMemo(()=>{if(!b)return q;const e=b.toLowerCase();return q.filter(s=>{var r,n,i,o,x;return((r=s.product_name)==null?void 0:r.toLowerCase().includes(e))||((n=s.sku)==null?void 0:n.toLowerCase().includes(e))||((i=s.barcode)==null?void 0:i.includes(e))||((o=s.notes)==null?void 0:o.toLowerCase().includes(e))||((x=s.full_name)==null?void 0:x.toLowerCase().includes(e))})},[q,b]);c.useEffect(()=>{v(),nt()},[]),c.useEffect(()=>{p==="history"&&W()},[p]);const v=async()=>{var e;D(!0);try{const s=await h.getAll({status:R||void 0});A(((e=s.data)==null?void 0:e.inventories)||s.data||[])}catch(s){console.error("Error loading inventories:",s),u("Не удалось загрузить инвентаризации"),A([])}finally{D(!1)}},nt=async()=>{var e;try{const s=await xt.getAll();J(((e=s.data)==null?void 0:e.warehouses)||s.data||[])}catch(s){console.error("Error loading warehouses:",s)}},S=async e=>{try{const s=await h.getById(e);B(s.data||s)}catch(s){console.error("Error loading inventory details:",s),u("Не удалось загрузить детали инвентаризации")}},at=async e=>{var s;try{const r=await h.create(e);k("Инвентаризация создана"),j(!1),v(),(s=r.data)!=null&&s.id&&S(r.data.id)}catch(r){console.error("Error creating inventory:",r),u("Ошибка создания инвентаризации")}},ot=async e=>{if(confirm("Начать инвентаризацию? Будут зафиксированы текущие остатки."))try{await h.start(e),k("Инвентаризация начата — товары загружены"),S(e),v()}catch(s){console.error("Error starting inventory:",s),u("Ошибка запуска инвентаризации")}},it=(e,s,r)=>{z.current[s]&&clearTimeout(z.current[s]),B(n=>n&&{...n,items:n.items.map(i=>i.id===s?{...i,actual_quantity:r===""?null:parseFloat(r),difference:r===""?null:parseFloat(r)-(i.expected_quantity||0)}:i)}),z.current[s]=setTimeout(async()=>{try{await h.updateItem(e,s,{actual_quantity:r===""?null:parseFloat(r)})}catch(n){console.error("Error updating item:",n),u("Ошибка обновления позиции")}},500)},lt=async e=>{var s;if(confirm("Завершить инвентаризацию? Будут проведены корректировки остатков."))try{const n=((s=(await h.complete(e)).data)==null?void 0:s.stats)||{total_items:0,items_with_difference:0};k(`Инвентаризация завершена! Обработано: ${n.total_items}, Расхождений: ${n.items_with_difference}`),v(),S(e)}catch(r){console.error("Error completing inventory:",r),u("Ошибка завершения инвентаризации")}},ct=e=>{if(e.key==="Enter"&&y){const r=((a==null?void 0:a.items)||[]).find(n=>{var i;return n.barcode===y||n.sku===y||((i=n.product_name)==null?void 0:i.toLowerCase().includes(y.toLowerCase()))});if(r){const n=document.getElementById(`qty-input-${r.id}`);n&&(n.scrollIntoView({behavior:"smooth",block:"center"}),n.focus(),n.select(),k(`✅ ${r.product_name}`))}else u(`Товар со штрих-кодом "${y}" не найден`);I("")}},dt=e=>({draft:"#6c757d",in_progress:"#ffc107",completed:"#28a745",cancelled:"#dc3545"})[e]||"#6c757d",O=e=>({draft:"Черновик",in_progress:"В процессе",completed:"Завершена",cancelled:"Отменена"})[e]||e,d=c.useMemo(()=>{if(!(a!=null&&a.items))return null;const e=a.items,s=e.filter(o=>o.actual_quantity!==null&&o.actual_quantity!==void 0),r=e.filter(o=>o.actual_quantity!==null&&o.actual_quantity!==void 0&&o.actual_quantity!==o.expected_quantity),n=r.filter(o=>o.actual_quantity>o.expected_quantity),i=r.filter(o=>o.actual_quantity<o.expected_quantity);return{total:e.length,counted:s.length,progress:e.length>0?Math.round(s.length/e.length*100):0,differences:r.length,surplus:n.length,shortage:i.length,surplusSum:n.reduce((o,x)=>o+(x.actual_quantity-x.expected_quantity),0),shortageSum:i.reduce((o,x)=>o+(x.expected_quantity-x.actual_quantity),0)}},[a]),N=c.useMemo(()=>{if(!(a!=null&&a.items))return[];let e=a.items;if(m){const s=m.toLowerCase();e=e.filter(r=>{var n,i,o;return((n=r.product_name)==null?void 0:n.toLowerCase().includes(s))||((i=r.sku)==null?void 0:i.toLowerCase().includes(s))||((o=r.barcode)==null?void 0:o.includes(s))})}return _&&(e=e.filter(s=>s.actual_quantity!==null&&s.actual_quantity!==void 0&&s.actual_quantity!==s.expected_quantity)),e},[a,m,_]),U=c.useMemo(()=>{if(!w)return f;const e=w.toLowerCase();return f.filter(s=>{var r,n;return((r=s.document_number)==null?void 0:r.toLowerCase().includes(e))||((n=s.warehouse_name)==null?void 0:n.toLowerCase().includes(e))})},[f,w]),pt=()=>{if(!a)return;const e=window.open("","_blank"),s=N;e.document.write(`
            <html>
            <head>
                <title>Инвентаризация ${a.document_number}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { font-size: 18px; }
                    h2 { font-size: 14px; color: #666; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 12px; }
                    th { background: #f5f5f5; font-weight: bold; }
                    .surplus { background: #e8f5e9; }
                    .shortage { background: #ffebee; }
                    .stats { display: flex; gap: 20px; margin: 10px 0; }
                    .stat { padding: 8px 12px; background: #f5f5f5; border-radius: 4px; }
                    @media print { body { margin: 10px; } }
                </style>
            </head>
            <body>
                <h1>📦 Инвентаризация ${a.document_number}</h1>
                <h2>Склад: ${a.warehouse_name||"-"} | 
                    Дата: ${new Date(a.document_date).toLocaleDateString("ru-RU")} |
                    Статус: ${O(a.status)}</h2>
                ${d?`
                    <div class="stats">
                        <div class="stat">{t('inventory.vsego', 'Всего:')} <b>${d.total}</b></div>
                        <div class="stat">{t('inventory.podschitano', 'Подсчитано:')} <b>${d.counted}</b></div>
                        <div class="stat">{t('inventory.rashozhdeniy', 'Расхождений:')} <b>${d.differences}</b></div>
                        <div class="stat" style="color:green">{t('inventory.izlishkov', 'Излишков:')} <b>${d.surplus}</b> (+${d.surplusSum})</div>
                        <div class="stat" style="color:red">{t('inventory.nedostach', 'Недостач:')} <b>${d.shortage}</b> (-${d.shortageSum})</div>
                    </div>
                `:""}
                <table>
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>{t('inventory.tovar', 'Товар')}</th>
                            <th>{t('inventory.artikul', 'Артикул')}</th>
                            <th>{t('inventory.shtrih_kod', 'Штрих-код')}</th>
                            <th>{t('inventory.ozhidaetsya', 'Ожидается')}</th>
                            <th>{t('inventory.fakticheski', 'Фактически')}</th>
                            <th>{t('inventory.raznitsa', 'Разница')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${s.map((r,n)=>{const i=r.actual_quantity!==null?r.actual_quantity-r.expected_quantity:null;return`<tr class="${i>0?"surplus":i<0?"shortage":""}">
                                <td>${n+1}</td>
                                <td>${r.product_name}</td>
                                <td>${r.sku||"-"}</td>
                                <td>${r.barcode||"-"}</td>
                                <td>${r.expected_quantity}</td>
                                <td>${r.actual_quantity??"-"}</td>
                                <td>${i!==null?(i>0?"+":"")+i:"-"}</td>
                            </tr>`}).join("")}
                    </tbody>
                </table>
                <p style="margin-top:20px;font-size:11px;color:#999">Дата печати: ${new Date().toLocaleString("ru-RU")}</p>
            </body>
            </html>
        `),e.document.close(),e.print()};return t.jsxs("div",{className:"page-container fade-in",children:[t.jsxs("div",{className:"page-header",children:[t.jsxs("div",{children:[t.jsxs("h1",{children:[t.jsx(K,{size:32})," ",l("inventory.title","Инвентаризация товаров")]}),t.jsx("p",{children:l("inventory.subtitle","Подсчёт фактических остатков и корректировки")})]}),t.jsxs("div",{style:{display:"flex",gap:"10px"},children:[t.jsx(bt,{data:f,filename:"Инвентаризации",sheetName:"Инвентаризации",columns:{document_number:"Номер",document_date:"Дата",warehouse_name:"Склад",status:"Статус",items_count:"Позиций",counted_items:"Подсчитано"}}),t.jsxs("button",{className:"btn btn-primary",onClick:()=>j(!0),children:[t.jsx(vt,{size:20})," ",l("inventory.newInventory","Новая инвентаризация")]})]})]}),t.jsxs("div",{className:"tabs-navigation",style:{display:"flex",gap:"15px",marginBottom:"15px",borderBottom:"1px solid var(--border-color)",paddingBottom:"10px"},children:[t.jsx("button",{className:`tab-btn ${p==="documents"?"active":""}`,onClick:()=>M("documents"),style:{background:"none",border:"none",borderBottom:p==="documents"?"2px solid var(--primary-color)":"2px solid transparent",padding:"8px 16px",cursor:"pointer",fontWeight:"bold",color:p==="documents"?"var(--primary-color)":"var(--text-color)",opacity:p==="documents"?1:.7,transition:"all 0.2s"},children:"📁 Документы"}),t.jsx("button",{className:`tab-btn ${p==="history"?"active":""}`,onClick:()=>M("history"),style:{background:"none",border:"none",borderBottom:p==="history"?"2px solid var(--primary-color)":"2px solid transparent",padding:"8px 16px",cursor:"pointer",fontWeight:"bold",color:p==="history"?"var(--primary-color)":"var(--text-color)",opacity:p==="history"?1:.7,transition:"all 0.2s"},children:"📜 История корректировок"})]}),p==="documents"?t.jsxs("div",{className:"inventory-layout",children:[t.jsxs("div",{className:"card inventories-list",children:[t.jsx("h3",{children:l("inventory.documents","Документы")}),t.jsx("div",{style:{display:"flex",gap:"4px",marginBottom:"8px",flexWrap:"wrap"},children:[{value:"",label:"Все"},{value:"draft",label:"Черновики"},{value:"in_progress",label:"В работе"},{value:"completed",label:"Завершённые"}].map(e=>t.jsx("button",{className:`btn btn-sm ${R===e.value?"btn-primary":"btn-secondary"}`,onClick:()=>{et(e.value),setTimeout(v,100)},style:{fontSize:"11px",padding:"4px 8px"},children:e.label},e.value))}),t.jsxs("div",{style:{position:"relative",marginBottom:"8px"},children:[t.jsx($,{size:14,style:{position:"absolute",left:"8px",top:"50%",transform:"translateY(-50%)",opacity:.5}}),t.jsx("input",{type:"text",placeholder:"Поиск...",value:w,onChange:e=>tt(e.target.value),style:{width:"100%",padding:"6px 6px 6px 28px",fontSize:"12px",border:"1px solid var(--border-color)",borderRadius:"6px",background:"var(--input-bg)",color:"var(--text-color)"}})]}),E&&t.jsxs("div",{style:{textAlign:"center",padding:"20px"},children:[t.jsx(L,{size:20,className:"spin"})," ",l("inventory.zagruzka","Загрузка...")]}),U.length===0&&!E&&t.jsx("div",{style:{textAlign:"center",padding:"20px",opacity:.5,fontSize:"13px"},children:"Инвентаризации не найдены"}),U.map(e=>t.jsxs("div",{className:`inventory-item ${(a==null?void 0:a.id)===e.id?"active":""}`,onClick:()=>S(e.id),children:[t.jsxs("div",{className:"inventory-header",children:[t.jsx("strong",{children:e.document_number}),t.jsx("span",{className:"badge",style:{background:dt(e.status),color:"#fff",padding:"2px 8px",borderRadius:"12px",fontSize:"11px"},children:O(e.status)})]}),t.jsxs("div",{className:"inventory-meta",children:[new Date(e.document_date).toLocaleDateString("ru-RU")," • ",e.warehouse_name]}),t.jsxs("div",{className:"inventory-meta",children:["Позиций: ",e.items_count||0," • Подсчитано: ",e.counted_items||0]})]},e.id))]}),a?t.jsxs("div",{className:"card inventory-details",children:[t.jsxs("div",{className:"inventory-details-header",children:[t.jsxs("div",{children:[t.jsx("h2",{children:a.document_number}),t.jsxs("p",{children:["Склад: ",a.warehouse_name," • Ответственный: ",a.responsible_name||"Не указан"]})]}),t.jsxs("div",{className:"action-buttons",children:[a.status==="draft"&&t.jsxs("button",{className:"btn btn-primary",onClick:()=>ot(a.id),children:[t.jsx(ft,{size:18})," Начать"]}),a.status==="in_progress"&&t.jsxs(t.Fragment,{children:[t.jsxs("button",{className:`btn ${g?"btn-warning":"btn-secondary"}`,onClick:()=>{Q(!g),g||setTimeout(()=>{var e;return(e=F.current)==null?void 0:e.focus()},100)},children:["📷 ",g?"Выкл. сканер":"Вкл. сканер"]}),t.jsxs("button",{className:"btn btn-success",onClick:()=>lt(a.id),children:[t.jsx(ht,{size:18})," Завершить"]})]}),t.jsx("button",{className:"btn btn-secondary",onClick:pt,title:l("inventory.pechat","Печать"),children:t.jsx(yt,{size:18})})]})]}),d&&t.jsxs("div",{className:"stats-row",children:[t.jsxs("div",{className:"stat-card",children:[t.jsx("div",{className:"stat-value",children:d.total}),t.jsx("div",{className:"stat-label",children:l("inventory.totalItems","Всего позиций")})]}),t.jsxs("div",{className:"stat-card",children:[t.jsxs("div",{className:"stat-value",children:[d.counted,t.jsxs("small",{children:["/",d.total]})]}),t.jsx("div",{className:"stat-label",children:l("inventory.counted","Подсчитано")}),t.jsx("div",{className:"progress-bar-mini",children:t.jsx("div",{style:{width:`${d.progress}%`,background:d.progress===100?"#28a745":"#ffc107"}})})]}),t.jsxs("div",{className:"stat-card",style:{borderLeft:"3px solid #dc3545"},children:[t.jsx("div",{className:"stat-value",style:{color:"#dc3545"},children:d.shortage}),t.jsxs("div",{className:"stat-label",children:[l("inventory.shortages","Недостачи")," (−",d.shortageSum,")"]})]}),t.jsxs("div",{className:"stat-card",style:{borderLeft:"3px solid #28a745"},children:[t.jsx("div",{className:"stat-value",style:{color:"#28a745"},children:d.surplus}),t.jsxs("div",{className:"stat-label",children:[l("inventory.surplus","Излишки")," (+",d.surplusSum,")"]})]})]}),g&&t.jsxs("div",{className:"scan-mode",children:[t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"},children:[t.jsx("span",{children:"📷"}),t.jsx("strong",{children:l("inventory.rezhim_skanera","Режим сканера")}),t.jsx("span",{style:{fontSize:"12px",opacity:.7},children:l("inventory.skaniruyte_shtrih_kod_kursor_pereydyot_k","Сканируйте штрих-код — курсор перейдёт к товару")})]}),t.jsx("input",{ref:F,type:"text",value:y,onChange:e=>I(e.target.value),onKeyDown:ct,placeholder:"Сканируйте штрих-код или введите артикул...",autoFocus:!0,className:"scan-input"})]}),t.jsxs("div",{style:{display:"flex",gap:"10px",marginBottom:"12px",alignItems:"center"},children:[t.jsxs("div",{style:{position:"relative",flex:1},children:[t.jsx($,{size:16,style:{position:"absolute",left:"10px",top:"50%",transform:"translateY(-50%)",opacity:.4}}),t.jsx("input",{type:"text",placeholder:"Поиск по товарам, артикулам, штрих-кодам...",value:m,onChange:e=>P(e.target.value),style:{width:"100%",padding:"8px 8px 8px 32px",border:"1px solid var(--border-color)",borderRadius:"6px",background:"var(--input-bg)",color:"var(--text-color)"}}),m&&t.jsx("button",{onClick:()=>P(""),style:{position:"absolute",right:"8px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",opacity:.5},children:t.jsx(V,{size:16})})]}),t.jsxs("label",{style:{display:"flex",alignItems:"center",gap:"6px",fontSize:"13px",whiteSpace:"nowrap",cursor:"pointer"},children:[t.jsx("input",{type:"checkbox",checked:_,onChange:e=>st(e.target.checked)}),"Только расхождения"]}),t.jsxs("span",{style:{fontSize:"12px",opacity:.6,whiteSpace:"nowrap"},children:[N.length," из ",((X=a==null?void 0:a.items)==null?void 0:X.length)||0]})]}),t.jsx("div",{style:{overflowX:"auto"},children:t.jsxs("table",{className:"data-table",children:[t.jsx("thead",{children:t.jsxs("tr",{children:[t.jsx("th",{style:{width:"30px"},children:"№"}),t.jsx("th",{children:l("inventory.tovar","Товар")}),t.jsx("th",{children:l("inventory.artikul","Артикул")}),t.jsx("th",{children:l("inventory.shtrih_kod","Штрих-код")}),t.jsx("th",{style:{textAlign:"right"},children:l("inventory.ozhidaetsya","Ожидается")}),t.jsx("th",{style:{textAlign:"center",width:"120px"},children:l("inventory.fakticheski","Фактически")}),t.jsx("th",{style:{textAlign:"right",width:"100px"},children:l("inventory.raznitsa","Разница")})]})}),t.jsxs("tbody",{children:[N.map((e,s)=>{const r=e.actual_quantity!==null&&e.actual_quantity!==void 0?e.actual_quantity-(e.expected_quantity||0):null;return t.jsxs("tr",{className:r>0?"surplus":r<0?"shortage":"",children:[t.jsx("td",{style:{opacity:.5,fontSize:"12px"},children:s+1}),t.jsx("td",{children:t.jsx("strong",{children:e.product_name})}),t.jsx("td",{style:{fontSize:"12px",opacity:.7},children:e.sku||"-"}),t.jsx("td",{style:{fontSize:"12px",fontFamily:"monospace"},children:e.barcode||"-"}),t.jsx("td",{style:{textAlign:"right"},children:e.expected_quantity}),t.jsx("td",{style:{textAlign:"center"},children:a.status==="in_progress"?t.jsx("input",{id:`qty-input-${e.id}`,type:"number",value:e.actual_quantity??"",onChange:n=>it(a.id,e.id,n.target.value),className:"qty-input",step:"0.001",placeholder:"—",onFocus:n=>n.target.select()}):t.jsx("span",{children:e.actual_quantity??"—"})}),t.jsx("td",{style:{textAlign:"right",fontWeight:r!==null&&r!==0?"bold":"normal"},children:r!==null?t.jsxs("span",{className:r>0?"text-success":r<0?"text-danger":"",children:[r>0?"+":"",r,r!==0&&t.jsx(mt,{size:14,style:{marginLeft:"4px",verticalAlign:"middle"}})]}):"—"})]},e.id)}),N.length===0&&t.jsx("tr",{children:t.jsx("td",{colSpan:7,style:{textAlign:"center",padding:"30px",opacity:.5},children:m||_?"Нет совпадений":"Нет позиций"})})]})]})})]}):t.jsx("div",{className:"card",style:{display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"10px",opacity:.5,minHeight:"300px"},children:t.jsx(K,{size:48})})]}):t.jsxs("div",{className:"card inventory-history-container",style:{padding:"20px"},children:[t.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"15px",flexWrap:"wrap",gap:"15px"},children:[t.jsxs("div",{children:[t.jsx("h2",{children:"📜 История корректировок остатков"}),t.jsx("p",{style:{opacity:.7,fontSize:"13px"},children:"Все изменения, проведённые в процессе инвентаризаций"})]}),t.jsxs("div",{style:{display:"flex",gap:"10px",alignItems:"center",marginLeft:"auto"},children:[t.jsxs("div",{style:{position:"relative",width:"300px"},children:[t.jsx($,{size:16,style:{position:"absolute",left:"10px",top:"50%",transform:"translateY(-50%)",opacity:.4}}),t.jsx("input",{type:"text",placeholder:"Поиск по товару, коду, сотруднику...",value:b,onChange:e=>H(e.target.value),style:{width:"100%",padding:"8px 8px 8px 32px",border:"1px solid var(--border-color)",borderRadius:"6px",background:"var(--input-bg)",color:"var(--text-color)"}}),b&&t.jsx("button",{onClick:()=>H(""),style:{position:"absolute",right:"8px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",opacity:.5},children:t.jsx(V,{size:16})})]}),t.jsxs("button",{className:"btn btn-secondary",onClick:W,disabled:C,children:[t.jsx(L,{size:16,className:C?"spin":""})," Обновить"]})]})]}),C?t.jsxs("div",{style:{textAlign:"center",padding:"50px"},children:[t.jsx(L,{size:30,className:"spin",style:{marginBottom:"10px"}}),t.jsx("div",{children:"Загрузка истории корректировок..."})]}):Y.length===0?t.jsx("div",{style:{textAlign:"center",padding:"50px",opacity:.5},children:"История корректировок пуста или ничего не найдено"}):t.jsx("div",{style:{overflowX:"auto"},children:t.jsxs("table",{className:"data-table",children:[t.jsx("thead",{children:t.jsxs("tr",{children:[t.jsx("th",{style:{width:"150px"},children:"Дата / Время"}),t.jsx("th",{children:"Товар"}),t.jsx("th",{children:"Код"}),t.jsx("th",{children:"Склад"}),t.jsx("th",{style:{textAlign:"center",width:"120px"},children:"Изменение"}),t.jsx("th",{children:"Примечание"}),t.jsx("th",{children:"Сотрудник"})]})}),t.jsx("tbody",{children:Y.map(e=>{const s=new Date(e.created_at),r=isNaN(s)?"—":`${String(s.getDate()).padStart(2,"0")}/${String(s.getMonth()+1).padStart(2,"0")}/${s.getFullYear()} ${String(s.getHours()).padStart(2,"0")}:${String(s.getMinutes()).padStart(2,"0")}`,n=parseFloat(e.quantity),i=n>0,o=n<0;return t.jsxs("tr",{className:i?"surplus":o?"shortage":"",children:[t.jsx("td",{style:{fontSize:"13px",opacity:.8},children:r}),t.jsx("td",{children:t.jsx("strong",{children:e.product_name})}),t.jsx("td",{style:{fontSize:"13px",opacity:.7},children:e.sku||e.code||"-"}),t.jsx("td",{children:e.warehouse_name}),t.jsx("td",{style:{textAlign:"center",fontWeight:"bold"},children:t.jsxs("span",{className:i?"text-success":o?"text-danger":"",children:[i?`+${n}`:n," ",e.unit||"шт."]})}),t.jsx("td",{style:{fontSize:"13px",opacity:.8},children:e.notes||"—"}),t.jsxs("td",{children:["👤 ",e.full_name||"Неизвестно"]})]},e.id)})})]})})]}),Z&&t.jsx("div",{className:"modal-overlay",onClick:()=>j(!1),children:t.jsxs("div",{className:"modal-content",onClick:e=>e.stopPropagation(),children:[t.jsx("h2",{children:l("inventory.newInventory","Новая инвентаризация")}),t.jsxs("form",{onSubmit:e=>{e.preventDefault();const s=new FormData(e.target);at({warehouse_id:parseInt(s.get("warehouse_id")),responsible_user_id:s.get("responsible_user_id")||null,notes:s.get("notes")})},children:[t.jsxs("div",{className:"form-group",children:[t.jsx("label",{children:l("inventory.sklad","Склад *")}),t.jsxs("select",{name:"warehouse_id",required:!0,children:[t.jsx("option",{value:"",children:l("inventory.vyberite_sklad","Выберите склад")}),G.map(e=>t.jsx("option",{value:e.id,children:e.name},e.id))]})]}),t.jsxs("div",{className:"form-group",children:[t.jsx("label",{children:l("inventory.primechaniya","Примечания")}),t.jsx("textarea",{name:"notes",rows:3})]}),t.jsxs("div",{style:{padding:"10px",background:"rgba(59,130,246,0.1)",borderRadius:"8px",marginBottom:"12px",fontSize:"13px"},children:["💡 После создания нажмите ",t.jsx("strong",{children:l("inventory.nachat",'"Начать"')})," — все товары выбранного склада будут автоматически загружены с текущими остатками."]}),t.jsxs("div",{className:"modal-actions",children:[t.jsx("button",{type:"button",className:"btn btn-secondary",onClick:()=>j(!1),children:l("common.cancel")}),t.jsx("button",{type:"submit",className:"btn btn-primary",children:l("common.create")})]})]})]})}),t.jsx("style",{children:`
                .inventory-layout {
                    display: grid;
                    grid-template-columns: 320px 1fr;
                    gap: 20px;
                    margin-top: 20px;
                }

                .inventories-list {
                    max-height: calc(100vh - 200px);
                    overflow-y: auto;
                }

                .inventory-item {
                    padding: 10px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    margin-bottom: 6px;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }

                .inventory-item:hover {
                    background: rgba(68, 114, 196, 0.1);
                }

                .inventory-item.active {
                    background: var(--primary-color);
                    color: white;
                    border-color: var(--primary-color);
                }

                .inventory-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2px;
                }

                .inventory-meta {
                    font-size: 11px;
                    opacity: 0.8;
                    margin-top: 2px;
                }

                .inventory-details-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: start;
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid var(--border-color);
                }

                .action-buttons {
                    display: flex;
                    gap: 8px;
                }

                /* Stats row */
                .stats-row {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                    margin-bottom: 16px;
                }

                .stat-card {
                    padding: 12px;
                    background: var(--card-bg, rgba(255,255,255,0.05));
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                }

                .stat-value {
                    font-size: 24px;
                    font-weight: 700;
                    line-height: 1;
                }

                .stat-value small {
                    font-size: 14px;
                    opacity: 0.5;
                }

                .stat-label {
                    font-size: 12px;
                    opacity: 0.6;
                    margin-top: 4px;
                }

                .progress-bar-mini {
                    height: 4px;
                    background: rgba(128,128,128,0.2);
                    border-radius: 2px;
                    margin-top: 6px;
                    overflow: hidden;
                }

                .progress-bar-mini > div {
                    height: 100%;
                    border-radius: 2px;
                    transition: width 0.3s;
                }

                /* Scanner */
                .scan-mode {
                    background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
                    color: #000;
                    padding: 12px 15px;
                    border-radius: 8px;
                    margin-bottom: 12px;
                }

                .scan-input {
                    width: 100%;
                    padding: 10px;
                    font-size: 16px;
                    border: 2px solid rgba(0,0,0,0.2);
                    border-radius: 6px;
                    background: rgba(255,255,255,0.9);
                    color: #000;
                }

                .scan-input:focus {
                    border-color: #000;
                    outline: none;
                }

                /* Qty input */
                .qty-input {
                    width: 90px;
                    padding: 6px 8px;
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    background: var(--input-bg);
                    color: var(--text-color);
                    text-align: center;
                    font-size: 14px;
                    transition: border-color 0.2s;
                }

                .qty-input:focus {
                    border-color: var(--primary-color);
                    outline: none;
                    box-shadow: 0 0 0 2px rgba(68, 114, 196, 0.2);
                }

                .qty-input::placeholder {
                    opacity: 0.3;
                }

                /* Table highlights */
                tr.surplus {
                    background: rgba(40, 167, 69, 0.08) !important;
                }

                tr.shortage {
                    background: rgba(220, 53, 69, 0.08) !important;
                }

                .text-success { color: #28a745; }
                .text-danger { color: #dc3545; }

                .btn-warning {
                    background: #ffc107;
                    color: #000;
                    border: none;
                }

                @media (max-width: 900px) {
                    .inventory-layout {
                        grid-template-columns: 1fr;
                    }
                    .stats-row {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `})]})};export{$t as default};
