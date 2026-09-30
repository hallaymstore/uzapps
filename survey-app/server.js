const express=require('express');
const fs=require('fs');
const path=require('path');
const ExcelJS=require('exceljs');
const app=express();
app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:true}));
const DATA=path.join('/tmp','oilaviy-survey-responses.json');
function read(){try{return JSON.parse(fs.readFileSync(DATA,'utf8'))}catch{return []}}
function write(x){fs.writeFileSync(DATA,JSON.stringify(x,null,2))}
const questions=[["Sizningcha, oila qurish uchun shaxsiy tayyorgarlik zarurmi?",["Ha","Yo‘q","Qisman"]],["Oila qurish uchun eng maqbul yosh oralig‘i qaysi?",["18–22","22–25","25–30","30 yoshdan yuqori"]],["Siz o‘zingizni oilaviy hayotga qanchalik tayyor deb hisoblaysiz?",["To‘liq tayyorman","Qisman tayyorman","Tayyor emasman"]],["Oilada moddiy barqarorlik qanchalik muhim?",["Juda muhim","Muhim","Unchalik muhim emas"]],["Turmush o‘rtoq tanlashda eng muhim fazilat qaysi?",["Halollik","Mehribonlik","Mas’uliyatlilik","Tushunish"]],["Oilaviy hayotda muhabbat asosiy omil deb hisoblaysizmi?",["Ha","Yo‘q","Faqat muhabbat yetarli emas"]],["Oilada er-xotin vazifalari teng bo‘lishi kerakmi?",["Ha","Yo‘q","Vaziyatga qarab"]],["Kelishmovchiliklarni qanday hal qilish kerak?",["Suhbat orqali","Kattalar aralashuvi bilan","Vaqt o‘tishi bilan"]],["Ota-onalar maslahatlari oila qurishda qanchalik muhim?",["Juda muhim","Qisman muhim","Muhim emas"]],["Oilaviy byudjetni rejalashtirishni bilasizmi?",["Ha","Yo‘q","Qisman"]],["Oilaviy hayotga psixologik tayyorgarlik kerakmi?",["Ha","Yo‘q"]],["Farzand tarbiyasiga tayyorgarlikni qachondan boshlash kerak?",["Oila qurishdan oldin","Oila qurgandan keyin","Farzand tug‘ilgach"]],["Ajralishlarning asosiy sababi nimada deb o‘ylaysiz?",["Moddiy muammo","Tushunmovchilik","Ishonchsizlik","Boshqa"]],["Oila qurishda ta’lim darajasi muhimmi?",["Ha","Yo‘q","Qisman"]],["Oilaviy hayotga tayyorgarlik bo‘yicha maxsus kurslar kerakmi?",["Ha","Yo‘q"]],["Ijtimoiy tarmoqlar oilaviy munosabatlarga qanday ta’sir ko‘rsatadi?",["Ijobiy","Salbiy","Har ikkala"]],["Oilada sabr-toqatning o‘rni qanday?",["Juda muhim","Muhim","Unchalik muhim emas"]],["Sizningcha, mustahkam oila qurish uchun eng zarur omil nima?",["Ishonch","Hurmat","Muhabbat","Mas’uliyat"]],["Oilaviy masalalarda mustaqil qaror qabul qilish muhimmi?",["Ha","Yo‘q","Qisman"]],["Siz kelajakda qanday oila qurishni xohlaysiz?",["An’anaviy","Zamonaviy","Aralash (an’anaviy va zamonaviy uyg‘unligi)"]]];
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
app.get('/',(req,res)=>{
 const items=questions.map((q,i)=>`<section class="q"><div class="n">${i+1}</div><h3>${esc(q[0])}</h3>${q[1].map(o=>`<label><input type="radio" name="q${i+1}" value="${esc(o)}" required><span>${esc(o)}</span></label>`).join('')}</section>`).join('');
 res.send(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SO‘ROVNOMA</title><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f7fb;color:#172033}.wrap{max-width:760px;margin:auto;padding:16px}.hero{background:#fff;border-radius:20px;padding:22px;margin:8px 0 16px;box-shadow:0 10px 30px #15223a12}.hero h1{font-size:24px;margin:0 0 8px}.hero p{margin:0;color:#657086}.q{position:relative;background:#fff;border-radius:18px;padding:18px;margin:12px 0;box-shadow:0 8px 24px #15223a0d}.q h3{font-size:17px;line-height:1.4;margin:0 0 14px;padding-left:34px}.n{position:absolute;top:18px;left:18px;width:24px;height:24px;border-radius:8px;background:#2563eb;color:white;display:grid;place-items:center;font-weight:700;font-size:13px}.q label{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #e4e9f2;border-radius:12px;margin:8px 0;cursor:pointer}.q input{width:20px;height:20px;accent-color:#2563eb}.q label:has(input:checked){border-color:#2563eb;background:#eff6ff}button{width:100%;border:0;border-radius:14px;padding:15px;background:#2563eb;color:white;font-size:17px;font-weight:700;margin:8px 0 30px}.ok{background:#ecfdf3;border:1px solid #bbf7d0;color:#166534;border-radius:16px;padding:20px;text-align:center}small{color:#778196}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.txt{width:100%;padding:14px;border:1px solid #dbe2ec;border-radius:12px;font-size:16px;outline:none}.txt:focus{border-color:#2563eb;box-shadow:0 0 0 3px #2563eb18}@media(max-width:520px){.grid2{grid-template-columns:1fr}}</style></head><body><div class="wrap"><div class="hero"><h1>SO‘ROVNOMA</h1><p>Oilaviy turmushga tayyorgarlik bo‘yicha so‘rovnoma. Har bir savolga bitta javob belgilang.</p></div><form id="f"><section class="q identity"><h3 style="padding-left:0">Ism va familiyangiz</h3><div class="grid2"><input class="txt" type="text" name="firstName" placeholder="Ism" required maxlength="80"><input class="txt" type="text" name="lastName" placeholder="Familiya" required maxlength="80"></div></section>${items}<button type="submit">Javoblarni yuborish</button></form><div id="done" hidden class="ok"><b>Rahmat! ✅</b><br>Javoblaringiz qabul qilindi.</div></div><script>const f=document.getElementById('f');f.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(f);const firstName=(fd.get('firstName')||'').trim();const lastName=(fd.get('lastName')||'').trim();const answers={};for(let i=1;i<=20;i++)answers['q'+i]=fd.get('q'+i);const b=f.querySelector('button');b.disabled=true;b.textContent='Yuborilmoqda...';try{const r=await fetch('/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({firstName,lastName,answers})});if(!r.ok)throw 0;f.hidden=true;document.getElementById('done').hidden=false;window.scrollTo({top:0,behavior:'smooth'})}catch{b.disabled=false;b.textContent='Qayta yuborish';alert('Xatolik. Qayta urinib ko‘ring.')}})</script></body></html>`);
});
app.post('/submit',(req,res)=>{
 const firstName=String(req.body&&req.body.firstName||'').trim().slice(0,80); const lastName=String(req.body&&req.body.lastName||'').trim().slice(0,80); const a=req.body&&req.body.answers||{};
 if(!firstName||!lastName)return res.status(400).json({ok:false,error:'name_required'});
 for(let i=1;i<=20;i++){if(!a['q'+i])return res.status(400).json({ok:false})}
 const rows=read();rows.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),createdAt:new Date().toISOString(),firstName,lastName,answers:a});write(rows);res.json({ok:true});
});
app.get('/admin/export.csv',(req,res)=>{ if(req.query.key!==process.env.ADMIN_KEY)return res.status(403).send('Forbidden');
 const rows=read();const head=['Ism','Familiya','Vaqt',...questions.map((_,i)=>'S'+(i+1))];
 const csv=[head,...rows.map(r=>[r.firstName||'',r.lastName||'',r.createdAt,...questions.map((_,i)=>r.answers['q'+(i+1)]||'')])].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
 res.type('text/csv').set('Content-Disposition','attachment; filename="sorovnoma-javoblari.csv"').send('\ufeff'+csv)
});


