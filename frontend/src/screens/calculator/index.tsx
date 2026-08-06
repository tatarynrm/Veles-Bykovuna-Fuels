'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Route,
  Fuel,
  Truck,
  Leaf,
  Coins,
  Download,
  FileSpreadsheet,
  Zap,
  Navigation,
  Globe2,
  CheckCircle2,
  Building2,
  MapPin,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import SectionHeading from '@/shared/ui/SectionHeading';
import VendorLogo from '@/components/VendorLogos';
import { t } from '@/lib/i18n';

/* i18n-ignore-raw: CalculatorScreen */
/* i18n-ignore-props: name, code, flag, label, labelKey, preset, distance, weight, id */

interface PresetRoute {
  labelKey: string;
  distance: number;
  weight: number;
  tolls: string[];
}

const PRESETS: PresetRoute[] = [
  { labelKey: 'calc.presetKyivLviv', distance: 540, weight: 18, tolls: ['UA'] },
  { labelKey: 'calc.presetKyivWarsaw', distance: 780, weight: 20, tolls: ['UA', 'PL'] },
  { labelKey: 'calc.presetKyivBerlin', distance: 1350, weight: 22, tolls: ['UA', 'PL', 'DE'] },
  { labelKey: 'calc.presetLvivConstanta', distance: 1020, weight: 16, tolls: ['UA', 'RO'] },
];

const NETWORKS = [
  { id: 'okko', name: 'OKKO', discount: 3.5, price: 54.5 },
  { id: 'shell', name: 'Shell', discount: 3.8, price: 53.9 },
  { id: 'wog', name: 'WOG', discount: 3.4, price: 54.2 },
  { id: 'socar', name: 'SOCAR', discount: 3.6, price: 54.8 },
  { id: 'ukrnafta', name: 'Ukrnafta', discount: 2.8, price: 51.5 },
];

const VEHICLE_TYPES = [
  { id: 'euro6', labelKey: 'calc.euro6', baseConsumption: 28.5, tollFactor: 0.18, co2Factor: 2.64 },
  { id: 'euro5', labelKey: 'calc.euro5', baseConsumption: 31.0, tollFactor: 0.24, co2Factor: 2.68 },
  { id: 'van5t', labelKey: 'calc.van5t', baseConsumption: 14.5, tollFactor: 0.08, co2Factor: 2.55 },
  { id: 'lcv', labelKey: 'calc.lcv', baseConsumption: 9.5, tollFactor: 0.04, co2Factor: 2.45 },
];

