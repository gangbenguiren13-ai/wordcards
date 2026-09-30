import { GameChoices } from '@/components/GameChoices'
import { ChoiceGroup, SettingRow, Stepper } from './SettingsPanel'
import { Toggle } from '@/components/ui'
import type { MemoryDefaults, SlowRevealDefaults, SetMode } from '@/types'

export function MemorySettingsPanel({ value: s, onChange, mode, adjustable, student = false }: {
  value: MemoryDefaults; onChange: (s: MemoryDefaults) => void; mode: SetMode; adjustable?: string[]; student?: boolean
}) {
  const label = (teacher: string, child: string) => student ? child : teacher
  const show = (key: string) => !adjustable || adjustable.includes(key)
  const patch = (p: Partial<MemoryDefaults>) => onChange({ ...s, ...p })
  return <>
    {show('cardCount') && <SettingRow label={label('カードの枚数', 'カードの まいすう')}>{student ? <GameChoices value={s.cardCount} onChange={cardCount => patch({ cardCount: cardCount as MemoryDefaults['cardCount'] })} values={[8, 12, 16, 20]} /> : <ChoiceGroup value={s.cardCount} onChange={cardCount => patch({ cardCount })}
      options={([8, 12, 16, 20] as const).map(value => ({ value, label: `${value}${student ? 'まい' : '枚'}` }))} />}</SettingRow>}
    {show('pick') && <SettingRow label={label('出題するカード', 'だす カード')}><ChoiceGroup value={s.pick} onChange={pick => patch({ pick })}
      options={[{ value: 'sequential', label: label('先頭から', 'はじめから') }, { value: 'random', label: 'ランダム' }]} /></SettingRow>}
    {show('pairType') && <SettingRow label={label('ペアの種類', 'ペアの くみあわせ')}><ChoiceGroup<MemoryDefaults['pairType']> value={s.pairType} onChange={pairType => patch({ pairType })}
      options={[...(mode === 'junior' ? [{ value: 'word_image' as const, label: label('単語と画像', 'ことばと がぞう') }, { value: 'word_word' as const, label: label('単語どうし', 'ことば どうし') }] : []),
        { value: 'image_image', label: label('同じ画像', 'おなじ がぞう') }, { value: 'image_pairimage', label: label('関連画像どうし', 'なかまの がぞう') }]} /></SettingRow>}
    {show('timeLimitMinutes') && <SettingRow label={label('制限時間', 'あそぶ じかん')}><Toggle student={student} label={label('時間を決める', 'じかんを きめる')} checked={s.timeLimitMinutes !== null} onChange={v => patch({ timeLimitMinutes: v ? 3 : null })} />
      {s.timeLimitMinutes !== null && <Stepper value={s.timeLimitMinutes} min={1} max={10} unit={student ? 'ふん' : '分'} onChange={timeLimitMinutes => patch({ timeLimitMinutes })} />}</SettingRow>}
    {show('teams') && <SettingRow label={label('プレイの形式', 'あそびかた')}><ChoiceGroup value={s.teams} onChange={teams => patch({ teams })}
      options={[{ value: 1, label: label('1人・ペアで協力', 'ひとり・ペアで きょうりょく') }, ...[2, 3, 4].map(value => ({ value, label: `${value}${student ? 'チームで たいせん' : 'チーム対抗'}` }))]} /></SettingRow>}
    {show('audioOnMatch') && <SettingRow label={label('音声', 'おんせい')}><Toggle student={student} label={label('そろったら音を鳴らす', 'そろったら おとを ならす')} checked={s.audioOnMatch} onChange={audioOnMatch => patch({ audioOnMatch })} /></SettingRow>}
  </>
}
export function RevealSettingsPanel({ value: s, onChange, mode, adjustable, student = false }: {
  value: SlowRevealDefaults; onChange: (s: SlowRevealDefaults) => void; mode: SetMode; adjustable?: string[]; student?: boolean
}) {
  const label = (teacher: string, child: string) => student ? child : teacher
  const show = (key: string) => !adjustable || adjustable.includes(key)
  const patch = (p: Partial<SlowRevealDefaults>) => onChange({ ...s, ...p })
  return <>
    {show('direction') && <SettingRow label={label('見せる方向', 'みせる むき')}><ChoiceGroup value={s.direction} onChange={direction => patch({ direction })}
      options={[{ value: 'top', label: label('上から', 'うえから') }, { value: 'bottom', label: label('下から', 'したから') }, { value: 'left', label: label('左から', 'ひだりから') }, { value: 'right', label: label('右から', 'みぎから') }, { value: 'center', label: label('中央から', 'まんなかから') }]} /></SettingRow>}
    {show('steps') && <SettingRow label={label('開く段階数', 'ひらく かいすう')}><Stepper value={s.steps} min={4} max={12} onChange={steps => patch({ steps })} /></SettingRow>}
    {show('advance') && <SettingRow label={label('開き方', 'ひらきかた')}><ChoiceGroup value={s.advance} onChange={advance => patch({ advance })}
      options={[{ value: 'manual', label: label('タッチで開く', 'タッチで ひらく') }, { value: 'auto', label: label('自動で開く', 'じどうで ひらく') }]} /></SettingRow>}
    {show('autoSeconds') && s.advance === 'auto' && <SettingRow label={label('1段階の時間', '1かいの じかん')}><Stepper value={s.autoSeconds} min={1} max={10} unit={student ? 'びょう' : '秒'} onChange={autoSeconds => patch({ autoSeconds })} /></SettingRow>}
    {show('order') && <SettingRow label={label('出す順番', 'だす じゅんばん')}><ChoiceGroup value={s.order} onChange={order => patch({ order })}
      options={[{ value: 'sequential', label: label('順番どおり', 'じゅんばんどおり') }, { value: 'random', label: 'ランダム' }]} /></SettingRow>}
    {show('answerDisplay') && mode === 'junior' && <SettingRow label={label('答えの表示', 'こたえの みせかた')}><ChoiceGroup value={s.answerDisplay} onChange={answerDisplay => patch({ answerDisplay })}
      options={[{ value: 'image', label: label('画像だけ', 'がぞうだけ') }, { value: 'image_word', label: label('画像と単語', 'がぞうと ことば') }, { value: 'image_word_audio', label: label('画像・単語・音声', 'がぞう・ことば・おんせい') }]} /></SettingRow>}
  </>
}
