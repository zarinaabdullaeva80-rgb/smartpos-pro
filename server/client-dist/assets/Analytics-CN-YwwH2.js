import{b as P,r as d,_ as p,j as a,B as m,P as E,a0 as $,v as R,D as y,F as I,G as K,H as T,I as g,Q as b,K as u,N,Y as f,V as _,L as q}from"./index-BxXqcl_v.js";/* empty css               */const M=()=>{const{t:s}=P(),[l,x]=d.useState("abc"),[t,k]=d.useState(null),[n,L]=d.useState(null),[i,S]=d.useState(null),[j,D]=d.useState(null),[c,v]=d.useState({startDate:new Date(Date.now()-30*24*60*60*1e3).toISOString().split("T")[0],endDate:new Date().toISOString().split("T")[0]}),[h,o]=d.useState(!1);d.useEffect(()=>{l==="abc"&&C(),l==="pl"&&A(),l==="balance"&&F(),l==="category"&&z()},[l,c]);const C=async()=>{o(!0);try{const e=await p.getABCAnalysis({startDate:c.startDate,endDate:c.endDate});k(e.data)}catch(e){console.error("Error loading ABC analysis:",e)}finally{o(!1)}},A=async()=>{o(!0);try{const e=await p.getProfitLoss({startDate:c.startDate,endDate:c.endDate});L(e.data)}catch(e){console.error("Error loading P&L:",e)}finally{o(!1)}},F=async()=>{o(!0);try{const e=await p.getBalanceSheet();S(e.data)}catch(e){console.error("Error loading balance sheet:",e)}finally{o(!1)}},z=async()=>{o(!0);try{const e=await p.getCategoryAnalysis({startDate:c.startDate,endDate:c.endDate});D(e.data)}catch(e){console.error("Error loading category analysis:",e)}finally{o(!1)}},B={A:"#28a745",B:"#ffc107",C:"#dc3545"};return a.jsxs("div",{className:"page-container fade-in",children:[a.jsxs("div",{className:"page-header",children:[a.jsxs("div",{children:[a.jsxs("h1",{children:[a.jsx(m,{size:32})," ",s("analytics.title","Аналитика и прогнозирование")]}),a.jsx("p",{children:s("analytics.subtitle","Глубокая аналитика продаж, товаров и финансов")})]}),a.jsxs("div",{style:{display:"flex",gap:"10px"},children:[a.jsx("input",{type:"date",value:c.startDate,onChange:e=>v(r=>({...r,startDate:e.target.value})),className:"input"}),a.jsx("input",{type:"date",value:c.endDate,onChange:e=>v(r=>({...r,endDate:e.target.value})),className:"input"})]})]}),a.jsxs("div",{className:"tabs",children:[a.jsxs("button",{className:`tab ${l==="abc"?"active":""}`,onClick:()=>x("abc"),children:[a.jsx(E,{size:18})," ",s("analytics.abcAnalysis","ABC-анализ")]}),a.jsxs("button",{className:`tab ${l==="pl"?"active":""}`,onClick:()=>x("pl"),children:[a.jsx($,{size:18})," ",s("analytics.profitLoss","ОПиУ (P&L)")]}),a.jsxs("button",{className:`tab ${l==="balance"?"active":""}`,onClick:()=>x("balance"),children:[a.jsx(R,{size:18})," ",s("analytics.balance","Баланс")]}),a.jsxs("button",{className:`tab ${l==="category"?"active":""}`,onClick:()=>x("category"),children:[a.jsx(m,{size:18})," ",s("analytics.byCategory","По категориям")]})]}),h&&a.jsx("div",{className:"loading",children:s("common.loading")}),l==="abc"&&t&&!h&&a.jsxs("div",{className:"analytics-content",children:[a.jsxs("div",{className:"stats-grid",children:[a.jsxs("div",{className:"stat-card card",style:{borderLeft:"4px solid #28a745"},children:[a.jsx("div",{className:"stat-label",children:s("analytics.kategoriya","Категория A (VIP)")}),a.jsxs("div",{className:"stat-value",children:[t.stats.A.count," товаров"]}),a.jsxs("div",{className:"stat-meta",children:[t.stats.A.percent,"% выручки • ",t.stats.A.revenue.toLocaleString()," ₽"]})]}),a.jsxs("div",{className:"stat-card card",style:{borderLeft:"4px solid #ffc107"},children:[a.jsx("div",{className:"stat-label",children:s("analytics.kategoriya_vazhnye","Категория B (Важные)")}),a.jsxs("div",{className:"stat-value",children:[t.stats.B.count," товаров"]}),a.jsxs("div",{className:"stat-meta",children:[t.stats.B.percent,"% выручки • ",t.stats.B.revenue.toLocaleString()," ₽"]})]}),a.jsxs("div",{className:"stat-card card",style:{borderLeft:"4px solid #dc3545"},children:[a.jsx("div",{className:"stat-label",children:s("analytics.kategoriya_prochie","Категория C (Прочие)")}),a.jsxs("div",{className:"stat-value",children:[t.stats.C.count," товаров"]}),a.jsxs("div",{className:"stat-meta",children:[t.stats.C.percent,"% выручки • ",t.stats.C.revenue.toLocaleString()," ₽"]})]}),a.jsxs("div",{className:"stat-card card",style:{borderLeft:"4px solid var(--primary-color)"},children:[a.jsx("div",{className:"stat-label",children:s("analytics.obschaya_vyruchka","Общая выручка")}),a.jsxs("div",{className:"stat-value",children:[parseFloat(t.totalRevenue).toLocaleString()," ₽"]}),a.jsx("div",{className:"stat-meta",children:s("analytics.za_vybrannyy_period","За выбранный период")})]})]}),a.jsxs("div",{className:"charts-grid",children:[a.jsxs("div",{className:"card",children:[a.jsx("h3",{children:s("analytics.raspredelenie_po_kategoriyam","Распределение по категориям")}),a.jsx(y,{width:"100%",height:300,children:a.jsxs(I,{children:[a.jsx(K,{data:[{name:"A",value:t.stats.A.count},{name:"B",value:t.stats.B.count},{name:"C",value:t.stats.C.count}],cx:"50%",cy:"50%",labelLine:!1,label:({name:e,value:r,percent:w})=>`${e}: ${r} (${(w*100).toFixed(0)}%)`,outerRadius:80,fill:"#8884d8",dataKey:"value",children:["A","B","C"].map((e,r)=>a.jsx(T,{fill:B[e]},`cell-${r}`))}),a.jsx(g,{})]})})]}),a.jsxs("div",{className:"card",children:[a.jsx("h3",{children:s("analytics.vyruchka_po_kategoriyam","Выручка по категориям")}),a.jsx(y,{width:"100%",height:300,children:a.jsxs(b,{data:[{name:"A",revenue:t.stats.A.revenue},{name:"B",revenue:t.stats.B.revenue},{name:"C",revenue:t.stats.C.revenue}],children:[a.jsx(u,{strokeDasharray:"3 3"}),a.jsx(N,{dataKey:"name"}),a.jsx(f,{}),a.jsx(g,{}),a.jsx(_,{dataKey:"revenue",fill:"var(--primary-color)"})]})})]})]}),a.jsxs("div",{className:"card",children:[a.jsx("h3",{children:s("analytics.top_tovarov","Топ-20 товаров")}),a.jsxs("table",{className:"data-table",children:[a.jsx("thead",{children:a.jsxs("tr",{children:[a.jsx("th",{children:"#"}),a.jsx("th",{children:s("analytics.tovar","Товар")}),a.jsx("th",{children:s("analytics.kategoriya","Категория ABC")}),a.jsx("th",{children:s("analytics.vyruchka","Выручка")}),a.jsx("th",{children:s("analytics.prodano","Продано")}),a.jsx("th",{children:s("analytics.pct_ot_obschey_vyruchki","% от общей выручки")}),a.jsx("th",{children:s("analytics.nakoplennyy_pct","Накопленный %")})]})}),a.jsx("tbody",{children:t.products.slice(0,20).map((e,r)=>a.jsxs("tr",{children:[a.jsx("td",{children:r+1}),a.jsx("td",{children:e.name}),a.jsx("td",{children:a.jsx("span",{className:`badge badge-${e.category.toLowerCase()}`,children:e.category})}),a.jsxs("td",{children:[parseFloat(e.revenue).toLocaleString()," ₽"]}),a.jsx("td",{children:e.quantity_sold}),a.jsxs("td",{children:[e.revenue_percent,"%"]}),a.jsxs("td",{children:[e.cumulative_percent,"%"]})]},e.id))})]})]})]}),l==="pl"&&n&&!h&&a.jsx("div",{className:"analytics-content",children:a.jsxs("div",{className:"card pl-report",children:[a.jsx("h2",{children:s("analytics.otchyot_o_pribylyah_i_ubytkah_opiu","Отчёт о прибылях и убытках (ОПиУ)")}),a.jsxs("p",{className:"period",children:["Период: ",n.period.startDate," - ",n.period.endDate]}),a.jsxs("div",{className:"pl-section",children:[a.jsx("h3",{children:s("analytics.dohody","Доходы")}),a.jsxs("div",{className:"pl-line",children:[a.jsx("span",{children:s("analytics.vyruchka_ot_prodazh","Выручка от продаж")}),a.jsxs("span",{className:"amount",children:[parseFloat(n.revenue).toLocaleString()," ₽"]})]}),a.jsxs("div",{className:"pl-line",children:[a.jsx("span",{children:s("analytics.vozvraty","Возвраты")}),a.jsxs("span",{className:"amount negative",children:["-",parseFloat(n.returns).toLocaleString()," ₽"]})]}),a.jsxs("div",{className:"pl-line total",children:[a.jsx("span",{children:s("analytics.chistaya_vyruchka","Чистая выручка")}),a.jsxs("span",{className:"amount",children:[parseFloat(n.netRevenue).toLocaleString()," ₽"]})]})]}),a.jsxs("div",{className:"pl-section",children:[a.jsx("h3",{children:s("analytics.rashody","Расходы")}),a.jsxs("div",{className:"pl-line",children:[a.jsx("span",{children:s("analytics.sebestoimost_tovarov","Себестоимость товаров")}),a.jsxs("span",{className:"amount negative",children:["-",parseFloat(n.costOfGoods).toLocaleString()," ₽"]})]}),a.jsxs("div",{className:"pl-line total",children:[a.jsx("span",{children:s("analytics.valovaya_pribyl","Валовая прибыль")}),a.jsxs("span",{className:"amount",children:[parseFloat(n.grossProfit).toLocaleString()," ₽"]})]}),a.jsxs("div",{className:"pl-line meta",children:[a.jsx("span",{children:s("analytics.valovaya_marzha","Валовая маржа")}),a.jsxs("span",{children:[n.grossMargin,"%"]})]})]}),a.jsxs("div",{className:"pl-section",children:[a.jsx("h3",{children:s("analytics.operatsionnye_rashody","Операционные расходы")}),a.jsxs("div",{className:"pl-line",children:[a.jsx("span",{children:s("analytics.prochie_rashody","Прочие расходы")}),a.jsxs("span",{className:"amount negative",children:["-",parseFloat(n.operatingExpenses).toLocaleString()," ₽"]})]})]}),a.jsxs("div",{className:"pl-section final",children:[a.jsxs("div",{className:"pl-line total highlight",children:[a.jsx("span",{children:a.jsx("strong",{children:s("analytics.chistaya_pribyl","Чистая прибыль")})}),a.jsx("span",{className:`amount ${parseFloat(n.netProfit)>=0?"positive":"negative"}`,children:a.jsxs("strong",{children:[parseFloat(n.netProfit).toLocaleString()," ₽"]})})]}),a.jsxs("div",{className:"pl-line meta",children:[a.jsx("span",{children:s("analytics.chistaya_marzha","Чистая маржа")}),a.jsxs("span",{children:[n.netMargin,"%"]})]})]})]})}),l==="balance"&&i&&!h&&a.jsx("div",{className:"analytics-content",children:a.jsxs("div",{className:"balance-grid",children:[a.jsxs("div",{className:"card",children:[a.jsx("h2",{children:s("analytics.aktivy","Активы")}),a.jsxs("div",{className:"balance-section",children:[a.jsx("h3",{children:s("analytics.tekuschie_aktivy","Текущие активы")}),a.jsxs("div",{className:"balance-line",children:[a.jsx("span",{children:s("analytics.denezhnye_sredstva","Денежные средства")}),a.jsxs("span",{children:[parseFloat(i.assets.current.cash).toLocaleString()," ₽"]})]}),a.jsxs("div",{className:"balance-line",children:[a.jsx("span",{children:s("analytics.tovarnye_zapasy","Товарные запасы")}),a.jsxs("span",{children:[parseFloat(i.assets.current.inventory).toLocaleString()," ₽"]})]}),a.jsxs("div",{className:"balance-line",children:[a.jsx("span",{children:s("analytics.debitorskaya_zadolzhennost","Дебиторская задолженность")}),a.jsxs("span",{children:[parseFloat(i.assets.current.receivables).toLocaleString()," ₽"]})]}),a.jsxs("div",{className:"balance-line total",children:[a.jsx("span",{children:a.jsx("strong",{children:s("analytics.itogo_tekuschie_aktivy","Итого текущие активы")})}),a.jsx("span",{children:a.jsxs("strong",{children:[parseFloat(i.assets.current.total).toLocaleString()," ₽"]})})]})]}),a.jsxs("div",{className:"balance-total",children:[a.jsx("span",{children:a.jsx("strong",{children:s("analytics.vsego_aktivy","ВСЕГО АКТИВЫ")})}),a.jsx("span",{className:"amount",children:a.jsxs("strong",{children:[parseFloat(i.assets.total).toLocaleString()," ₽"]})})]})]}),a.jsxs("div",{className:"card",children:[a.jsx("h2",{children:s("analytics.passivy_i_kapital","Пассивы и капитал")}),a.jsxs("div",{className:"balance-section",children:[a.jsx("h3",{children:s("analytics.obyazatelstva","Обязательства")}),a.jsxs("div",{className:"balance-line",children:[a.jsx("span",{children:s("analytics.kreditorskaya_zadolzhennost","Кредиторская задолженность")}),a.jsxs("span",{children:[parseFloat(i.liabilities.current.payables).toLocaleString()," ₽"]})]}),a.jsxs("div",{className:"balance-line total",children:[a.jsx("span",{children:a.jsx("strong",{children:s("analytics.itogo_obyazatelstva","Итого обязательства")})}),a.jsx("span",{children:a.jsxs("strong",{children:[parseFloat(i.liabilities.total).toLocaleString()," ₽"]})})]})]}),a.jsxs("div",{className:"balance-section",children:[a.jsx("h3",{children:s("analytics.kapital","Капитал")}),a.jsxs("div",{className:"balance-line",children:[a.jsx("span",{children:s("analytics.neraspredelyonnaya_pribyl","Нераспределённая прибыль")}),a.jsxs("span",{children:[parseFloat(i.equity.retainedEarnings).toLocaleString()," ₽"]})]}),a.jsxs("div",{className:"balance-line total",children:[a.jsx("span",{children:a.jsx("strong",{children:s("analytics.itogo_kapital","Итого капитал")})}),a.jsx("span",{children:a.jsxs("strong",{children:[parseFloat(i.equity.total).toLocaleString()," ₽"]})})]})]}),a.jsxs("div",{className:"balance-total",children:[a.jsx("span",{children:a.jsx("strong",{children:s("analytics.vsego_passivy","ВСЕГО ПАССИВЫ")})}),a.jsx("span",{className:"amount",children:a.jsxs("strong",{children:[parseFloat(i.totalLiabilitiesAndEquity).toLocaleString()," ₽"]})})]})]})]})}),l==="category"&&j&&!h&&a.jsxs("div",{className:"analytics-content",children:[a.jsxs("div",{className:"card",children:[a.jsx("h3",{children:s("analytics.analiz_po_kategoriyam_tovarov","Анализ по категориям товаров")}),a.jsx(y,{width:"100%",height:400,children:a.jsxs(b,{data:j.categories,children:[a.jsx(u,{strokeDasharray:"3 3"}),a.jsx(N,{dataKey:"category_name"}),a.jsx(f,{}),a.jsx(g,{}),a.jsx(q,{}),a.jsx(_,{dataKey:"total_revenue",fill:"var(--primary-color)",name:"Выручка"})]})})]}),a.jsx("div",{className:"card",children:a.jsxs("table",{className:"data-table",children:[a.jsx("thead",{children:a.jsxs("tr",{children:[a.jsx("th",{children:s("analytics.kategoriya","Категория")}),a.jsx("th",{children:s("analytics.tovarov","Товаров")}),a.jsx("th",{children:s("analytics.kolichestvo_prodano","Количество продано")}),a.jsx("th",{children:s("analytics.vyruchka","Выручка")}),a.jsx("th",{children:s("analytics.srednyaya_tsena","Средняя цена")})]})}),a.jsx("tbody",{children:j.categories.map((e,r)=>a.jsxs("tr",{children:[a.jsx("td",{children:e.category_name}),a.jsx("td",{children:e.products_count}),a.jsx("td",{children:e.total_quantity}),a.jsxs("td",{children:[parseFloat(e.total_revenue).toLocaleString()," ₽"]}),a.jsxs("td",{children:[parseFloat(e.avg_price).toFixed(2)," ₽"]})]},r))})]})})]}),a.jsx("style",{jsx:!0,children:`
    .tabs {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        border-bottom: 2px solid var(--border-color);
    }

    .tab {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: transparent;
        border: none;
        border-bottom: 3px solid transparent;
        color: var(--text-color);
        cursor: pointer;
        transition: all 0.2s;
    }

    .tab:hover {
        background: rgba(255, 255, 255, 0.05);
    }

    .tab.active {
        border-bottom-color: var(--primary-color);
        color: var(--primary-color);
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
    }

    .charts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 20px;
        margin-bottom: 20px;
    }

    .pl-report {
        max-width: 800px;
        margin: 0 auto;
        padding: 30px;
    }

    .pl-section {
        margin: 20px 0;
        padding: 15px 0;
        border-bottom: 1px solid var(--border-color);
    }

    .pl-section.final {
        border-bottom: none;
        background: rgba(68, 114, 196, 0.1);
        padding: 20px;
        border-radius: 8px;
    }

    .pl-line {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
    }

    .pl-line.total {
        font-weight: 600;
        padding-top: 12px;
        margin-top: 8px;
        border-top: 1px solid var(--border-color);
    }

    .pl-line.meta {
        font-size: 14px;
        opacity: 0.7;
    }

    .negative {
        color: #dc3545;
    }

    .positive {
        color: #28a745;
    }

    .balance-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 20px;
    }

    .balance-section {
        margin: 15px 0;
        padding: 15px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
    }

    .balance-line {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
    }

    .balance-total {
        display: flex;
        justify-content: space-between;
        padding: 20px;
        margin-top: 15px;
        background: var(--primary-color);
        border-radius: 8px;
        font-size: 18px;
    }

    .badge-a { background: #28a745; color: white; }
    .badge-b { background: #ffc107; color: #000; }
    .badge-c { background: #dc3545; color: white; }
`})]})};export{M as default};
