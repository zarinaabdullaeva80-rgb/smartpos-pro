import{u as s}from"./index-BxXqcl_v.js";const f=()=>{const e=s();return{handleNotImplemented:n=>{e.info(`${n||"Функция"} в разработке`)},handleSuccess:n=>{e.success(n||"Операция выполнена успешно")},handleError:n=>{e.error(n||"Произошла ошибка")},handleWarning:n=>{e.warning(n||"Внимание")},handlePrint:(n,o={})=>{const t=window.open("","_blank");t?(t.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${o.title||"Печать"}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background: #f5f5f5; }
                        @media print {
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    ${n}
                </body>
                </html>
            `),t.document.close(),t.focus(),t.print(),e.success("Документ отправлен на печать")):e.error("Не удалось открыть окно печати")},handleExport:(n,o="export.json")=>{try{const t=new Blob([JSON.stringify(n,null,2)],{type:"application/json"}),l=URL.createObjectURL(t),r=document.createElement("a");r.href=l,r.download=o,r.click(),URL.revokeObjectURL(l),e.success(`Файл ${o} скачан`)}catch{e.error("Ошибка экспорта данных")}},handleConfirm:(n,o)=>{window.confirm(n)&&o()},toast:e}};export{f as u};
