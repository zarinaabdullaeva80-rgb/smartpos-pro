import{b as T,r as d,p as F,j as e,E as A,P as v,n as W,S as q,T as w}from"./index-C8xBICTb.js";import{P as L}from"./plus-4eQNaKah.js";import{T as M}from"./tag-CAvdf2Rf.js";import{B as U}from"./barcode-5jvrr2rt.js";function K(){const{t:a}=T(),[z,S]=d.useState([]),[n,c]=d.useState([]),[x,k]=d.useState(""),[N,$]=d.useState(!0),[C,g]=d.useState(!1),[i,o]=d.useState({size:"medium",showBarcode:!0,showSKU:!0,showOldPrice:!0,showStoreName:!0,storeName:localStorage.getItem("priceTagStoreName")||"",storeNamePosition:"top",nameFontSize:10,priceFontSize:15,columns:3});d.useEffect(()=>{P()},[]);const P=async()=>{try{const t=await F.getAll(),r=t.data||t;S(r.products||[])}catch(t){console.warn("PriceTagPrinter: не удалось загрузить данные",t.message)}$(!1)},l=t=>new Intl.NumberFormat("ru-RU").format(t||0)+" so'm",_=t=>{const r=n.find(s=>s.id===t.id);c(r?n.map(s=>s.id===t.id?{...s,quantity:s.quantity+1}:s):[...n,{...t,quantity:1}])},f=t=>{c(n.filter(r=>r.id!==t))},u=(t,r)=>{r<=0?f(t):c(n.map(s=>s.id===t?{...s,quantity:r}:s))},h=n.reduce((t,r)=>t+r.quantity,0),I=z.filter(t=>{var r,s,p;return((r=t.name)==null?void 0:r.toLowerCase().includes(x.toLowerCase()))||((s=t.sku)==null?void 0:s.toLowerCase().includes(x.toLowerCase()))||((p=t.barcode)==null?void 0:p.includes(x))}),B=t=>{const r=t.split("").map(j=>({0:"3211",1:"2221",2:"2122",3:"1411",4:"1132",5:"1231",6:"1114",7:"1312",8:"1213",9:"3112"})[j]||"1111").join("");let s=0;const p=[];let y=!0;for(const j of r.split("")){const b=parseInt(j);y&&p.push(`<rect x="${s}" y="0" width="${b}" height="40" fill="#000"/>`),s+=b,y=!y}return`<svg viewBox="0 0 ${s} 50" xmlns="http://www.w3.org/2000/svg">
            ${p.join("")}
            <text x="${s/2}" y="48" text-anchor="middle" font-size="8" font-family="monospace">${t}</text>
        </svg>`},m=()=>{const t=window.open("","_blank"),r={small:{width:"40mm",height:"25mm",barcodeHeight:"20px"},medium:{width:"58mm",height:"40mm",barcodeHeight:"30px"},large:{width:"80mm",height:"50mm",barcodeHeight:"40px"}}[i.size];t.document.write(`
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
                        grid-template-columns: repeat(${i.columns}, 1fr);
                        gap: 2mm;
                        padding: 5mm;
                    }
                    .price-tag {
                        width: ${r.width};
                        height: ${r.height};
                        border: 1px solid #000;
                        padding: 2mm;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        page-break-inside: avoid;
                    }
                    .tag-name {
                        font-weight: bold;
                        font-size: ${i.nameFontSize}px;
                        line-height: 1.2;
                        max-height: 2.4em;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .tag-store-name {
                        font-size: ${Math.max(i.nameFontSize-2,7)}px;
                        color: #333;
                        text-align: center;
                        font-weight: 600;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 2px;
                        margin-bottom: 2px;
                    }
                    .tag-store-name-bottom {
                        font-size: ${Math.max(i.nameFontSize-2,7)}px;
                        color: #333;
                        text-align: center;
                        font-weight: 600;
                        border-top: 1px solid #ddd;
                        padding-top: 2px;
                        margin-top: 2px;
                    }
                    .tag-sku {
                        font-size: ${Math.max(i.nameFontSize-2,7)}px;
                        color: #666;
                    }
                    .tag-barcode {
                        text-align: center;
                        height: ${r.barcodeHeight};
                    }
                    .tag-barcode svg {
                        height: 100%;
                        width: auto;
                    }
                    .tag-price {
                        font-size: ${i.priceFontSize}px;
                        font-weight: bold;
                        text-align: center;
                    }
                    .tag-old-price {
                        font-size: ${Math.max(i.priceFontSize-3,8)}px;
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
                    ${n.flatMap(s=>Array(s.quantity).fill(null).map(()=>`
                            <div class="price-tag">
                                ${i.showStoreName&&i.storeName&&i.storeNamePosition==="top"?`<div class="tag-store-name">${i.storeName}</div>`:""}
                                <div class="tag-name">${s.name}</div>
                                ${i.showSKU?`<div class="tag-sku">Арт: ${s.sku}</div>`:""}
                                ${i.showBarcode?`<div class="tag-barcode">${B(s.barcode)}</div>`:""}
                                ${i.showOldPrice&&s.old_price?`<div class="tag-old-price">${l(s.old_price)}</div>`:""}
                                <div class="tag-price">${l(s.price)}</div>
                                ${i.showStoreName&&i.storeName&&i.storeNamePosition==="bottom"?`<div class="tag-store-name-bottom">${i.storeName}</div>`:""}
                            </div>
                        `)).join("")}
                </div>
            </body>
            </html>
        `),t.document.close()};return e.jsxs("div",{className:"price-tag-printer-page fade-in",children:[e.jsxs("div",{className:"page-header",children:[e.jsxs("div",{children:[e.jsx("h1",{children:a("pricetagprinter.pechat_tsennikov","🏷️ Печать ценников")}),e.jsx("p",{className:"text-muted",children:a("pricetagprinter.generatsiya_i_pechat_tsennikov_so_shtrih_kod","Генерация и печать ценников со штрих-кодами")})]}),e.jsxs("div",{style:{display:"flex",gap:"12px"},children:[e.jsxs("button",{className:"btn btn-secondary",onClick:()=>g(!0),disabled:n.length===0,children:[e.jsx(A,{size:18})," Предпросмотр"]}),e.jsxs("button",{className:"btn btn-primary",onClick:m,disabled:n.length===0,children:[e.jsx(v,{size:18})," Печать (",h," шт)"]})]})]}),e.jsxs("div",{className:"card",style:{marginBottom:"20px",padding:"16px"},children:[e.jsxs("div",{style:{display:"flex",gap:"24px",alignItems:"center",flexWrap:"wrap"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx(W,{size:18}),e.jsx("strong",{children:a("pricetagprinter.nastroyki","Настройки:")})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx("span",{children:a("pricetagprinter.razmer","Размер:")}),e.jsxs("select",{value:i.size,onChange:t=>o({...i,size:t.target.value}),children:[e.jsx("option",{value:"small",children:a("pricetagprinter.malenkiy_mm","Маленький (40×25мм)")}),e.jsx("option",{value:"medium",children:a("pricetagprinter.sredniy_mm","Средний (58×40мм)")}),e.jsx("option",{value:"large",children:a("pricetagprinter.bolshoy_mm","Большой (80×50мм)")})]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx("span",{children:a("pricetagprinter.kolonok","Колонок:")}),e.jsxs("select",{value:i.columns,onChange:t=>o({...i,columns:parseInt(t.target.value)}),children:[e.jsx("option",{value:"2",children:"2"}),e.jsx("option",{value:"3",children:"3"}),e.jsx("option",{value:"4",children:"4"}),e.jsx("option",{value:"5",children:"5"})]})]}),e.jsxs("label",{style:{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer"},children:[e.jsx("input",{type:"checkbox",checked:i.showBarcode,onChange:t=>o({...i,showBarcode:t.target.checked})}),a("pricetagprinter.shtrih_kod","Штрих-код")]}),e.jsxs("label",{style:{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer"},children:[e.jsx("input",{type:"checkbox",checked:i.showSKU,onChange:t=>o({...i,showSKU:t.target.checked})}),"Артикул"]}),e.jsxs("label",{style:{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer"},children:[e.jsx("input",{type:"checkbox",checked:i.showOldPrice,onChange:t=>o({...i,showOldPrice:t.target.checked})}),"Старая цена"]})]}),e.jsxs("div",{style:{display:"flex",gap:"24px",alignItems:"center",flexWrap:"wrap",marginTop:"12px",paddingTop:"12px",borderTop:"1px solid var(--border-color)"},children:[e.jsxs("label",{style:{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer"},children:[e.jsx("input",{type:"checkbox",checked:i.showStoreName,onChange:t=>o({...i,showStoreName:t.target.checked})}),"Магазин"]}),e.jsx("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:e.jsx("input",{type:"text",placeholder:"Название магазина",value:i.storeName,onChange:t=>{o({...i,storeName:t.target.value}),localStorage.setItem("priceTagStoreName",t.target.value)},style:{width:"200px",padding:"4px 8px",fontSize:"13px"}})}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx("span",{children:"Позиция:"}),e.jsxs("select",{value:i.storeNamePosition,onChange:t=>o({...i,storeNamePosition:t.target.value}),children:[e.jsx("option",{value:"top",children:"Сверху"}),e.jsx("option",{value:"bottom",children:"Снизу"})]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx("span",{children:"Шрифт названия:"}),e.jsx("input",{type:"range",min:"7",max:"20",value:i.nameFontSize,onChange:t=>o({...i,nameFontSize:parseInt(t.target.value)}),style:{width:"80px"}}),e.jsxs("span",{style:{fontSize:"12px",minWidth:"30px"},children:[i.nameFontSize,"px"]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx("span",{children:"Шрифт цены:"}),e.jsx("input",{type:"range",min:"10",max:"30",value:i.priceFontSize,onChange:t=>o({...i,priceFontSize:parseInt(t.target.value)}),style:{width:"80px"}}),e.jsxs("span",{style:{fontSize:"12px",minWidth:"30px"},children:[i.priceFontSize,"px"]})]})]})]}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 400px",gap:"20px"},children:[e.jsxs("div",{className:"card",children:[e.jsx("div",{style:{padding:"16px",borderBottom:"1px solid var(--border-color)"},children:e.jsxs("div",{style:{position:"relative"},children:[e.jsx(q,{size:18,style:{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#888"}}),e.jsx("input",{type:"text",placeholder:"Поиск по названию, артикулу или штрих-коду...",value:x,onChange:t=>k(t.target.value),style:{paddingLeft:"40px",width:"100%"}})]})}),N?e.jsx("div",{style:{padding:"40px",textAlign:"center"},children:a("pricetagprinter.zagruzka","Загрузка...")}):e.jsxs("table",{style:{width:"100%",borderCollapse:"collapse"},children:[e.jsx("thead",{children:e.jsxs("tr",{style:{background:"var(--bg-secondary)"},children:[e.jsx("th",{style:{padding:"12px",textAlign:"left"},children:a("pricetagprinter.tovar","Товар")}),e.jsx("th",{style:{padding:"12px",textAlign:"left"},children:a("pricetagprinter.shtrih_kod","Штрих-код")}),e.jsx("th",{style:{padding:"12px",textAlign:"right"},children:a("pricetagprinter.tsena","Цена")}),e.jsx("th",{style:{padding:"12px",textAlign:"center"},children:a("pricetagprinter.dobavit","Добавить")})]})}),e.jsx("tbody",{children:I.map(t=>e.jsxs("tr",{style:{borderBottom:"1px solid var(--border-color)"},children:[e.jsxs("td",{style:{padding:"12px"},children:[e.jsx("div",{style:{fontWeight:500},children:t.name}),e.jsxs("div",{style:{fontSize:"12px",color:"#888"},children:["Арт: ",t.sku]})]}),e.jsx("td",{style:{padding:"12px",fontFamily:"monospace"},children:t.barcode}),e.jsxs("td",{style:{padding:"12px",textAlign:"right"},children:[e.jsx("div",{style:{fontWeight:"bold"},children:l(t.price)}),t.old_price&&e.jsx("div",{style:{fontSize:"12px",textDecoration:"line-through",color:"#888"},children:l(t.old_price)})]}),e.jsx("td",{style:{padding:"12px",textAlign:"center"},children:e.jsxs("button",{className:"btn btn-primary btn-sm",onClick:()=>_(t),children:[e.jsx(L,{size:14})," ",a("pricetagprinter.dobavit","Добавить")]})})]},t.id))})]})]}),e.jsxs("div",{className:"card",children:[e.jsxs("div",{style:{padding:"16px",borderBottom:"1px solid var(--border-color)",display:"flex",justifyContent:"space-between",alignItems:"center"},children:[e.jsx("h3",{style:{margin:0},children:a("pricetagprinter.k_pechati","🛒 К печати")}),e.jsxs("span",{style:{background:n.length>0?"#dcfce7":"#f3f4f6",color:n.length>0?"#16a34a":"#888",padding:"4px 12px",borderRadius:"12px",fontWeight:"bold"},children:[h," ценников"]})]}),n.length===0?e.jsxs("div",{style:{padding:"60px 20px",textAlign:"center"},children:[e.jsx(M,{size:48,style:{color:"#ccc",marginBottom:"16px"}}),e.jsx("p",{style:{color:"#888"},children:a("pricetagprinter.dobavte_tovary_dlya_pechati_tsennikov","Добавьте товары для печати ценников")})]}):e.jsx("div",{style:{maxHeight:"500px",overflowY:"auto"},children:n.map(t=>e.jsxs("div",{style:{padding:"12px 16px",borderBottom:"1px solid var(--border-color)",display:"flex",alignItems:"center",gap:"12px"},children:[e.jsxs("div",{style:{flex:1},children:[e.jsx("div",{style:{fontWeight:500,fontSize:"14px"},children:t.name}),e.jsx("div",{style:{fontSize:"12px",color:"#888"},children:l(t.price)})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx("button",{className:"btn btn-sm btn-secondary",onClick:()=>u(t.id,t.quantity-1),children:"−"}),e.jsx("span",{style:{width:"30px",textAlign:"center",fontWeight:"bold"},children:t.quantity}),e.jsx("button",{className:"btn btn-sm btn-secondary",onClick:()=>u(t.id,t.quantity+1),children:"+"})]}),e.jsx("button",{className:"btn btn-sm btn-secondary",onClick:()=>f(t.id),children:e.jsx(w,{size:14})})]},t.id))}),n.length>0&&e.jsxs("div",{style:{padding:"16px",borderTop:"1px solid var(--border-color)",display:"flex",gap:"8px"},children:[e.jsxs("button",{className:"btn btn-secondary",style:{flex:1},onClick:()=>c([]),children:[e.jsx(w,{size:16})," Очистить"]}),e.jsxs("button",{className:"btn btn-primary",style:{flex:2},onClick:m,children:[e.jsx(v,{size:16})," Печать"]})]})]})]}),C&&n.length>0&&e.jsx("div",{className:"modal-overlay",onClick:()=>g(!1),children:e.jsxs("div",{className:"modal",onClick:t=>t.stopPropagation(),style:{maxWidth:"600px"},children:[e.jsx("div",{className:"modal-header",children:e.jsx("h2",{children:a("pricetagprinter.predprosmotr_tsennika","👁️ Предпросмотр ценника")})}),e.jsx("div",{className:"modal-body",style:{display:"flex",justifyContent:"center",padding:"40px"},children:e.jsxs("div",{style:{width:i.size==="small"?"160px":i.size==="medium"?"230px":"320px",padding:"16px",border:"2px solid #000",borderRadius:"4px",background:"white"},children:[i.showStoreName&&i.storeName&&i.storeNamePosition==="top"&&e.jsx("div",{style:{fontSize:`${Math.max(i.nameFontSize-2,7)}px`,fontWeight:600,textAlign:"center",borderBottom:"1px solid #ddd",paddingBottom:"4px",marginBottom:"4px",color:"#333"},children:i.storeName}),e.jsx("div",{style:{fontWeight:"bold",fontSize:`${i.nameFontSize}px`,marginBottom:"8px"},children:n[0].name}),i.showSKU&&e.jsxs("div",{style:{fontSize:"10px",color:"#666",marginBottom:"8px"},children:["Арт: ",n[0].sku]}),i.showBarcode&&e.jsxs("div",{style:{textAlign:"center",marginBottom:"8px"},children:[e.jsx(U,{size:48}),e.jsx("div",{style:{fontFamily:"monospace",fontSize:"10px"},children:n[0].barcode})]}),i.showOldPrice&&n[0].old_price&&e.jsx("div",{style:{textAlign:"center",textDecoration:"line-through",color:"#888",fontSize:"14px"},children:l(n[0].old_price)}),e.jsx("div",{style:{textAlign:"center",fontSize:`${i.priceFontSize}px`,fontWeight:"bold"},children:l(n[0].price)}),i.showStoreName&&i.storeName&&i.storeNamePosition==="bottom"&&e.jsx("div",{style:{fontSize:`${Math.max(i.nameFontSize-2,7)}px`,fontWeight:600,textAlign:"center",borderTop:"1px solid #ddd",paddingTop:"4px",marginTop:"4px",color:"#333"},children:i.storeName})]})}),e.jsxs("div",{className:"modal-footer",children:[e.jsx("button",{className:"btn btn-secondary",onClick:()=>g(!1),children:a("pricetagprinter.zakryt","Закрыть")}),e.jsxs("button",{className:"btn btn-primary",onClick:m,children:[e.jsx(v,{size:18})," Печать (",h," шт)"]})]})]})})]})}export{K as default};
