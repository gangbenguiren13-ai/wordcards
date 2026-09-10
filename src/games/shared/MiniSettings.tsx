import { ChoiceGroup, SettingRow, Stepper } from './SettingsPanel'
import { Toggle } from '@/components/ui'
import type { MemoryDefaults, SlowRevealDefaults, SetMode } from '@/types'

export function MemorySettingsPanel({ value: s, onChange, mode, adjustable }: {
  value: MemoryDefaults; onChange: (s: MemoryDefaults) => void; mode: SetMode; adjustable?: string[]
}) {
  const show = (key: string) => !adjustable || adjustable.includes(key)
  const patch = (p: Partial<MemoryDefaults>) => onChange({ ...s, ...p })
  return <>
    {show('cardCount') && <SettingRow label="カードの枚数"><ChoiceGroup value={s.cardCount} onChange={cardCount => patch({ cardCount })}
      options={([8, 12, 16, 20] as const).map(value => ({ value, label: `${value}枚` }))} /></SettingRow>}
    {show('pick') && <SettingRow label="出題するカード"><ChoiceGroup value={s.pick} onChange={pick => patch({ pick })}
      options={[{ value: 'sequential', label: '先頭から' }, { value: 'random', label: 'ランダム' }]} /></SettingRow>}
    {show('pairType') && <SettingRow label="ペアの種類"><ChoiceGroup<MemoryDefaults['pairType']> value={s.pairType} onChange={pairType => patch({ pairType })}
      options={[...(mode === 'junior' ? [{ value: 'word_image' as const, label: '単語と画像' }, { value: 'word_word' as const, label: '単語どうし' }] : []),
        { value: 'image_image', label: '同じ画像' }, { value: 'image_pairimage', label: '関連画像どうし' }]} /></SettingRow>}
    {show('timeLimitMinutes') && <SettingRow label="制限時間"><Toggle label="時間を決める" checked={s.timeLimitMinutes !== null} onChange={v => patch({ timeLimitMinutes: v ? 3 : null })} />
      {s.timeLimitMinutes !== null && <Stepper value={s.timeLimitMinutes} min={1} max={10} unit="分" onChange={timeLimitMinutes => patch({ timeLimitMinutes })} />}</SettingRow>}
    {show('teams') && <SettingRow label="プレイの形式"><ChoiceGroup value={s.teams} onChange={teams => patch({ teams })}
      options={[{ value: 1, label: '1人・ペアで協力' }, ...[2, 3, 4].map(value => ({ value, label: `${value}チーム対抗` }))]} /></SettingRow>}
    {show('audioOnMatch') && <SettingRow label="音声"><Toggle label="そろったら音を鳴らす" checked={s.audioOnMatch} onChange={audioOnMatch => patch({ audioOnMatch })} /></SettingRow>}
  </>
}
export function RevealSettingsPanel({ value: s, onChange, mode, adjustable }: {
  value: SlowRevealDefaults; onChange: (s: SlowRevealDefaults) => void; mode: SetMode; adjustable?: string[]
}) {
  const show = (key: string) => !adjustable || adjustable.includes(key)
  const patch = (p: Partial<SlowRevealDefaults>) => onChange({ ...s, ...p })
  return <>
    {show('direction') && <SettingRow label="見せる方向"><ChoiceGroup value={s.direction} onChange={direction => patch({ direction })}
      options={[{ value: 'top', label: '上から' }, { value: 'bottom', label: '下から' }, { value: 'left', label: '左から' }, { value: 'right', label: '右から' }, { value: 'center', label: '中央から' }]} /></SettingRow>}
    {show('steps') && <SettingRow label="開く段階数"><Stepper value={s.steps} min={4} max={12} onChange={steps => patch({ steps })} /></SettingRow>}
    {show('advance') && <SettingRow label="開き方"><ChoiceGroup value={s.advance} onChange={advance => patch({ advance })}
      options={[{ value: 'manual', label: 'タッチで開く' }, { value: 'auto', label: '自動で開く' }]} /></SettingRow>}
    {show('autoSeconds') && s.advance === 'auto' && <SettingRow label="1段階の時間"><Stepper value={s.autoSeconds} min={1} max={10} unit="秒" onChange={autoSeconds => patch({ autoSeconds })} /></SettingRow>}
    {show('order') && <SettingRow label="出す順番"><ChoiceGroup value={s.order} onChange={order => patch({ order })}
      options={[{ value: 'sequential', label: '順番どおり' }, { value: 'random', label: 'ランダム' }]} /></SettingRow>}
    {show('answerDisplay') && mode === 'junior' && <SettingRow label="答えの表示"><ChoiceGroup value={s.answerDisplay} onChange={answerDisplay => patch({ answerDisplay })}
      options={[{ value: 'image', label: '画像だけ' }, { value: 'image_word', label: '画像と単語' }, { value: 'image_word_audio', label: '画像・単語・音声' }]} /></SettingRow>}
  </>
}
