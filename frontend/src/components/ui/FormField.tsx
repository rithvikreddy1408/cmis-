import { forwardRef, useId, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'

interface FieldWrapperProps {
  label: string
  error?: string
}

export const TextField = forwardRef<
  HTMLInputElement,
  FieldWrapperProps & InputHTMLAttributes<HTMLInputElement>
>(({ label, error, className, id, ...props }, ref) => {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1 block text-sm text-slate-700">
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        className={`w-full rounded-lg input px-3 py-2 text-sm text-slate-900 ${className ?? ''}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
})
TextField.displayName = 'TextField'

export const SelectField = forwardRef<
  HTMLSelectElement,
  FieldWrapperProps & SelectHTMLAttributes<HTMLSelectElement>
>(({ label, error, className, children, id, ...props }, ref) => {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1 block text-sm text-slate-700">
        {label}
      </label>
      <select
        ref={ref}
        id={fieldId}
        className={`w-full rounded-lg input px-3 py-2 text-sm text-slate-900 ${className ?? ''}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
})
SelectField.displayName = 'SelectField'
