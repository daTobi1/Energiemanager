import React, { useState } from 'react'
import { ChevronDown, ChevronRight, HelpCircle } from 'lucide-react'

// --- FormField wrapper ---
interface FormFieldProps {
  label: string
  unit?: string
  hint?: string
  info?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, unit, hint, info, children, className = '' }: FormFieldProps) {
  const [showInfo, setShowInfo] = useState(false)
  return (
    <div className={className}>
      <label className="label flex items-center gap-1.5">
        <span>
          {label}
          {unit && <span className="text-dark-faded font-normal ml-1">({unit})</span>}
        </span>
        {info && (
          <span className="relative">
            <HelpCircle
              className="w-3.5 h-3.5 text-dark-faded hover:text-emerald-400 cursor-help transition-colors"
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
            />
            {showInfo && (
              <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-dark-hover border border-dark-border rounded-lg text-xs text-dark-text font-normal whitespace-normal w-56 shadow-lg">
                {info}
              </span>
            )}
          </span>
        )}
      </label>
      {children}
      {hint && <p className="text-xs text-dark-faded mt-1">{hint}</p>}
    </div>
  )
}

// --- Input ---
interface InputFieldProps {
  label: string
  value: string | number
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'date' | 'password'
  unit?: string
  hint?: string
  info?: string
  placeholder?: string
  min?: number
  max?: number
  step?: number | string
  required?: boolean
  className?: string
  disabled?: boolean
}

export function InputField({
  label, value, onChange, type = 'text', unit, hint, info,
  placeholder, min, max, step, required, className = '', disabled,
}: InputFieldProps) {
  return (
    <FormField label={label} unit={unit} hint={hint} info={info} className={className}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        required={required}
        disabled={disabled}
        className="input disabled:opacity-40"
      />
    </FormField>
  )
}

// --- Select ---
interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  unit?: string
  hint?: string
  info?: string
  className?: string
  disabled?: boolean
}

export function SelectField({
  label, value, onChange, options, unit, hint, info, className = '', disabled,
}: SelectFieldProps) {
  return (
    <FormField label={label} unit={unit} hint={hint} info={info} className={className}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="select"
        disabled={disabled}
      >
        <option value="">— Bitte wählen —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FormField>
  )
}

// --- Checkbox ---
interface CheckboxFieldProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
  className?: string
}

export function CheckboxField({ label, checked, onChange, hint, className = '' }: CheckboxFieldProps) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-4 h-4 text-emerald-600 rounded border-dark-border bg-dark-hover focus:ring-emerald-500"
      />
      <div>
        <span className="text-sm font-medium text-dark-muted">{label}</span>
        {hint && <p className="text-xs text-dark-faded mt-0.5">{hint}</p>}
      </div>
    </div>
  )
}

// --- Textarea ---
interface TextareaFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  className?: string
}

export function TextareaField({
  label, value, onChange, rows = 3, placeholder, className = '',
}: TextareaFieldProps) {
  return (
    <FormField label={label} className={className}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="input resize-y"
      />
    </FormField>
  )
}

// --- Collapsible Section ---
interface SectionProps {
  title: string
  icon?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  badge?: string
}

export function Section({ title, icon, defaultOpen = true, children, badge }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-dark-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-dark-hover hover:brightness-110 transition-all"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-dark-muted">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-xs rounded-full font-medium">
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-dark-faded" /> : <ChevronRight className="w-4 h-4 text-dark-faded" />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  )
}
