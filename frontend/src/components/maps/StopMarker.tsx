import { AdvancedMarker, Pin } from '@vis.gl/react-google-maps'

export default function StopMarker({
  position,
  label,
  color = '#6366f1',
  onClick,
}: {
  position: { lat: number; lng: number }
  label: string
  color?: string
  onClick?: () => void
}) {
  return (
    <AdvancedMarker position={position} onClick={onClick} title={label}>
      <Pin background={color} borderColor="#1e1b4b" glyphColor="#fff" />
    </AdvancedMarker>
  )
}