export default function CalculatorScreen() {
  const [distance, setDistance] = useState(780);
  const [weight, setWeight] = useState(18);
  const [vehicleId, setVehicleId] = useState('euro6');
  const [networkId, setNetworkId] = useState('okko');
  const [selectedTolls, setSelectedTolls] = useState<string[]>(['UA', 'PL']);

  const vehicle = useMemo(
    () => VEHICLE_TYPES.find(v => v.id === vehicleId) || VEHICLE_TYPES[0],
    [vehicleId],
  );

  const network = useMemo(
    () => NETWORKS.find(n => n.id === networkId) || NETWORKS[0],
    [networkId],
  );

  // Calculations
  const metrics = useMemo(() => {
    // Consumption adjusts +0.35L per ton of cargo
    const consumptionPer100km = vehicle.baseConsumption + weight * 0.35;
    const totalLiters = (distance * consumptionPer100km) / 100;

    const baseCostUah = totalLiters * network.price;
    const velesCostUah = totalLiters * (network.price - network.discount);
    const savingsUah = baseCostUah - velesCostUah;

    // Toll fees
    const tollCountriesCount = selectedTolls.filter(t => t !== 'UA').length;
    const tollKm = (distance * (tollCountriesCount * 0.45)) / Math.max(1, selectedTolls.length);
    const tollCostEur = tollKm * vehicle.tollFactor;
    const tollCostUah = tollCostEur * 44.5; // EUR to UAH rate approx

    // Carbon emissions: liters * CO2 factor / 1000 = metric tons
    const co2Tons = (totalLiters * vehicle.co2Factor) / 1000;
    // 1 tree absorbs ~22kg (0.022t) CO2 per year
    const treesNeeded = Math.round(co2Tons / 0.022);

    return {
      consumptionPer100km: consumptionPer100km.toFixed(1),
      totalLiters: Math.round(totalLiters),
      baseCostUah: Math.round(baseCostUah),
      velesCostUah: Math.round(velesCostUah),
      savingsUah: Math.round(savingsUah),
      tollCostEur: Math.round(tollCostEur),
      tollCostUah: Math.round(tollCostUah),
      co2Tons: co2Tons.toFixed(2),
      treesNeeded,
    };
  }, [distance, weight, vehicle, network, selectedTolls]);

  const handleApplyPreset = (preset: PresetRoute) => {
    setDistance(preset.distance);
    setWeight(preset.weight);
    setSelectedTolls(preset.tolls);
  };

  const handleToggleToll = (country: string) => {
    if (country === 'UA') return;
    if (selectedTolls.includes(country)) {
      setSelectedTolls(selectedTolls.filter(c => c !== country));
    } else {
      setSelectedTolls([...selectedTolls, country]);
    }
  };

  const handleExportPdf = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      `Distance,Weight,Vehicle,Network,Litres,BaseCostUAH,VelesCostUAH,SavingsUAH,CO2Tons,TreesNeeded\n` +
      `${distance},${weight},${vehicle.id},${network.id},${metrics.totalLiters},${metrics.baseCostUah},${metrics.velesCostUah},${metrics.savingsUah},${metrics.co2Tons},${metrics.treesNeeded}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Veles_Route_Quote_${distance}km.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 text-center sm:text-left">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border-accent bg-accent-soft px-3.5 py-1 text-xs font-semibold text-accent backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span>{t('calc.smartEngine')}</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl text-txt-primary">
          {t('calc.title')}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-txt-secondary leading-relaxed">
          {t('calc.subtitle')}
        </p>
      </div>

      {/* Quick Presets */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-txt-muted flex items-center gap-1">
          <Navigation className="h-3.5 w-3.5 text-accent" />
          <span>{t('calc.quickRoutes')}</span>
        </span>
        {PRESETS.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleApplyPreset(p)}
            className="rounded-xl border border-subtle bg-surface-inset px-3 py-1.5 text-xs font-medium text-txt-secondary transition-all hover:border-accent hover:text-txt-primary hover:shadow-sm"
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      {/* Main Grid: Controls + Live Metrics */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Sliders & Settings (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          <div className="glass-panel p-6 space-y-6">
            <h2 className="text-base font-bold flex items-center gap-2 text-txt-primary">
              <Route className="h-4 w-4 text-accent" />
              <span>{t('calc.routeParams')}</span>
            </h2>

            {/* Distance Slider */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold text-txt-secondary flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-accent" />
                  <span>{t('calc.distance')}</span>
                </label>
                <span className="font-mono text-sm font-bold text-accent">
                  {distance} <span className="text-xs font-normal text-txt-muted">{t('calc.km')}</span>
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={5000}
                step={25}
                value={distance}
                onChange={e => setDistance(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="mt-1 flex justify-between text-[10px] text-txt-muted font-mono">
                <span>{`50 ${t('calc.km')}`}</span>
                <span>{`2,500 ${t('calc.km')}`}</span>
                <span>{`5,000 ${t('calc.km')}`}</span>
              </div>
            </div>

            {/* Weight Slider */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold text-txt-secondary flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-info" />
                  <span>{t('calc.cargoWeight')}</span>
                </label>
                <span className="font-mono text-sm font-bold text-info">
                  {weight} <span className="text-xs font-normal text-txt-muted">{t('calc.ton')}</span>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={24}
                step={1}
                value={weight}
                onChange={e => setWeight(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="mt-1 flex justify-between text-[10px] text-txt-muted font-mono">
                <span>{t('calc.empty0t')}</span>
                <span>{`12 ${t('calc.ton')}`}</span>
                <span>{t('calc.full24t')}</span>
              </div>
            </div>

            {/* Vehicle Euro Class */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-txt-secondary">
                {t('calc.vehicleType')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {VEHICLE_TYPES.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVehicleId(v.id)}
                    className={`flex flex-col items-start rounded-xl p-2.5 text-left border transition-all ${
                      vehicleId === v.id
                        ? 'border-border-accent bg-accent-soft text-txt-primary shadow-sm font-semibold'
                        : 'border-subtle bg-surface-inset text-txt-secondary hover:text-txt-primary'
                    }`}
                  >
                    <span className="text-xs font-bold">{t(v.labelKey)}</span>
                    <span className="text-[10px] text-txt-muted mt-0.5 font-mono">
                      ~{v.baseConsumption} {t('calc.lPer100km')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fuel Network */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-txt-secondary">
                {t('calc.fuelNetwork')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {NETWORKS.map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setNetworkId(n.id)}
                    className={`flex items-center gap-2 rounded-xl p-2 border transition-all ${
                      networkId === n.id
                        ? 'border-border-accent bg-accent-soft text-txt-primary shadow-sm'
                        : 'border-subtle bg-surface-inset text-txt-secondary hover:text-txt-primary'
                    }`}
                  >
                    <VendorLogo name={n.id} size={18} />
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-bold truncate">{n.name}</p>
                      <p className="text-[9px] text-accent font-semibold">{`-${n.discount} ${t('calc.uahPerL')}`}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Transit Countries */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-txt-secondary">
                {t('calc.transitTolls')}
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { code: 'UA', flag: '🇺🇦', labelKey: 'calc.ua' },
                  { code: 'PL', flag: '🇵🇱', labelKey: 'calc.plToll' },
                  { code: 'DE', flag: '🇩🇪', labelKey: 'calc.deToll' },
                  { code: 'RO', flag: '🇷🇴', labelKey: 'calc.roToll' },
                ].map(c => {
                  const active = selectedTolls.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleToggleToll(c.code)}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all ${
                        active
                          ? 'border-border-accent bg-accent-soft text-accent'
                          : 'border-subtle bg-surface-inset text-txt-muted hover:text-txt-primary'
                      }`}
                    >
                      <span>{c.flag}</span>
                      <span>{t(c.labelKey)}</span>
                      {active && <CheckCircle2 className="h-3 w-3 text-accent" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Bento Analytics (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Top Hero Metric: Savings */}
          <div className="glass-panel relative overflow-hidden p-6 border border-border-accent shadow-lg">
            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
              <Coins size={120} className="text-accent" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <span className="micro-label text-accent font-mono tracking-wider">
                  {t('calc.resultsHeader')}
                </span>
                <span className="badge badge-accent flex items-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5" />
                  <span>{`-${network.discount} ${t('calc.uahPerL')}`}</span>
                </span>
              </div>

              <div className="mt-4 flex items-baseline gap-3">
                <span className="stat font-display text-4xl font-extrabold text-txt-primary sm:text-5xl tracking-tight">
                  {metrics.savingsUah.toLocaleString()} <span className="text-xl font-semibold text-accent">₴</span>
                </span>
                <span className="text-xs text-txt-muted">{t('calc.velesSavings')}</span>
              </div>

              <p className="mt-2 text-xs text-txt-secondary">
                {t('calc.calculatedFor')} <strong className="text-txt-primary">{network.name}</strong> {t('calc.atConsumption')}{' '}
                <span className="font-mono text-accent">{metrics.consumptionPer100km} {t('calc.lPer100km')}</span>.
              </p>
            </div>
          </div>

          {/* Bento Cards Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Card 1: Fuel Litres */}
            <div className="glass-panel p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-txt-secondary">{t('calc.fuelVolume')}</span>
                <Fuel className="h-4 w-4 text-accent" />
              </div>
              <p className="stat font-display text-2xl font-bold text-txt-primary">
                {metrics.totalLiters.toLocaleString()} <span className="text-xs font-normal text-txt-muted">{t('calc.l')}</span>
              </p>
              <div className="h-1.5 w-full rounded-full bg-surface-inset overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: '65%' }} />
              </div>
            </div>

            {/* Card 2: Fuel Cost Comparison */}
            <div className="glass-panel p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-txt-secondary">{t('calc.fuelCostVeles')}</span>
                <Building2 className="h-4 w-4 text-accent" />
              </div>
              <p className="stat font-display text-2xl font-bold text-txt-primary">
                {metrics.velesCostUah.toLocaleString()} <span className="text-xs font-normal text-txt-muted">₴</span>
              </p>
              <p className="text-[11px] text-txt-muted line-through">
                {t('calc.fuelCostBase')}: {metrics.baseCostUah.toLocaleString()} ₴
              </p>
            </div>

            {/* Card 3: Toll Road Fees */}
            <div className="glass-panel p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-txt-secondary">{t('calc.tollRoadCost')}</span>
                <Globe2 className="h-4 w-4 text-warn" />
              </div>
              <p className="stat font-display text-2xl font-bold text-txt-primary">
                € {metrics.tollCostEur.toLocaleString()}{' '}
                <span className="text-xs font-normal text-txt-muted">
                  (~{metrics.tollCostUah.toLocaleString()} ₴)
                </span>
              </p>
              <p className="text-[11px] text-txt-muted">
                {t('calc.tollAutobahns')} {selectedTolls.join(', ')}
              </p>
            </div>

            {/* Card 4: CO2 Carbon Footprint */}
            <div className="glass-panel p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-txt-secondary">{t('calc.co2Emissions')}</span>
                <Leaf className="h-4 w-4 text-accent" />
              </div>
              <p className="stat font-display text-2xl font-bold text-accent">
                {metrics.co2Tons} <span className="text-xs font-normal text-txt-muted">т CO₂</span>
              </p>
              <p className="text-[11px] text-txt-secondary flex items-center gap-1">
                <span>🌲 {metrics.treesNeeded} {t('calc.treesOffset')}</span>
              </p>
            </div>
          </div>

          {/* Action Bar: Export Quote */}
          <div className="glass-panel p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-txt-primary">{t('calc.exportTitle')}</h3>
              <p className="text-xs text-txt-secondary">{t('calc.exportSub')}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportPdf}
                className="btn btn-ghost gap-1.5 text-xs font-semibold"
              >
                <Download className="h-4 w-4 text-txt-primary" />
                <span>{t('calc.exportPdf')}</span>
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="btn btn-primary gap-1.5 text-xs font-semibold"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>{t('calc.exportExcel')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
