/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./GlobalWalletSummary.tsx', import.meta.url)), 'utf8')
const informationPageSource = readFileSync(fileURLToPath(new URL('../informacion/InformationPage.tsx', import.meta.url)), 'utf8')
const administrationPageSource = readFileSync(fileURLToPath(new URL('./AdministrationPage.tsx', import.meta.url)), 'utf8')

describe('vista Resumen global', () => {
  it('usa el servicio de lectura V4 y no contiene operaciones de escritura', () => {
    expect(source).toContain('FirestoreV4GlobalWalletReadService')
    expect(source).not.toContain('setDoc')
    expect(source).not.toContain('updateDoc')
    expect(source).not.toContain('deleteDoc')
  })

  it('es la misma pieza compartida por Información y Administración', () => {
    expect(informationPageSource).toContain('<GlobalWalletSummary')
    expect(administrationPageSource).toContain('<GlobalWalletSummary')
  })
})