app.get('/admin/export.xlsx',async(req,res)=>{
 if(req.query.key!==process.env.ADMIN_KEY)return res.status(403).send('Forbidden');
 const rows=read();
 const wb=new ExcelJS.Workbook();
 wb.creator='Oilaviy turmushga tayyorlash — SO‘ROVNOMA';
 wb.created=new Date();

 const sum=wb.addWorksheet('Umumiy');
 sum.getCell('A1').value='SO‘ROVNOMA NATIJALARI';
 sum.getCell('A1').font={bold:true,size:18};
 sum.getCell('A3').value='Jami qatnashchilar';
 sum.getCell('B3').value=rows.length;
 sum.getCell('A4').value='Hisobot vaqti';
 sum.getCell('B4').value=new Date();
 sum.getCell('B4').numFmt='dd.mm.yyyy hh:mm';
 sum.getCell('A6').value='Ko‘rsatkich';
 sum.getCell('B6').value='Qiymat';
 sum.getRow(6).font={bold:true};
 sum.addRow(['To‘liq 20 ta savolga javob berganlar',rows.filter(r=>questions.every((_,i)=>r.answers&&r.answers['q'+(i+1)])).length]);
 sum.addRow(['Jami saqlangan javob yozuvlari',rows.length]);
 sum.columns=[{width:42},{width:24}];

 const ans=wb.addWorksheet('Javoblar');
 const headers=['Ism','Familiya','Vaqt','Javoblar soni',...questions.map((q,i)=>(i+1)+'. '+q[0])];
 ans.addRow(headers);
 ans.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
 ans.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1F4E78'}};
 ans.views=[{state:'frozen',ySplit:1,xSplit:4}];
 rows.forEach(r=>{
   const count=questions.reduce((n,_,i)=>n+((r.answers&&r.answers['q'+(i+1)])?1:0),0);
   ans.addRow([r.firstName||'',r.lastName||'',r.createdAt?new Date(r.createdAt):'',count,...questions.map((_,i)=>r.answers&&r.answers['q'+(i+1)]||'')]);
 });
 ans.getColumn(1).width=18; ans.getColumn(2).width=22; ans.getColumn(3).width=20; ans.getColumn(4).width=15;
 for(let c=5;c<=headers.length;c++) ans.getColumn(c).width=28;
 ans.getColumn(3).numFmt='dd.mm.yyyy hh:mm';
 ans.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};

 const st=wb.addWorksheet('Statistika');
 st.addRow(['Savol №','Savol','Variant','Soni','Foiz (%)']);
 st.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
 st.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1F4E78'}};
 questions.forEach((q,i)=>{
   q[1].forEach(opt=>{
     const count=rows.filter(r=>r.answers&&r.answers['q'+(i+1)]===opt).length;
     const pct=rows.length?count/rows.length:0;
     st.addRow([i+1,q[0],opt,count,pct]);
   });
 });
 st.getColumn(1).width=10; st.getColumn(2).width=55; st.getColumn(3).width=38; st.getColumn(4).width=12; st.getColumn(5).width=14;
 st.getColumn(5).numFmt='0.00%';
 st.views=[{state:'frozen',ySplit:1}];
 st.autoFilter={from:'A1',to:'E1'};

 [sum,ans,st].forEach(ws=>{
   ws.eachRow({includeEmpty:false},row=>{row.alignment={vertical:'middle',wrapText:true};});
 });
 const buf=await wb.xlsx.writeBuffer();
 res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 res.setHeader('Content-Disposition','attachment; filename="sorovnoma-natijalari.xlsx"');
 res.send(Buffer.from(buf));
});

