// Small dependency-free line chart. The project has no charting library installed
// (package.json only has supabase/html2canvas/xlsx/react), so rather than pull in
// recharts/chart.js for a handful of trend views, this renders plain SVG — same
// approach already used for the score ring in ScoreTab.jsx.
export default function MiniLineChart({ data, labels, color = 'var(--blue)', height = 120, max = 100, formatValue, labelEvery = 1 }) {
  const W = 100; // viewBox width in percent-friendly units; scales with container via SVG viewBox
  const H = height;
  const pad = 8;
  const n = data.length;

  if (!n) {
    return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--mt)', fontSize:12 }}>No data yet</div>;
  }

  const xStep = n > 1 ? (W - pad*2) / (n - 1) : 0;
  const scaleY = v => H - pad - (Math.max(0, Math.min(max, v)) / max) * (H - pad*2);
  const points = data.map((v, i) => [pad + i*xStep, scaleY(v)]);
  const pathD = points.map((p, i) => `${i===0?'M':'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const areaD = `${pathD} L${points[points.length-1][0].toFixed(2)},${H-pad} L${points[0][0].toFixed(2)},${H-pad} Z`;

  return (
    <div style={{ width:'100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display:'block' }}>
        <path d={areaD} fill={color} opacity={0.08} />
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.6} fill={color} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
        {labels.map((l, i) => (
          (i % labelEvery === 0 || i === labels.length-1) ? (
            <div key={i} style={{ fontSize:10, color:'var(--mt)', textAlign:'center', flex:1 }}>
              {l}
              <div style={{ fontWeight:700, color:'var(--txt)', fontFamily:"'JetBrains Mono'", fontSize:11 }}>
                {formatValue ? formatValue(data[i]) : data[i]}
              </div>
            </div>
          ) : <div key={i} style={{ flex:1 }} />
        ))}
      </div>
    </div>
  );
}
