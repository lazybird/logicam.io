import React from 'react';
import { Delete } from 'lucide-react';

interface PinKeypadProps {
  pin: string;
  onChange: (pin: string) => void;
  disabled?: boolean;
}

export const PinKeypad: React.FC<PinKeypadProps> = ({ pin, onChange, disabled = false }) => {
  const handleDigit = (digit: string) => {
    if (disabled || pin.length >= 4) return;
    const next = pin + digit;
    onChange(next);
  };

  const handleBackspace = () => {
    if (disabled || pin.length === 0) return;
    onChange(pin.slice(0, -1));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 4 Indicateurs Visuels de PIN */}
      <div className="flex gap-2 justify-between">
        {[0, 1, 2, 3].map((index) => {
          const isFilled = index < pin.length;
          const isCurrent = index === pin.length;

          return (
            <div
              key={index}
              className={`w-full h-12 bg-[#020617] rounded flex items-center justify-center transition-all ${
                isCurrent
                  ? 'border-l-2 border-l-[#ff8c00] border-y border-r border-[#334155]'
                  : 'border border-[#334155]'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  isFilled ? 'bg-[#dae2fd] scale-110' : 'bg-[#dae2fd]/20'
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Pavé numérique 3x4 */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => handleDigit(digit)}
            className="h-12 bg-surface-container hover:bg-surface-variant active:bg-[#ff8c00]/20 rounded border border-[#334155] font-mono text-lg text-on-surface transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed select-none"
          >
            {digit}
          </button>
        ))}

        <div className="h-12" />

        <button
          type="button"
          disabled={disabled}
          onClick={() => handleDigit('0')}
          className="h-12 bg-surface-container hover:bg-surface-variant active:bg-[#ff8c00]/20 rounded border border-[#334155] font-mono text-lg text-on-surface transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed select-none"
        >
          0
        </button>

        <button
          type="button"
          disabled={disabled || pin.length === 0}
          onClick={handleBackspace}
          className="h-12 bg-surface-container hover:bg-surface-variant active:bg-[#ff8c00]/20 rounded border border-[#334155] text-on-surface transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center select-none"
          title="Effacer"
        >
          <Delete className="w-5 h-5 text-on-surface-variant hover:text-primary" />
        </button>
      </div>
    </div>
  );
};
