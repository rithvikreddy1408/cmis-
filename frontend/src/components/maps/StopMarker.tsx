import { AdvancedMarker, Pin } from '@vis.gl/react-google-maps'

export default function StopMarker({
  position,
  label,
  color = '#0091dc',
  onClick,
}: {
  position: { lat: number; lng: number }
  label: string
  color?: string
  onClick?: () => void
}) {
  return (
    <AdvancedMarker position={position} onClick={onClick} title={label}>
      <Pin background={color} borderColor="#002a44" glyphColor="#fff" />
    </AdvancedMarker>
  )
}
