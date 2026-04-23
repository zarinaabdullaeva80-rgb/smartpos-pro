import{b,r,aD as o,j as e,P as v,A as f,z as h,ag as k}from"./index-BxXqcl_v.js";/* empty css               */const D=()=>{const{t}=b(),[x,l]=r.useState([]),[n,p]=r.useState([]),[N,w]=r.useState([]),[i,j]=r.useState({status:"active",expiring_days:null}),[u,c]=r.useState(!1);r.useEffect(()=>{g(),_()},[i]);const g=async()=>{var s;c(!0);try{const a={status:i.status||void 0,product_id:i.product_id||void 0},d=await o.getAll(a);l(((s=d.data)==null?void 0:s.batches)||d.data||[])}catch(a){console.error("Error loading batches:",a),l([])}finally{c(!1)}},_=async()=>{var s;try{const a=await o.getExpiring(30);p(((s=a.data)==null?void 0:s.batches)||a.data||[])}catch(a){console.error("Error loading expiring batches:",a)}},m=s=>({Просрочено:"#dc3545","Критично (< 7 дней)":"#dc3545","Предупреждение (< 30 дней)":"#ffc107",Нормально:"#28a745"})[s]||"#6c757d",y=s=>s?Math.ceil((new Date(s)-new Date)/(1e3*60*60*24)):null;return e.jsxs("div",{className:"page-container fade-in",children:[e.jsx("div",{className:"page-header",children:e.jsxs("div",{children:[e.jsxs("h1",{children:[e.jsx(v,{size:32})," ",t("batches.partionnyy_uchyot","Партионный учёт")]}),e.jsx("p",{children:t("batches.upravlenie_partiyami_tovarov_i_kontrol_s","Управление партиями товаров и контроль сроков годности")})]})}),n.length>0&&e.jsxs("div",{className:"alert alert-warning",children:[e.jsx(f,{size:24}),e.jsxs("div",{children:[e.jsx("strong",{children:t("batches.vnimanie_istekayuschie_sroki_godnosti","Внимание! Истекающие сроки годности")}),e.jsxs("p",{children:[n.length," партий требуют внимания в ближайшие 30 дней"]})]})]}),e.jsx("div",{className:"card filters",children:e.jsxs("div",{className:"filter-group",children:[e.jsx("label",{children:t("batches.status","Статус:")}),e.jsxs("select",{value:i.status,onChange:s=>j({...i,status:s.target.value}),children:[e.jsx("option",{value:"",children:t("batches.vse","Все")}),e.jsx("option",{value:"active",children:t("batches.aktivnye","Активные")}),e.jsx("option",{value:"sold_out",children:t("batches.rasprodany","Распроданы")}),e.jsx("option",{value:"expired",children:t("batches.prosrocheny","Просрочены")})]})]})}),e.jsxs("div",{className:"card",children:[e.jsx("h3",{children:t("batches.partii_tovarov","Партии товаров")}),u&&e.jsx("div",{children:t("batches.zagruzka","Загрузка...")}),e.jsxs("table",{className:"data-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:t("batches.num_partii","№ Партии")}),e.jsx("th",{children:t("batches.tovar","Товар")}),e.jsx("th",{children:t("batches.artikul","Артикул")}),e.jsx("th",{children:t("batches.nachalnoe_kol_vo","Начальное кол-во")}),e.jsx("th",{children:t("batches.ostatok","Остаток")}),e.jsx("th",{children:t("batches.tsena_zakupki","Цена закупки")}),e.jsx("th",{children:t("batches.stoimost_ostatka","Стоимость остатка")}),e.jsx("th",{children:t("batches.data_proizvodstva","Дата производства")}),e.jsx("th",{children:t("batches.srok_godnosti","Срок годности")}),e.jsx("th",{children:t("batches.status_sroka","Статус срока")}),e.jsx("th",{children:t("batches.sklad","Склад")}),e.jsx("th",{children:t("batches.postavschik","Поставщик")})]})}),e.jsx("tbody",{children:x.map(s=>{const a=y(s.expiry_date);return e.jsxs("tr",{children:[e.jsxs("td",{children:[e.jsx("strong",{children:s.batch_number}),s.batch_barcode&&e.jsx("div",{className:"barcode-small",children:s.batch_barcode})]}),e.jsx("td",{children:s.product_name}),e.jsx("td",{children:s.sku}),e.jsx("td",{children:s.initial_quantity}),e.jsx("td",{children:e.jsx("strong",{children:s.remaining_quantity})}),e.jsxs("td",{children:[parseFloat(s.purchase_price).toFixed(2)," ₽"]}),e.jsx("td",{children:e.jsxs("strong",{children:[parseFloat(s.total_value).toFixed(2)," ₽"]})}),e.jsx("td",{children:s.production_date?e.jsxs("div",{className:"date-cell",children:[e.jsx(h,{size:14}),new Date(s.production_date).toLocaleDateString()]}):"-"}),e.jsx("td",{children:s.expiry_date?e.jsxs("div",{className:"date-cell",children:[e.jsx(h,{size:14}),new Date(s.expiry_date).toLocaleDateString(),a!==null&&a>=0&&e.jsxs("div",{className:"days-left",children:["Осталось: ",a," дн."]})]}):"-"}),e.jsx("td",{children:s.expiry_status&&e.jsx("span",{className:"badge",style:{background:m(s.expiry_status)},children:s.expiry_status})}),e.jsx("td",{children:s.warehouse_name&&e.jsxs("div",{className:"location-cell",children:[e.jsx(k,{size:14}),s.warehouse_name]})}),e.jsx("td",{children:s.supplier_name||"-"})]},s.id)})})]})]}),n.length>0&&e.jsxs("div",{className:"card expiring-batches",children:[e.jsx("h3",{children:t("batches.istekayuschie_sroki_godnosti_dney","⚠️ Истекающие сроки годности (30 дней)")}),e.jsxs("table",{className:"data-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:t("batches.num_partii","№ Партии")}),e.jsx("th",{children:t("batches.tovar","Товар")}),e.jsx("th",{children:t("batches.ostatok","Остаток")}),e.jsx("th",{children:t("batches.srok_godnosti","Срок годности")}),e.jsx("th",{children:t("batches.dney_do_istecheniya","Дней до истечения")})]})}),e.jsx("tbody",{children:n.map(s=>e.jsxs("tr",{className:"expiring-row",children:[e.jsx("td",{children:e.jsx("strong",{children:s.batch_number})}),e.jsx("td",{children:s.product_name}),e.jsx("td",{children:e.jsx("strong",{children:s.remaining_quantity})}),e.jsx("td",{children:new Date(s.expiry_date).toLocaleDateString()}),e.jsx("td",{children:e.jsxs("span",{className:"badge",style:{background:s.days_until_expiry<=7?"#dc3545":"#ffc107"},children:[s.days_until_expiry," дней"]})})]},s.batch_id))})]})]}),e.jsx("style",{jsx:!0,children:`
                .alert {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 15px 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }

                .alert-warning {
                    background: rgba(255, 193, 7, 0.1);
                    border: 1px solid #ffc107;
                    color: #ffc107;
                }

                .filters {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 20px;
                    padding: 15px;
                }

                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .filter-group label {
                    font-weight: 500;
                }

                .barcode-small {
                    font-size: 11px;
                    font-family: monospace;
                    color: var(--primary-color);
                    margin-top: 4px;
                }

                .date-cell {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .days-left {
                    font-size: 11px;
                    opacity: 0.7;
                    margin-top: 2px;
                }

                .location-cell {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .expiring-batches {
                    border: 2px solid #ffc107;
                }

                .expiring-row {
                    background: rgba(255, 193, 7, 0.05);
                }
            `})]})};export{D as default};
