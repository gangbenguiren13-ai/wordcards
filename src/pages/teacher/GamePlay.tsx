import { rememberUsed } from '@/lib/recentSets'
import { QuickStart, rememberStarted } from '@/games/shared/QuickStart'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCards, getSet } from '@/api/sets'
import { signedUrls } from '@/lib/mediaStore'
import { preloadCards, releasePreloaded, type PreloadedCard } from '@/lib/preload'
import { selectUsableCards } from '@/lib/usableCards'
import { AppHeader } from '@/components/AppHeader'
import { LoadError } from '@/components/LoadError'
import { hasBlockingError, validateSet } from '@/lib/validation'
import { Button, Spinner, Toggle } from '@/components/ui'
import { ChoiceGroup, SettingRow, Stepper } from '@/games/shared/SettingsPanel'
import { FlashcardsGame } from '@/games/flashcards/FlashcardsGame'
import { effectiveDisplay, initialSettings, rememberSettings, type FlashcardsSettings } from '@/games/flashcards/settings'
import { englishVoices, loadVoices, pickVoice, saveVoiceUri, speak, unlockAudio } from '@/lib/audio'
import { useToast } from '@/components/toast/useToast'
import { toJapaneseError } from '@/lib/errorMessage'
import { DISPLAY_MODE_LABELS, type DisplayMode } from '@/types'
import { AUTO_SECONDS_MAX, AUTO_SECONDS_MIN } from '@/lib/constants'
import { MiniPlayPage } from './MiniPlay'

type Stage = 'settings' | 'loading' | 'playing'

export function GamePlayPage() {
  const { game } = useParams()
  if (game === 'memory' || game === 'slowreveal') return <MiniPlayPage game={game} />
  return <FlashcardsPlayPage />
}

