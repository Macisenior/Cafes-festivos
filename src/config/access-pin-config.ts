/** Los PIN se validan por Cloud Functions; nunca se incorporan al bundle. */
export type ProtectedArea = 'operational' | 'administration'

export const accessPinConfig: Readonly<Record<ProtectedArea, string>> = {
  operational: '',
  administration: '',
}
