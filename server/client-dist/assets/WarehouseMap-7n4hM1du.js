import{b as _,W as L,r as i,aJ as m,j as e,ag as v,P,T as S}from"./index-BxXqcl_v.js";/* empty css               */import{P as M}from"./plus-BaJI-wxH.js";import{G as D}from"./grid-3x3-C9FbjYD1.js";import{P as E}from"./pen-CPyhSohW.js";const B=()=>{const{t:l}=_(),g=L(),[x,y]=i.useState([]),[d,p]=i.useState(null),[b,o]=i.useState(!1),[O,f]=i.useState(!1),[t,c]=i.useState({zone:"",rack:"",level:"",cell:"",capacity:100});i.useEffect(()=>{h()},[]);const h=async()=>{try{const a=await m.getAllLocations(),s=a.data||a;y(s.locations||s||[])}catch(a){console.warn("WarehouseMap: не удалось загрузить данные",a.message)}f(!1)},N=async a=>{a.preventDefault();try{d?await m.updateLocation(d.id,t):await m.saveLocation(t),o(!1),c({zone:"",rack:"",level:"",cell:"",capacity:100}),p(null),h()}catch(s){console.error("Error saving location:",s)}},k=async a=>{if(await g({variant:"danger",message:"Удалить ячейку?"}))try{await m.deleteLocation(a),h()}catch(s){console.error("Error deleting location:",s)}},u=x.reduce((a,s)=>(a[s.zone]||(a[s.zone]={}),a[s.zone][s.rack]||(a[s.zone][s.rack]=[]),a[s.zone][s.rack].push(s),a),{}),z=a=>a===0?"#94a3b8":a<50?"#22d3ee":a<80?"#38bdf8":"#0ea5e9",w=a=>a===0?"#1e293b":"#0c4a6e",C=a=>`${a.current_capacity?Math.round(a.current_capacity/a.capacity*100):0}%`;return e.jsxs("div",{className:"page-container fade-in",children:[e.jsxs("div",{className:"page-header",children:[e.jsxs("div",{children:[e.jsxs("h1",{children:[e.jsx(v,{size:32})," ",l("warehousemap.karta_sklada","Карта склада")]}),e.jsx("p",{children:l("warehousemap.vizualizatsiya_yacheek_i_tekuschaya_zagruzka","Визуализация ячеек и текущая загрузка")})]}),e.jsxs("button",{className:"btn btn-primary",onClick:()=>{p(null),o(!0)},children:[e.jsx(M,{size:20})," Добавить ячейку"]})]}),e.jsxs("div",{className:"stats-grid",children:[e.jsxs("div",{className:"stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"#4472C4"},children:e.jsx(D,{size:24})}),e.jsxs("div",{className:"stat-details",children:[e.jsx("div",{className:"stat-value",children:x.length}),e.jsx("div",{className:"stat-label",children:l("warehousemap.vsego_yacheek","Всего ячеек")})]})]}),e.jsxs("div",{className:"stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"#70AD47"},children:e.jsx(P,{size:24})}),e.jsxs("div",{className:"stat-details",children:[e.jsx("div",{className:"stat-value",children:x.filter(a=>a.current_capacity>0).length}),e.jsx("div",{className:"stat-label",children:l("warehousemap.zanyato","Занято")})]})]}),e.jsxs("div",{className:"stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"#FFC000"},children:e.jsx(v,{size:24})}),e.jsxs("div",{className:"stat-details",children:[e.jsx("div",{className:"stat-value",children:Object.keys(u).length}),e.jsx("div",{className:"stat-label",children:l("warehousemap.zon","Зон")})]})]})]}),Object.keys(u).map(a=>e.jsxs("div",{className:"card",style:{marginBottom:"20px"},children:[e.jsxs("h3",{children:["Зона: ",a]}),Object.keys(u[a]).map(s=>e.jsxs("div",{className:"rack-container",children:[e.jsxs("h4",{children:["Стеллаж ",s]}),e.jsx("div",{className:"cells-grid",children:u[a][s].sort((r,n)=>r.level!==n.level?r.level-n.level:r.cell.localeCompare(n.cell)).map(r=>{const n=r.current_capacity/r.capacity*100;return e.jsxs("div",{className:"cell-card",style:{background:z(n),color:w(n),cursor:"pointer"},onClick:()=>p(r),children:[e.jsxs("div",{className:"cell-header",children:[e.jsx("strong",{children:r.barcode||r.cell}),e.jsxs("div",{className:"cell-actions",children:[e.jsx("button",{className:"icon-btn",onClick:j=>{j.stopPropagation(),p(r),c({zone:r.zone,rack:r.rack,level:r.level,cell:r.cell,capacity:r.capacity}),o(!0)},children:e.jsx(E,{size:14})}),e.jsx("button",{className:"icon-btn",onClick:j=>{j.stopPropagation(),k(r.id)},children:e.jsx(S,{size:14})})]})]}),e.jsxs("div",{className:"cell-info",children:[e.jsxs("div",{children:["Уровень: ",r.level]}),e.jsxs("div",{children:["Загрузка: ",C(r)]}),e.jsxs("div",{style:{fontSize:"11px",opacity:.7},children:[r.current_capacity||0," / ",r.capacity]})]})]},r.id)})})]},s))]},a)),b&&e.jsx("div",{className:"modal-overlay",onClick:()=>o(!1),children:e.jsxs("div",{className:"modal-content",onClick:a=>a.stopPropagation(),children:[e.jsxs("h2",{children:[d?"Редактировать":"Добавить"," ячейку"]}),e.jsxs("form",{onSubmit:N,children:[e.jsxs("div",{className:"form-row",children:[e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:l("warehousemap.zona","Зона *")}),e.jsx("input",{type:"text",value:t.zone,onChange:a=>c({...t,zone:a.target.value}),placeholder:"A, B, C...",required:!0})]}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:l("warehousemap.stellazh","Стеллаж *")}),e.jsx("input",{type:"text",value:t.rack,onChange:a=>c({...t,rack:a.target.value}),placeholder:"01, 02...",required:!0})]})]}),e.jsxs("div",{className:"form-row",children:[e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:l("warehousemap.uroven","Уровень *")}),e.jsx("input",{type:"number",value:t.level,onChange:a=>c({...t,level:a.target.value}),min:"1",required:!0})]}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:l("warehousemap.yacheyka","Ячейка *")}),e.jsx("input",{type:"text",value:t.cell,onChange:a=>c({...t,cell:a.target.value}),placeholder:"01, 02...",required:!0})]})]}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:l("warehousemap.vmestimost_m_kg","Вместимость (м³/кг)")}),e.jsx("input",{type:"number",value:t.capacity,onChange:a=>c({...t,capacity:a.target.value}),min:"1"})]}),e.jsxs("div",{className:"modal-actions",children:[e.jsx("button",{type:"button",className:"btn btn-secondary",onClick:()=>o(!1),children:"Отмена"}),e.jsx("button",{type:"submit",className:"btn btn-primary",children:d?"Сохранить":"Создать"})]})]})]})}),e.jsx("style",{jsx:!0,children:`
                .rack-container {
                    margin: 20px 0;
                    padding: 16px;
                    background: var(--bg-tertiary);
                    border-radius: 8px;
                }

                .cells-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 12px;
                    margin-top: 12px;
                }

                .cell-card {
                    border: 2px solid var(--border-color);
                    border-radius: 8px;
                    padding: 12px;
                    transition: all 0.2s;
                }

                .cell-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }

                .cell-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .cell-actions {
                    display: flex;
                    gap: 4px;
                }

                .icon-btn {
                    background: rgba(0,0,0,0.1);
                    border: none;
                    border-radius: 4px;
                    padding: 4px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .icon-btn:hover {
                    background: rgba(0,0,0,0.2);
                }

                .cell-info {
                    font-size: 13px;
                }

                .cell-info div {
                    margin: 4px 0;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
            `})]})};export{B as default};
