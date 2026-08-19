const state={data:[],meta:null,page:1,size:40,category:'股票'};
const $=s=>document.querySelector(s);
const pct=v=>v==null?'—':`${(v*100).toFixed(1)}%`;
const num=v=>v==null?'—':Number(v).toLocaleString('zh-CN',{maximumFractionDigits:2});
const stageLabel=r=>`<span class="badge"><i class="stage-dot s${r.stage}"></i>${r.stage===0?'数据不足':`${r.stage} · ${r.stage_name}`}</span>`;
const escapeHtml=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function init(){
  const manifest=await fetch(`data/manifest.json?t=${Date.now()}`).then(r=>r.json());
  const batches=await Promise.all(manifest.files.map(file=>fetch(`data/${file}?t=${Date.now()}`).then(r=>r.json())));
  const payload={meta:manifest.meta,records:batches.flat()};
  state.data=payload.records;state.meta=payload.meta;
  $('#dataDate').textContent=`截至 ${payload.meta.data_date}`;
  renderCategoryTabs();updateTypeFilter();renderSummary();
  $('#methodBody').innerHTML=`<ol><li><b>四阶段：</b>以 MA10/20/50 的排列和斜率、20日高低点结构、63日趋势组成可复核评分。阶段2和阶段4至少满足六项中的五项；其余根据最近抬升状态与长期位置区分蓄势和派发。</li><li><b>资产分类：</b>债券、货币和商品优先按基金类型识别；港股、美股、日本等跨境产品按名称及跟踪指数归入海外；其余股票型产品归入股票。</li><li><b>当前风险收益：</b>风险为当前价至最近已确认回调低点；收益为当前价至过去252日内最近的已确认上方阻力。无明确阻力时不虚构目标。</li><li><b>历史胜率：</b>${escapeHtml(payload.meta.sample_definition)}。盈利事件数÷有效事件数即胜率。</li><li><b>历史赔率：</b>盈利事件平均R倍数÷亏损事件平均绝对R倍数。R为入场价至结构止损的距离。</li><li><b>最低历史样本：</b>只显示有效历史入场事件数达到门槛的 ETF。少于10次为不足，10—29次为有限，30次以上标记为充足。它用于避免被少数偶然事件产生的极端胜率误导。</li></ol>`;
  bind();render();
}

