import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

const colors = ['#ffce2b', '#f28c55', '#85bfa8', '#80a9e3', '#c699d8'];
const formatNumber = (value) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value);

export default function PlansChart({ data }) {
  const [selectedName, setSelectedName] = useState(null);
  const total = data.reduce((sum, plan) => sum + plan.memberships, 0);
  const selected = data.find((plan) => plan.name === selectedName);

  return (
    <div className="plans-chart">
      <div className="plans-chart-layout">
        <div className="plans-chart-graphic" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer={false}>
              <Pie
                data={data}
                dataKey="memberships"
                nameKey="name"
                innerRadius="57%"
                outerRadius="88%"
                stroke="#1b1b1b"
                strokeWidth={2}
                isAnimationActive={false}
                onMouseEnter={(plan) => setSelectedName(plan.name)}
                onClick={(plan) => setSelectedName(plan.name)}
              >
                {data.map((plan, index) => (
                  <Cell
                    key={plan.name}
                    fill={colors[index % colors.length]}
                    opacity={selected && selected.name !== plan.name ? 0.55 : 1}
                    cursor="pointer"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="plans-chart-center">
            <strong>{formatNumber(total)}</strong>
            <span>mostradas</span>
          </div>
        </div>
        <div className="plans-chart-legend" aria-label="Planes mostrados">
          {data.map((plan, index) => (
            <button
              type="button"
              key={plan.name}
              className={`plans-chart-legend-item${selectedName === plan.name ? ' selected' : ''}`}
              onMouseEnter={() => setSelectedName(plan.name)}
              onFocus={() => setSelectedName(plan.name)}
              onClick={() => setSelectedName(plan.name)}
              aria-pressed={selectedName === plan.name}
            >
              <span className="plans-chart-swatch" style={{ backgroundColor: colors[index % colors.length] }} />
              <span className="plans-chart-name">{plan.name}</span>
              <strong>{formatNumber(plan.memberships)}</strong>
            </button>
          ))}
        </div>
      </div>
      <div className="plans-chart-detail" aria-live="polite">
        {selected ? (
          <><strong>{selected.name}</strong> · {formatNumber(selected.memberships)} membresías · {formatNumber(total ? (selected.memberships / total) * 100 : 0)} % de las mostradas</>
        ) : (
          'Toca un segmento o pasa el cursor sobre un plan para ver sus detalles.'
        )}
      </div>
      <p className="plans-chart-note">Hasta 5 planes con más membresías registradas; excluye las vinculadas a pagos anulados.</p>
    </div>
  );
}
