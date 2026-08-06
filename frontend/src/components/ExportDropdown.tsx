'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { ExportManager, ExportOptions } from '@/utils/exportManager';
import { t } from '@/lib/i18n';

interface ExportDropdownProps {
  /**
   * Raw dataset array, HTMLTableElement, or CSS selector of a table element.
   * A function is also accepted so the latest filtered/paginated data is read at click time.
   */
  data: any[] | (() => any[]) | string | HTMLTableElement;
  options?: ExportOptions;
  className?: string;
  buttonText?: string;
}

const OVERLAY_ID = 'export-loader-overlay';

/** Full-screen frosted overlay while the export libraries load and render. */
function showFullScreenSpinner() {
  if (typeof document === 'undefined' || document.getElementById(OVERLAY_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:99999',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:14px',
    'background:color-mix(in srgb, var(--bg-page) 72%, transparent)',
    'backdrop-filter:blur(16px) saturate(180%)',
    '-webkit-backdrop-filter:blur(16px) saturate(180%)',
    'color:var(--text-primary)',
    'font-family:inherit',
    'animation:fade .2s ease-out both',
  ].join(';');

  // Розмітка лишається розміткою — перекладаються лише два підписи всередині.
  overlay.innerHTML = `
    <div style="
      width:38px;height:38px;border-radius:9999px;
      border:3px solid var(--border-subtle);
      border-left-color:var(--accent);
      animation:exportSpin .8s linear infinite;"></div>
    <div style="text-align:center">
      <div style="font-size:13px;font-weight:600;letter-spacing:-0.01em;">${t('export.buildingTheReport')}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${t('export.processingDataEllipsis')}</div>
    </div>
    <style>@keyframes exportSpin{to{transform:rotate(360deg)}}</style>`;

  document.body.appendChild(overlay);
}

function hideFullScreenSpinner() {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;
  overlay.style.transition = 'opacity .15s ease-out';
  overlay.style.opacity = '0';
  setTimeout(() => overlay.remove(), 160);
}

export default function ExportDropdown({
  data,
  options = {},
  className = '',
  buttonText = t('common.export'),
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    setIsOpen(false);
    setIsExporting(true);
    showFullScreenSpinner();

    try {
      const resolvedData = typeof data === 'function' ? data() : data;
      const shared = {
        filename: options.filename || 'export',
        title: options.title || t('export.dataExport'),
        subtitle: options.subtitle || 'VELES ERP',
        columns: options.columns,
      };

      if (format === 'xlsx') {
        await ExportManager.toExcel(resolvedData, {
          ...shared,
          sheetName: options.sheetName || t('common.data'),
        });
      } else {
        await ExportManager.toPDF(resolvedData, {
          ...shared,
          orientation: options.orientation,
        });
      }
    } catch (error: any) {
      console.error(t('export.exportFailedColon'), error);
      alert(t('export.exportError', { v0: error?.message || error }));
    } finally {
      setIsExporting(false);
      hideFullScreenSpinner();
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        disabled={isExporting}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="btn btn-ghost"
        title={t('export.exportData')}
      >
        {isExporting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
        ) : (
          <Download className="h-3.5 w-3.5 text-accent" />
        )}
        <span>{isExporting ? t('export.exportingEllipsis') : buttonText}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="glass-float animate-pop absolute right-0 z-50 mt-2 w-52 rounded-field p-1.5"
        >
          <button
            role="menuitem"
            onClick={() => handleExport('xlsx')}
            className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-xs font-medium text-txt-secondary transition-colors hover:bg-surface-hover hover:text-txt-primary"
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-accent" />
            <span>Excel (.xlsx)</span>
          </button>
          <button
            role="menuitem"
            onClick={() => handleExport('pdf')}
            className="mt-0.5 flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-xs font-medium text-txt-secondary transition-colors hover:bg-surface-hover hover:text-txt-primary"
          >
            <FileText className="h-4 w-4 shrink-0 text-danger" />
            <span>PDF (.pdf)</span>
          </button>
        </div>
      )}
    </div>
  );
}
