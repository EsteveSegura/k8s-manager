<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { setLocale, SUPPORTED_LOCALES, type AppLocale } from '@/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LanguagesIcon, CheckIcon } from '@lucide/vue'

const { locale } = useI18n()

const LOCALE_LABEL: Record<AppLocale, string> = { es: 'Español', en: 'English' }
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon-sm" aria-label="Cambiar idioma / Change language">
        <LanguagesIcon />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem v-for="code in SUPPORTED_LOCALES" :key="code" @select="setLocale(code)">
        <CheckIcon v-if="locale === code" class="text-muted-foreground" />
        <span v-else class="size-4 shrink-0" />
        {{ LOCALE_LABEL[code] }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
