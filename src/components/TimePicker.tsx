import { useState, useRef, useEffect } from 'react';

interface TimePickerProps {
  value: string;  // "HH:mm" format
  onChange: (time: string) => void;
  label?: string;
  className?: string;
}

export default function TimePicker({ value, onChange, label, className = '' }: TimePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempHour, setTempHour] = useState('09');
  const [tempMinute, setTempMinute] = useState('00');
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse value on open
  useEffect(() => {
    if (showPicker && value) {
      const [h, m] = value.split(':');
      setTempHour(h || '09');
      setTempMinute(m || '00');
    }
  }, [showPicker, value]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  const handleConfirm = () => {
    onChange(`${tempHour}:${tempMinute}`);
    setShowPicker(false);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  const displayValue = value || '시간 선택';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="text-sm text-gray-500 mb-2 block">{label}</label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl text-left hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {displayValue}
        </span>
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Picker Dialog */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPicker(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xs overflow-hidden">
            {/* Header */}
            <div className="bg-accent text-white p-4 text-center">
              <p className="text-sm opacity-80">시간 선택</p>
              <p className="text-4xl font-bold mt-1">{tempHour}:{tempMinute}</p>
            </div>

            {/* Picker Content */}
            <div className="p-4">
              <div className="flex gap-4 justify-center items-center">
                {/* Hour Picker */}
                <div className="flex-1">
                  <p className="text-xs text-gray-500 text-center mb-2">시</p>
                  <div className="h-40 overflow-y-auto scrollbar-thin border rounded-xl">
                    {hours.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setTempHour(h)}
                        className={`w-full py-2 text-center transition-colors ${
                          tempHour === h
                            ? 'bg-accent text-white font-bold'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                <span className="text-3xl font-bold text-gray-400">:</span>

                {/* Minute Picker */}
                <div className="flex-1">
                  <p className="text-xs text-gray-500 text-center mb-2">분</p>
                  <div className="h-40 overflow-y-auto scrollbar-thin border rounded-xl">
                    {minutes.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTempMinute(m)}
                        className={`w-full py-2 text-center transition-colors ${
                          tempMinute === m
                            ? 'bg-accent text-white font-bold'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex border-t">
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="flex-1 py-3 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3 text-accent font-medium hover:bg-accent/5 transition-colors border-l"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for inline use (like in day-by-day time settings)
interface CompactTimePickerProps {
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
}

export function CompactTimePicker({ value, onChange, placeholder = '00:00' }: CompactTimePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempHour, setTempHour] = useState('09');
  const [tempMinute, setTempMinute] = useState('00');

  useEffect(() => {
    if (showPicker && value) {
      const [h, m] = value.split(':');
      setTempHour(h || '09');
      setTempMinute(m || '00');
    }
  }, [showPicker, value]);

  const handleConfirm = () => {
    onChange(`${tempHour}:${tempMinute}`);
    setShowPicker(false);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="flex-1 flex items-center justify-between px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value || placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPicker(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xs overflow-hidden">
            {/* Header */}
            <div className="bg-accent text-white p-4 text-center">
              <p className="text-sm opacity-80">시간 선택</p>
              <p className="text-4xl font-bold mt-1">{tempHour}:{tempMinute}</p>
            </div>

            {/* Picker Content */}
            <div className="p-4">
              <div className="flex gap-4 justify-center items-center">
                {/* Hour Picker */}
                <div className="flex-1">
                  <p className="text-xs text-gray-500 text-center mb-2">시</p>
                  <div className="h-40 overflow-y-auto scrollbar-thin border rounded-xl">
                    {hours.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setTempHour(h)}
                        className={`w-full py-2 text-center transition-colors ${
                          tempHour === h
                            ? 'bg-accent text-white font-bold'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                <span className="text-3xl font-bold text-gray-400">:</span>

                {/* Minute Picker */}
                <div className="flex-1">
                  <p className="text-xs text-gray-500 text-center mb-2">분</p>
                  <div className="h-40 overflow-y-auto scrollbar-thin border rounded-xl">
                    {minutes.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTempMinute(m)}
                        className={`w-full py-2 text-center transition-colors ${
                          tempMinute === m
                            ? 'bg-accent text-white font-bold'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex border-t">
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="flex-1 py-3 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3 text-accent font-medium hover:bg-accent/5 transition-colors border-l"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
