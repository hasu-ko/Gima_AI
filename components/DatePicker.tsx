'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface DatePickerProps {
  value: string; // Formato 'YYYY-MM-DD'
  onChange: (value: string) => void;
  maxYear?: number; // Límite de año (ej: 2013 para >=13 años)
  onBlur?: () => void;
}

export default function CustomDatePicker({ value, onChange, maxYear = new Date().getFullYear() - 13, onBlur }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Analizar fecha inicial
  const initialDate = value ? new Date(value + 'T00:00:00') : null;
  
  // Estado del calendario interno (mes/año que se está mostrando)
  const [currentYear, setCurrentYear] = useState(initialDate ? initialDate.getFullYear() : maxYear);
  const [currentMonth, setCurrentMonth] = useState(initialDate ? initialDate.getMonth() : new Date().getMonth());
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera del componente
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isOpen && onBlur) {
          onBlur();
        }
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onBlur]);

  // Sincronizar mes/año cuando cambia el valor externo
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setCurrentYear(d.getFullYear());
      setCurrentMonth(d.getMonth());
    }
  }, [value]);

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Rango de años: desde 1950 hasta el año máximo (ej: 13 años atrás)
  const years = Array.from({ length: maxYear - 1949 }, (_, i) => maxYear - i);

  // Días del mes actual
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Primer día de la semana (0 = Domingo, 1 = Lunes, etc.)
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    // Ajustar para que el Lunes sea 0 y el Domingo sea 6
    return day === 0 ? 6 : day - 1;
  };

  const handleSelectDay = (day: number) => {
    // Formatear mes y día con ceros a la izquierda
    const formattedMonth = String(currentMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const selectedDateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;
    onChange(selectedDateStr);
    setIsOpen(false);
    if (onBlur) {
      onBlur();
    }
  };

  const changeMonth = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      if (currentMonth === 11) {
        if (currentYear < maxYear) {
          setCurrentMonth(0);
          setCurrentYear(prev => prev + 1);
        }
      } else {
        setCurrentMonth(prev => prev + 1);
      }
    } else {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(prev => prev - 1);
      } else {
        setCurrentMonth(prev => prev - 1);
      }
    }
  };

  // Generar cuadrícula de días
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);
  
  const dayCells = [];
  
  // Celdas vacías para rellenar hasta el primer día del mes
  for (let i = 0; i < firstDayIndex; i++) {
    dayCells.push(<div key={`empty-${i}`} className="w-8 h-8" />);
  }

  // Celdas de los días reales
  for (let day = 1; day <= daysInMonth; day++) {
    const isSelected = initialDate 
      ? initialDate.getFullYear() === currentYear &&
        initialDate.getMonth() === currentMonth &&
        initialDate.getDate() === day
      : false;

    dayCells.push(
      <button
        key={`day-${day}`}
        type="button"
        onClick={() => handleSelectDay(day)}
        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
          isSelected 
            ? 'bg-gradient-to-r from-accent-violet to-accent-cyan text-white shadow-md shadow-accent-cyan/20 border border-accent-cyan/30'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`}
      >
        {day}
      </button>
    );
  }

  // Formato legible para mostrar en el input de entrada
  const getDisplayValue = () => {
    if (!value) return '';
    const d = new Date(value + 'T00:00:00');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Botón / Input de disparo */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-left text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {getDisplayValue() || <span className="text-slate-500">Seleccionar fecha...</span>}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Calendario Flotante Estilo GIMA */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 p-4 rounded-xl bg-[#0d0d17] border border-slate-800/80 neon-border-violet shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 max-w-[320px] mx-auto md:max-w-none">
          
          {/* Cabecera del Calendario */}
          <div className="flex items-center justify-between mb-4 gap-2">
            
            {/* Selectores de Mes y Año */}
            <div className="flex gap-2">
              
              {/* Select de Meses */}
              <div className="relative">
                <select
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-800 rounded-md py-1 px-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent-cyan cursor-pointer appearance-none pr-6"
                >
                  {meses.map((mes, idx) => (
                    <option key={mes} value={idx}>{mes}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
              </div>

              {/* Select de Años */}
              <div className="relative">
                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-800 rounded-md py-1 px-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent-cyan cursor-pointer appearance-none pr-6"
                >
                  {years.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
              </div>

            </div>

            {/* Controles de navegación de meses */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => changeMonth('prev')}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentYear >= maxYear && currentMonth >= 11}
                onClick={() => changeMonth('next')}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* Días de la semana abreviados */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((day) => (
              <span key={day} className="text-[10px] font-mono text-slate-500 font-bold uppercase">
                {day}
              </span>
            ))}
          </div>

          {/* Cuadrícula de Días */}
          <div className="grid grid-cols-7 gap-1 justify-items-center">
            {dayCells}
          </div>

          {/* Footer del selector */}
          <div className="mt-3 pt-3 border-t border-slate-900 text-center">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
              GIMA Date Selector • Máx: {maxYear}
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
