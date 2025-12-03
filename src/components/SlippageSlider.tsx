import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface SlippageSliderProps {
  value: number;
  onChange: (value: number) => void;
}

const PRESET_VALUES = [0.1, 0.5, 1.0, 3.0];

const SlippageSlider: React.FC<SlippageSliderProps> = ({ value, onChange }) => {
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(!PRESET_VALUES.includes(value));

  const handlePresetClick = (preset: number) => {
    onChange(preset);
    setShowCustom(false);
    setCustomInput('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    setCustomInput(val);

    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 50) {
      onChange(num);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onChange(val);
    setShowCustom(true);
    setCustomInput(val.toFixed(1));
  };

  return (
    <div className="bg-bear-dark-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-white">Slippage Tolerance</span>
        <span className="text-sm text-bear-purple-400 font-mono">{value}%</span>
      </div>

      {/* Preset buttons */}
      <div className="flex gap-2 mb-4">
        {PRESET_VALUES.map((preset) => (
          <button
            key={preset}
            onClick={() => handlePresetClick(preset)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              value === preset && !showCustom
                ? 'bg-bear-purple-600 text-white'
                : 'bg-bear-dark-600 text-gray-400 hover:bg-bear-dark-500'
            }`}
          >
            {preset}%
          </button>
        ))}
        <button
          onClick={() => setShowCustom(true)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            showCustom
              ? 'bg-bear-purple-600 text-white'
              : 'bg-bear-dark-600 text-gray-400 hover:bg-bear-dark-500'
          }`}
        >
          Custom
        </button>
      </div>

      {/* Beautiful slider */}
      <div className="relative">
        <div className="h-2 bg-bear-dark-600 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-bear-green-500 via-bear-gold-500 to-red-500"
            style={{ width: `${Math.min(value * 10, 100)}%` }}
            transition={{ type: 'spring', damping: 20 }}
          />
        </div>
        <input
          type="range"
          min="0"
          max="10"
          step="0.1"
          value={value}
          onChange={handleSliderChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        {/* Slider thumb indicator */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-bear-purple-500 pointer-events-none"
          style={{ left: `calc(${Math.min(value * 10, 100)}% - 8px)` }}
          transition={{ type: 'spring', damping: 20 }}
        />
      </div>

      {/* Custom input */}
      {showCustom && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customInput || value.toString()}
              onChange={handleCustomChange}
              placeholder="0.5"
              className="flex-1 bg-bear-dark-700 border border-bear-dark-500 rounded-lg px-3 py-2 text-white focus:border-bear-purple-500 outline-none text-center font-mono"
            />
            <span className="text-gray-400">%</span>
          </div>
          {value > 5 && (
            <p className="text-yellow-400 text-xs mt-2">
              High slippage may result in unfavorable trades
            </p>
          )}
        </motion.div>
      )}

      {/* Scale labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>0%</span>
        <span>Safe</span>
        <span>Risky</span>
        <span>10%</span>
      </div>
    </div>
  );
};

export default SlippageSlider;
