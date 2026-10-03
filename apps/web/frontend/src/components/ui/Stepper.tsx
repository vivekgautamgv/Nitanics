interface StepperProps {
  steps: string[]
  current: number
}

export default function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="stepper">
      {steps.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <li key={label} className={`stepper-item ${done ? 'stepper-done' : ''} ${active ? 'stepper-active' : ''}`}>
            <span className="stepper-dot">{done ? '✓' : step}</span>
            <span className="stepper-label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