function categoryRows(){return state.data.filter(r=>r.category===state.category)}
function renderCategoryTabs(){
  const order=['股票','债券','海外','商品','货币','其他'];
  const counts=Object.fromEntries(order.map(c=>[c,state.data.filter(r=>r.category===c).length]));
  $('#categoryTabs').innerHTML=order.filter(c=>counts[c]).map(c=>`<button data-category="${c}" class="${c===state.category?'active':''}">${c}<small>${counts[c].toLocaleString()}</small></button>`).join('');
  document.querySelectorAll('#categoryTabs button').forEach(b=>b.onclick=()=>{state.category=b.dataset.category;state.page=1;renderCategoryTabs();updateTypeFilter();renderSummary();render()});
}
function updateTypeFilter(){
  const types=[...new Set(categoryRows().map(x=>x.type))].sort();
  $('#typeFilter').innerHTML='<option value="all">全部类型</option>'+types.map(x=>`<option>${escapeHtml(x)}</option>`).join('');
}
function renderSummary(){
  const rows=categoryRows(),c={};for(let i=0;i<=4;i++)c[i]=rows.filter(r=>r.stage===i).length;
  $('#summary').innerHTML=`<div class="stat"><small>${state.category} ETF</small><strong>${rows.length.toLocaleString()}</strong></div><div class="stat stage-1"><small>阶段 1 · 蓄势</small><strong>${c[1].toLocaleString()}</strong></div><div class="stat stage-2"><small>阶段 2 · 抬升</small><strong>${c[2].toLocaleString()}</strong></div><div class="stat stage-3"><small>阶段 3 · 派发</small><strong>${c[3].toLocaleString()}</strong></div><div class="stat stage-4"><small>阶段 4 · 下跌</small><strong>${c[4].toLocaleString()}</strong></div><div class="stat"><small>严格多头候选</small><strong>${rows.filter(r=>r.action==='多头候选').length.toLocaleString()}</strong><span class="subtle">数据不足 ${c[0].toLocaleString()} 只</span></div>`;
}
function filtered(){
  const q=$('#search').value.trim().toLowerCase(),stage=$('#stageFilter').value,action=$('#actionFilter').value,type=$('#typeFilter').value,min=+$('#sampleFilter').value;
  let rows=categoryRows().filter(r=>(!q||`${r.code}${r.name}${r.index}`.toLowerCase().includes(q))&&(stage==='all'||r.stage==stage)&&(action==='all'||r.action===action)&&(type==='all'||r.type===type)&&r.samples>=min);
  const sort=$('#sort').value,desc=k=>(a,b)=>(b[k]??-Infinity)-(a[k]??-Infinity);
  if(sort==='win')rows.sort(desc('win_rate'));else if(sort==='odds')rows.sort(desc('historical_odds'));else if(sort==='rr')rows.sort(desc('risk_reward'));else if(sort==='amount')rows.sort(desc('amount'));else rows.sort((a,b)=>(a.action!=='多头候选')-(b.action!=='多头候选')||(b.risk_reward??-1)-(a.risk_reward??-1));
  return rows;
}
function render(){
  const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/state.size));state.page=Math.min(state.page,pages);const start=(state.page-1)*state.size,slice=rows.slice(start,start+state.size);
  $('#resultCount').textContent=`${state.category}类 · 符合条件 ${rows.length.toLocaleString()} 只`;
  $('#rows').innerHTML=slice.map(r=>`<tr data-code="${r.code}"><td class="ticker"><strong>${escapeHtml(r.name)}</strong><span>${r.code} · ${escapeHtml(r.type)}</span></td><td>${stageLabel(r)}</td><td class="action ${r.action==='多头候选'?'good':''}">${escapeHtml(r.action)}<span class="subtle">置信度 ${pct(r.confidence)}</span></td><td class="${r.samples<10?'low-sample':''}">${pct(r.win_rate)}<span class="subtle">${r.samples} 次 · ${r.sample_note}</span></td><td>${r.historical_odds==null?'—':`1 : ${r.historical_odds.toFixed(2)}`}<span class="subtle">平均 ${r.avg_r==null?'—':r.avg_r.toFixed(2)}R</span></td><td>${r.risk_reward==null?'无明确阻力':`1 : ${r.risk_reward.toFixed(2)}`}<span class="subtle">支撑 ${num(r.support)} / 阻力 ${num(r.resistance)}</span></td><td class="${r.change>=0?'positive':'negative'}">${pct(r.change)}</td></tr>`).join('');
  $('#pageInfo').textContent=`${state.page} / ${pages}`;$('#prev').disabled=state.page<=1;$('#next').disabled=state.page>=pages;
  document.querySelectorAll('tbody tr').forEach(tr=>tr.onclick=()=>showDetail(tr.dataset.code));
}