function FlashcardsPlayPage() {
  const { id = '', game = 'flashcards' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const startLock = useRef(false)

  const setQuery = useQuery({ queryKey: ['set', id], queryFn: () => getSet(id) })
  const cardsQuery = useQuery({ queryKey: ['cards', id], queryFn: () => getCards(id) })

  const [stage, setStage] = useState<Stage>('settings')
  // 設定は「セットの既定値＋この画面で変えた分」で組み立てる。
  // 読み込み完了時にstateへ書き写すやり方だと、effectの中でstateを動かすことになり
  // 描画の順番によっては一瞬古い設定でゲームが始まってしまう
  const [override, setOverride] = useState<Partial<FlashcardsSettings>>({})
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [items, setItems] = useState<PreloadedCard[]>([])
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)

  const set = setQuery.data
  const settings: FlashcardsSettings | null = useMemo(
    () => (set ? { ...initialSettings(set), ...override } : null),
    [set, override],
  )

  useEffect(() => {
    void loadVoices().then((all) => {
      const en = englishVoices(all)
      setVoices(en)
      setVoice(pickVoice(all))
    })
  }, [])

  // 画面を離れるときに、取り込んだ画像を解放する
  useEffect(() => () => releasePreloaded(items), [items])

  const display: DisplayMode = set && settings ? effectiveDisplay(set, settings) : 'word_image'
  const usable = useMemo(
    () => selectUsableCards(cardsQuery.data ?? [], display),
    [cardsQuery.data, display],
  )

  if (setQuery.isError || cardsQuery.isError) {
    return (
      <>
        <AppHeader back={`/t/sets/${id}/play`} />
        <LoadError
          retrying={setQuery.isFetching || cardsQuery.isFetching}
          onRetry={() => { void setQuery.refetch(); void cardsQuery.refetch() }}
        />
      </>
    )
  }

  if (setQuery.isLoading || cardsQuery.isLoading || !set || !settings) {
    return (
      <>
        <AppHeader back={`/t/sets/${id}/play`} />
        <Spinner />
      </>
    )
  }

  const blocked = hasBlockingError(validateSet({
    title: set.title, mode: set.mode, gamesConfig: set.games_config,
    cards: cardsQuery.data ?? [],
  }))

  if (game !== 'flashcards' || blocked) {
    return (
      <>
        <AppHeader back={`/t/sets/${id}/play`} />
        <p role="alert" className="p-6 text-center font-bold text-danger-700">
          {blocked ? '教材に未入力や修正が必要な項目があります。教材を直してから始めてください。' : 'このゲームは準備中です。ゲーム選択に戻ってください。'}
        </p>
      </>
    )
  }

  const patch = (p: Partial<FlashcardsSettings>) => {
    const next = { ...settings, ...p }
    setOverride((prev) => ({ ...prev, ...p }))
    rememberSettings(next)
  }

  async function start() {
    if (!set || !settings || startLock.current) return
    startLock.current = true
    // 音を出す権利はユーザー操作の中でしか得られない。開始ボタンがその機会になる
    setStage('loading')
    try {
      await unlockAudio()
      const paths = usable.usable.flatMap((c) => [c.image_path, c.audio_path])
      const urls = await signedUrls(paths.filter((p): p is string => Boolean(p)))
      const result = await preloadCards(usable.usable, urls, setProgress)
      if (result.failures.length > 0) {
        releasePreloaded(result.items)
        toast.show('画像や音声を読み込めませんでした。通信を確認して、もう一度「はじめる」を押してください。')
        setStage('settings')
        return
      }
      setItems(result.items)
      rememberSettings(settings)
      rememberStarted('flashcards')
      rememberUsed(set.owner_id, set.id)
      setStage('playing')
    } catch (e) {
      toast.show(toJapaneseError(e))
      setStage('settings')
    } finally { startLock.current = false }
  }

  if (stage === 'playing') {
    return (
      <FlashcardsGame
        set={set}
        items={items}
        settings={settings}
        voice={voice}
        onExit={() => navigate(`/t/sets/${id}/play`)}
      />
    )
  }

  if (stage === 'loading') {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6">
        <p className="text-xl font-bold">よみこみちゅう…</p>
        <div className="h-4 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full bg-brand-500 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <p className="tabular-nums text-ink-soft">
          {progress.done} / {progress.total}
        </p>
        <p className="text-center text-sm text-ink-soft">
          さきに全部よみこむので、とちゅうで通信が切れても続けられます。
        </p>
      </main>
    )
  }

  const gameName = game === 'flashcards' ? 'フラッシュカード' : game

  return (
    <>
      <AppHeader title={`${gameName}のせってい`} back={`/t/sets/${id}/play`} />
      <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-12">
        {usable.reason && (
          <p className="rounded-xl border-2 border-warn-500 bg-warn-50 p-3 text-sm font-bold text-warn-700">
            ！ {usable.reason}
          </p>
        )}

        <QuickStart game="flashcards" count={usable.usable.length} disabled={!usable.usable.length}
          onStart={() => void start()} summary={[
            settings.order === 'random' ? 'ランダム' : '順番どおり',
            settings.advance === 'auto' ? `自動 ${settings.autoSeconds}秒` : '手で送る',
            settings.reviewMode === 'mixed' ? '復習を混ぜる' : '最後に復習',
            set.audio_enabled ? (settings.audioAutoplay ? '音声は自動' : '音声はボタンで') : '音なし',
          ].join('・')}>
        <div className="rounded-2xl border-2 border-line bg-surface px-4">
          {set.mode === 'junior' && (
            <SettingRow label="カードの見せ方">
              <ChoiceGroup<DisplayMode | 'inherit'>
                columns={2}
                value={settings.display ?? 'inherit'}
                onChange={(v) => patch({ display: v === 'inherit' ? null : v })}
                options={[
                  { value: 'inherit', label: 'セットの設定のまま', sub: DISPLAY_MODE_LABELS[set.default_display] },
                  ...(Object.keys(DISPLAY_MODE_LABELS) as DisplayMode[]).map((d) => ({
                    value: d, label: DISPLAY_MODE_LABELS[d],
                  })),
                ]}
              />
            </SettingRow>
          )}

          <SettingRow label="出す順番">
            <ChoiceGroup
              value={settings.order}
              onChange={(v) => patch({ order: v })}
              options={[
                { value: 'sequential' as const, label: '順番どおり' },
                { value: 'random' as const, label: 'ランダム' },
              ]}
            />
          </SettingRow>

          <SettingRow label="カードの送り方">
            <ChoiceGroup
              value={settings.advance}
              onChange={(v) => patch({ advance: v })}
              options={[
                { value: 'manual' as const, label: '手で送る', sub: 'タップ・矢印キー' },
                { value: 'auto' as const, label: '自動で送る' },
              ]}
            />
          </SettingRow>

          {settings.advance === 'auto' && (
            <SettingRow label="1枚あたりの時間">
              <Stepper
                value={settings.autoSeconds}
                min={AUTO_SECONDS_MIN}
                max={AUTO_SECONDS_MAX}
                unit="秒"
                onChange={(v) => patch({ autoSeconds: v })}
              />
            </SettingRow>
          )}

          <SettingRow
            label="言えなかったカードの出し方"
            hint="★を付けたカードを、どのタイミングでもう一度出すか"
          >
            <ChoiceGroup
              value={settings.reviewMode}
              onChange={(v) => patch({ reviewMode: v })}
              options={[
                { value: 'mixed' as const, label: '復習を混ぜる', sub: '同じ周の中でもう一度出る' },
                { value: 'rounds' as const, label: '最後に復習', sub: '1周してから★だけ' },
              ]}
            />
          </SettingRow>

          <SettingRow label="進み具合の表示">
            <Toggle
              label="「3／10」を出す"
              checked={settings.showProgress}
              onChange={(v) => patch({ showProgress: v })}
            />
          </SettingRow>

          {set.audio_enabled && (
            <SettingRow label="音声" hint="音声のないカードは、この端末の読み上げで代用します">
              <div className="flex flex-col gap-2">
                <Toggle
                  label="カードが出たら自動で鳴らす"
                  description="オフのときは🔊ボタンを押したときだけ鳴ります"
                  checked={settings.audioAutoplay}
                  onChange={(v) => patch({ audioAutoplay: v })}
                />
                <details><summary className="min-h-11 cursor-pointer py-3 font-bold">読み上げの声を変える</summary>
                {voices.length > 0 ? (
                  <label className="flex flex-col gap-1 pt-1">
                    <span className="text-sm font-bold text-ink-soft">読み上げの声（この端末だけの設定）</span>
                    <div className="flex gap-2">
                      <select
                        className="min-h-11 flex-1 rounded-xl border-2 border-line bg-surface px-3"
                        value={voice?.voiceURI ?? ''}
                        onChange={(e) => {
                          const v = voices.find((x) => x.voiceURI === e.target.value) ?? null
                          setVoice(v)
                          if (v) saveVoiceUri(v.voiceURI)
                        }}
                      >
                        {voices.map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name}（{v.lang}）
                          </option>
                        ))}
                      </select>
                      <Button
                        onClick={async () => {
                          await unlockAudio()
                          speak('apple', { voice })
                        }}
                      >
                        ためす
                      </Button>
                    </div>
                  </label>
                ) : (
                  <p className="text-sm text-ink-soft">
                    この端末には英語の読み上げ音声が入っていません。音声ファイルを登録したカードだけ鳴ります。
                  </p>
                )}
                </details>
              </div>
            </SettingRow>
          )}
        </div>
        </QuickStart>
      </main>

    </>
  )
}
