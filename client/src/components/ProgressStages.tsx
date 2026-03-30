import { CheckCircle, Circle, Loader } from 'lucide-react'

interface Stage {
  label: string
  description: string
  /** Progress threshold at which this stage becomes active */
  threshold: number
}

const STAGES: Stage[] = [
  { label: 'Queued',          description: 'Research job accepted',        threshold: 0  },
  { label: 'Searching',       description: 'Gathering sources & evidence', threshold: 15 },
  { label: 'Analysing',       description: 'Processing findings',          threshold: 40 },
  { label: 'Verifying',       description: 'Circle of Truth validation',   threshold: 65 },
  { label: 'Writing Report',  description: 'Synthesising final report',    threshold: 82 },
]

interface ProgressStagesProps {
  progress: number
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export default function ProgressStages({ progress, status }: ProgressStagesProps) {
  const activeIndex = status === 'completed'
    ? STAGES.length - 1
    : STAGES.reduce((acc, stage, i) => (progress >= stage.threshold ? i : acc), 0)

  return (
    <div className="space-y-3">
      {STAGES.map((stage, i) => {
        const isDone   = status === 'completed' || i < activeIndex
        const isActive = !isDone && i === activeIndex && status === 'running'

        return (
          <div key={stage.label} className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {isDone ? (
                <CheckCircle size={20} className="text-green-400" />
              ) : isActive ? (
                <Loader size={20} className="text-accent-500 animate-spin" />
              ) : (
                <Circle size={20} className="text-navy-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-tight ${
                isDone   ? 'text-green-400'  :
                isActive ? 'text-accent-400' : 'text-navy-500'
              }`}>
                {stage.label}
              </p>
              {(isDone || isActive) && (
                <p className="text-xs text-navy-500 leading-tight">{stage.description}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
