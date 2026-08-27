import { IMAGE_MAX_EDGE, IMAGE_QUALITY, IMAGE_TARGET_BYTES } from './constants'

export interface CompressResult {
  blob: Blob
  width: number
  height: number
  /** 圧縮前のバイト数 */
  originalBytes: number
  /** 実際に使った品質 */
  quality: number
}

/**
 * 画像を「長辺 IMAGE_MAX_EDGE px の WebP」に変換する。
 *
 * - EXIF の回転情報を適用してから描画する（iPad で撮った写真が横倒しにならない）
 * - HEIC は Safari がネイティブにデコードできるため、そのまま canvas に描ける
 * - 目標サイズ(300KB)を超える場合は品質を段階的に下げて再試行する
 * - 元ファイルは保存しない（保存するのは戻り値の blob のみ）
 */
export async function compressImage(file: File): Promise<CompressResult> {
  const source = await loadBitmap(file)
  const { width, height } = fitWithin(source.width, source.height, IMAGE_MAX_EDGE)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context を取得できませんでした')
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height)
  if ('close' in source && typeof source.close === 'function') source.close()

  let quality = IMAGE_QUALITY
  let blob = await canvasToBlob(canvas, 'image/webp', quality)

  // 目標サイズを超えるなら品質を落として再試行（最大3回）
  for (let i = 0; i < 3 && blob.size > IMAGE_TARGET_BYTES; i++) {
    quality = Math.max(0.5, quality - 0.1)
    blob = await canvasToBlob(canvas, 'image/webp', quality)
  }

  return { blob, width, height, originalBytes: file.size, quality }
}

/** 長辺を maxEdge に収める寸法を返す（拡大はしない） */
export function fitWithin(
  w: number,
  h: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(w, h)
  if (longest <= maxEdge) return { width: w, height: h }
  const scale = maxEdge / longest
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap は EXIF 回転を明示的に適用できる（Safari 16.4+）
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // HEIC など、環境によっては失敗するので img 要素にフォールバック
    }
  }
  return await loadViaImgElement(file)
}

function loadViaImgElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    // 既定値 from-image により、img 要素は EXIF 回転を自動適用する
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('画像を読み込めませんでした（対応していない形式の可能性があります）'))
    }
    img.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('画像の変換に失敗しました'))),
      type,
      quality,
    )
  })
}
