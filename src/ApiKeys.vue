<template>
  <main class="px-3 py-4" style="max-width: 800px; margin: 0 auto">
    <h2 class="mt-0 mb-4">API Keys</h2>

    <!-- Admin key input -->
    <div class="flex align-items-center gap-2 mb-4">
      <label for="admin-key" class="font-semibold white-space-nowrap">Admin key</label>
      <InputText
        id="admin-key"
        v-model="adminKey"
        type="password"
        placeholder="MCP_ADMIN_KEY"
        class="flex-grow-1"
        @keyup.enter="fetchKeys"
      />
      <Button label="Load" icon="pi pi-refresh" @click="fetchKeys" :loading="loading" />
    </div>

    <Message v-if="error" severity="error" :closable="false" class="mb-3">{{ error }}</Message>

    <!-- Generate new key -->
    <div class="flex align-items-center gap-2 mb-4">
      <InputText
        v-model="newKeyName"
        placeholder="Key name (e.g. user or purpose)"
        class="flex-grow-1"
        @keyup.enter="generateKey"
      />
      <Button
        label="Generate"
        icon="pi pi-plus"
        severity="success"
        @click="generateKey"
        :disabled="!newKeyName.trim() || !adminKey"
        :loading="generating"
      />
    </div>

    <!-- Show newly created key -->
    <Message v-if="justCreated" severity="success" class="mb-3" @close="justCreated = null">
      <div>
        Key <strong>{{ justCreated.name }}</strong> created. Copy it now — it won't be shown again:
      </div>
      <div class="flex align-items-center gap-2 mt-2">
        <code class="text-sm select-all" style="word-break: break-all">{{ justCreated.key }}</code>
        <Button
          icon="pi pi-copy"
          text
          rounded
          size="small"
          @click="copyToClipboard(justCreated!.key)"
        />
      </div>
    </Message>

    <!-- Keys table -->
    <DataTable :value="keys" dataKey="id" size="small" :loading="loading" stripedRows>
      <template #empty>{{ adminKey ? 'No API keys yet' : 'Enter admin key and click Load' }}</template>
      <Column field="name" header="Name" />
      <Column header="Key">
        <template #body="{ data }">
          <code class="text-sm">{{ data.maskedKey }}</code>
        </template>
      </Column>
      <Column field="usageCount" header="Calls" style="width: 5rem" />
      <Column header="Last used" style="width: 10rem">
        <template #body="{ data }">
          {{ data.lastUsedAt ? formatDate(data.lastUsedAt) : '—' }}
        </template>
      </Column>
      <Column header="Created" style="width: 10rem">
        <template #body="{ data }">
          {{ formatDate(data.createdAt) }}
        </template>
      </Column>
      <Column style="width: 4rem">
        <template #body="{ data }">
          <Button
            icon="pi pi-trash"
            text
            rounded
            severity="danger"
            size="small"
            @click="revokeKey(data.id)"
          />
        </template>
      </Column>
    </DataTable>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Message from 'primevue/message'

// In dev, VITE_MCP_PORT lets us hit the MCP server directly (e.g. :3100).
// In production nginx proxies /api/ and /mcp to the container, so we use the current origin.
const MCP_BASE = window.location.hostname.startsWith('localhost')
  ? `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_MCP_PORT ?? 3100}`
  : window.location.origin

interface KeyInfo {
  id: string
  name: string
  maskedKey: string
  createdAt: string
  lastUsedAt: string | null
  usageCount: number
}

interface CreatedKey {
  id: string
  key: string
  name: string
}

const adminKey = ref(localStorage.getItem('mcp-admin-key') ?? '')
const keys = ref<KeyInfo[]>([])
const loading = ref(false)
const generating = ref(false)
const error = ref('')
const newKeyName = ref('')
const justCreated = ref<CreatedKey | null>(null)

function authHeaders() {
  return { Authorization: `Bearer ${adminKey.value}`, 'Content-Type': 'application/json' }
}

async function fetchKeys() {
  if (!adminKey.value) return
  localStorage.setItem('mcp-admin-key', adminKey.value)
  error.value = ''
  loading.value = true
  try {
    const res = await fetch(`${MCP_BASE}/api/keys`, { headers: authHeaders() })
    if (!res.ok) throw new Error(res.status === 401 ? 'Invalid admin key' : `Error ${res.status}`)
    keys.value = await res.json()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function generateKey() {
  if (!newKeyName.value.trim() || !adminKey.value) return
  generating.value = true
  error.value = ''
  try {
    const res = await fetch(`${MCP_BASE}/api/keys`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: newKeyName.value.trim() }),
    })
    if (!res.ok) throw new Error(`Error ${res.status}`)
    const created = await res.json()
    justCreated.value = created
    newKeyName.value = ''
    await fetchKeys()
  } catch (e: any) {
    error.value = e.message
  } finally {
    generating.value = false
  }
}

async function revokeKey(id: string) {
  error.value = ''
  try {
    const res = await fetch(`${MCP_BASE}/api/keys/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error(`Error ${res.status}`)
    await fetchKeys()
  } catch (e: any) {
    error.value = e.message
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Auto-load if admin key is saved
if (adminKey.value) fetchKeys()
</script>
