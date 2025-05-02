import { localStorageGetObject, localStorageSetObject } from "@/lib"
import { ref, watch } from "vue"

export default () => {
  const TAGS_STORAGE_KEY = 'tags'
  const localTags = ref<Record<string, string[]>>(localStorageGetObject(TAGS_STORAGE_KEY) || {})

  const removeTag = (hash: string, index: number) => {
    localTags.value[hash]?.splice(index, 1)
  }
  const addTag = (hash: string, newTag: string) => {
    if (!localTags.value[hash]) localTags.value[hash] = []
    localTags.value[hash].push(newTag)
  }
  watch(
    localTags,
    () => {
      localStorageSetObject(TAGS_STORAGE_KEY, localTags.value)
    },
    { deep: true },
  )

  return {
    localTags,
    removeTag,
    addTag
  }
}