import { localStorageGet, localStorageGetObject, localStorageSet, localStorageSetObject } from '../lib'

export function useSettings(prefix: string) {
  const settingsPrefix = `${prefix}::`
  const lastSettingsKey = `${prefix}-last`

  function listSettingsSets(): string[] {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(settingsPrefix)) keys.push(key.slice(settingsPrefix.length))
    }
    return keys.sort()
  }

  function saveSettingsSet(name: string, value: Record<string, any>) {
    localStorageSetObject(settingsPrefix + name, value)
  }

  function loadSettingsSet(name: string): Record<string, any> | null {
    return localStorageGetObject(settingsPrefix + name)
  }

  function deleteSettingsSet(name: string) {
    try {
      localStorage.removeItem(settingsPrefix + name)
    } catch (e) { }
  }

  function getLastSettingsName(): string | null {
    return localStorageGet(lastSettingsKey)
  }

  function setLastSettingsName(name: string | null) {
    if (name) localStorageSet(lastSettingsKey, name)
    else {
      try {
        localStorage.removeItem(lastSettingsKey)
      } catch (e) { }
    }
  }

  return {
    listSettingsSets,
    saveSettingsSet,
    loadSettingsSet,
    deleteSettingsSet,
    getLastSettingsName,
    setLastSettingsName,
  }
}
