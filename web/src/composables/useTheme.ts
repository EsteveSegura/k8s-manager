import { useColorMode } from '@vueuse/core'

export function useTheme() {
  return useColorMode({
    attribute: 'class',
    modes: { light: '', dark: 'dark' },
    initialValue: 'dark',
  })
}
