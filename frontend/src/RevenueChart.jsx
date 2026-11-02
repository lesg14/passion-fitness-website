import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const formatCurrency = (value) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
}).format(value);

export default function RevenueChart({ data }) {
  return <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid vertical={false} stroke="#2e2e2e" strokeDasharray="3 5" />
      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8a8a85', fontSize: 12 }} dy={12} />
      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8a8a85', fontSize: 11 }} tickFormatter={(value) => `$${value / 1000000}M`} width={48} />
      <Tooltip cursor={{ fill: '#ffffff0d' }} formatter={(value) => [formatCurrency(value), 'Ingresos']} contentStyle={{ background: '#222', border: '1px solid #333', borderRadius: 8, color: '#fff', fontFamily: 'DM Sans' }} itemStyle={{ color: '#fff' }} labelStyle={{ color: '#ffce2b' }} />
      <Bar dataKey="revenue" fill="#ffce2b" radius={[6, 6, 0, 0]} maxBarSize={44} />
    </BarChart>
  </ResponsiveContainer>;
}