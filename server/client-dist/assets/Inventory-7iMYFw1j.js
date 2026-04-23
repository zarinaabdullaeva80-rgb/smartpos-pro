import{b as tt,r as d,aC as h,w as et,j as t,P as R,S as B,k as st,h as rt,X as at,ak as nt}from"./index-BxXqcl_v.js";/* empty css               */import{u as ot}from"./useActionHandler-Bg5f0lyV.js";import{E as it}from"./ExportButton-iWTZBhEy.js";import{P as lt}from"./plus-BaJI-wxH.js";import{P as ct}from"./play-J885xFav.js";import{P as dt}from"./printer-DVjk5q9y.js";import"./xlsx-BQptaUDQ.js";import"./download-DA6U2jnZ.js";import"./file-spreadsheet-CQ_nff5t.js";const jt=()=>{var P;const{t:o}=tt(),[b,N]=d.useState([]),[a,z]=d.useState(null),[F,M]=d.useState([]),[q,$]=d.useState(!1),[T,v]=d.useState(!1),[m,W]=d.useState(!1),[p,C]=d.useState(""),[f,U]=d.useState(""),[A,Y]=d.useState(""),[x,E]=d.useState(""),[j,H]=d.useState(!1),{handleSuccess:_,handleError:u}=ot(),I=d.useRef(null),S=d.useRef({});d.useEffect(()=>{y(),O()},[]);const y=async()=>{var e;$(!0);try{const s=await h.getAll({status:A||void 0});N(((e=s.data)==null?void 0:e.inventories)||s.data||[])}catch(s){console.error("Error loading inventories:",s),u("Не удалось загрузить инвентаризации"),N([])}finally{$(!1)}},O=async()=>{var e;try{const s=await et.getAll();M(((e=s.data)==null?void 0:e.warehouses)||s.data||[])}catch(s){console.error("Error loading warehouses:",s)}},w=async e=>{try{const s=await h.getById(e);z(s.data||s)}catch(s){console.error("Error loading inventory details:",s),u("Не удалось загрузить детали инвентаризации")}},X=async e=>{var s;try{const r=await h.create(e);_("Инвентаризация создана"),v(!1),y(),(s=r.data)!=null&&s.id&&w(r.data.id)}catch(r){console.error("Error creating inventory:",r),u("Ошибка создания инвентаризации")}},K=async e=>{if(confirm("Начать инвентаризацию? Будут зафиксированы текущие остатки."))try{await h.start(e),_("Инвентаризация начата — товары загружены"),w(e),y()}catch(s){console.error("Error starting inventory:",s),u("Ошибка запуска инвентаризации")}},V=(e,s,r)=>{S.current[s]&&clearTimeout(S.current[s]),z(n=>n&&{...n,items:n.items.map(l=>l.id===s?{...l,actual_quantity:r===""?null:parseFloat(r),difference:r===""?null:parseFloat(r)-(l.expected_quantity||0)}:l)}),S.current[s]=setTimeout(async()=>{try{await h.updateItem(e,s,{actual_quantity:r===""?null:parseFloat(r)})}catch(n){console.error("Error updating item:",n),u("Ошибка обновления позиции")}},500)},G=async e=>{var s;if(confirm("Завершить инвентаризацию? Будут проведены корректировки остатков."))try{const n=((s=(await h.complete(e)).data)==null?void 0:s.stats)||{total_items:0,items_with_difference:0};_(`Инвентаризация завершена! Обработано: ${n.total_items}, Расхождений: ${n.items_with_difference}`),y(),w(e)}catch(r){console.error("Error completing inventory:",r),u("Ошибка завершения инвентаризации")}},J=e=>{if(e.key==="Enter"&&p){const r=((a==null?void 0:a.items)||[]).find(n=>{var l;return n.barcode===p||n.sku===p||((l=n.product_name)==null?void 0:l.toLowerCase().includes(p.toLowerCase()))});if(r){const n=document.getElementById(`qty-input-${r.id}`);n&&(n.scrollIntoView({behavior:"smooth",block:"center"}),n.focus(),n.select(),_(`✅ ${r.product_name}`))}else u(`Товар со штрих-кодом "${p}" не найден`);C("")}},Z=e=>({draft:"#6c757d",in_progress:"#ffc107",completed:"#28a745",cancelled:"#dc3545"})[e]||"#6c757d",L=e=>({draft:"Черновик",in_progress:"В процессе",completed:"Завершена",cancelled:"Отменена"})[e]||e,c=d.useMemo(()=>{if(!(a!=null&&a.items))return null;const e=a.items,s=e.filter(i=>i.actual_quantity!==null&&i.actual_quantity!==void 0),r=e.filter(i=>i.actual_quantity!==null&&i.actual_quantity!==void 0&&i.actual_quantity!==i.expected_quantity),n=r.filter(i=>i.actual_quantity>i.expected_quantity),l=r.filter(i=>i.actual_quantity<i.expected_quantity);return{total:e.length,counted:s.length,progress:e.length>0?Math.round(s.length/e.length*100):0,differences:r.length,surplus:n.length,shortage:l.length,surplusSum:n.reduce((i,g)=>i+(g.actual_quantity-g.expected_quantity),0),shortageSum:l.reduce((i,g)=>i+(g.expected_quantity-g.actual_quantity),0)}},[a]),k=d.useMemo(()=>{if(!(a!=null&&a.items))return[];let e=a.items;if(x){const s=x.toLowerCase();e=e.filter(r=>{var n,l,i;return((n=r.product_name)==null?void 0:n.toLowerCase().includes(s))||((l=r.sku)==null?void 0:l.toLowerCase().includes(s))||((i=r.barcode)==null?void 0:i.includes(s))})}return j&&(e=e.filter(s=>s.actual_quantity!==null&&s.actual_quantity!==void 0&&s.actual_quantity!==s.expected_quantity)),e},[a,x,j]),D=d.useMemo(()=>{if(!f)return b;const e=f.toLowerCase();return b.filter(s=>{var r,n;return((r=s.document_number)==null?void 0:r.toLowerCase().includes(e))||((n=s.warehouse_name)==null?void 0:n.toLowerCase().includes(e))})},[b,f]),Q=()=>{if(!a)return;const e=window.open("","_blank"),s=k;e.document.write(`
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
                    Статус: ${L(a.status)}</h2>
                ${c?`
                    <div class="stats">
                        <div class="stat">{t('inventory.vsego', 'Всего:')} <b>${c.total}</b></div>
                        <div class="stat">{t('inventory.podschitano', 'Подсчитано:')} <b>${c.counted}</b></div>
                        <div class="stat">{t('inventory.rashozhdeniy', 'Расхождений:')} <b>${c.differences}</b></div>
                        <div class="stat" style="color:green">{t('inventory.izlishkov', 'Излишков:')} <b>${c.surplus}</b> (+${c.surplusSum})</div>
                        <div class="stat" style="color:red">{t('inventory.nedostach', 'Недостач:')} <b>${c.shortage}</b> (-${c.shortageSum})</div>
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
                        ${s.map((r,n)=>{const l=r.actual_quantity!==null?r.actual_quantity-r.expected_quantity:null;return`<tr class="${l>0?"surplus":l<0?"shortage":""}">
                                <td>${n+1}</td>
                                <td>${r.product_name}</td>
                                <td>${r.sku||"-"}</td>
                                <td>${r.barcode||"-"}</td>
                                <td>${r.expected_quantity}</td>
                                <td>${r.actual_quantity??"-"}</td>
                                <td>${l!==null?(l>0?"+":"")+l:"-"}</td>
                            </tr>`}).join("")}
                    </tbody>
                </table>
                <p style="margin-top:20px;font-size:11px;color:#999">Дата печати: ${new Date().toLocaleString("ru-RU")}</p>
            </body>
            </html>
        `),e.document.close(),e.print()};return t.jsxs("div",{className:"page-container fade-in",children:[t.jsxs("div",{className:"page-header",children:[t.jsxs("div",{children:[t.jsxs("h1",{children:[t.jsx(R,{size:32})," ",o("inventory.title","Инвентаризация товаров")]}),t.jsx("p",{children:o("inventory.subtitle","Подсчёт фактических остатков и корректировки")})]}),t.jsxs("div",{style:{display:"flex",gap:"10px"},children:[t.jsx(it,{data:b,filename:"Инвентаризации",sheetName:"Инвентаризации",columns:{document_number:"Номер",document_date:"Дата",warehouse_name:"Склад",status:"Статус",items_count:"Позиций",counted_items:"Подсчитано"}}),t.jsxs("button",{className:"btn btn-primary",onClick:()=>v(!0),children:[t.jsx(lt,{size:20})," ",o("inventory.newInventory","Новая инвентаризация")]})]})]}),t.jsxs("div",{className:"inventory-layout",children:[t.jsxs("div",{className:"card inventories-list",children:[t.jsx("h3",{children:o("inventory.documents","Документы")}),t.jsx("div",{style:{display:"flex",gap:"4px",marginBottom:"8px",flexWrap:"wrap"},children:[{value:"",label:"Все"},{value:"draft",label:"Черновики"},{value:"in_progress",label:"В работе"},{value:"completed",label:"Завершённые"}].map(e=>t.jsx("button",{className:`btn btn-sm ${A===e.value?"btn-primary":"btn-secondary"}`,onClick:()=>{Y(e.value),setTimeout(y,100)},style:{fontSize:"11px",padding:"4px 8px"},children:e.label},e.value))}),t.jsxs("div",{style:{position:"relative",marginBottom:"8px"},children:[t.jsx(B,{size:14,style:{position:"absolute",left:"8px",top:"50%",transform:"translateY(-50%)",opacity:.5}}),t.jsx("input",{type:"text",placeholder:"Поиск...",value:f,onChange:e=>U(e.target.value),style:{width:"100%",padding:"6px 6px 6px 28px",fontSize:"12px",border:"1px solid var(--border-color)",borderRadius:"6px",background:"var(--input-bg)",color:"var(--text-color)"}})]}),q&&t.jsxs("div",{style:{textAlign:"center",padding:"20px"},children:[t.jsx(st,{size:20,className:"spin"})," ",o("inventory.zagruzka","Загрузка...")]}),D.length===0&&!q&&t.jsx("div",{style:{textAlign:"center",padding:"20px",opacity:.5,fontSize:"13px"},children:"Инвентаризации не найдены"}),D.map(e=>t.jsxs("div",{className:`inventory-item ${(a==null?void 0:a.id)===e.id?"active":""}`,onClick:()=>w(e.id),children:[t.jsxs("div",{className:"inventory-header",children:[t.jsx("strong",{children:e.document_number}),t.jsx("span",{className:"badge",style:{background:Z(e.status),color:"#fff",padding:"2px 8px",borderRadius:"12px",fontSize:"11px"},children:L(e.status)})]}),t.jsxs("div",{className:"inventory-meta",children:[new Date(e.document_date).toLocaleDateString("ru-RU")," • ",e.warehouse_name]}),t.jsxs("div",{className:"inventory-meta",children:["Позиций: ",e.items_count||0," • Подсчитано: ",e.counted_items||0]})]},e.id))]}),a?t.jsxs("div",{className:"card inventory-details",children:[t.jsxs("div",{className:"inventory-details-header",children:[t.jsxs("div",{children:[t.jsx("h2",{children:a.document_number}),t.jsxs("p",{children:["Склад: ",a.warehouse_name," • Ответственный: ",a.responsible_name||"Не указан"]})]}),t.jsxs("div",{className:"action-buttons",children:[a.status==="draft"&&t.jsxs("button",{className:"btn btn-primary",onClick:()=>K(a.id),children:[t.jsx(ct,{size:18})," Начать"]}),a.status==="in_progress"&&t.jsxs(t.Fragment,{children:[t.jsxs("button",{className:`btn ${m?"btn-warning":"btn-secondary"}`,onClick:()=>{W(!m),m||setTimeout(()=>{var e;return(e=I.current)==null?void 0:e.focus()},100)},children:["📷 ",m?"Выкл. сканер":"Вкл. сканер"]}),t.jsxs("button",{className:"btn btn-success",onClick:()=>G(a.id),children:[t.jsx(rt,{size:18})," Завершить"]})]}),t.jsx("button",{className:"btn btn-secondary",onClick:Q,title:o("inventory.pechat","Печать"),children:t.jsx(dt,{size:18})})]})]}),c&&t.jsxs("div",{className:"stats-row",children:[t.jsxs("div",{className:"stat-card",children:[t.jsx("div",{className:"stat-value",children:c.total}),t.jsx("div",{className:"stat-label",children:o("inventory.totalItems","Всего позиций")})]}),t.jsxs("div",{className:"stat-card",children:[t.jsxs("div",{className:"stat-value",children:[c.counted,t.jsxs("small",{children:["/",c.total]})]}),t.jsx("div",{className:"stat-label",children:o("inventory.counted","Подсчитано")}),t.jsx("div",{className:"progress-bar-mini",children:t.jsx("div",{style:{width:`${c.progress}%`,background:c.progress===100?"#28a745":"#ffc107"}})})]}),t.jsxs("div",{className:"stat-card",style:{borderLeft:"3px solid #dc3545"},children:[t.jsx("div",{className:"stat-value",style:{color:"#dc3545"},children:c.shortage}),t.jsxs("div",{className:"stat-label",children:[o("inventory.shortages","Недостачи")," (−",c.shortageSum,")"]})]}),t.jsxs("div",{className:"stat-card",style:{borderLeft:"3px solid #28a745"},children:[t.jsx("div",{className:"stat-value",style:{color:"#28a745"},children:c.surplus}),t.jsxs("div",{className:"stat-label",children:[o("inventory.surplus","Излишки")," (+",c.surplusSum,")"]})]})]}),m&&t.jsxs("div",{className:"scan-mode",children:[t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"},children:[t.jsx("span",{children:"📷"}),t.jsx("strong",{children:o("inventory.rezhim_skanera","Режим сканера")}),t.jsx("span",{style:{fontSize:"12px",opacity:.7},children:o("inventory.skaniruyte_shtrih_kod_kursor_pereydyot_k","Сканируйте штрих-код — курсор перейдёт к товару")})]}),t.jsx("input",{ref:I,type:"text",value:p,onChange:e=>C(e.target.value),onKeyDown:J,placeholder:"Сканируйте штрих-код или введите артикул...",autoFocus:!0,className:"scan-input"})]}),t.jsxs("div",{style:{display:"flex",gap:"10px",marginBottom:"12px",alignItems:"center"},children:[t.jsxs("div",{style:{position:"relative",flex:1},children:[t.jsx(B,{size:16,style:{position:"absolute",left:"10px",top:"50%",transform:"translateY(-50%)",opacity:.4}}),t.jsx("input",{type:"text",placeholder:"Поиск по товарам, артикулам, штрих-кодам...",value:x,onChange:e=>E(e.target.value),style:{width:"100%",padding:"8px 8px 8px 32px",border:"1px solid var(--border-color)",borderRadius:"6px",background:"var(--input-bg)",color:"var(--text-color)"}}),x&&t.jsx("button",{onClick:()=>E(""),style:{position:"absolute",right:"8px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",opacity:.5},children:t.jsx(at,{size:16})})]}),t.jsxs("label",{style:{display:"flex",alignItems:"center",gap:"6px",fontSize:"13px",whiteSpace:"nowrap",cursor:"pointer"},children:[t.jsx("input",{type:"checkbox",checked:j,onChange:e=>H(e.target.checked)}),"Только расхождения"]}),t.jsxs("span",{style:{fontSize:"12px",opacity:.6,whiteSpace:"nowrap"},children:[k.length," из ",((P=a==null?void 0:a.items)==null?void 0:P.length)||0]})]}),t.jsx("div",{style:{overflowX:"auto"},children:t.jsxs("table",{className:"data-table",children:[t.jsx("thead",{children:t.jsxs("tr",{children:[t.jsx("th",{style:{width:"30px"},children:"№"}),t.jsx("th",{children:o("inventory.tovar","Товар")}),t.jsx("th",{children:o("inventory.artikul","Артикул")}),t.jsx("th",{children:o("inventory.shtrih_kod","Штрих-код")}),t.jsx("th",{style:{textAlign:"right"},children:o("inventory.ozhidaetsya","Ожидается")}),t.jsx("th",{style:{textAlign:"center",width:"120px"},children:o("inventory.fakticheski","Фактически")}),t.jsx("th",{style:{textAlign:"right",width:"100px"},children:o("inventory.raznitsa","Разница")})]})}),t.jsxs("tbody",{children:[k.map((e,s)=>{const r=e.actual_quantity!==null&&e.actual_quantity!==void 0?e.actual_quantity-(e.expected_quantity||0):null;return t.jsxs("tr",{className:r>0?"surplus":r<0?"shortage":"",children:[t.jsx("td",{style:{opacity:.5,fontSize:"12px"},children:s+1}),t.jsx("td",{children:t.jsx("strong",{children:e.product_name})}),t.jsx("td",{style:{fontSize:"12px",opacity:.7},children:e.sku||"-"}),t.jsx("td",{style:{fontSize:"12px",fontFamily:"monospace"},children:e.barcode||"-"}),t.jsx("td",{style:{textAlign:"right"},children:e.expected_quantity}),t.jsx("td",{style:{textAlign:"center"},children:a.status==="in_progress"?t.jsx("input",{id:`qty-input-${e.id}`,type:"number",value:e.actual_quantity??"",onChange:n=>V(a.id,e.id,n.target.value),className:"qty-input",step:"0.001",placeholder:"—",onFocus:n=>n.target.select()}):t.jsx("span",{children:e.actual_quantity??"—"})}),t.jsx("td",{style:{textAlign:"right",fontWeight:r!==null&&r!==0?"bold":"normal"},children:r!==null?t.jsxs("span",{className:r>0?"text-success":r<0?"text-danger":"",children:[r>0?"+":"",r,r!==0&&t.jsx(nt,{size:14,style:{marginLeft:"4px",verticalAlign:"middle"}})]}):"—"})]},e.id)}),k.length===0&&t.jsx("tr",{children:t.jsx("td",{colSpan:7,style:{textAlign:"center",padding:"30px",opacity:.5},children:x||j?"Нет совпадений":"Нет позиций"})})]})]})})]}):t.jsxs("div",{className:"card",style:{display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"10px",opacity:.5,minHeight:"300px"},children:[t.jsx(R,{size:48}),t.jsx("p",{children:o("inventory.vyberite_inventarizatsiyu_iz_spiska_sleva","Выберите инвентаризацию из списка слева или создайте новую")})]})]}),T&&t.jsx("div",{className:"modal-overlay",onClick:()=>v(!1),children:t.jsxs("div",{className:"modal-content",onClick:e=>e.stopPropagation(),children:[t.jsx("h2",{children:o("inventory.newInventory","Новая инвентаризация")}),t.jsxs("form",{onSubmit:e=>{e.preventDefault();const s=new FormData(e.target);X({warehouse_id:parseInt(s.get("warehouse_id")),responsible_user_id:s.get("responsible_user_id")||null,notes:s.get("notes")})},children:[t.jsxs("div",{className:"form-group",children:[t.jsx("label",{children:o("inventory.sklad","Склад *")}),t.jsxs("select",{name:"warehouse_id",required:!0,children:[t.jsx("option",{value:"",children:o("inventory.vyberite_sklad","Выберите склад")}),F.map(e=>t.jsx("option",{value:e.id,children:e.name},e.id))]})]}),t.jsxs("div",{className:"form-group",children:[t.jsx("label",{children:o("inventory.primechaniya","Примечания")}),t.jsx("textarea",{name:"notes",rows:3})]}),t.jsxs("div",{style:{padding:"10px",background:"rgba(59,130,246,0.1)",borderRadius:"8px",marginBottom:"12px",fontSize:"13px"},children:["💡 После создания нажмите ",t.jsx("strong",{children:o("inventory.nachat",'"Начать"')})," — все товары выбранного склада будут автоматически загружены с текущими остатками."]}),t.jsxs("div",{className:"modal-actions",children:[t.jsx("button",{type:"button",className:"btn btn-secondary",onClick:()=>v(!1),children:o("common.cancel")}),t.jsx("button",{type:"submit",className:"btn btn-primary",children:o("common.create")})]})]})]})}),t.jsx("style",{children:`
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
            `})]})};export{jt as default};
