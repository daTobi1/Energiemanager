import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

// --- FormField wrapper ---
interface FormFieldProps {
  label: string
  unit?: string
  hint?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, unit, hint, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {unit && <span className="text-gray-400 font-normal ml-1">({unit})</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
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
  placeholder?: string
  min?: number
  max?: number
  step?: number | string
  required?: boolean
  className?: string
  disabled?: boolean
}

export function InputField({
  label, value, onChange, type = 'text', unit, hint,
  placeholder, min, max, step, required, className = '', disabled,
}: InputFieldProps) {
  return (
    <FormField label={label} unit={unit} hint={hint} className={className}>
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
        className="input"
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
  className?: string
  disabled?: boolean
}

export function SelectField({
  label, value, onChange, options, unit, hint, className = '', disabled,
}: SelectFieldProps) {
  return (
    <FormField label={label} unit={unit} hint={hint} className={className}>
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
        className="mt-1 w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
      />
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
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
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-gray-700">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  )
}