app.get('/admin',(req,res)=>{
 if(req.query.key!==process.env.ADMIN_KEY)return res.status(403).send('Forbidden');
 const rows=read().slice().reverse();
 const th=['Ism','Familiya','Vaqt',...questions.map((q,i)=>(i+1)+'. '+q[0])].map(x=>'<th>'+esc(x)+'</th>').join('');
 const body=rows.map(r=>'<tr><td><b>'+esc(r.firstName||'')+'</b></td><td><b>'+esc(r.lastName||'')+'</b></td><td>'+esc(new Date(r.createdAt).toLocaleString('uz-UZ'))+'</td>'+questions.map((_,i)=>'<td>'+esc(r.answers['q'+(i+1)]||'')+'</td>').join('')+'</tr>').join('');
 res.send(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>So‘rovnoma javoblari</title><style>body{font-family:system-ui;margin:0;background:#f4f7fb;color:#172033}.wrap{padding:16px}.top{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#fff;padding:16px;border-radius:16px;margin-bottom:12px}.btn{background:#2563eb;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;font-weight:700}.table{overflow:auto;background:#fff;border-radius:14px}table{border-collapse:collapse;min-width:2200px;width:100%}th,td{border-bottom:1px solid #e6eaf0;padding:10px;text-align:left;font-size:13px;white-space:nowrap}th{position:sticky;top:0;background:#eef3f9;z-index:1}</style></head><body><div class="wrap"><div class="top"><div><h2 style="margin:0">Javoblar</h2><small>Jami: ${rows.length} ta</small></div><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="/admin/export.xlsx?key=${encodeURIComponent(req.query.key)}">Excel yuklash</a><a class="btn" style="background:#475569" href="/admin/export.csv?key=${encodeURIComponent(req.query.key)}">CSV</a></div></div><div class="table"><table><thead><tr>${th}</tr></thead><tbody>${body||'<tr><td>Hozircha javob yo‘q</td></tr>'}</tbody></table></div></div></body></html>`);
});

app.get('/health',(req,res)=>res.json({ok:true,count:read().length}));
const port=process.env.PORT||10000;app.listen(port,'0.0.0.0',()=>console.log('survey running',port));