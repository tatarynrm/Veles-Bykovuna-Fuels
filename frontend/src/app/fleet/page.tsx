'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import { AuthGate } from '@/components/PageShell';
import { useTheme } from '@/context/ThemeContext';
import { useAuthGuard, signOut } from '@/lib/useAuthGuard';
import {
  Truck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Wrench,
  User,
  Gauge,
  Sun,
  Moon,
  LogOut,
  Activity,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
  Sliders,
  ShieldAlert,
} from 'lucide-react';

const ThreeTruckViewer = dynamic(() => import('@/components/ThreeTruckViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[360px] sm:h-[480px] lg:h-[580px] rounded-card flex flex-col items-center justify-center bg-surface-inset border border-bdr-subtle">
      <div className="w-10 h-10 border-4 border-bdr-highlight border-t-okko-emerald rounded-full animate-spin mb-3"></div>
      <p className="text-txt-secondary text-sm font-semibold font-sans">Ініціалізація 3D Canvas...</p>
    </div>
  ),
});

// Complete structured list of malfunctions grouped into 5 categories
const diagnosticCategories = [
  {
    id: 'reefer_unit',
    title: '1. Холодильно-обігрівальна установка',
    system: 'refrigerator',
    groups: [
      {
        subTitle: 'Двигун та привод рефрижератора',
        items: [
          { id: 'reefer_engine_failure', title: 'Поломка дизельного двигуна установки', desc: 'Двигун не запускається / заглух.', status: 'damaged' as const, code: 'REF-ENG-101', recommendation: 'Діагностика паливної системи дизельного двигуна установки, заміна паливного насоса або свічок розжарювання.' },
          { id: 'reefer_belt_snapped', title: 'Обрив або знос приводного ременя', desc: 'Обрив або знос приводного ременя (Drive Belt).', status: 'damaged' as const, code: 'REF-BLT-102', recommendation: 'Термінова заміна приводного ременя. Перевірка натяжних роликів.' },
          { id: 'reefer_starter_fault', title: 'Несправність стартера рефрижератора', desc: 'Стартер не прокручує вал двигуна установки.', status: 'warning' as const, code: 'REF-STR-103', recommendation: 'Ремонт або заміна втягующего реле стартера, перевірка клем.' },
          { id: 'reefer_alternator_fault', title: 'Поломка генератора рефрижератора', desc: 'Відсутній заряд акумулятора установки.', status: 'warning' as const, code: 'REF-ALT-104', recommendation: 'Заміна регулятора напруги генератора або ремонт діодного моста.' },
          { id: 'reefer_battery_dead', title: 'Акумулятор рефа розряджений/відмовив', desc: 'Напруга АКБ нижче критичного рівня.', status: 'warning' as const, code: 'REF-BAT-105', recommendation: 'Зарядка АКБ рефрижератора або заміна на новий акумулятор 12V 95Ah.' },
        ]
      },
      {
        subTitle: 'Контур охолодження та фреон',
        items: [
          { id: 'compressor_failure', title: 'Заклинювання/поломка компресора', desc: 'Критична несправність компресора установки.', status: 'damaged' as const, code: 'REF-CMP-201', recommendation: 'Заміна компресора холодильного контуру, вакуумування та промивка системи від металевої стружки.' },
          { id: 'freon_leak', title: 'Витік хладагенту / фреону', desc: 'Пошкодження трубок, конденсера чи випарника.', status: 'damaged' as const, code: 'REF-FRN-202', recommendation: 'Опресування системи азотом, паяння витоків, заміна фільтра-осушувача, заправка фреоном R404A.' },
          { id: 'condenser_fan_broken', title: 'Поломка вентилятора конденсатора', desc: 'Вентилятор зовнішнього блоку не обертається.', status: 'damaged' as const, code: 'REF-FAN-203', recommendation: 'Заміна електродвигуна вентилятора конденсатора або перевірка реле живлення.' },
          { id: 'evaporator_fan_broken', title: 'Поломка вентиляторів випарника', desc: 'Не працюють вентилятори всередині будки.', status: 'damaged' as const, code: 'REF-FAN-204', recommendation: 'Заміна крильчатки або мотора внутрішнього вентилятора, відновлення проводки.' },
          { id: 'evaporator_icing', title: 'Обмерзання випарника / збій розморозки', desc: 'Несправність системи розморожування (Defrost).', status: 'warning' as const, code: 'REF-DEF-205', recommendation: 'Перевірка ТЕНів розморожування, заміна датчика відтайки випарника.' },
        ]
      },
      {
        subTitle: 'Електроніка та паливна система рефа',
        items: [
          { id: 'reefer_controller_error', title: 'Збій блоку управління / екрана', desc: 'Код помилки зв\'язку на панелі керування.', status: 'warning' as const, code: 'REF-CTR-301', recommendation: 'Діагностика шини CAN контролера рефрижератора, перепрошивка плати управління.' },
          { id: 'temp_sensor_fault', title: 'Поломка датчиків температури', desc: 'Помилка сенсорів Return або Supply Air.', status: 'warning' as const, code: 'REF-SNS-302', recommendation: 'Заміна датчика температури повітря у будці (вхідного/вихідного потоків).' },
          { id: 'reefer_fuel_filter_clogged', title: 'Засмічений паливний фільтр рефрижератора', desc: 'Падіння тиску дизельного палива в системі.', status: 'warning' as const, code: 'REF-FLT-303', recommendation: 'Планова заміна паливного та водовіддільного фільтрів установки.' },
          { id: 'reefer_fuel_tank_leak', title: 'Пробиття або витік з бака рефрижератора', desc: 'Витік палива з нижньої частини бака установки.', status: 'damaged' as const, code: 'REF-TNK-304', recommendation: 'Злив залишків палива, зварювання бака або заміна паливного резервуара рефа.' },
        ]
      }
    ]
  },
  {
    id: 'trailer_body',
    title: '2. Кузов та ізоляція напівпричепа',
    system: 'cabin',
    groups: [
      {
        subTitle: 'Герметичність та фурнітура',
        items: [
          { id: 'door_seal_damage', title: 'Пошкодження ущільнювачів дверей', desc: 'Знос гумових ущільнювачів (витік холоду).', status: 'damaged' as const, code: 'TRL-SEL-401', recommendation: 'Повна заміна контурного гумового ущільнювача задніх воріт напівпричепа.' },
          { id: 'door_latch_broken', title: 'Поломка замка задніх дверей', desc: 'Деформація запірного штангового механізму.', status: 'warning' as const, code: 'TRL-LTH-402', recommendation: 'Ремонт або заміна замків штангового типу задніх воріт.' },
          { id: 'wall_panel_damage', title: 'Пробиття термоізоляційної стінки', desc: 'Пошкодження сендвіч-панелі напівпричепа.', status: 'warning' as const, code: 'TRL-WAL-403', recommendation: 'Герметизація отворів монтажною піною та встановлення склопластикових латок.' },
          { id: 'roof_leak', title: 'Пошкодження або витік даху будки', desc: 'Протікання вологи через стики даху.', status: 'warning' as const, code: 'TRL-ROF-404', recommendation: 'Очищення покрівлі причепа, герметизація зовнішніх швів поліуретановим клеєм-герметиком.' },
          { id: 'air_chute_detached', title: 'Обрив розподільного рукава повітря', desc: 'Пошкодження стельового рукава (Air Chute).', status: 'warning' as const, code: 'TRL-CHT-405', recommendation: 'Повторне закріплення або заміна повітняного гнучкого рукава під стелею будки.' },
          { id: 'drain_hole_clogged', title: 'Засмічення дренажних отворів', desc: 'Замерзання або бруд у водовідводах підлоги.', status: 'warning' as const, code: 'TRL-DRN-406', recommendation: 'Механічне прочищення дренажних клапанів у кутах підлоги причепа.' },
          { id: 'floor_damage', title: 'Пошкодження алюмінієвої підлоги', desc: 'Деформація реф-підлоги (T-floor) роклою.', status: 'warning' as const, code: 'TRL-FLR-407', recommendation: 'Рихтування алюмінієвого профілю або зварювання тріщин аргоном.' },
        ]
      }
    ]
  },
  {
    id: 'trailer_chassis',
    title: '3. Ходова часть та підвіска причепа',
    system: 'wheels',
    groups: [
      {
        subTitle: 'Осі, підвіска та гальма',
        items: [
          { id: 'tire_blowout', title: 'Вибух / пробій шини причепа', desc: 'Втрата тиску колеса на середній осі.', status: 'damaged' as const, code: 'TRL-TIR-501', recommendation: 'Монтаж запасного колеса або заміна пошкодженої покришки 385/65 R22.5.' },
          { id: 'tire_wear_uneven', title: 'Нерівномірний знос протектора шин', desc: 'Знос плечової зони через порушення співвісності.', status: 'warning' as const, code: 'TRL-TIR-502', recommendation: 'Регулювання співвісності осей напівпричепа на СТО.' },
          { id: 'brake_pad_wear', title: 'Граничний знос гальмівних колодок', desc: 'Товщина фрикційних накладок менше 3 мм.', status: 'warning' as const, code: 'TRL-BRK-503', recommendation: 'Заміна гальмівних колодок та датчиків зносу на осях SAF/BPW.' },
          { id: 'air_bag_puncture', title: 'Пробій/витік пневмоподушки причепа', desc: 'Витік повітря з гумового балона підвіски.', status: 'damaged' as const, code: 'TRL-PNE-504', recommendation: 'Заміна пневморесори (пневмоподушки) напівпричепа.' },
          { id: 'brake_air_line_leak', title: 'Витік повітря з гальмівних шлангів', desc: 'Пошкодження гнучких сполучних трубок.', status: 'damaged' as const, code: 'TRL-AIR-505', recommendation: 'Заміна пошкодженої ділянки пластикової трубки швидкого з\'єднання.' },
          { id: 'wheel_bearing_overheat', title: 'Перегрів підшипника маточини', desc: 'Руйнування мастила маточини, ризик заклинювання.', status: 'damaged' as const, code: 'TRL-BRG-506', recommendation: 'Термінова заміна підшипника маточини разом із сальниками.' },
          { id: 'landing_gear_broken', title: 'Поломка опорних лап напівпричепа', desc: 'Пошкодження редуктора підйомного пристрою.', status: 'warning' as const, code: 'TRL-LND-507', recommendation: 'Ремонт шестерень редуктора опорних стійок JOST або заміна опорної лапи.' },
          { id: 'kingpin_damage', title: 'Знос/пошкодження зчіпного шкворня', desc: 'Критичний люфт у сідельно-зчіпному пристрої.', status: 'warning' as const, code: 'TRL-PIN-508', recommendation: 'Вимірювання зносу шкворня (Kingpin 2"). Заміна зчіпного шкворня плити.' },
        ]
      }
    ]
  },
  {
    id: 'truck_tractor',
    title: '4. Тягач (Truck Tractor)',
    system: 'engine',
    groups: [
      {
        subTitle: 'Двигун та трансмісія тягача',
        items: [
          { id: 'engine_overheat', title: 'Перегрів двигуна тягача', desc: 'Критична температура ОР, витік антифризу.', status: 'damaged' as const, code: 'TRK-ENG-601', recommendation: 'Перевірка помпи охолодження, герметичності радіатора та рівня охолоджуючої рідини.' },
          { id: 'engine_oil_leak', title: 'Витік моторної оливи', desc: 'Витік під прокладкою клапанної кришки або піддону.', status: 'damaged' as const, code: 'TRK-OIL-602', recommendation: 'Заміна прокладок двигуна, очищення сапуна, доливання мастила.' },
          { id: 'turbo_failure', title: 'Поломка турбокомпресора тягача', desc: 'Втрата тяги двигуна, сизий дим з вихлопної.', status: 'damaged' as const, code: 'TRK-TRB-603', recommendation: 'Демонтаж та ремонт турбіни, заміна картриджа, очищення інтеркулера.' },
          { id: 'transmission_fault', title: 'Несправність коробки передач', desc: 'Збої при переході передач КПП I-Shift / Opticruise.', status: 'warning' as const, code: 'TRK-TRN-604', recommendation: 'Комп\'ютерна діагностика ЕБУ КПП, перевірка клапанів зчеплення.' },
          { id: 'driveshaft_issue', title: 'Знос хрестовини / карданного вала', desc: 'Вібрація під час руху під навантаженням.', status: 'warning' as const, code: 'TRK-DRV-605', recommendation: 'Заміна хрестовини або підвісного підшипника карданного вала.' },
        ]
      },
      {
        subTitle: 'Електрика та пневматика тягача',
        items: [
          { id: 'main_battery_dead', title: 'Розряд акумуляторів тягача', desc: 'Напруга бортової мережі нижче 22V.', status: 'warning' as const, code: 'TRK-BAT-606', recommendation: 'Зарядка або заміна стартерних акумуляторних батарей (12V 225Ah - 2 од.).' },
          { id: 'truck_alternator_fault', title: 'Несправність генератора тягача', desc: 'Помилка заряду АКБ на приладовій панелі.', status: 'warning' as const, code: 'TRK-ALT-607', recommendation: 'Ремонт або заміна генератора тягача (28V, 120A).' },
          { id: 'air_compressor_failure', title: 'Поломка пневмокомпресора тягача', desc: 'Повільний набір повітря в ресивери системи.', status: 'warning' as const, code: 'TRK-CMP-608', recommendation: 'Заміна поршневих кілець компресора або повна його заміна.' },
          { id: 'gladhand_leak', title: 'Витік у з\'єднувальних головках', desc: 'Витік повітря через ущільнювачі Gladhands.', status: 'damaged' as const, code: 'TRK-GLD-609', recommendation: 'Заміна гумових ущільнювачів або самих зчіпних головок червоного/жовтого шлангів.' },
          { id: 'seven_way_cable_damage', title: 'Пошкодження 7-жильного кабелю', desc: 'Збої в передачі сигналів освітлення та ABS.', status: 'warning' as const, code: 'TRK-CBL-610', recommendation: 'Заміна або відновлення пошкодженої крученої розетки/кабелю 24V ISO.' },
        ]
      },
      {
        subTitle: 'Екологія та вихлоп',
        items: [
          { id: 'dpf_clogged', title: 'Забруднення сажового фільтра DPF', desc: 'Засмічення сажею понад 85%.', status: 'warning' as const, code: 'TRK-DPF-611', recommendation: 'Запуск примусової регенерації або професійна мийка сажового фільтра на СТО.' },
          { id: 'egr_valve_fault', title: 'Поломка клапана EGR', desc: 'Помилка датчика положення клапана рециркуляції.', status: 'warning' as const, code: 'TRK-EGR-612', recommendation: 'Очищення клапана EGR від нагару або заміна виконавчого механізму.' },
          { id: 'def_adblue_leak', title: 'Витік або несправність системи AdBlue', desc: 'Помилка системи SCR, кристалізація сечовини.', status: 'warning' as const, code: 'TRK-DEF-613', recommendation: 'Промивка форсунки впорскування AdBlue, перевірка підігріву бака DEF.' },
        ]
      }
    ]
  },
  {
    id: 'optics_equipment',
    title: '5. Оптика та додаткове обладнання',
    system: 'lights',
    groups: [
      {
        subTitle: 'Освітлення та сенсори безпеки',
        items: [
          { id: 'tail_light_broken', title: 'Непрацюючі задні ліхтарі причепа', desc: 'Збій живлення або розбитий плафон вогнів.', status: 'damaged' as const, code: 'EQP-LGT-701', recommendation: 'Заміна ламп/світлодіодного модуля заднього комбінованого ліхтаря.' },
          { id: 'side_marker_fault', title: 'Поломка габаритних бокових вогнів', desc: 'Відсутність живлення на маркерній стрічці причепа.', status: 'warning' as const, code: 'EQP-LGT-702', recommendation: 'Пошук обриву проводки вздовж лонжеронів напівпричепа, заміна LED маркерів.' },
          { id: 'abs_sensor_fault', title: 'Поломка датчика ABS причепа', desc: 'Світиться індикатор ABS причепа на панелі.', status: 'warning' as const, code: 'EQP-ABS-703', recommendation: 'Очищення датчика ABS від бруду, регулювання зазору або заміна індуктивного сенсора.' },
          { id: 'tpms_sensor_fault', title: 'Несправність датчика тиску TPMS', desc: 'Відсутній сигнал від колеса причепа.', status: 'warning' as const, code: 'EQP-TPM-704', recommendation: 'Заміна батарейки або встановлення нового датчика тиску в колесі.' },
        ]
      }
    ]
  }
];

