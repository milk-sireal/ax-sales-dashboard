import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
)

export function Button({ asChild = false, variant, className, ...props }) {
  const Component = asChild ? Slot : 'button'
  return <Component data-slot="button" className={twMerge(clsx(buttonVariants({ variant }), className))} {...props} />
}
