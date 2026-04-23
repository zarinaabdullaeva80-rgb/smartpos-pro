import{b as k,r as i,aF as c,j as a,aG as z,v as w}from"./index-BxXqcl_v.js";/* empty css               */import{S as F}from"./star-DB3b-heG.js";import{A as S}from"./award-eFIl9DLT.js";const E=()=>{const{t}=k(),[n,h]=i.useState([]),[y,d]=i.useState([]),[r,g]=i.useState(null),[j,v]=i.useState([]),[u,p]=i.useState(!1);i.useEffect(()=>{b(),N()},[]);const b=async()=>{var s;p(!0);try{const e=await c.getCards();h(((s=e.data)==null?void 0:s.cards)||e.data||[])}catch(e){console.error("Error loading customers:",e)}finally{p(!1)}},N=async()=>{try{const e=(await c.getProgram()).data,l=Array.isArray(e==null?void 0:e.tiers)?e.tiers:Array.isArray(e)?e:[];d(l)}catch(s){console.error("Error loading tiers:",s),d([])}},f=async s=>{var e;try{const l=await c.getCardById(s);v(((e=l.data)==null?void 0:e.transactions)||[])}catch(l){console.error("Error loading transactions:",l)}},m=s=>{g(s),f(s.customer_id||s.id)},o=s=>({Bronze:"🥉",Silver:"🥈",Gold:"🥇",Platinum:"💎"})[s]||"⭐",_=s=>({earned:"Начислено",spent:"Списано",expired:"Истекло",adjusted:"Корректировка"})[s]||s,x=s=>({earned:"#28a745",spent:"#dc3545",expired:"#6c757d",adjusted:"#ffc107"})[s]||"#6c757d";return a.jsxs("div",{className:"page-container fade-in",children:[a.jsx("div",{className:"page-header",children:a.jsxs("div",{children:[a.jsxs("h1",{children:[a.jsx(z,{size:32})," ",t("loyaltyprogram.programma_loyalnosti","Программа лояльности")]}),a.jsx("p",{children:t("loyaltyprogram.upravlenie_ballami_i_urovnyami_klientov","Управление баллами и уровнями клиентов")})]})}),a.jsxs("div",{className:"stats-grid",children:[a.jsxs("div",{className:"stat-card",children:[a.jsx("div",{className:"stat-icon",style:{background:"#4472C4"},children:a.jsx(F,{size:24})}),a.jsxs("div",{className:"stat-details",children:[a.jsx("div",{className:"stat-value",children:n.length}),a.jsx("div",{className:"stat-label",children:t("loyaltyprogram.uchastnikov_programmy","Участников программы")})]})]}),a.jsxs("div",{className:"stat-card",children:[a.jsx("div",{className:"stat-icon",style:{background:"#70AD47"},children:a.jsx(w,{size:24})}),a.jsxs("div",{className:"stat-details",children:[a.jsx("div",{className:"stat-value",children:n.reduce((s,e)=>s+parseFloat(e.total_points||0),0).toFixed(0)}),a.jsx("div",{className:"stat-label",children:t("loyaltyprogram.vsego_ballov","Всего баллов")})]})]}),a.jsxs("div",{className:"stat-card",children:[a.jsx("div",{className:"stat-icon",style:{background:"#FFD700"},children:a.jsx(S,{size:24})}),a.jsxs("div",{className:"stat-details",children:[a.jsx("div",{className:"stat-value",children:n.filter(s=>s.tier_name==="Gold"||s.tier_name==="Platinum").length}),a.jsx("div",{className:"stat-label",children:t("loyaltyprogram.klientov","VIP клиентов")})]})]})]}),a.jsxs("div",{className:"card",children:[a.jsx("h3",{children:t("loyaltyprogram.urovni_programmy","Уровни программы")}),a.jsx("div",{className:"tiers-grid",children:y.map(s=>a.jsxs("div",{className:"tier-card",style:{borderColor:s.color},children:[a.jsx("div",{className:"tier-icon",children:o(s.name)}),a.jsx("div",{className:"tier-name",children:s.name}),a.jsxs("div",{className:"tier-details",children:[a.jsxs("div",{children:[t("loyaltyprogram.skidka","Скидка:")," ",a.jsxs("strong",{children:[s.discount_percent,"%"]})]}),a.jsxs("div",{children:[t("loyaltyprogram.mnozhitel","Множитель:")," ",a.jsxs("strong",{children:[s.points_multiplier,"x"]})]}),a.jsxs("div",{children:[t("loyaltyprogram.ot","От:")," ",a.jsxs("strong",{children:[parseFloat(s.min_purchases_amount).toLocaleString()," ₽"]})]})]}),a.jsxs("div",{className:"tier-count",children:[n.filter(e=>e.tier_id===s.id).length," клиентов"]})]},s.id))})]}),a.jsxs("div",{className:"loyalty-layout",children:[a.jsxs("div",{className:"card customers-table",children:[a.jsx("h3",{children:t("loyaltyprogram.klienty_programmy","Клиенты программы")}),u&&a.jsx("div",{children:t("loyaltyprogram.zagruzka","Загрузка...")}),a.jsxs("table",{className:"data-table",children:[a.jsx("thead",{children:a.jsxs("tr",{children:[a.jsx("th",{children:t("loyaltyprogram.klient","Клиент")}),a.jsx("th",{children:t("loyaltyprogram.uroven","Уровень")}),a.jsx("th",{children:t("loyaltyprogram.bally","Баллы")}),a.jsx("th",{children:t("loyaltyprogram.nachisleno","Начислено")}),a.jsx("th",{children:t("loyaltyprogram.spisano","Списано")}),a.jsx("th",{children:t("loyaltyprogram.skidka","Скидка")}),a.jsx("th",{children:t("loyaltyprogram.deystviya","Действия")})]})}),a.jsx("tbody",{children:n.map(s=>a.jsxs("tr",{className:(r==null?void 0:r.id)===s.id?"selected":"",onClick:()=>m(s),style:{cursor:"pointer"},children:[a.jsxs("td",{children:[a.jsx("div",{children:a.jsx("strong",{children:s.customer_name})}),a.jsx("div",{style:{fontSize:"12px",opacity:.7},children:s.customer_phone})]}),a.jsx("td",{children:a.jsxs("span",{className:"tier-badge",style:{background:s.tier_color},children:[o(s.tier_name)," ",s.tier_name]})}),a.jsx("td",{children:a.jsx("strong",{children:parseFloat(s.total_points).toFixed(0)})}),a.jsx("td",{style:{color:"#28a745"},children:parseFloat(s.earned_points).toFixed(0)}),a.jsx("td",{style:{color:"#dc3545"},children:parseFloat(s.spent_points).toFixed(0)}),a.jsx("td",{children:a.jsxs("strong",{children:[s.tier_discount,"%"]})}),a.jsx("td",{children:a.jsx("button",{className:"btn btn-sm btn-secondary",onClick:e=>{e.stopPropagation(),m(s)},children:"История"})})]},s.id))})]})]}),r&&a.jsxs("div",{className:"card transactions-panel",children:[a.jsxs("h3",{children:["История баллов: ",r.customer_name]}),a.jsxs("div",{className:"balance-summary",children:[a.jsxs("div",{className:"balance-item",children:[a.jsx("div",{className:"balance-label",children:t("loyaltyprogram.tekuschiy_balans","Текущий баланс")}),a.jsxs("div",{className:"balance-value",children:[parseFloat(r.total_points).toFixed(0)," баллов"]})]}),a.jsxs("div",{className:"balance-item",children:[a.jsx("div",{className:"balance-label",children:t("loyaltyprogram.uroven","Уровень")}),a.jsxs("div",{className:"balance-value",children:[o(r.tier_name)," ",r.tier_name]})]})]}),a.jsx("div",{className:"transactions-list",children:j.map(s=>a.jsxs("div",{className:"transaction-item",children:[a.jsx("div",{className:"transaction-icon",style:{background:x(s.transaction_type)},children:s.transaction_type==="earned"?"+":"-"}),a.jsxs("div",{className:"transaction-details",children:[a.jsx("div",{className:"transaction-type",children:_(s.transaction_type)}),a.jsx("div",{className:"transaction-description",children:s.description}),a.jsx("div",{className:"transaction-date",children:new Date(s.created_at).toLocaleString()})]}),a.jsxs("div",{className:"transaction-amount",style:{color:x(s.transaction_type)},children:[s.transaction_type==="earned"?"+":"",parseFloat(s.points).toFixed(0)]})]},s.id))})]})]}),a.jsx("style",{jsx:!0,children:`
                .tiers-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                    margin-top: 16px;
                }

                .tier-card {
                    border: 2px solid;
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                    transition: transform 0.2s;
                }

                .tier-card:hover {
                    transform: translateY(-4px);
                }

                .tier-icon {
                    font-size: 48px;
                    margin-bottom: 12px;
                }

                .tier-name {
                    font-size: 20px;
                    font-weight: 700;
                    margin-bottom: 12px;
                }

                .tier-details {
                    font-size: 13px;
                    margin-bottom: 12px;
                }

                .tier-details div {
                    margin: 4px 0;
                }

                .tier-count {
                    font-size: 12px;
                    opacity: 0.7;
                }

                .tier-badge {
                    padding: 4px 12px;
                    border-radius: 12px;
                    color: white;
                    font-size: 13px;
                    font-weight: 600;
                    display: inline-block;
                }

                .loyalty-layout {
                    display: grid;
                    grid-template-columns: 1fr 400px;
                    gap: 20px;
                    margin-top: 20px;
                }

                .transactions-panel {
                    max-height: 600px;
                    overflow-y: auto;
                }

                .balance-summary {
                    background: var(--input-bg);
                    padding: 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                }

                .balance-item {
                    margin-bottom: 12px;
                }

                .balance-label {
                    font-size: 12px;
                    opacity: 0.7;
                    margin-bottom: 4px;
                }

                .balance-value {
                    font-size: 20px;
                    font-weight: 700;
                }

                .transactions-list {
                    max-height: 400px;
                    overflow-y: auto;
                }

                .transaction-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    border-bottom: 1px solid var(--border-color);
                }

                .transaction-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 700;
                    font-size: 18px;
                }

                .transaction-details {
                    flex: 1;
                }

                .transaction-type {
                    font-weight: 600;
                    margin-bottom: 2px;
                }

                .transaction-description {
                    font-size: 12px;
                    opacity: 0.7;
                    margin-bottom: 2px;
                }

                .transaction-date {
                    font-size: 11px;
                    opacity: 0.5;
                }

                .transaction-amount {
                    font-size: 18px;
                    font-weight: 700;
                }

                tr.selected {
                    background: rgba(68, 114, 196, 0.1);
                }
            `})]})};export{E as default};