// Initial Wheels Configuration Data
const initialWheelsData: Record<string, WheelInfo[]> = {
  'volvo-reefer-damaged': [
    { id: 'FL', name: 'FL', positionName: 'Переднє ліве (Рульова вісь тягача)', pressure: 8.5, temperature: 45, treadWear: 75, lastReplacement: '15.06.2025', mileageSinceReplacement: 45000, status: 'ok' },
    { id: 'FR', name: 'FR', positionName: 'Переднє праве (Рульова вісь тягача)', pressure: 8.4, temperature: 46, treadWear: 72, lastReplacement: '15.06.2025', mileageSinceReplacement: 45000, status: 'ok' },
    { id: 'RL', name: 'RL', positionName: 'Заднє ліве (Ведуча вісь тягача)', pressure: 8.6, temperature: 52, treadWear: 55, lastReplacement: '10.11.2024', mileageSinceReplacement: 95000, status: 'ok' },
    { id: 'RR', name: 'RR', positionName: 'Заднє праве (Ведуча вісь тягача)', pressure: 8.6, temperature: 53, treadWear: 53, lastReplacement: '10.11.2024', mileageSinceReplacement: 95000, status: 'ok' },
    { id: 'T1L', name: 'T1L', positionName: 'Перше ліве (1-ша вісь причепа)', pressure: 8.5, temperature: 40, treadWear: 68, lastReplacement: '20.01.2025', mileageSinceReplacement: 62000, status: 'ok' },
    { id: 'T1R', name: 'T1R', positionName: 'Перше праве (1-ша вісь причепа)', pressure: 4.8, temperature: 85, treadWear: 12, lastReplacement: '14.05.2023', mileageSinceReplacement: 165000, status: 'damaged' }, // Damaged tire
    { id: 'T2L', name: 'T2L', positionName: 'Друге ліве (2-га вісь причепа)', pressure: 8.7, temperature: 42, treadWear: 64, lastReplacement: '20.01.2025', mileageSinceReplacement: 62000, status: 'ok' },
    { id: 'T2R', name: 'T2R', positionName: 'Друге праве (2-га вісь причепа)', pressure: 8.6, temperature: 41, treadWear: 62, lastReplacement: '20.01.2025', mileageSinceReplacement: 62000, status: 'ok' },
    { id: 'T3L', name: 'T3L', positionName: 'Третє ліве (3-тя вісь причепа)', pressure: 8.4, temperature: 44, treadWear: 42, lastReplacement: '12.04.2024', mileageSinceReplacement: 122000, status: 'warning' }, // Warning tire
    { id: 'T3R', name: 'T3R', positionName: 'Третє праве (3-тя вісь причепа)', pressure: 8.5, temperature: 43, treadWear: 40, lastReplacement: '12.04.2024', mileageSinceReplacement: 122000, status: 'warning' }, // Warning tire
  ],
  'scania-reefer-warning': [
    { id: 'FL', name: 'FL', positionName: 'Переднє ліве (Рульова вісь тягача)', pressure: 8.6, temperature: 38, treadWear: 88, lastReplacement: '10.09.2025', mileageSinceReplacement: 12000, status: 'ok' },
    { id: 'FR', name: 'FR', positionName: 'Переднє праве (Рульова вісь тягача)', pressure: 8.6, temperature: 39, treadWear: 86, lastReplacement: '10.09.2025', mileageSinceReplacement: 12000, status: 'ok' },
    { id: 'RL', name: 'RL', positionName: 'Заднє ліве (Ведуча вісь тягача)', pressure: 8.5, temperature: 42, treadWear: 70, lastReplacement: '01.03.2025', mileageSinceReplacement: 52000, status: 'ok' },
    { id: 'RR', name: 'RR', positionName: 'Заднє праве (Ведуча вісь тягача)', pressure: 8.5, temperature: 43, treadWear: 68, lastReplacement: '01.03.2025', mileageSinceReplacement: 52000, status: 'ok' },
    { id: 'T1L', name: 'T1L', positionName: 'Перше ліве (1-ша вісь причепа)', pressure: 8.4, temperature: 36, treadWear: 74, lastReplacement: '15.05.2025', mileageSinceReplacement: 38000, status: 'ok' },
    { id: 'T1R', name: 'T1R', positionName: 'Перше праве (1-ша вісь причепа)', pressure: 8.4, temperature: 37, treadWear: 72, lastReplacement: '15.05.2025', mileageSinceReplacement: 38000, status: 'ok' },
    { id: 'T2L', name: 'T2L', positionName: 'Друге ліве (2-га вісь причепа)', pressure: 8.5, temperature: 38, treadWear: 35, lastReplacement: '18.02.2024', mileageSinceReplacement: 128000, status: 'warning' },
    { id: 'T2R', name: 'T2R', positionName: 'Друге праве (2-га вісь причепа)', pressure: 8.5, temperature: 38, treadWear: 33, lastReplacement: '18.02.2024', mileageSinceReplacement: 128000, status: 'warning' },
    { id: 'T3L', name: 'T3L', positionName: 'Третє ліве (3-тя вісь причепа)', pressure: 8.6, temperature: 36, treadWear: 76, lastReplacement: '15.05.2025', mileageSinceReplacement: 38000, status: 'ok' },
    { id: 'T3R', name: 'T3R', positionName: 'Третє праве (3-тя вісь причепа)', pressure: 8.6, temperature: 35, treadWear: 75, lastReplacement: '15.05.2025', mileageSinceReplacement: 38000, status: 'ok' },
  ],
  'daf-reefer-ok': [
    { id: 'FL', name: 'FL', positionName: 'Переднє ліве (Рульова вісь тягача)', pressure: 8.6, temperature: 34, treadWear: 95, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'FR', name: 'FR', positionName: 'Переднє праве (Рульова вісь тягача)', pressure: 8.6, temperature: 35, treadWear: 94, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'RL', name: 'RL', positionName: 'Заднє ліве (Ведуча вісь тягача)', pressure: 8.5, temperature: 38, treadWear: 90, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'RR', name: 'RR', positionName: 'Заднє праве (Ведуча вісь тягача)', pressure: 8.5, temperature: 37, treadWear: 89, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'T1L', name: 'T1L', positionName: 'Перше ліве (1-ша вісь причепа)', pressure: 8.6, temperature: 34, treadWear: 92, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'T1R', name: 'T1R', positionName: 'Перше праве (1-ша вісь причепа)', pressure: 8.6, temperature: 34, treadWear: 92, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'T2L', name: 'T2L', positionName: 'Друге ліве (2-га вісь причепа)', pressure: 8.5, temperature: 35, treadWear: 91, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'T2R', name: 'T2R', positionName: 'Друге праве (2-га вісь причепа)', pressure: 8.5, temperature: 35, treadWear: 91, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'T3L', name: 'T3L', positionName: 'Третє ліве (3-тя вісь причепа)', pressure: 8.6, temperature: 33, treadWear: 92, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'T3R', name: 'T3R', positionName: 'Третє праве (3-тя вісь причепа)', pressure: 8.6, temperature: 33, treadWear: 92, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
  ],
  'man-reefer-mixed': [
    { id: 'FL', name: 'FL', positionName: 'Переднє ліве (Рульова вісь тягача)', pressure: 8.5, temperature: 40, treadWear: 82, lastReplacement: '12.05.2025', mileageSinceReplacement: 24000, status: 'ok' },
    { id: 'FR', name: 'FR', positionName: 'Переднє праве (Рульова вісь тягача)', pressure: 8.5, temperature: 40, treadWear: 80, lastReplacement: '12.05.2025', mileageSinceReplacement: 24000, status: 'ok' },
    { id: 'RL', name: 'RL', positionName: 'Заднє ліве (Ведуча вісь тягача)', pressure: 8.6, temperature: 44, treadWear: 62, lastReplacement: '18.10.2024', mileageSinceReplacement: 68000, status: 'ok' },
    { id: 'RR', name: 'RR', positionName: 'Заднє праве (Ведуча вісь тягача)', pressure: 8.6, temperature: 45, treadWear: 60, lastReplacement: '18.10.2024', mileageSinceReplacement: 68000, status: 'ok' },
    { id: 'T1L', name: 'T1L', positionName: 'Перше ліве (1-ша вісь причепа)', pressure: 8.5, temperature: 38, treadWear: 72, lastReplacement: '10.03.2025', mileageSinceReplacement: 42000, status: 'ok' },
    { id: 'T1R', name: 'T1R', positionName: 'Перше праве (1-ша вісь причепа)', pressure: 8.4, temperature: 37, treadWear: 70, lastReplacement: '10.03.2025', mileageSinceReplacement: 42000, status: 'ok' },
    { id: 'T2L', name: 'T2L', positionName: 'Друге ліве (2-га вісь причепа)', pressure: 8.5, temperature: 39, treadWear: 42, lastReplacement: '05.08.2024', mileageSinceReplacement: 84000, status: 'warning' },
    { id: 'T2R', name: 'T2R', positionName: 'Друге праве (2-га вісь причепа)', pressure: 8.5, temperature: 38, treadWear: 40, lastReplacement: '05.08.2024', mileageSinceReplacement: 84000, status: 'warning' },
    { id: 'T3L', name: 'T3L', positionName: 'Третє ліве (3-тя вісь причепа)', pressure: 8.6, temperature: 37, treadWear: 75, lastReplacement: '10.03.2025', mileageSinceReplacement: 42000, status: 'ok' },
    { id: 'T3R', name: 'T3R', positionName: 'Третє праве (3-тя вісь причепа)', pressure: 8.6, temperature: 37, treadWear: 73, lastReplacement: '10.03.2025', mileageSinceReplacement: 42000, status: 'ok' },
  ],
};

interface WheelInfo {
  id: string;
  name: string;
  positionName: string;
  pressure: number;
  temperature: number;
  treadWear: number;
  lastReplacement: string;
  mileageSinceReplacement: number;
  status: 'ok' | 'warning' | 'damaged';
}

const mockVehicles = [
  {
    id: 'volvo-reefer-damaged',
    name: 'Volvo FH16 Globetrotter Reefer',
    plate: 'CE 7749 BE',
    type: 'Рефрижератор',
    status: 'damaged',
    driver: 'Олександр Шевченко',
    phone: '+380 50 123 45 67',
    mileage: '342,150 км',
    fuelConsumption: '28.5 л/100км',
    activeRoute: 'Чернівці (База) - Львів (Склад №4)',
    temperatureSet: '-18°C',
    temperatureCurrent: '-4°C',
    activeFaultIds: [
      'reefer_engine_failure',
      'reefer_belt_snapped',
      'compressor_failure',
      'freon_leak',
      'condenser_fan_broken',
      'evaporator_fan_broken',
      'reefer_fuel_tank_leak',
      'door_seal_damage',
      'tire_blowout',
      'air_bag_puncture',
      'brake_air_line_leak',
      'wheel_bearing_overheat',
      'engine_overheat',
      'engine_oil_leak',
      'turbo_failure',
      'gladhand_leak',
      'tail_light_broken'
    ],
  },
  {
    id: 'scania-reefer-warning',
    name: 'Scania S580 Highline Reefer',
    plate: 'CE 2200 OK',
    type: 'Рефрижератор',
    status: 'warning',
    driver: 'Микола Козак',
    phone: '+380 67 987 65 43',
    mileage: '189,420 км',
    fuelConsumption: '31.2 л/100км',
    activeRoute: 'Тернопіль (Склад №2) - Чернівці',
    temperatureSet: '-20°C',
    temperatureCurrent: '-16°C',
    activeFaultIds: [
      'reefer_starter_fault',
      'reefer_alternator_fault',
      'reefer_battery_dead',
      'evaporator_icing',
      'temp_sensor_fault',
      'door_latch_broken',
      'wall_panel_damage',
      'roof_leak',
      'air_chute_detached',
      'drain_hole_clogged',
      'floor_damage',
      'tire_wear_uneven',
      'brake_pad_wear',
      'landing_gear_broken',
      'kingpin_damage',
      'main_battery_dead',
      'truck_alternator_fault',
      'air_compressor_failure',
      'seven_way_cable_damage',
      'dpf_clogged',
      'egr_valve_fault',
      'def_adblue_leak',
      'side_marker_fault',
      'abs_sensor_fault',
      'tpms_sensor_fault'
    ],
  },
  {
    id: 'daf-reefer-ok',
    name: 'DAF XF 530 Super Space Reefer',
    plate: 'CE 0555 ВВ',
    type: 'Рефрижератор',
    status: 'ok',
    driver: 'Віталій Петренко',
    phone: '+380 99 444 33 22',
    mileage: '412,800 км',
    fuelConsumption: '29.0 л/100км',
    activeRoute: 'Київ (Логістичний центр) - Чернівці',
    temperatureSet: '-18°C',
    temperatureCurrent: '-18°C',
    activeFaultIds: [],
  },
  {
    id: 'man-reefer-mixed',
    name: 'MAN TGX 18.510 Lion\'s Reefer',
    plate: 'CE 9911 KM',
    type: 'Рефрижератор',
    status: 'warning',
    driver: 'Дмитро Коваленко',
    phone: '+380 63 555 11 22',
    mileage: '224,100 км',
    fuelConsumption: '27.4 л/100км',
    activeRoute: 'Одеса (Порт) - Чернівці',
    temperatureSet: '-22°C',
    temperatureCurrent: '-19°C',
    activeFaultIds: [
      'evaporator_icing',
      'reefer_fuel_filter_clogged',
      'wall_panel_damage',
      'brake_pad_wear',
      'dpf_clogged',
      'air_chute_detached',
      'driveshaft_issue',
      'egr_valve_fault',
      'abs_sensor_fault',
      'tpms_sensor_fault'
    ],
  }
];

export default function FleetPage() {
  const router = useRouter();
  const { authenticated } = useAuthGuard();
  const { theme, toggleTheme } = useTheme();
  const [selectedVehicle, setSelectedVehicle] = useState(mockVehicles[0]);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [selectedSubFault, setSelectedSubFault] = useState<string | null>(null);

  // Real-time wheel database state
  const [wheelsState, setWheelsState] = useState<Record<string, WheelInfo[]>>(initialWheelsData);
  const [selectedWheelId, setSelectedWheelId] = useState<string | null>(null);

  // Track expanded category IDs in the accordion layout
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    reefer_unit: true,
    trailer_body: false,
    trailer_chassis: false,
    truck_tractor: false,
    optics_equipment: false,
  });

  const handleLogout = () => {
    signOut();
    router.push('/login');
  };

  const handlePartClick = (partKey: string) => {
    setSelectedPart((prev) => (prev === partKey ? null : partKey));
    setSelectedSubFault(null);
    setSelectedWheelId(null);
    
    const matchCat = diagnosticCategories.find(c => c.system === partKey);
    if (matchCat) {
      setExpandedCategories(prev => ({
        ...prev,
        [matchCat.id]: true
      }));
    }
  };

  const handleSubFaultClick = (subFaultId: string | null, systemKey: string) => {
    setSelectedSubFault(subFaultId);
    setSelectedPart(systemKey);
    setSelectedWheelId(null);
  };

  const toggleCategoryAccordion = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  // Get active wheels list for the selected vehicle
  const currentVehicleWheels = useMemo(() => {
    return wheelsState[selectedVehicle.id] || [];
  }, [wheelsState, selectedVehicle.id]);

  // Find currently selected wheel info
  const selectedWheel = useMemo(() => {
    if (!selectedWheelId) return null;
    return currentVehicleWheels.find(w => w.id === selectedWheelId) || null;
  }, [selectedWheelId, currentVehicleWheels]);

  // Handler when clicking a wheel in the 2D schematic diagram
  const handleWheelSelect = (wheelId: string) => {
    setSelectedWheelId(wheelId);
    setSelectedPart('wheels');
    // Zoom camera directly to the clicked wheel
    setSelectedSubFault(`wheel_${wheelId}`);
  };

  // Handler to register replacement of a specific wheel
  const handleReplaceWheel = (wheelId: string) => {
    // 1. Update wheels state properties
    const todayStr = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const updatedWheels = currentVehicleWheels.map((w) => {
      if (w.id === wheelId) {
        return {
          ...w,
          pressure: 8.5,
          temperature: 35,
          treadWear: 100,
          mileageSinceReplacement: 0,
          lastReplacement: todayStr,
          status: 'ok' as const,
        };
      }
      return w;
    });

    setWheelsState(prev => ({
      ...prev,
      [selectedVehicle.id]: updatedWheels
    }));

    // 2. Clear faults from vehicle activeFaultIds dynamically
    const dynamicFaultIds = [...selectedVehicle.activeFaultIds];
    
    if (wheelId === 'T1R') {
      const idxTire = dynamicFaultIds.indexOf('tire_blowout');
      if (idxTire !== -1) dynamicFaultIds.splice(idxTire, 1);
      
      const idxBrg = dynamicFaultIds.indexOf('wheel_bearing_overheat');
      if (idxBrg !== -1) dynamicFaultIds.splice(idxBrg, 1);
    }
    
    // Check if there are any warning wheels left on the vehicle
    const remainingWarnings = updatedWheels.filter(w => w.status === 'warning');
    if (remainingWarnings.length === 0) {
      const idxWear = dynamicFaultIds.indexOf('tire_wear_uneven');
      if (idxWear !== -1) dynamicFaultIds.splice(idxWear, 1);

      const idxBrake = dynamicFaultIds.indexOf('brake_pad_wear');
      if (idxBrake !== -1) dynamicFaultIds.splice(idxBrake, 1);
    }

    const remainingDamaged = updatedWheels.filter(w => w.status === 'damaged');
    if (remainingDamaged.length === 0) {
      const idxBlow = dynamicFaultIds.indexOf('tire_blowout');
      if (idxBlow !== -1) dynamicFaultIds.splice(idxBlow, 1);
    }

    // Update selected vehicle properties in memory
    const updatedVehicle = {
      ...selectedVehicle,
      activeFaultIds: dynamicFaultIds,
      status: dynamicFaultIds.includes('reefer_engine_failure') || dynamicFaultIds.includes('compressor_failure') || dynamicFaultIds.includes('freon_leak') || remainingDamaged.length > 0 ? 'damaged' as const : dynamicFaultIds.length > 0 || remainingWarnings.length > 0 ? 'warning' as const : 'ok' as const
    };

    setSelectedVehicle(updatedVehicle);
    
    // Update the master mockVehicles array entry so state is preserved when switching back and forth
    const idxInMock = mockVehicles.findIndex(v => v.id === selectedVehicle.id);
    if (idxInMock !== -1) {
      mockVehicles[idxInMock] = updatedVehicle;
    }
  };

  // Compute 3D model part glow statuses dynamically based on selected vehicle's activeFaultIds and wheels
  const partStatuses = useMemo(() => {
    const statuses: Record<string, 'ok' | 'warning' | 'damaged'> = {
      refrigerator: 'ok',
      cabin: 'ok',
      wheels: 'ok',
      engine: 'ok',
      lights: 'ok',
    };

    // Evaluate active faults
    selectedVehicle.activeFaultIds.forEach((faultId) => {
      diagnosticCategories.forEach((cat) => {
        cat.groups.forEach((g) => {
          const item = g.items.find(i => i.id === faultId);
          if (item) {
            const current = statuses[cat.system];
            if (item.status === 'damaged') {
              statuses[cat.system] = 'damaged';
            } else if (item.status === 'warning' && current !== 'damaged') {
              statuses[cat.system] = 'warning';
            }
          }
        });
      });
    });

    // Evaluate wheels statuses
    currentVehicleWheels.forEach((wheel) => {
      const current = statuses.wheels;
      if (wheel.status === 'damaged') {
        statuses.wheels = 'damaged';
      } else if (wheel.status === 'warning' && current !== 'damaged') {
        statuses.wheels = 'warning';
      }
    });

    return statuses;
  }, [selectedVehicle, currentVehicleWheels]);

  // Find currently active sub-fault details to display recommendations
  const activeSubFaultData = useMemo(() => {
    if (!selectedSubFault) return null;
    for (const cat of diagnosticCategories) {
      for (const group of cat.groups) {
        const match = group.items.find(item => item.id === selectedSubFault);
        if (match) return match;
      }
    }
    return null;
  }, [selectedSubFault]);

  // Helper to get CSS classes for wheel status representation
  const getWheelColorClass = (wheelId: string) => {
    const wheel = currentVehicleWheels.find(w => w.id === wheelId);
    const isSelected = selectedWheelId === wheelId;
    const ringStyle = isSelected ? 'ring-2 ring-white scale-110 shadow-apple-sm' : 'hover:scale-105';
    
    if (!wheel) return `bg-surface-hover border-bdr-subtle ${ringStyle}`;
    if (wheel.status === 'damaged') return `bg-danger hover:bg-danger border-danger/30 animate-pulse ${ringStyle}`;
    if (wheel.status === 'warning') return `bg-warn hover:bg-warn border-warn/30 ${ringStyle}`;
    return `bg-accent hover:bg-accent border-bdr-highlight ${ringStyle}`;
  };

  if (!authenticated) return <AuthGate />;

  return (
    <div className="flex min-h-screen w-full bg-page overflow-hidden text-txt-secondary">
      <Sidebar />

      <main className="flex-1 min-w-0 h-screen overflow-y-auto">
        
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-bdr-subtle bg-glass px-4 py-3 backdrop-blur-chrome sm:px-6">
          <div className="min-w-0 flex-1 pl-12 lg:pl-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-txt-primary sm:text-lg">
              Моніторинг та інспекція автопарку
            </h1>
            <p className="mt-0.5 truncate text-2xs text-txt-muted">
              Інтерактивний 3D-контроль технічного стану · демонстраційні дані
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="btn-icon"
              title={theme === 'dark' ? 'Світла тема' : 'Темна тема'}
              aria-label={theme === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={handleLogout}
              className="btn-icon hover:text-danger"
              title="Вийти з системи"
              aria-label="Вийти з системи"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* 3-Column Interactive Layout */}
        <div className="px-3 sm:px-5 lg:px-8 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
            
            {/* ══════════════════════════════════════════
                КОЛОНКА 1 (lg:col-span-3) — Список транспорту
            ══════════════════════════════════════════ */}
            <div className="lg:col-span-3 space-y-4">
              <div className="glass-card rounded-card overflow-hidden border border-bdr-subtle">
                <div className="flex items-center justify-between px-4 py-3 border-b border-bdr-subtle bg-surface-inset">
                  <h3 className="font-semibold text-xs text-txt-secondary tracking-wider uppercase flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-accent" /> Рефрижератори
                  </h3>
                  <span className="bg-surface-inset border border-bdr-subtle text-[9px] px-2 py-0.5 rounded-full font-bold text-txt-secondary">
                    {mockVehicles.length} од.
                  </span>
                </div>
                
                <div className="p-3 space-y-2.5 max-h-[480px] overflow-y-auto">
                  {mockVehicles.map((vehicle) => {
                    const isSelected = selectedVehicle.id === vehicle.id;
                    
                    // Count issues
                    const wheels = wheelsState[vehicle.id] || [];
                    const activeTireIssues = wheels.filter(w => w.status !== 'ok').length;
                    const totalFaultsCount = vehicle.activeFaultIds.length + activeTireIssues;

                    return (
                      <div
                        key={vehicle.id}
                        onClick={() => {
                          setSelectedVehicle(vehicle);
                          setSelectedPart(null);
                          setSelectedSubFault(null);
                          setSelectedWheelId(null);
                        }}
                        className={`p-3.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                          isSelected
                            ? 'bg-accent/10 border-bdr-highlight shadow-md shadow-okko-green/5'
                            : 'bg-surface-inset border-bdr-subtle hover:border-bdr-strong hover:bg-surface-hover'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs text-txt-primary">{vehicle.plate}</span>
                              <span className="bg-surface-inset border border-bdr-subtle text-[8px] text-txt-secondary font-bold px-1.5 py-0.5 rounded">
                                {vehicle.type}
                              </span>
                            </div>
                            <h4 className="text-[10px] text-txt-secondary font-semibold mt-1 truncate">{vehicle.name}</h4>
                          </div>
                          <span className="flex-shrink-0 ml-2">
                            {vehicle.status === 'damaged' || totalFaultsCount > 10 ? (
                              <XCircle className="w-4 h-4 text-okko-red animate-pulse" />
                            ) : totalFaultsCount > 0 ? (
                              <AlertTriangle className="w-4 h-4 text-okko-accent" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-accent" />
                            )}
                          </span>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-bdr-subtle flex items-center justify-between text-[9px] text-txt-secondary font-semibold gap-2">
                          <span className="flex items-center gap-1 min-w-0 truncate">
                            <User className="w-2.5 h-2.5 text-txt-muted flex-shrink-0" /> {vehicle.driver}
                          </span>
                          <span className="flex items-center gap-1 font-mono flex-shrink-0">
                            <Gauge className="w-2.5 h-2.5 text-txt-muted" /> {vehicle.mileage}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Стан автопарку */}
              <div className="glass-card p-4 rounded-card border border-bdr-subtle">
                <h4 className="font-bold text-[10px] text-txt-secondary tracking-wider uppercase mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-accent" /> Експрес-статус рефів
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-txt-secondary">Активні рефрижератори:</span>
                    <span className="text-txt-primary font-bold">{mockVehicles.length}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-txt-secondary">Справний стан (OK):</span>
                    <span className="text-accent font-bold">1</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-txt-secondary">Часткові попередження:</span>
                    <span className="text-okko-accent font-bold">2</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-txt-secondary">Критична аварія:</span>
                    <span className="text-okko-red font-bold">1</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════
                КОЛОНКА 2 (lg:col-span-4) — Список проблем чи все ок
            ══════════════════════════════════════════ */}
            <div className="lg:col-span-4 space-y-4">
              <div className="glass-card p-4 sm:p-5 rounded-card border border-bdr-subtle">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-bdr-subtle">
                  <h3 className="font-semibold text-xs text-txt-secondary tracking-wider uppercase flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-accent" /> Карта несправностей
                  </h3>
                  <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-accent" /> OBD-II
                  </span>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {selectedVehicle.activeFaultIds.length > 0 || currentVehicleWheels.some(w => w.status !== 'ok') ? (
                    diagnosticCategories.map((cat) => {
                      const isExpanded = expandedCategories[cat.id];
                      
                      // Count active faults in this category
                      const activeInCat = cat.groups.flatMap(g => g.items).filter(i => selectedVehicle.activeFaultIds.includes(i.id));
                      const activeTiresInCat = cat.id === 'trailer_chassis' ? currentVehicleWheels.filter(w => w.status !== 'ok').length : 0;
                      const totalActive = activeInCat.length + activeTiresInCat;
                      
                      if (totalActive === 0) return null;

                      return (
                        <div key={cat.id} className="border border-bdr-subtle rounded-xl overflow-hidden bg-surface-inset">
                          {/* Accordion Header */}
                          <button
                            onClick={() => toggleCategoryAccordion(cat.id)}
                            className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-inset hover:bg-surface-inset transition-colors text-left"
                          >
                            <span className="text-[11px] font-semibold text-txt-primary tracking-wide uppercase flex items-center gap-2">
                              {cat.title}
                              <span className="bg-danger/20 text-okko-red text-[9px] px-1.5 py-0.5 rounded font-semibold">
                                {totalActive}
                              </span>
                            </span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-txt-secondary" /> : <ChevronDown className="w-3.5 h-3.5 text-txt-secondary" />}
                          </button>

                          {/* Accordion Content */}
                          {isExpanded && (
                            <div className="p-2.5 space-y-3.5 bg-surface-inset border-t border-bdr-subtle fade-in">
                              
                              {/* ══════════════════════════════════════════
                                  HIGH FIDELITY INTERACTIVE WHEEL SCHEMATIC
                              ══════════════════════════════════════════ */}
                              {cat.id === 'trailer_chassis' && (
                                <div className="p-1 space-y-2 border-b border-bdr-subtle pb-3">
                                  <span className="text-[9px] text-accent font-semibold uppercase tracking-widest block mb-2">
                                    Інтерактивна схема коліс
                                  </span>
                                  
                                  <div className="grid grid-cols-12 gap-3 items-center bg-surface-inset p-2 rounded-lg border border-bdr-subtle">
                                    {/* Visual Schematic Layout - Absolute Positioning over Vector Truck outline */}
                                    <div className="col-span-6 flex items-center justify-center py-2 pr-1 border-r border-bdr-subtle">
                                      <div className="relative w-[120px] h-[280px] flex-shrink-0 select-none bg-surface-inset rounded-xl border border-bdr-subtle p-2">
                                        
                                        {/* SVG top-down truck blueprint outline */}
                                        <svg className="absolute inset-0 w-full h-full text-bdr-strong pointer-events-none" viewBox="0 0 120 280" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          {/* Tractor Cab Contour (Narrower steer front) */}
                                          <path d="M22 15 C22 10, 98 10, 98 15 L94 55 C94 58, 26 58, 26 55 Z" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3"/>
                                          {/* Kingpin / Fifth Wheel hitch circle */}
                                          <circle cx="60" cy="98" r="8" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
                                          {/* Connection lines */}
                                          <line x1="60" y1="55" x2="60" y2="90" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                                          
                                          {/* Trailer Chassis Frame (Wider box - x from 8 to 112) */}
                                          <rect x="8" y="75" width="104" height="195" rx="6" stroke="currentColor" strokeWidth="1.5" />
                                          
                                          {/* Reefer Cooling unit mounted on front wall of trailer */}
                                          <rect x="35" y="65" width="50" height="10" rx="2" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1" />
                                        </svg>

                                        {/* Front Steer Axle (Steer tires inside cab width boundary) */}
                                        <button 
                                          onClick={() => handleWheelSelect('FL')}
                                          style={{ left: '10px', top: '22px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('FL')}`}
                                          title="Переднє ліве (Рульове)"
                                        />
                                        <button 
                                          onClick={() => handleWheelSelect('FR')}
                                          style={{ right: '10px', top: '22px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('FR')}`}
                                          title="Переднє праве (Рульове)"
                                        />

                                        {/* Tractor Rear Drive Axle (Twin/Dual tires on each side) */}
                                        {/* RL Duals */}
                                        <button 
                                          onClick={() => handleWheelSelect('RL')}
                                          style={{ left: '8px', top: '88px', width: '7px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('RL')}`}
                                          title="Заднє ліве зовнішнє (Ведуче)"
                                        />
                                        <button 
                                          onClick={() => handleWheelSelect('RL')}
                                          style={{ left: '17px', top: '88px', width: '7px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('RL')}`}
                                          title="Заднє ліве внутрішнє (Ведуче)"
                                        />

                                        {/* RR Duals */}
                                        <button 
                                          onClick={() => handleWheelSelect('RR')}
                                          style={{ right: '17px', top: '88px', width: '7px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('RR')}`}
                                          title="Заднє праве внутрішнє (Ведуче)"
                                        />
                                        <button 
                                          onClick={() => handleWheelSelect('RR')}
                                          style={{ right: '8px', top: '88px', width: '7px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('RR')}`}
                                          title="Заднє праве зовнішнє (Ведуче)"
                                        />

                                        {/* Trailer Axle 1 (Sticks out at the very edge of the trailer box width) */}
                                        <button 
                                          onClick={() => handleWheelSelect('T1L')}
                                          style={{ left: '2px', top: '165px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('T1L')}`}
                                          title="Причіп 1 Ліве"
                                        />
                                        <button 
                                          onClick={() => handleWheelSelect('T1R')}
                                          style={{ right: '2px', top: '165px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('T1R')}`}
                                          title="Причіп 1 Праве"
                                        />

                                        {/* Trailer Axle 2 */}
                                        <button 
                                          onClick={() => handleWheelSelect('T2L')}
                                          style={{ left: '2px', top: '195px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('T2L')}`}
                                          title="Причіп 2 Ліве"
                                        />
                                        <button 
                                          onClick={() => handleWheelSelect('T2R')}
                                          style={{ right: '2px', top: '195px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('T2R')}`}
                                          title="Причіп 2 Праве"
                                        />

                                        {/* Trailer Axle 3 */}
                                        <button 
                                          onClick={() => handleWheelSelect('T3L')}
                                          style={{ left: '2px', top: '225px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('T3L')}`}
                                          title="Причіп 3 Ліве"
                                        />
                                        <button 
                                          onClick={() => handleWheelSelect('T3R')}
                                          style={{ right: '2px', top: '225px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('T3R')}`}
                                          title="Причіп 3 Праве"
                                        />
                                      </div>
                                    </div>

                                    {/* Selected Wheel Details panel */}
                                    <div className="col-span-6 text-left space-y-1.5 min-h-[140px] flex flex-col justify-center">
                                      {selectedWheel ? (
                                        <div className="space-y-1.5 fade-in">
                                          <div className="flex items-center justify-between">
                                            <span className="font-semibold text-[10px] text-txt-primary">
                                              Колесо {selectedWheel.id}
                                            </span>
                                            <span className={`text-[7px] font-semibold px-1 py-0.5 rounded-full uppercase ${
                                              selectedWheel.status === 'damaged' ? 'bg-danger/10 text-okko-red border border-okko-red/25 animate-pulse' :
                                              selectedWheel.status === 'warning' ? 'bg-warn/10 text-okko-accent border border-okko-accent/25' :
                                              'bg-accent/10 text-accent border border-bdr-highlight'
                                            }`}>
                                              {selectedWheel.status === 'damaged' ? 'Аварія' : selectedWheel.status === 'warning' ? 'Знос' : 'Норма'}
                                            </span>
                                          </div>
                                          <p className="text-[8px] text-txt-secondary font-semibold leading-tight">{selectedWheel.positionName}</p>
                                          
                                          <div className="grid grid-cols-2 gap-1 text-[9px]">
                                            <div className="bg-surface-inset p-1 rounded border border-bdr-subtle">
                                              <span className="text-txt-muted block text-[7px] font-bold">ТИСК</span>
                                              <span className={`font-mono font-bold ${selectedWheel.pressure < 6.0 ? 'text-okko-red animate-pulse' : 'text-txt-primary'}`}>{selectedWheel.pressure} бар</span>
                                            </div>
                                            <div className="bg-surface-inset p-1 rounded border border-bdr-subtle">
                                              <span className="text-txt-muted block text-[7px] font-bold">ТЕМП.</span>
                                              <span className={`font-mono font-bold ${selectedWheel.temperature > 70 ? 'text-okko-red' : 'text-txt-primary'}`}>{selectedWheel.temperature}°C</span>
                                            </div>
                                            <div className="bg-surface-inset p-1 rounded border border-bdr-subtle">
                                              <span className="text-txt-muted block text-[7px] font-bold">ПРОТЕКТОР</span>
                                              <span className={`font-mono font-bold ${selectedWheel.treadWear < 20 ? 'text-okko-red' : selectedWheel.treadWear < 45 ? 'text-okko-accent' : 'text-txt-primary'}`}>{selectedWheel.treadWear}% залишок</span>
                                            </div>
                                            <div className="bg-surface-inset p-1 rounded border border-bdr-subtle">
                                              <span className="text-txt-muted block text-[7px] font-bold">ПРОБІГ ШИНИ</span>
                                              <span className="font-mono font-bold text-txt-primary">{selectedWheel.mileageSinceReplacement.toLocaleString()} км</span>
                                            </div>
                                          </div>
                                          
                                          <div className="pt-1.5 text-[8px] text-txt-secondary flex flex-wrap items-center justify-between gap-1 border-t border-bdr-subtle">
                                            <span>Заміна: {selectedWheel.lastReplacement}</span>
                                            {selectedWheel.status !== 'ok' && (
                                              <button
                                                onClick={() => handleReplaceWheel(selectedWheel.id)}
                                                className="px-2 py-0.5 rounded bg-accent/20 hover:bg-accent text-[8px] font-semibold uppercase text-accent hover:text-txt-primary border border-bdr-highlight hover:border-bdr-highlight transition-all active:scale-95"
                                              >
                                                Замінити
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-center py-6 text-txt-muted text-[9px] font-semibold flex flex-col items-center gap-1">
                                          <Info className="w-4 h-4 text-txt-muted" />
                                          <span>Оберіть шину на схемі для діагностики</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {cat.groups.map((group, groupIdx) => {
                                const activeInGroup = group.items.filter(i => selectedVehicle.activeFaultIds.includes(i.id));
                                if (activeInGroup.length === 0) return null;

                                return (
                                  <div key={groupIdx} className="space-y-1.5">
                                    <span className="text-[9px] text-txt-muted font-semibold uppercase tracking-wider block ml-1">
                                      {group.subTitle}
                                    </span>
                                    <div className="space-y-1.5">
                                      {activeInGroup.map((item) => {
                                        const isSelected = selectedSubFault === item.id;
                                        return (
                                          <div
                                            key={item.id}
                                            onClick={() => handleSubFaultClick(item.id, cat.system)}
                                            className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                              isSelected
                                                ? 'bg-danger/10 border-danger/30 shadow-md ring-1 ring-red-500/30'
                                                : 'bg-surface-inset border-bdr-subtle hover:border-bdr-strong hover:bg-surface-inset'
                                            }`}
                                          >
                                            <div className="flex items-start justify-between gap-1 mb-1">
                                              <span className="font-semibold text-[11px] text-txt-primary flex items-center gap-1.5 leading-tight">
                                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.status === 'damaged' ? 'bg-danger animate-pulse' : 'bg-warn'}`} />
                                                {item.title}
                                              </span>
                                              <span className="text-[8px] font-mono text-txt-muted font-bold flex-shrink-0">{item.code}</span>
                                            </div>
                                            <p className="text-[10px] text-txt-secondary line-clamp-1">{item.desc}</p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    /* Fully operational state */
                    <div className="p-6 rounded-xl bg-accent/5 border border-bdr-highlight text-center space-y-3.5">
                      <CheckCircle className="w-10 h-10 text-accent mx-auto shadow shadow-okko-green/10" />
                      <div>
                        <h4 className="font-bold text-xs text-txt-primary">Всі системи працюють нормально</h4>
                        <p className="text-[10px] text-txt-secondary mt-1 leading-relaxed">
                          Помилок в блоках OBD-II / CAN-gateway не виявлено. Холодильний контур тримає стабільні -18°C. Тягач готовий до рейсу.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Maintenance recommendation */}
              <div className="glass-card p-4 rounded-card border border-bdr-subtle bg-surface-inset">
                {activeSubFaultData ? (
                  <div className="space-y-3 fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-accent font-semibold uppercase tracking-widest flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" /> Рекомендація з ремонту
                      </span>
                      <span className="text-[9px] font-mono font-bold text-txt-muted">{activeSubFaultData.code}</span>
                    </div>
                    <h4 className="text-txt-primary font-semibold text-xs">{activeSubFaultData.title}</h4>
                    <p className="text-[11px] text-txt-secondary leading-relaxed">{activeSubFaultData.desc}</p>
                    
                    <div className="p-3 rounded-lg bg-danger/5 border-l-4 border-okko-red text-[11px] text-txt-secondary leading-normal">
                      <strong className="text-txt-primary block mb-0.5">Необхідні роботи:</strong>
                      {activeSubFaultData.recommendation}
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <button className="okko-btn px-4 py-2 text-[9px] uppercase font-semibold tracking-wider rounded-lg text-txt-primary active:scale-95 shadow">
                        Створити наряд на СТО
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 text-xs text-txt-secondary justify-center py-3.5 font-semibold">
                    <Info className="w-4 h-4 text-txt-muted" />
                    <span>{selectedVehicle.activeFaultIds.length > 0 ? 'Оберіть несправність зі списку для перегляду рекомендацій' : 'Автомобіль повністю справний'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ══════════════════════════════════════════
                КОЛОНКА 3 (lg:col-span-5) — 3D Модель
            ══════════════════════════════════════════ */}
            <div className="lg:col-span-5 space-y-4">
              <div className="glass-card p-3 sm:p-4 rounded-card w-full border border-bdr-subtle relative">
                
                {/* Title Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
                  <div>
                    <span className="bg-danger/10 text-okko-red border border-okko-red/20 text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full tracking-wider animate-pulse inline-flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" /> 3D-Діагностика {selectedVehicle.type}
                    </span>
                    <h2 className="text-sm sm:text-base font-semibold text-txt-primary mt-1">
                      {selectedVehicle.name} <span className="text-txt-muted font-normal">({selectedVehicle.plate})</span>
                    </h2>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPart(null);
                      setSelectedSubFault(null);
                      setSelectedWheelId(null);
                    }}
                    className={`text-[9px] font-semibold uppercase px-2.5 py-1.5 rounded-lg border transition-all ${
                      selectedPart === null && selectedSubFault === null && selectedWheelId === null
                        ? 'bg-surface-inset border-bdr-subtle text-txt-secondary cursor-default'
                        : 'bg-surface-inset hover:bg-surface-hover border-bdr-subtle text-txt-secondary active:scale-95'
                    }`}
                  >
                    Скинути камеру
                  </button>
                </div>

                {/* 3D Canvas */}
                <ThreeTruckViewer
                  selectedPart={selectedPart}
                  onPartClick={handlePartClick}
                  partStatuses={partStatuses}
                  selectedSubFault={selectedSubFault}
                  activeFaultIds={selectedVehicle.activeFaultIds}
                  onSubFaultClick={(id) => {
                    setSelectedSubFault(id);
                    if (id) {
                      // If it's a wheel target (e.g. wheel_T1R), parse and set selectedWheelId
                      if (id.startsWith('wheel_')) {
                        const wheelId = id.replace('wheel_', '');
                        setSelectedWheelId(wheelId);
                        setExpandedCategories(prev => ({ ...prev, trailer_chassis: true }));
                        setSelectedPart('wheels');
                        return;
                      }

                      for (const cat of diagnosticCategories) {
                        for (const g of cat.groups) {
                          if (g.items.some(item => item.id === id)) {
                            setExpandedCategories(prev => ({
                              ...prev,
                              [cat.id]: true
                            }));
                            setSelectedPart(cat.system);
                            return;
                          }
                        }
                      }
                    }
                  }}
                />

                {/* Help tip */}
                <div className="mt-3 p-3 rounded-xl bg-surface-inset border border-bdr-subtle text-[10px] text-txt-secondary leading-relaxed flex items-start gap-2 fade-in">
                  <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-txt-primary block mb-0.5">Інтерактивна 3D інспекція:</strong>
                    Для огляду коліс знизу або з боків обертайте камеру мишею. Натискайте на колісні пари на 2D-схемі або в 3D для детального аналізу стану шин, тиску та пробігу.
                  </div>
                </div>
              </div>

              {/* Sensors and driver cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Driver */}
                <div className="glass-card p-4 rounded-card border border-bdr-subtle">
                  <h4 className="font-bold text-[10px] text-txt-secondary tracking-wider uppercase mb-3 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-accent" /> Відповідальний водій
                  </h4>
                  <div className="flex items-center gap-3 mb-3.5">
                    <div className="w-10 h-10 rounded-xl bg-surface-inset border border-bdr-subtle flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-accent/75" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-txt-primary truncate">{selectedVehicle.driver}</p>
                      <p className="text-[10px] text-txt-secondary font-semibold">{selectedVehicle.phone}</p>
                    </div>
                  </div>
                  <div className="pt-2.5 border-t border-bdr-subtle text-[10px] text-txt-secondary font-semibold space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-txt-muted">Рейс:</span>
                      <span className="text-txt-primary font-bold truncate max-w-[140px]">{selectedVehicle.activeRoute}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-txt-muted">Час виїзду:</span>
                      <span className="text-txt-primary font-bold">Сьогодні, 06:15</span>
                    </div>
                  </div>
                </div>

                {/* Sensors */}
                <div className="glass-card p-4 rounded-card border border-bdr-subtle">
                  <h4 className="font-bold text-[10px] text-txt-secondary tracking-wider uppercase mb-3 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-accent" /> Датчики рефрижератора
                  </h4>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-surface-inset border border-bdr-subtle p-2 rounded-xl text-center">
                      <span className="text-[8px] text-txt-secondary font-bold block">Цільова темп.</span>
                      <span className="text-txt-primary font-semibold text-xs font-mono">{selectedVehicle.temperatureSet}</span>
                    </div>
                    <div className={`p-2 rounded-xl text-center ${selectedVehicle.status === 'ok' ? 'bg-accent/5 border border-bdr-highlight' : 'bg-danger/5 border border-danger/30'}`}>
                      <span className="text-[8px] font-bold block text-txt-secondary">Поточна темп.</span>
                      <span className={`font-semibold text-xs font-mono ${selectedVehicle.status === 'ok' ? 'text-accent' : 'text-okko-red animate-pulse'}`}>{selectedVehicle.temperatureCurrent}</span>
                    </div>
                  </div>
                  <div className="pt-2.5 border-t border-bdr-subtle text-[10px] text-txt-secondary font-semibold space-y-1">
                    <div className="flex justify-between">
                      <span className="text-txt-muted">Вологість:</span>
                      <span className="text-txt-primary font-bold">54% (Норма)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-txt-muted">Вентилятори:</span>
                      <span className={`font-bold ${selectedVehicle.status === 'ok' ? 'text-accent' : 'text-okko-accent'}`}>{selectedVehicle.status === 'ok' ? 'Стабільно' : '100% потужності'}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}