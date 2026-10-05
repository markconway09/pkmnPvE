// How big the game draws - picked in Options → Screen size. Auto fits the game to the
// screen it's on; the others are a fixed size. The layout is built for a 1280x960 window,
// so every size is that window zoomed in or out.

export type UiScaleChoice = 'auto' | '75' | '90' | '100' | '125' | '150'

export const UI_SCALE_CHOICES: UiScaleChoice[] = ['auto', '75', '90', '100', '125', '150']

export const UI_SCALE_LABELS: Record<UiScaleChoice, string> = {
  auto: 'Auto',
  '75': '75%',
  '90': '90%',
  '100': '100%',
  '125': '125%',
  '150': '150%'
}

export interface UiScaleState {
  choice: UiScaleChoice
  // The zoom in use right now (1 = 100%) - for Auto, what it worked out for this screen.
  zoom: number
}
