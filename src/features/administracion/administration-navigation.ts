export type AdministrationArea = 'menu' | 'people' | 'groups' | 'expenses' | 'history' | 'reports' | 'expenses-by-person' | 'contributions-by-person' | 'global-wallet' | 'account-state-at-date' | 'state-between-dates' | 'pro-summary' | 'system'

export function openAdministrationArea(area: Exclude<AdministrationArea, 'menu'>): AdministrationArea {
  return area
}

export function returnToAdministrationMenu(): AdministrationArea {
  return 'menu'
}
