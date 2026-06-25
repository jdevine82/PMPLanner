import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMonthYear(value: string): string {
  const [year, month] = value.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  })
}

export function currentMonthYear(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function nextMonthYear(): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

export function monthYearOptions(count = 24): string[] {
  const options: string[] = []
  const now = new Date()
  for (let i = -12; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return options
}
