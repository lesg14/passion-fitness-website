import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordInput({ label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <label>
      {label}
      <span className="staff-password-input">
        <input type={visible ? 'text' : 'password'} required autoComplete={autoComplete} value={value} onChange={onChange} />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}>
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}
