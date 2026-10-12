import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const formatCurrency = (value) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
}).format(value);

export default function RevenueChart({ data }) {
  return <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
      <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#77b89a" stopOpacity={0.25} /><stop offset="95%" stopColor="#77b89a" stopOpacity={0.015} /></linearGradient></defs>
      <CartesianGrid vertical={false} stroke="#e9ece7" strokeDasharray="3 5" />
      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#929a91', fontSize: 12 }} dy={12} />
      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#929a91', fontSize: 11 }} tickFormatter={(value) => `$${value / 1000000}M`} width={48} />
      <Tooltip formatter={(value) => [formatCurrency(value), 'Ingresos']} contentStyle={{ border: '1px solid #e7eae4', borderRadius: 8, fontFamily: 'DM Sans' }} />
      <Area type="monotone" dataKey="revenue" stroke="#43866a" strokeWidth={2.5} fill="url(#revenueFill)" activeDot={{ r: 5, fill: '#43866a', stroke: '#fff', strokeWidth: 2 }} />
    </AreaChart>
  </ResponsiveContainer>;
}