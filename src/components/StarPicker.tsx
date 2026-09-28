'use client';

import { useState } from 'react';

export default function StarPicker({ name = 'stars' }: { name?: string }) {
  const [value, setValue] = useState(5);

  return (
    <div className="flex items-center gap-1">
      <input type="hidden" name={name} value={value} />
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          onClick={() => setValue(star)}
          className={`text-2xl leading-none transition ${
            star <= value ? 'text-gold-500' : 'text-ink-200 hover:text-gold-300'
          }`}
        >
          ★
        </button>
      ))}
      <span className="ml-2 text-sm text-ink-500">{value}/5</span>
    </div>
  );
}
