export function Mascot({ pose = 'front', className = '' }: {
  pose?: 'front' | 'three4' | 'back' | 'jump' | 'wave'; className?: string
}) {
  return <img src={`/mascot/mascot-${pose}.webp`} alt="" width="512" height="512" draggable={false} className={`mascot-static ${className}`} />
}
