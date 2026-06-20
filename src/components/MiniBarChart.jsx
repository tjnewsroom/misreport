export default function MiniBarChart({ data, labels, color = 'var(--blue)', height = 140, max = 100, formatValue, labelEvery = 1 }) {
  const W = 100;
  const H = height;
  const pad = 10;
  const n = data.length;

  if (!n) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mt)', fontSize: 12 }}>No data yet</div>;
  }

  const barSpace = (W - pad * 2) / n;
  const barWidth = Math.max(3, Math.min(12, barSpace * 0.6));
  const scaleY = v => H - pad - (Math.max(0, Math.min(max, v)) / max) * (H - pad * 2);

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
        {data.map((value, index) => {
          const x = pad + index * barSpace + (barSpace - barWidth) / 2;
          const y = scaleY(value);
          const barHeight = Math.max(1, H - pad - y);
          return (
            <rect
              key={index}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={2}
              fill={color}
              opacity={0.9}
            />
          );
        })}
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--brd)" strokeWidth={0.5} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, gap: 4 }}>
        {labels.map((label, index) => (
          (index % labelEvery === 0 || index === labels.length - 1) ? (
            <div key={index} style={{ fontSize: 10, color: 'var(--mt)', textAlign: 'center', flex: 1, minWidth: 0 }}>
              <div>{label}</div>
              <div style={{ fontWeight: 700, color: 'var(--txt)', fontFamily: "'JetBrains Mono'", fontSize: 11 }}>
                {formatValue ? formatValue(data[index]) : data[index]}
              </div>
            </div>
          ) : <div key={index} style={{ flex: 1 }} />
        ))}
      </div>
    </div>
  );
}
