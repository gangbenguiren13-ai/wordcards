export function PlayerToken({ number, active = false }: { number: number; active?: boolean }) {
  return <span aria-hidden="true" className={`player-token player-token--${number} ${active ? 'player-token--active' : ''}`}><span>{number}</span></span>
}
