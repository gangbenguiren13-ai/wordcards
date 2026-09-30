import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import postcss from 'postcss'

it('動きを減らす設定ではゲーム全体・疑似要素・ボタンのアニメーションと遷移を止める', () => {
  const css = postcss.parse(readFileSync(new URL('./index.css', import.meta.url), 'utf8'))
  const stopped = new Set<string>()
  css.walkAtRules('media', media => {
    if (media.params !== '(prefers-reduced-motion: reduce)') return
    media.walkRules(rule => {
      const declarations = new Map<string, string>()
      rule.walkDecls(decl => { if (decl.important) declarations.set(decl.prop, decl.value) })
      if (declarations.get('animation') === 'none' && declarations.get('transition') === 'none') rule.selectors.forEach(selector => stopped.add(selector))
    })
  })
  expect([...stopped]).toEqual(expect.arrayContaining([
    ':is(.game-shell, [data-audience="student"]) *',
    ':is(.game-shell, [data-audience="student"]) *::before',
    ':is(.game-shell, [data-audience="student"]) *::after', '.game-button',
  ]))
})
