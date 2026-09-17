export type CellValue = string | number | boolean | Date | null;
export type Row = Record<string, CellValue>;
export type Policies = { removeDuplicates:boolean; quarantineNegative:boolean; trimText:boolean; convertNumbers:boolean };

export const demoRows:Row[]=[
 {order_id:"D001",date:"2026-09-01",region:"الشمال",product:"A",quantity:2,sales_total:100},
 {order_id:"D002",date:"2026-09-01",region:"الجنوب",product:"B",quantity:4,sales_total:200},
 {order_id:"D003",date:"2026-09-02",region:"الشمال",product:"A",quantity:6,sales_total:300},
 {order_id:"D004",date:"2026-09-03",region:"الشرق ",product:"C",quantity:null,sales_total:150},
 {order_id:"D005",date:"2026-09-04",region:"الغرب",product:"B",quantity:1,sales_total:-50},
 {order_id:"D003",date:"2026-09-02",region:"الشمال",product:"A",quantity:6,sales_total:300},
];

export const fmt=new Intl.NumberFormat("ar-JO",{maximumFractionDigits:2});
export function numberValue(value:CellValue){if(typeof value==="number"&&Number.isFinite(value))return value;if(typeof value==="string"&&value.trim()){const parsed=Number(value.replaceAll(",",""));return Number.isFinite(parsed)?parsed:null}return null}
export function valueLabel(value:CellValue){if(value===null||value===undefined||value==="")return "—";if(value instanceof Date)return value.toLocaleDateString("ar-JO");return String(value)}
export function stableRow(row:Row,columns:string[]){return JSON.stringify(columns.map(c=>row[c] instanceof Date?(row[c] as Date).toISOString():row[c]))}
function parseCsvLine(line:string){const out:string[]=[];let current="",quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'&&line[i+1]==='"'){current+='"';i++}else if(ch==='"')quoted=!quoted;else if(ch===","&&!quoted){out.push(current);current=""}else current+=ch}out.push(current);return out}
function coerce(value:string):CellValue{const clean=value.trim();if(!clean)return null;const n=Number(clean.replaceAll(",",""));return Number.isFinite(n)&&/^-?[\d,.]+$/.test(clean)?n:clean}
export function parseCsv(text:string):Row[]{const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);if(lines.length<2)return[];const headers=parseCsvLine(lines[0]).map((h,i)=>h.trim()||`column_${i+1}`);return lines.slice(1).map(line=>{const values=parseCsvLine(line);return Object.fromEntries(headers.map((h,i)=>[h,coerce(values[i]??"")])) as Row})}

