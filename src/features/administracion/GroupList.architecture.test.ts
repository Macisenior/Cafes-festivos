/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const groupListSource = readFileSync(
  fileURLToPath(new URL('./GroupList.tsx', import.meta.url)),
  'utf8',
)

describe('listado de grupos administrativo', () => {
  it('recibe catálogo y grupo activo desde la arquitectura existente', () => {
    expect(groupListSource).toContain('groups: readonly Group[]')
    expect(groupListSource).toContain('activeGroupId: GroupId')
    expect(groupListSource).toContain('onGroupsChanged')
  })

  it('usa servicios V4 para editar el nombre y borrar solo tras la inspección de elegibilidad', () => {
    expect(groupListSource).toContain('FirestoreV4AdministrationFunctionsClient')
    expect(groupListSource).toContain('FirestoreV4GroupDeletionService')
    expect(groupListSource).toContain("'editGroupName'")
    expect(groupListSource).toContain("'deleteEmptyGroup'")
    expect(groupListSource).toContain('.inspect(')
    expect(groupListSource).not.toContain('isMainGroup:')
    expect(groupListSource).not.toContain('groupId=')
  })
})

