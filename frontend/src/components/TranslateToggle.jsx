import React from 'react';
import { Languages } from 'lucide-react';
import { isAmharicEnabled, toggleAmharicTranslation } from '../utils/googleTranslate';

export default function TranslateToggle({ className = '', compact = false }) {
  const enabled = isAmharicEnabled();

  const handleToggle = () => {
    toggleAmharicTranslation();
  };

  if (compact) {
    return (
      <button
        type="button"
        className={`translate-toggle-btn translate-toggle-btn--compact${enabled ? ' active' : ''}${className ? ` ${className}` : ''}`}
        onClick={handleToggle}
        title={enabled ? 'Switch back to English' : 'Translate page to Amharic'}
        aria-pressed={enabled}
      >
        <Languages size={18} />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`translate-toggle-btn${enabled ? ' active' : ''}${className ? ` ${className}` : ''}`}
      onClick={handleToggle}
      title={enabled ? 'Switch back to English' : 'Translate page to Amharic'}
      aria-pressed={enabled}
    >
      <Languages size={16} />
      <span className="translate-toggle-label">
        {enabled ? 'English' : 'Translate'}
      </span>
      {!enabled && <span className="translate-toggle-hint">አማርኛ</span>}
      {enabled && <span className="translate-toggle-hint">አማርኛ ON</span>}
    </button>
  );
}
