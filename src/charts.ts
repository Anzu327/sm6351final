import { select, scaleLinear, max, rollups } from 'd3';
import type { RecordItem } from './types';
import { isMeteorite } from './types';
export function drawCharts(host:HTMLElement,records:RecordItem[]) {
  host.replaceChildren();
  const years=rollups(records.filter(r=>r.year!==null),v=>v.length,r=>r.year as number).sort((a,b)=>a[0]-b[0]);
  const heading=document.createElement('h3');heading.textContent='Records over time';host.append(heading);
  if(!years.length){const p=document.createElement('p');p.textContent='No dated records in this selection.';host.append(p);return;}
  const width=640,height=98,pad=24;const minYear=years[0][0],maxYear=years.at(-1)![0];
  const x=scaleLinear().domain([minYear,maxYear===minYear?maxYear+1:maxYear]).range([pad,width-pad]);
  const y=scaleLinear().domain([0,max(years,d=>d[1])||1]).range([height-pad,7]);
  const svg=select(host).append('svg').attr('viewBox','0 0 '+width+' '+height).attr('role','img').attr('aria-label','Yearly record counts, '+minYear+' to '+maxYear+'. Largest annual count '+max(years,d=>d[1]));
  const barWidth=Math.max(.8,Math.min(9,(width-2*pad)/(maxYear-minYear+1)*.8));
  svg.selectAll('rect').data(years).join('rect').attr('x',d=>x(d[0])).attr('y',d=>y(d[1])).attr('width',barWidth).attr('height',d=>height-pad-y(d[1])).attr('fill','#bdb5a2').append('title').text(d=>d[0]+': '+d[1]+' records');
  svg.selectAll('text').data([...new Set([minYear,Math.round((minYear+maxYear)/2),maxYear])]).join('text').attr('x',d=>x(d)).attr('y',height-5).attr('text-anchor','middle').attr('fill','#929da9').attr('font-size',10).text(d=>d);
  const stats=document.createElement('p');stats.className='class-summary';
  const categories=rollups(records,v=>v.length,r=>isMeteorite(r)?r.classification:'Fireball').sort((a,b)=>b[1]-a[1]);
  stats.textContent='Top classes · '+categories.slice(0,3).map(([name,count])=>name+' '+count.toLocaleString('en')).join(' / ');host.append(stats);
}
