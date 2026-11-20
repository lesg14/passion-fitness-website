import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

const colors = ['#ffce2b', '#f28c55', '#85bfa8', '#80a9e3', '#c699d8'];
const formatNumber = (value) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value);

export default function MemberStatusChart({ data }) {
  const [selectedKey, setSelectedKey] = useState(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const selected = data.find((item) => item.key === selectedKey);

  return (
    <div className="plans-chart member-status-chart">
      <div className="plans-chart-layout">
        <div className="plans-chart-graphic" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer={false}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="57%"
              outerRadius="88%"
              stroke="#1b1b1b"
              strokeWidth={2}
              isAnimationActive={false}
              onMouseEnter={(item) => setSelectedKey(item.key)}
              onClick={(item) => setSelectedKey(item.key)}
            >
              {data.map((item, index) => (
                <Cell
                  key={item.key}
                  fill={colors[index % colors.length]}
                  opacity={selected && selected.key !== item.key ? 0.55 : 1}
                  cursor="pointer"
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="plans-chart-center">
          <strong>{formatNumber(total)}</strong>
          <span>miembros</span>
        </div>
        </div>
        <div className="plans-chart-legend" aria-label="Distribución de miembros">
          {data.map((item, index) => (
            <button
              type="button"
              key={item.key}
              className={`plans-chart-legend-item${selectedKey === item.key ? ' selected' : ''}`}
              onMouseEnter={() => setSelectedKey(item.key)}
              onFocus={() => setSelectedKey(item.key)}
              onClick={() => setSelectedKey(item.key)}
              aria-pressed={selectedKey === item.key}
            >
              <span className="plans-chart-swatch" style={{ backgroundColor: colors[index % colors.length] }} />
              <span className="plans-chart-name">{item.label}</span>
              <strong>{formatNumber(item.value)}</strong>
            </button>
          ))}
        </div>
      </div>
      <div className="plans-chart-detail" aria-live="polite">
        {selected ? (
          <><strong>{selected.label}</strong> · {formatNumber(selected.value)} miembros · {formatNumber(total ? (selected.value / total) * 100 : 0)} % del total</>
        ) : (
          'Toca un segmento o pasa el cursor sobre un estado para ver sus detalles.'
        )}
      </div>
      <p className="plans-chart-note">Incluye todos los miembros no archivados y clasifica cada uno en un único estado.</p>
    </div>
  );
}
