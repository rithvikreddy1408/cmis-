import { AdvancedMarker } from '@vis.gl/react-google-maps'
import { Bus } from 'lucide-react'

export default function BusMarker({
  position,
  heading,
  label,
  onClick,
}: {
  position: { lat: number; lng: number }
  heading?: number
  label?: string
  onClick?: () => void
}) {
  return (
    <AdvancedMarker position={position} title={label} onClick={onClick}>
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-indigo-600 shadow-lg"
        style={{ transform: heading != null ? `rotate(${heading}deg)` : undefined }}
      >
        <Bus className="h-4 w-4 text-white" />
      </div>
    </AdvancedMarker>
  )
}
