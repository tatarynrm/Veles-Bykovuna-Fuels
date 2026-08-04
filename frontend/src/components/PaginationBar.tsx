'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="hairline-t mt-4 flex flex-col items-center justify-between gap-3 pt-4 sm:flex-row">
      <div className="flex items-center gap-3">
        <p className="text-2xs text-txt-muted">
          <span className="tabular font-medium text-txt-secondary">
            {from}–{to}
          </span>{' '}
          з <span className="tabular font-medium text-txt-secondary">{totalItems}</span>
        </p>

        <label className="flex items-center gap-1.5 text-2xs text-txt-muted">
          <span className="hidden sm:inline">На сторінці</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="field field-sm w-auto"
            aria-label="Кількість записів на сторінці"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-2xs text-txt-muted">
          Сторінка <span className="tabular font-medium text-txt-secondary">{currentPage}</span> з{' '}
          <span className="tabular font-medium text-txt-secondary">{totalPages}</span>
        </span>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="btn-icon h-8 w-8 disabled:pointer-events-none disabled:opacity-35"
          title="Попередня сторінка"
          aria-label="Попередня сторінка"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="btn-icon h-8 w-8 disabled:pointer-events-none disabled:opacity-35"
          title="Наступна сторінка"
          aria-label="Наступна сторінка"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
