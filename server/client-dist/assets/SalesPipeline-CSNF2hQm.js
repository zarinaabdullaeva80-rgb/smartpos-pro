import{c as L,b as J,W as R,r,a7 as d,j as e,m as U,a0 as $,l as V,v as W,U as G,X as _}from"./index-BxXqcl_v.js";/* empty css               */import{P as k}from"./plus-BaJI-wxH.js";/**
 * @license lucide-react v0.294.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=L("Briefcase",[["rect",{width:"20",height:"14",x:"2",y:"7",rx:"2",ry:"2",key:"eto64e"}],["path",{d:"M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",key:"zwj3tp"}]]),D=[{id:1,name:"Новая заявка",color:"#6366f1",success_probability:10,is_final:!1},{id:2,name:"Квалификация",color:"#8b5cf6",success_probability:25,is_final:!1},{id:3,name:"Предложение",color:"#f59e0b",success_probability:50,is_final:!1},{id:4,name:"Переговоры",color:"#3b82f6",success_probability:75,is_final:!1},{id:5,name:"Закрыта (успех)",color:"#10b981",success_probability:100,is_final:!0}],ee=()=>{const{t}=J(),w=R(),[n,p]=r.useState(()=>{const s=localStorage.getItem("crm_stages");return s?JSON.parse(s):D}),[c,v]=r.useState(()=>{const s=localStorage.getItem("crm_deals");return s?JSON.parse(s):[]}),[z,C]=r.useState([]),[x,X]=r.useState({}),[Y,f]=r.useState(!1),[A,m]=r.useState(!1),[I,u]=r.useState(!1),[h,y]=r.useState(null),[H,N]=r.useState(null);r.useEffect(()=>{localStorage.setItem("crm_stages",JSON.stringify(n))},[n]),r.useEffect(()=>{localStorage.setItem("crm_deals",JSON.stringify(c))},[c]),r.useEffect(()=>{g(),P()},[]);const P=async()=>{var s;try{const a=await d.getCustomers({limit:500});C(((s=a.data)==null?void 0:s.customers)||a.data||[])}catch{console.log("Could not load customers")}},g=async()=>{f(!0);try{const[s,a]=await Promise.all([d.getStages(),d.getDeals({status:"active"})]),l=s.data||s;Array.isArray(l)&&l.length>0&&p(l);const i=a.data||a;Array.isArray(i)&&v(i)}catch{console.log("Server sync skipped, using local data")}finally{f(!1)}},T=(s,a="#6366f1",l=50)=>{const i={id:Date.now(),name:s,color:a,success_probability:l,is_final:!1};p([...n,i])},E=s=>{if(b(s).length>0){N({type:"error",text:"Нельзя удалить этап с сделками. Сначала переместите сделки."});return}p(n.filter(a=>a.id!==s))},F=async s=>{try{const a=await d.createDeal(s),l=a.data||a;N({type:"success",text:"Сделка создана"}),m(!1),g()}catch(a){console.warn("SalesPipeline: не удалось загрузить данные",a.message)}},B=async(s,a)=>{try{await d.updateDealStage(s,a),g()}catch(l){console.error("Error moving deal:",l),v(i=>i.map(o=>o.id===s?{...o,stage_id:a}:o))}},M=(s,a)=>{y(a),s.dataTransfer.effectAllowed="move"},O=s=>{s.preventDefault(),s.dataTransfer.dropEffect="move"},q=(s,a)=>{s.preventDefault(),h&&h.stage_id!==a.id&&B(h.id,a.id),y(null)},b=s=>c.filter(a=>a.stage_id===s),j=s=>V(s);return e.jsxs("div",{className:"page-container fade-in",children:[e.jsxs("div",{className:"page-header",children:[e.jsxs("div",{children:[e.jsxs("h1",{children:[e.jsx(S,{size:32})," ",t("salespipeline.voronka_prodazh","Воронка продаж")]}),e.jsx("p",{children:t("salespipeline.upravlenie_sdelkami_i_konversiya","Управление сделками и конверсия")})]}),e.jsxs("div",{style:{display:"flex",gap:"12px"},children:[e.jsxs("button",{className:"btn btn-secondary",onClick:()=>u(!0),children:[e.jsx(U,{size:18})," Этапы"]}),e.jsxs("button",{className:"btn btn-primary",onClick:()=>m(!0),children:[e.jsx(k,{size:20})," ",t("salespipeline.novaya_sdelka","Новая сделка")]})]})]}),e.jsxs("div",{className:"stats-grid",children:[e.jsxs("div",{className:"stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"#4472C4"},children:e.jsx(S,{size:24})}),e.jsxs("div",{className:"stat-details",children:[e.jsx("div",{className:"stat-value",children:c.length}),e.jsx("div",{className:"stat-label",children:t("salespipeline.aktivnyh_sdelok","Активных сделок")})]})]}),e.jsxs("div",{className:"stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"#70AD47"},children:e.jsx($,{size:24})}),e.jsxs("div",{className:"stat-details",children:[e.jsx("div",{className:"stat-value",children:j(c.reduce((s,a)=>s+parseFloat(a.amount||0),0))}),e.jsx("div",{className:"stat-label",children:t("salespipeline.obschaya_summa","Общая сумма")})]})]}),e.jsxs("div",{className:"stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"#FFC000"},children:e.jsx(W,{size:24})}),e.jsxs("div",{className:"stat-details",children:[e.jsxs("div",{className:"stat-value",children:[(x==null?void 0:x.conversion_rate)||0,"%"]}),e.jsx("div",{className:"stat-label",children:t("salespipeline.konversiya","Конверсия")})]})]}),e.jsxs("div",{className:"stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"#9F2B68"},children:e.jsx(G,{size:24})}),e.jsxs("div",{className:"stat-details",children:[e.jsx("div",{className:"stat-value",children:new Set(c.map(s=>s.customer_id)).size}),e.jsx("div",{className:"stat-label",children:t("salespipeline.klientov","Клиентов")})]})]})]}),e.jsx("div",{className:"kanban-board",children:n.filter(s=>!s.is_final).map(s=>{const a=b(s.id),l=a.reduce((i,o)=>i+parseFloat(o.amount||0),0);return e.jsxs("div",{className:"kanban-column",onDragOver:O,onDrop:i=>q(i,s),children:[e.jsxs("div",{className:"kanban-header",style:{borderTop:`3px solid ${s.color}`},children:[e.jsxs("div",{children:[e.jsx("h3",{children:s.name}),e.jsxs("div",{className:"kanban-stats",children:[a.length," • ",j(l)]})]}),e.jsxs("div",{className:"probability-badge",children:[s.success_probability,"%"]})]}),e.jsx("div",{className:"kanban-cards",children:a.map(i=>e.jsxs("div",{className:"deal-card",draggable:!0,onDragStart:o=>M(o,i),children:[e.jsx("div",{className:"deal-title",children:i.title}),e.jsx("div",{className:"deal-customer",children:i.customer_name}),e.jsx("div",{className:"deal-amount",children:j(i.amount)}),e.jsxs("div",{className:"deal-meta",children:[e.jsx("span",{children:i.assigned_name||"Не назначено"}),i.expected_close_date&&e.jsxs("span",{children:["До ",new Date(i.expected_close_date).toLocaleDateString()]})]})]},i.id))})]},s.id)})}),A&&e.jsx("div",{className:"modal-overlay",onClick:()=>m(!1),children:e.jsxs("div",{className:"modal-content",onClick:s=>s.stopPropagation(),children:[e.jsx("h2",{children:t("salespipeline.novaya_sdelka","Новая сделка")}),e.jsxs("form",{onSubmit:s=>{s.preventDefault();const a=new FormData(s.target);F({title:a.get("title"),customer_id:parseInt(a.get("customer_id")),stage_id:parseInt(a.get("stage_id")),amount:parseFloat(a.get("amount")),expected_close_date:a.get("expected_close_date"),source:a.get("source"),notes:a.get("notes")})},children:[e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:t("salespipeline.nazvanie_sdelki","Название сделки *")}),e.jsx("input",{name:"title",required:!0})]}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:t("salespipeline.klient","Клиент *")}),e.jsxs("select",{name:"customer_id",required:!0,children:[e.jsx("option",{value:"",children:t("salespipeline.vyberite_klienta","Выберите клиента")}),z.map(s=>e.jsxs("option",{value:s.id,children:[s.name,s.phone?` (${s.phone})`:""]},s.id))]})]}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:t("salespipeline.etap","Этап *")}),e.jsx("select",{name:"stage_id",required:!0,children:n.filter(s=>!s.is_final).map(s=>e.jsx("option",{value:s.id,children:s.name},s.id))})]}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:t("salespipeline.summa","Сумма *")}),e.jsx("input",{name:"amount",type:"number",step:"0.01",required:!0})]}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:t("salespipeline.ozhidaemaya_data_zakrytiya","Ожидаемая дата закрытия")}),e.jsx("input",{name:"expected_close_date",type:"date"})]}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:t("salespipeline.istochnik","Источник")}),e.jsxs("select",{name:"source",children:[e.jsx("option",{value:"",children:t("salespipeline.vyberite","Выберите")}),e.jsx("option",{value:"website",children:t("salespipeline.sayt","Сайт")}),e.jsx("option",{value:"advertising",children:t("salespipeline.reklama","Реклама")}),e.jsx("option",{value:"referral",children:t("salespipeline.rekomendatsiya","Рекомендация")}),e.jsx("option",{value:"cold_call",children:t("salespipeline.holodnyy_zvonok","Холодный звонок")})]})]}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:t("salespipeline.primechaniya","Примечания")}),e.jsx("textarea",{name:"notes",rows:3})]}),e.jsxs("div",{className:"modal-actions",children:[e.jsx("button",{type:"button",className:"btn btn-secondary",onClick:()=>m(!1),children:"Отмена"}),e.jsx("button",{type:"submit",className:"btn btn-primary",children:"Создать"})]})]})]})}),I&&e.jsx("div",{className:"modal-overlay",onClick:()=>u(!1),children:e.jsxs("div",{className:"modal-content",onClick:s=>s.stopPropagation(),style:{maxWidth:"500px"},children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"},children:[e.jsx("h2",{style:{margin:0},children:t("salespipeline.upravlenie_etapami","Управление этапами")}),e.jsx("button",{className:"btn btn-sm btn-secondary",onClick:()=>u(!1),children:e.jsx(_,{size:18})})]}),e.jsx("div",{style:{marginBottom:"20px"},children:n.map((s,a)=>e.jsxs("div",{style:{display:"flex",alignItems:"center",padding:"12px",background:"var(--card-bg)",borderRadius:"8px",marginBottom:"8px",borderLeft:`4px solid ${s.color}`},children:[e.jsxs("div",{style:{flex:1},children:[e.jsx("strong",{children:s.name}),e.jsxs("div",{style:{fontSize:"12px",opacity:.7},children:["Вероятность: ",s.success_probability,"% ",s.is_final&&"(финальный)"]})]}),e.jsxs("div",{style:{display:"flex",gap:"8px"},children:[e.jsxs("span",{style:{color:"#666"},children:[b(s.id).length," сделок"]}),!s.is_final&&e.jsx("button",{className:"btn btn-sm btn-danger",onClick:()=>E(s.id),title:t("salespipeline.udalit_etap","Удалить этап"),children:e.jsx(_,{size:14})})]})]},s.id))}),e.jsxs("form",{onSubmit:s=>{s.preventDefault();const a=s.target.stageName.value,l=s.target.stageColor.value,i=parseInt(s.target.stageProbability.value);a&&(T(a,l,i),s.target.reset())},children:[e.jsx("h4",{children:t("salespipeline.dobavit_etap","Добавить этап")}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 80px 80px auto",gap:"12px",alignItems:"end"},children:[e.jsxs("div",{className:"form-group",style:{margin:0},children:[e.jsx("label",{children:t("salespipeline.nazvanie","Название")}),e.jsx("input",{name:"stageName",placeholder:"Название этапа",required:!0})]}),e.jsxs("div",{className:"form-group",style:{margin:0},children:[e.jsx("label",{children:t("salespipeline.tsvet","Цвет")}),e.jsx("input",{name:"stageColor",type:"color",defaultValue:"#6366f1",style:{height:"40px",padding:"4px"}})]}),e.jsxs("div",{className:"form-group",style:{margin:0},children:[e.jsx("label",{children:"%"}),e.jsx("input",{name:"stageProbability",type:"number",min:"0",max:"100",defaultValue:"50",style:{width:"100%"}})]}),e.jsx("button",{type:"submit",className:"btn btn-primary",children:e.jsx(k,{size:18})})]})]}),e.jsx("div",{style:{marginTop:"20px",paddingTop:"16px",borderTop:"1px solid var(--border-color)"},children:e.jsx("button",{className:"btn btn-secondary",onClick:async()=>{await w({message:"Сбросить этапы по умолчанию?"})&&p(D)},children:"Сбросить по умолчанию"})})]})}),e.jsx("style",{jsx:!0,children:`
                .kanban-board {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                    overflow-x: auto;
                }

                .kanban-column {
                    background: var(--card-bg);
                    border-radius: 8px;
                    min-height: 500px;
                    display: flex;
                    flex-direction: column;
                }

                .kanban-header {
                    padding: 16px;
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: start;
                }

                .kanban-header h3 {
                    margin: 0 0 8px 0;
                    font-size: 16px;
                }

                .kanban-stats {
                    font-size: 13px;
                    opacity: 0.7;
                }

                .probability-badge {
                    background: rgba(68, 114, 196, 0.1);
                    color: var(--primary-color);
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                }

                .kanban-cards {
                    padding: 12px;
                    flex: 1;
                    overflow-y: auto;
                }

                .deal-card {
                    background: var(--input-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    padding: 12px;
                    margin-bottom: 12px;
                    cursor: grab;
                    transition: all 0.2s;
                }

                .deal-card:active {
                    cursor: grabbing;
                    opacity: 0.7;
                }

                .deal-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }

                .deal-title {
                    font-weight: 600;
                    margin-bottom: 6px;
                }

                .deal-customer {
                    font-size: 13px;
                    opacity: 0.7;
                    margin-bottom: 8px;
                }

                .deal-amount {
                    font-size: 18px;
                    font-weight: 700;
                    color: var(--primary-color);
                    margin-bottom: 8px;
                }

                .deal-meta {
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                    opacity: 0.6;
                }
            `})]})};export{ee as default};