function kline(candles){
  if(!candles?.length)return '<p>暂无足够行情绘制K线。</p>';
  const W=920,H=390,L=58,R=18,T=24,B=38,pw=W-L-R,ph=H-T-B;
  const lows=candles.map(x=>x[3]),highs=candles.map(x=>x[2]),min=Math.min(...lows),max=Math.max(...highs),range=max-min||1;
  const y=v=>T+(max-v)/range*ph,x=i=>L+(i+.5)*pw/candles.length,step=pw/candles.length,cw=Math.max(2,step*.58);
  let grid='';for(let i=0;i<5;i++){const yy=T+i*ph/4,val=max-i*range/4;grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#ddd8cb"/><text x="${L-7}" y="${yy+4}" text-anchor="end" font-size="10" fill="#718079">${val.toFixed(2)}</text>`}
  const bars=candles.map((d,i)=>{const [,o,h,l,c]=d,xx=x(i),color=c>=o?'#b94d3f':'#176b4d',top=y(Math.max(o,c)),height=Math.max(1,Math.abs(y(o)-y(c)));return `<line x1="${xx}" y1="${y(h)}" x2="${xx}" y2="${y(l)}" stroke="${color}"/><rect x="${xx-cw/2}" y="${top}" width="${cw}" height="${height}" fill="${color}"/>`}).join('');
  const line=(idx,color)=>{const pts=candles.map((d,i)=>d[idx]==null?null:`${x(i)},${y(d[idx])}`).filter(Boolean).join(' ');return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke"/>`};
  let labels='';for(let i=0;i<candles.length;i+=Math.max(1,Math.floor(candles.length/5))){const s=String(candles[i][0]);labels+=`<text x="${x(i)}" y="${H-12}" text-anchor="middle" font-size="10" fill="#718079">${s.slice(4,6)}-${s.slice(6)}</text>`}
  return `<div class="chart-title"><h3>日 K 线与均线</h3><span class="subtle">最近 ${candles.length} 个交易日</span></div><svg class="kchart" viewBox="0 0 ${W} ${H}">${grid}${bars}${line(5,'#386cb0')}${line(6,'#d08b2f')}${line(7,'#7a58a5')}${labels}</svg><div class="chart-legend"><span><i class="up"></i>上涨</span><span><i class="down"></i>下跌</span><span><i style="background:#386cb0"></i>MA5</span><span><i style="background:#d08b2f"></i>MA20</span><span><i style="background:#7a58a5"></i>MA50</span></div>`;
}
function showDetail(code){
  const r=state.data.find(x=>x.code===code);if(!r)return;
  $('#detailBody').innerHTML=`<div class="detail-head"><div><p class="eyebrow">${r.code} · ${escapeHtml(r.category)} · ${escapeHtml(r.type)}</p><h2>${escapeHtml(r.name)}</h2><p>${escapeHtml(r.index)}</p></div><div>${stageLabel(r)}</div></div>${kline(r.candles)}<div class="quote-grid"><div class="quote"><small>最新收盘</small><strong>${num(r.close)}</strong><span class="subtle">${r.date}</span></div><div class="quote"><small>历史胜率</small><strong>${pct(r.win_rate)}</strong><span class="subtle">${r.samples} 个非重叠事件</span></div><div class="quote"><small>历史赔率</small><strong>${r.historical_odds==null?'—':`1 : ${r.historical_odds.toFixed(2)}`}</strong><span class="subtle">3R触达率 ${pct(r.hit_3r)}</span></div><div class="quote"><small>结构支撑</small><strong>${num(r.support)}</strong><span class="subtle">${escapeHtml(r.support_source)}</span></div><div class="quote"><small>上方阻力</small><strong>${num(r.resistance)}</strong><span class="subtle">过去252日确认枢轴</span></div><div class="quote"><small>当前风险收益</small><strong>${r.risk_reward==null?'—':`1 : ${r.risk_reward.toFixed(2)}`}</strong><span class="subtle">原书指导值 1:3</span></div></div><h3>阶段判断依据</h3><div class="conditions">${r.conditions.map(c=>`<div class="condition ${c.met?'met':''}">${c.met?'✓':'○'} ${escapeHtml(c.label)}</div>`).join('')}</div><h3>主动投资提示</h3><p>${escapeHtml(r.action)}。${r.samples<10?'该 ETF 的有效历史样本不足，胜率与赔率不宜作为主要依据。':'历史统计仅描述同口径事件，仍需结合组合风险、流动性和当日执行条件。'}</p>`;
  $('#detail').showModal();
}
function bind(){['search','stageFilter','actionFilter','typeFilter','sampleFilter','sort'].forEach(id=>$(`#${id}`).addEventListener('input',()=>{state.page=1;$('#sampleValue').textContent=$('#sampleFilter').value;render()}));$('#prev').onclick=()=>{state.page--;render()};$('#next').onclick=()=>{state.page++;render()};$('#methodButton').onclick=()=>$('#method').showModal();document.querySelectorAll('dialog .close').forEach(b=>b.onclick=()=>b.closest('dialog').close());}
init().catch(err=>{document.body.innerHTML=`<main><h1>数据载入失败</h1><p>${escapeHtml(err.message)}</p><p>请通过本地服务器访问本页，而不是直接双击 HTML 文件。</p></main>`});
