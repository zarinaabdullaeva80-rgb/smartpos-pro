import{b as I,r as o,p as T,j as e,E as W,m as q,S as L,T as w}from"./index-B6ZLgq7t.js";import{P as f}from"./printer-BIE1RMlL.js";import{P as U}from"./plus-i2qgcudk.js";import{T as E}from"./tag-CG22WNXL.js";import{B as O}from"./barcode-7yg2Gy1h.js";function Y(){const{t:a}=I(),[k,z]=o.useState([]),[n,d]=o.useState([]),[x,S]=o.useState(""),[C,_]=o.useState(!0),[P,g]=o.useState(!1),[r,c]=o.useState({size:"medium",showBarcode:!0,showSKU:!0,showOldPrice:!0,columns:3});o.useEffect(()=>{$()},[]);const $=async()=>{try{const t=await T.getAll(),s=t.data||t;z(s.products||[])}catch(t){console.warn("PriceTagPrinter: не удалось загрузить данные",t.message)}_(!1)},l=t=>new Intl.NumberFormat("ru-RU").format(t||0)+" so'm",N=t=>{const s=n.find(i=>i.id===t.id);d(s?n.map(i=>i.id===t.id?{...i,quantity:i.quantity+1}:i):[...n,{...t,quantity:1}])},v=t=>{d(n.filter(s=>s.id!==t))},u=(t,s)=>{s<=0?v(t):d(n.map(i=>i.id===t?{...i,quantity:s}:i))},h=n.reduce((t,s)=>t+s.quantity,0),B=k.filter(t=>{var s,i,p;return((s=t.name)==null?void 0:s.toLowerCase().includes(x.toLowerCase()))||((i=t.sku)==null?void 0:i.toLowerCase().includes(x.toLowerCase()))||((p=t.barcode)==null?void 0:p.includes(x))}),A=t=>{const s=t.split("").map(j=>({0:"3211",1:"2221",2:"2122",3:"1411",4:"1132",5:"1231",6:"1114",7:"1312",8:"1213",9:"3112"})[j]||"1111").join("");let i=0;const p=[];let y=!0;for(const j of s.split("")){const b=parseInt(j);y&&p.push(`<rect x="${i}" y="0" width="${b}" height="40" fill="#000"/>`),i+=b,y=!y}return`<svg viewBox="0 0 ${i} 50" xmlns="http://www.w3.org/2000/svg">
            ${p.join("")}
            <text x="${i/2}" y="48" text-anchor="middle" font-size="8" font-family="monospace">${t}</text>
        </svg>`},m=()=>{const t=window.open("","_blank"),s={small:{width:"40mm",height:"25mm",fontSize:"8px",barcodeHeight:"20px"},medium:{width:"58mm",height:"40mm",fontSize:"10px",barcodeHeight:"30px"},large:{width:"80mm",height:"50mm",fontSize:"12px",barcodeHeight:"40px"}}[r.size];t.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>{t('pricetagprinter.pechat_tsennikov', 'Печать ценников')}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    
                    /* Скрыть URL, дату и нумерацию страниц при печати */
                    @page { 
                        size: A4; 
                        margin: 5mm;
                    }
                    
                    @media print {
                        html, body { margin: 0 !important; padding: 0 !important; }
                        /* Скрыть системные колонтитулы браузера */
                        @page { margin: 5mm 5mm 5mm 5mm; }
                    }
                    
                    .tags-container {
                        display: grid;
                        grid-template-columns: repeat(${r.columns}, 1fr);
                        gap: 2mm;
                        padding: 5mm;
                    }
                    .price-tag {
                        width: ${s.width};
                        height: ${s.height};
                        border: 1px solid #000;
                        padding: 2mm;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        page-break-inside: avoid;
                    }
                    .tag-name {
                        font-weight: bold;
                        font-size: ${s.fontSize};
                        line-height: 1.2;
                        max-height: 2.4em;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .tag-sku {
                        font-size: calc(${s.fontSize} * 0.8);
                        color: #666;
                    }
                    .tag-barcode {
                        text-align: center;
                        height: ${s.barcodeHeight};
                    }
                    .tag-barcode svg {
                        height: 100%;
                        width: auto;
                    }
                    .tag-price {
                        font-size: calc(${s.fontSize} * 1.5);
                        font-weight: bold;
                        text-align: center;
                    }
                    .tag-old-price {
                        font-size: calc(${s.fontSize} * 0.9);
                        text-decoration: line-through;
                        color: #999;
                        text-align: center;
                    }
                    @media print {
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="padding: 10px; background: #eee; margin-bottom: 10px;">
                    <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px;">{t('pricetagprinter.pechat', '🖨️ Печать')}</button>
                    <span style="margin-left: 20px;">Всего ценников: ${h}</span>
                </div>
                <div class="tags-container">
                    ${n.flatMap(i=>Array(i.quantity).fill(null).map(()=>`
                            <div class="price-tag">
                                <div class="tag-name">${i.name}</div>
                                ${r.showSKU?`<div class="tag-sku">Арт: ${i.sku}</div>`:""}
                                ${r.showBarcode?`<div class="tag-barcode">${A(i.barcode)}</div>`:""}
                                ${r.showOldPrice&&i.old_price?`<div class="tag-old-price">${l(i.old_price)}</div>`:""}
                                <div class="tag-price">${l(i.price)}</div>
                            </div>
                        `)).join("")}
                </div>
            </body>
            </html>
        `),t.document.close()};return e.jsxs("div",{className:"price-tag-printer-page fade-in",children:[e.jsxs("div",{className:"page-header",children:[e.jsxs("div",{children:[e.jsx("h1",{children:a("pricetagprinter.pechat_tsennikov","🏷️ Печать ценников")}),e.jsx("p",{className:"text-muted",children:a("pricetagprinter.generatsiya_i_pechat_tsennikov_so_shtrih_kod","Генерация и печать ценников со штрих-кодами")})]}),e.jsxs("div",{style:{display:"flex",gap:"12px"},children:[e.jsxs("button",{className:"btn btn-secondary",onClick:()=>g(!0),disabled:n.length===0,children:[e.jsx(W,{size:18})," Предпросмотр"]}),e.jsxs("button",{className:"btn btn-primary",onClick:m,disabled:n.length===0,children:[e.jsx(f,{size:18})," Печать (",h," шт)"]})]})]}),e.jsx("div",{className:"card",style:{marginBottom:"20px",padding:"16px"},children:e.jsxs("div",{style:{display:"flex",gap:"24px",alignItems:"center",flexWrap:"wrap"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx(q,{size:18}),e.jsx("strong",{children:a("pricetagprinter.nastroyki","Настройки:")})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx("span",{children:a("pricetagprinter.razmer","Размер:")}),e.jsxs("select",{value:r.size,onChange:t=>c({...r,size:t.target.value}),children:[e.jsx("option",{value:"small",children:a("pricetagprinter.malenkiy_mm","Маленький (40×25мм)")}),e.jsx("option",{value:"medium",children:a("pricetagprinter.sredniy_mm","Средний (58×40мм)")}),e.jsx("option",{value:"large",children:a("pricetagprinter.bolshoy_mm","Большой (80×50мм)")})]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx("span",{children:a("pricetagprinter.kolonok","Колонок:")}),e.jsxs("select",{value:r.columns,onChange:t=>c({...r,columns:parseInt(t.target.value)}),children:[e.jsx("option",{value:"2",children:"2"}),e.jsx("option",{value:"3",children:"3"}),e.jsx("option",{value:"4",children:"4"}),e.jsx("option",{value:"5",children:"5"})]})]}),e.jsxs("label",{style:{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer"},children:[e.jsx("input",{type:"checkbox",checked:r.showBarcode,onChange:t=>c({...r,showBarcode:t.target.checked})}),a("pricetagprinter.shtrih_kod","Штрих-код")]}),e.jsxs("label",{style:{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer"},children:[e.jsx("input",{type:"checkbox",checked:r.showSKU,onChange:t=>c({...r,showSKU:t.target.checked})}),"Артикул"]}),e.jsxs("label",{style:{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer"},children:[e.jsx("input",{type:"checkbox",checked:r.showOldPrice,onChange:t=>c({...r,showOldPrice:t.target.checked})}),"Старая цена"]})]})}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 400px",gap:"20px"},children:[e.jsxs("div",{className:"card",children:[e.jsx("div",{style:{padding:"16px",borderBottom:"1px solid var(--border-color)"},children:e.jsxs("div",{style:{position:"relative"},children:[e.jsx(L,{size:18,style:{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#888"}}),e.jsx("input",{type:"text",placeholder:"Поиск по названию, артикулу или штрих-коду...",value:x,onChange:t=>S(t.target.value),style:{paddingLeft:"40px",width:"100%"}})]})}),C?e.jsx("div",{style:{padding:"40px",textAlign:"center"},children:a("pricetagprinter.zagruzka","Загрузка...")}):e.jsxs("table",{style:{width:"100%",borderCollapse:"collapse"},children:[e.jsx("thead",{children:e.jsxs("tr",{style:{background:"var(--bg-secondary)"},children:[e.jsx("th",{style:{padding:"12px",textAlign:"left"},children:a("pricetagprinter.tovar","Товар")}),e.jsx("th",{style:{padding:"12px",textAlign:"left"},children:a("pricetagprinter.shtrih_kod","Штрих-код")}),e.jsx("th",{style:{padding:"12px",textAlign:"right"},children:a("pricetagprinter.tsena","Цена")}),e.jsx("th",{style:{padding:"12px",textAlign:"center"},children:a("pricetagprinter.dobavit","Добавить")})]})}),e.jsx("tbody",{children:B.map(t=>e.jsxs("tr",{style:{borderBottom:"1px solid var(--border-color)"},children:[e.jsxs("td",{style:{padding:"12px"},children:[e.jsx("div",{style:{fontWeight:500},children:t.name}),e.jsxs("div",{style:{fontSize:"12px",color:"#888"},children:["Арт: ",t.sku]})]}),e.jsx("td",{style:{padding:"12px",fontFamily:"monospace"},children:t.barcode}),e.jsxs("td",{style:{padding:"12px",textAlign:"right"},children:[e.jsx("div",{style:{fontWeight:"bold"},children:l(t.price)}),t.old_price&&e.jsx("div",{style:{fontSize:"12px",textDecoration:"line-through",color:"#888"},children:l(t.old_price)})]}),e.jsx("td",{style:{padding:"12px",textAlign:"center"},children:e.jsxs("button",{className:"btn btn-primary btn-sm",onClick:()=>N(t),children:[e.jsx(U,{size:14})," ",a("pricetagprinter.dobavit","Добавить")]})})]},t.id))})]})]}),e.jsxs("div",{className:"card",children:[e.jsxs("div",{style:{padding:"16px",borderBottom:"1px solid var(--border-color)",display:"flex",justifyContent:"space-between",alignItems:"center"},children:[e.jsx("h3",{style:{margin:0},children:a("pricetagprinter.k_pechati","🛒 К печати")}),e.jsxs("span",{style:{background:n.length>0?"#dcfce7":"#f3f4f6",color:n.length>0?"#16a34a":"#888",padding:"4px 12px",borderRadius:"12px",fontWeight:"bold"},children:[h," ценников"]})]}),n.length===0?e.jsxs("div",{style:{padding:"60px 20px",textAlign:"center"},children:[e.jsx(E,{size:48,style:{color:"#ccc",marginBottom:"16px"}}),e.jsx("p",{style:{color:"#888"},children:a("pricetagprinter.dobavte_tovary_dlya_pechati_tsennikov","Добавьте товары для печати ценников")})]}):e.jsx("div",{style:{maxHeight:"500px",overflowY:"auto"},children:n.map(t=>e.jsxs("div",{style:{padding:"12px 16px",borderBottom:"1px solid var(--border-color)",display:"flex",alignItems:"center",gap:"12px"},children:[e.jsxs("div",{style:{flex:1},children:[e.jsx("div",{style:{fontWeight:500,fontSize:"14px"},children:t.name}),e.jsx("div",{style:{fontSize:"12px",color:"#888"},children:l(t.price)})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx("button",{className:"btn btn-sm btn-secondary",onClick:()=>u(t.id,t.quantity-1),children:"−"}),e.jsx("span",{style:{width:"30px",textAlign:"center",fontWeight:"bold"},children:t.quantity}),e.jsx("button",{className:"btn btn-sm btn-secondary",onClick:()=>u(t.id,t.quantity+1),children:"+"})]}),e.jsx("button",{className:"btn btn-sm btn-secondary",onClick:()=>v(t.id),children:e.jsx(w,{size:14})})]},t.id))}),n.length>0&&e.jsxs("div",{style:{padding:"16px",borderTop:"1px solid var(--border-color)",display:"flex",gap:"8px"},children:[e.jsxs("button",{className:"btn btn-secondary",style:{flex:1},onClick:()=>d([]),children:[e.jsx(w,{size:16})," Очистить"]}),e.jsxs("button",{className:"btn btn-primary",style:{flex:2},onClick:m,children:[e.jsx(f,{size:16})," Печать"]})]})]})]}),P&&n.length>0&&e.jsx("div",{className:"modal-overlay",onClick:()=>g(!1),children:e.jsxs("div",{className:"modal",onClick:t=>t.stopPropagation(),style:{maxWidth:"600px"},children:[e.jsx("div",{className:"modal-header",children:e.jsx("h2",{children:a("pricetagprinter.predprosmotr_tsennika","👁️ Предпросмотр ценника")})}),e.jsx("div",{className:"modal-body",style:{display:"flex",justifyContent:"center",padding:"40px"},children:e.jsxs("div",{style:{width:r.size==="small"?"160px":r.size==="medium"?"230px":"320px",padding:"16px",border:"2px solid #000",borderRadius:"4px",background:"white"},children:[e.jsx("div",{style:{fontWeight:"bold",fontSize:r.size==="small"?"12px":"16px",marginBottom:"8px"},children:n[0].name}),r.showSKU&&e.jsxs("div",{style:{fontSize:"10px",color:"#666",marginBottom:"8px"},children:["Арт: ",n[0].sku]}),r.showBarcode&&e.jsxs("div",{style:{textAlign:"center",marginBottom:"8px"},children:[e.jsx(O,{size:48}),e.jsx("div",{style:{fontFamily:"monospace",fontSize:"10px"},children:n[0].barcode})]}),r.showOldPrice&&n[0].old_price&&e.jsx("div",{style:{textAlign:"center",textDecoration:"line-through",color:"#888",fontSize:"14px"},children:l(n[0].old_price)}),e.jsx("div",{style:{textAlign:"center",fontSize:"24px",fontWeight:"bold"},children:l(n[0].price)})]})}),e.jsxs("div",{className:"modal-footer",children:[e.jsx("button",{className:"btn btn-secondary",onClick:()=>g(!1),children:a("pricetagprinter.zakryt","Закрыть")}),e.jsxs("button",{className:"btn btn-primary",onClick:m,children:[e.jsx(f,{size:18})," Печать (",h," шт)"]})]})]})})]})}export{Y as default};
