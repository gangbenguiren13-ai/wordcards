import { GameIcon } from './GameIcon'
import { PlayerToken } from './PlayerToken'

export function GameChoices({ value, onChange, values, players = false }: {
  value: number; onChange: (value: number) => void; values: readonly number[]; players?: boolean
}) {
  return <div className={`game-choices ${players ? 'game-choices--players' : 'game-choices--counts'}`}>{values.map(n => <button type="button" key={n} aria-pressed={n === value}
    className={`game-choice ${n === value ? 'game-choice--selected' : ''}`} onClick={() => onChange(n)}>
    <span className="game-choice-marks" aria-hidden="true">{players ? Array.from({ length: n }, (_, i) => <PlayerToken key={i} number={i + 1} />) : <GameIcon name="cards" width="48" height="48" />}</span>
    <span>{players ? n === 1 ? 'ひとりで あそぶ' : `${n}にんで きょうりょく` : `${n}まい`}</span>
    {n === value && <GameIcon name="check" />}
  </button>)}</div>
}
