import{b as M,W as U,r as o,az as c,j as e,U as L,an as T,T as $,au as B}from"./index-BxXqcl_v.js";/* empty css               */import{S as D}from"./shield-CgCtxqRy.js";import{P as F}from"./plus-BaJI-wxH.js";import{S as I}from"./save-1lmIV20X.js";const H=()=>{const{t}=M(),f=U(),[b,v]=o.useState([]),[N,k]=o.useState({}),[i,u]=o.useState(null),[y,j]=o.useState([]),[w,d]=o.useState(!1),[C,p]=o.useState(!1),[n,x]=o.useState({code:"",name:"",description:""}),[h,l]=o.useState(null);o.useEffect(()=>{g(),_()},[]),o.useEffect(()=>{i&&P(i.id)},[i]);const g=async()=>{try{const s=await c.getRoles(),r=s.data||s,a=Array.isArray(r)?r:r.roles||[];v(a),a.length>0&&!i&&u(a[0])}catch{console.warn("PermissionsManagement.jsx: API недоступен")}d(!1)},_=async()=>{try{const s=await c.getAll(),r=s.data||s;k(r.grouped||r)}catch(s){console.error("Error loading permissions:",s)}},P=async s=>{try{const r=await c.getRolePermissions(s),a=r.data||r,m=Array.isArray(a)?a:[];j(m.map(E=>E.id))}catch(r){console.error("Error loading role permissions:",r)}},z=s=>{if(i!=null&&i.is_system){l({type:"error",text:"Нельзя изменять системные роли"});return}j(r=>r.includes(s)?r.filter(a=>a!==s):[...r,s])},R=async()=>{var s,r;if(i){d(!0);try{await c.updateRole(i.id,{name:i.name,description:i.description,permissions:y}),l({type:"success",text:"Права роли обновлены"}),g()}catch(a){console.error("Error saving permissions:",a),l({type:"error",text:((r=(s=a.response)==null?void 0:s.data)==null?void 0:r.error)||"Ошибка сохранения прав"})}finally{d(!1)}}},S=async()=>{var s,r;d(!0);try{await c.createRole(n),l({type:"success",text:"Роль создана"}),p(!1),x({code:"",name:"",description:""}),g()}catch(a){console.error("Error creating role:",a),l({type:"error",text:((r=(s=a.response)==null?void 0:s.data)==null?void 0:r.error)||"Ошибка создания роли"})}finally{d(!1)}},A=async s=>{var r,a;if(await f({variant:"danger",message:"Удалить роль?"}))try{await c.deleteRole(s),l({type:"success",text:"Роль удалена"}),u(null),g()}catch(m){console.error("Error deleting role:",m),l({type:"error",text:((a=(r=m.response)==null?void 0:r.data)==null?void 0:a.error)||m.message})}};return e.jsxs("div",{className:"page-container fade-in",children:[e.jsxs("div",{className:"page-header",children:[e.jsxs("div",{children:[e.jsxs("h1",{children:[e.jsx(D,{size:32})," ",t("permissionsmanagement.upravlenie_rolyami_i_pravami","Управление ролями и правами")]}),e.jsx("p",{children:t("permissionsmanagement.nastroyka_prav_dostupa_dlya_polzovateley","Настройка прав доступа для пользователей системы")})]}),e.jsxs("button",{className:"btn btn-primary",onClick:()=>p(!0),children:[e.jsx(F,{size:20})," ",t("permissionsmanagement.sozdat_rol","Создать роль")]})]}),h&&e.jsxs("div",{className:`alert ${h.type==="success"?"alert-success":"alert-danger"}`,style:{marginBottom:"1rem"},children:[h.text,e.jsx("button",{style:{float:"right",background:"none",border:"none",cursor:"pointer"},onClick:()=>l(null),children:"✕"})]}),e.jsxs("div",{className:"permissions-container",children:[e.jsxs("div",{className:"roles-list card",children:[e.jsxs("h2",{children:[e.jsx(L,{size:24})," ",t("permissionsmanagement.roli","Роли")]}),e.jsx("div",{className:"roles-items",children:b.map(s=>e.jsxs("div",{className:`role-item ${(i==null?void 0:i.id)===s.id?"active":""}`,onClick:()=>u(s),children:[e.jsxs("div",{className:"role-info",children:[e.jsxs("div",{className:"role-name",children:[s.is_system&&e.jsx(T,{size:16}),s.name]}),e.jsxs("div",{className:"role-meta",children:[s.permissions_count," прав • ",s.users_count," пользователей"]})]}),!s.is_system&&e.jsx("button",{className:"btn-icon",onClick:r=>{r.stopPropagation(),A(s.id)},children:e.jsx($,{size:16})})]},s.id))})]}),e.jsx("div",{className:"permissions-list card",children:i&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"permissions-header",children:[e.jsxs("div",{children:[e.jsx("h2",{children:i.name}),e.jsx("p",{children:i.description})]}),e.jsxs("button",{className:"btn btn-primary",onClick:R,disabled:w||i.is_system,children:[e.jsx(I,{size:20})," Сохранить"]})]}),e.jsx("div",{className:"permissions-grid",children:Object.entries(N).map(([s,r])=>e.jsxs("div",{className:"permission-module",children:[e.jsxs("h3",{children:[e.jsx(B,{size:20})," ",s.toUpperCase()]}),r.map(a=>e.jsxs("label",{className:"permission-checkbox",children:[e.jsx("input",{type:"checkbox",checked:y.includes(a.id),onChange:()=>z(a.id),disabled:i.is_system}),e.jsxs("div",{className:"permission-info",children:[e.jsx("div",{className:"permission-name",children:a.name}),e.jsx("div",{className:"permission-desc",children:a.description}),e.jsx("div",{className:"permission-code",children:a.code})]})]},a.id))]},s))})]})})]}),C&&e.jsx("div",{className:"modal-overlay",onClick:()=>p(!1),children:e.jsxs("div",{className:"modal-content",onClick:s=>s.stopPropagation(),children:[e.jsx("h2",{children:t("permissionsmanagement.sozdat_rol","Создать роль")}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:t("permissionsmanagement.kod_roli","Код роли *")}),e.jsx("input",{type:"text",value:n.code,onChange:s=>x({...n,code:s.target.value}),placeholder:"manager"})]}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:t("permissionsmanagement.nazvanie","Название *")}),e.jsx("input",{type:"text",value:n.name,onChange:s=>x({...n,name:s.target.value}),placeholder:"Менеджер"})]}),e.jsxs("div",{className:"form-group",children:[e.jsx("label",{children:t("permissionsmanagement.opisanie","Описание")}),e.jsx("textarea",{value:n.description,onChange:s=>x({...n,description:s.target.value}),placeholder:"Описание роли",rows:3})]}),e.jsxs("div",{className:"modal-actions",children:[e.jsx("button",{className:"btn btn-secondary",onClick:()=>p(!1),children:"Отмена"}),e.jsx("button",{className:"btn btn-primary",onClick:S,disabled:!n.code||!n.name,children:"Создать"})]})]})}),e.jsx("style",{jsx:!0,children:`
                .permissions-container {
                    display: grid;
                    grid-template-columns: 300px 1fr;
                    gap: 20px;
                    margin-top: 20px;
                }

                .roles-list, .permissions-list {
                    background: var(--card-bg);
                    border-radius: 12px;
                    padding: 20px;
                }

                .roles-items {
                    margin-top: 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .role-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }

                .role-item:hover {
                    background: rgba(68, 114, 196, 0.1);
                }

                .role-item.active {
                    background: var(--primary-color);
                    color: white;
                    border-color: var(--primary-color);
                }

                .role-info {
                    flex: 1;
                }

                .role-name {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    margin-bottom: 4px;
                }

                .role-meta {
                    font-size: 12px;
                    opacity: 0.7;
                }

                .permissions-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: start;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid var(--border-color);
                }

                .permissions-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 20px;
                }

                .permission-module {
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 8px;
                    padding: 15px;
                }

                .permission-module h3 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 15px;
                    color: var(--primary-color);
                }

                .permission-checkbox {
                    display: flex;
                    align-items: start;
                    gap: 10px;
                    padding: 10px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .permission-checkbox:hover {
                    background: rgba(255, 255, 255, 0.05);
                }

                .permission-info {
                    flex: 1;
                }

                .permission-name {
                    font-weight: 500;
                    margin-bottom: 4px;
                }

                .permission-desc {
                    font-size: 13px;
                    opacity: 0.7;
                    margin-bottom: 4px;
                }

                .permission-code {
                    font-size: 11px;
                    font-family: monospace;
                    color: var(--primary-color);
                }
            `})]})};export{H as default};
