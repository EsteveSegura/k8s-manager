import { createApp, type App } from 'vue'
import { createPinia, setActivePinia, type Pinia } from 'pinia'

// Runs a composable inside a real (headless) component setup so lifecycle hooks
// such as onBeforeUnmount are registered. Call `unmount()` to trigger them.
// Errors thrown inside hooks/watchers are collected in `errors` instead of only
// being logged by Vue, so tests can assert there were none.
export function withSetup<T>(
  composable: () => T,
  pinia: Pinia = createPinia(),
): { result: T; app: App; errors: unknown[]; unmount: () => void } {
  setActivePinia(pinia)
  const errors: unknown[] = []
  let result!: T
  const app = createApp({
    setup() {
      result = composable()
      return () => null
    },
  })
  app.config.errorHandler = (err) => {
    errors.push(err)
  }
  app.use(pinia)
  app.mount(document.createElement('div'))
  return { result, app, errors, unmount: () => app.unmount() }
}
