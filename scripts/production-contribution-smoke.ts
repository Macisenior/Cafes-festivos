import { readFileSync } from 'node:fs'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, signInAnonymously, signOut } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { createGroupFinancialView } from '../src/domain/financial-adapter'
import type { Contribution, Expense, Group, Person } from '../src/domain/entities'

const groupId = 'Torreznos'
const contributionId = 'v4-production-smoke-20260811-01'
const testDate = '2026-08-11'
const testAmountInCents = 1

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function firebaseConfig() {
  const variables = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1)]
      }),
  )
  return {
    apiKey: variables.VITE_FIREBASE_API_KEY,
    authDomain: variables.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: variables.VITE_FIREBASE_PROJECT_ID,
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

async function run(): Promise<void> {
  assert(process.env.V4_RUN_APPROVED_PRODUCTION_SMOKE === 'true', 'Falta la aprobación explícita para la prueba de producción.')
  const operationalPin = process.env.V4_PRODUCTION_OPERATIONAL_PIN_TEST
  const administrationPin = process.env.V4_PRODUCTION_ADMINISTRATION_PIN_TEST
  assert(operationalPin && administrationPin, 'Faltan los PINes de la prueba.')

  const app = initializeApp(firebaseConfig())
  const auth = getAuth(app)
  const firestore = getFirestore(app)
  const functions = getFunctions(app, 'europe-southwest1')
  let created = false
  let selectedPersonId: string | undefined

  async function readEntities() {
    const groupReference = doc(firestore, 'grupos_v4', groupId)
    const [groupSnapshot, peopleSnapshot, contributionsSnapshot, expensesSnapshot] = await Promise.all([
      getDoc(groupReference),
      getDocs(collection(groupReference, 'personas')),
      getDocs(collection(groupReference, 'aportaciones')),
      getDocs(collection(groupReference, 'gastos')),
    ])
    assert(groupSnapshot.exists(), 'Torreznos no existe en grupos_v4.')
    return {
      group: groupSnapshot.data() as Group,
      people: peopleSnapshot.docs.map((snapshot) => snapshot.data() as Person),
      contributions: contributionsSnapshot.docs.map((snapshot) => snapshot.data() as Contribution),
      expenses: expensesSnapshot.docs.map((snapshot) => snapshot.data() as Expense),
    }
  }

  function snapshot(entities: Awaited<ReturnType<typeof readEntities>>, personId: string) {
    const financial = createGroupFinancialView(entities)
    const personBalance = financial.personBalances.find((balance) => balance.personId === personId)
    assert(personBalance, 'No se ha encontrado el saldo de la persona de prueba.')
    assert(financial.groupIntegrity.isConsistent, 'La integridad del grupo no es válida.')
    assert(financial.expenseIntegrity.every((check) => check.isConsistent), 'Hay gastos sin integridad válida.')
    return {
      contributionCount: entities.contributions.length,
      personBalanceInCents: personBalance.availableInCents,
      groupBalanceInCents: financial.groupBalance.availableInCents,
      people: canonical([...entities.people].sort((left, right) => left.id.localeCompare(right.id))),
      expenses: canonical([...entities.expenses].sort((left, right) => left.id.localeCompare(right.id))),
      contributions: canonical([...entities.contributions].sort((left, right) => left.id.localeCompare(right.id))),
    }
  }

  async function deleteOnlyTestContribution(): Promise<void> {
    await httpsCallable(functions, 'administrationV4')({
      pin: administrationPin,
      action: 'deleteContribution',
      groupId,
      payload: { contributionId },
    })
  }

  try {
    await signInAnonymously(auth)
    await httpsCallable(functions, 'verifyOperationalPin')({ pin: operationalPin })
    await httpsCallable(functions, 'verifyAdministrationPin')({ pin: administrationPin })

    const beforeEntities = await readEntities()
    assert(!beforeEntities.contributions.some((contribution) => contribution.id === contributionId), `El ID ${contributionId} ya existe; no se escribe nada.`)
    const person = beforeEntities.people.find((candidate) => candidate.isActive)
    assert(person, 'Torreznos no tiene ninguna persona activa; no se escribe nada.')
    selectedPersonId = person.id
    const before = snapshot(beforeEntities, selectedPersonId)
    console.log('ANTES', JSON.stringify({ personId: person.id, personName: person.name, contributionCount: before.contributionCount, personBalanceInCents: before.personBalanceInCents, groupBalanceInCents: before.groupBalanceInCents }))

    await httpsCallable(functions, 'createContributionV4')({
      pin: operationalPin,
      input: { id: contributionId, groupId, personId: selectedPersonId, amountInCents: testAmountInCents, date: testDate },
    })
    created = true

    const duringEntities = await readEntities()
    const persisted = duringEntities.contributions.find((contribution) => contribution.id === contributionId)
    assert(persisted, 'No se ha encontrado el documento de aportación creado.')
    assert(persisted.groupId === groupId && persisted.personId === selectedPersonId, 'El documento pertenece a otro grupo o persona.')
    assert(persisted.amountInCents === testAmountInCents && persisted.date === testDate && persisted.source === 'user', 'El documento no contiene exactamente los datos esperados.')
    const during = snapshot(duringEntities, selectedPersonId)
    assert(during.contributionCount === before.contributionCount + 1, 'El recuento de aportaciones no aumentó exactamente en uno.')
    assert(during.personBalanceInCents === before.personBalanceInCents + 1, 'El saldo personal no aumentó exactamente un céntimo.')
    assert(during.groupBalanceInCents === before.groupBalanceInCents + 1, 'El saldo del grupo no aumentó exactamente un céntimo.')
    assert(during.people === before.people && during.expenses === before.expenses, 'Se alteraron personas o gastos durante la prueba.')
    console.log('DURANTE', JSON.stringify({ contributionId, amountInCents: persisted.amountInCents, personId: persisted.personId, source: persisted.source, contributionCount: during.contributionCount, personBalanceInCents: during.personBalanceInCents, groupBalanceInCents: during.groupBalanceInCents }))

    await deleteOnlyTestContribution()
    created = false
    const afterEntities = await readEntities()
    assert(!afterEntities.contributions.some((contribution) => contribution.id === contributionId), 'La aportación de prueba sigue existiendo tras la eliminación.')
    const after = snapshot(afterEntities, selectedPersonId)
    assert(canonical(after) === canonical(before), 'Torreznos no volvió exactamente al estado previo.')
    console.log('DESPUÉS', JSON.stringify({ contributionCount: after.contributionCount, personBalanceInCents: after.personBalanceInCents, groupBalanceInCents: after.groupBalanceInCents, restoredExactly: true }))
    console.log('PRUEBA COMPLETADA CORRECTAMENTE')
  } catch (error) {
    console.error('PRUEBA FALLIDA:', error instanceof Error ? error.message : String(error))
    if (created) {
      try {
        await deleteOnlyTestContribution()
        console.error('LIMPIEZA DE EMERGENCIA: la aportación de prueba fue eliminada.')
      } catch (cleanupError) {
        console.error('LIMPIEZA DE EMERGENCIA FALLIDA:', cleanupError instanceof Error ? cleanupError.message : String(cleanupError))
      }
    }
    process.exitCode = 1
  } finally {
    await signOut(auth).catch(() => undefined)
    await deleteApp(app).catch(() => undefined)
  }
}

void run()