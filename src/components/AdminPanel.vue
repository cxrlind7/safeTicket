<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'

const props = defineProps(['user'])
// const emit = defineEmits(['logout', 'data-changed'])

const activeTab = ref('tickets') // 'tickets' | 'schedule' | 'config'
const myStatus = ref(null) // { id, es_disponible, ... }
const loadingStatus = ref(false)

// Ticket Management State
const myTickets = ref([])
const loadingTickets = ref(false)

// Ticket Form Data
const isSaving = ref(false)
const showForm = ref(false)
const ticketMode = ref('add') // 'add' | 'edit'
const editingId = ref(null)
const newTicket = ref({
    type: 'venta',
    date: 14,
    price: 0,
    zone: '',
    phone: '',
    seeks: '',
    offers: '',
    dia_busca: 14,
    dia_ofrece: 14
})
const ticketMessage = ref('')

// Secret Word State
const secretWord = ref('')
const isSavingSecret = ref(false)
const secretMessage = ref('')

// --- SCHEDULE LOGIC (Updated to use perfiles) ---
async function loadStatus() {
    loadingStatus.value = true
    const userId = props.user.id

    // Fetch existing status from perfiles
    const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .single()

    if (data) {
        myStatus.value = data
    }
    loadingStatus.value = false
}

async function toggleStatus() {
    if (!myStatus.value) return

    const newState = !myStatus.value.es_disponible
    const { error } = await supabase
        .from('perfiles')
        .update({ es_disponible: newState })
        .eq('id', myStatus.value.id)

    if (!error) {
        myStatus.value.es_disponible = newState
        emit('data-changed')
    }
}

// --- SECRET WORD LOGIC ---
async function loadSecret() {
    const { data, error } = await supabase
        .from('info_dinamica')
        .select('mensaje')
        .eq('id', 1)
        .single()

    if (data) {
        secretWord.value = data.mensaje
    }
}

async function saveSecret() {
    isSavingSecret.value = true
    secretMessage.value = ''

    const { error } = await supabase
        .from('info_dinamica')
        .update({ mensaje: secretWord.value })
        .eq('id', 1)

    if (error) {
        secretMessage.value = 'Error: ' + error.message
    } else {
        secretMessage.value = 'Palabra secreta actualizada correctamente.'
    }
    isSavingSecret.value = false
}

// --- TICKET LOGIC ---

async function loadMyTickets(showLoading = true) {
    if (showLoading) loadingTickets.value = true
    const { data: ventas } = await supabase.from('ventas').select('*').order('created_at', { ascending: false })
    const { data: cambios } = await supabase.from('cambios').select('*').order('created_at', { ascending: false })

    const combined = [
        ...(ventas || []).map(t => ({ ...t, type: 'venta', table: 'ventas' })),
        ...(cambios || []).map(t => ({ ...t, type: 'cambio', table: 'cambios' }))
    ]

    myTickets.value = combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (showLoading) loadingTickets.value = false
}

function editTicket(ticket) {
    showForm.value = true
    ticketMode.value = 'edit'
    editingId.value = ticket.id
    // Populate form
    newTicket.value = {
        type: ticket.type,
        date: ticket.dia || 14,
        price: ticket.precio || 0,
        zone: ticket.zona || '',
        phone: ticket.tel || '',
        seeks: ticket.busca || '',
        offers: ticket.ofrece || '',
        dia_busca: ticket.dia_busca || 14,
        dia_ofrece: ticket.dia_ofrece || 14
    }
    ticketMessage.value = ''
}

const emit = defineEmits(['logout', 'data-changed'])

// ... (props and other constants remain the same)

// ...

async function deleteTicket(ticket) {
    if (!confirm('¿Estás seguro de eliminar este ticket?')) return

    // Optimistically remove from UI
    const originalTickets = [...myTickets.value]
    myTickets.value = myTickets.value.filter(t => t.id !== ticket.id)

    const { error } = await supabase.from(ticket.table).delete().eq('id', ticket.id)

    if (error) {
        alert('Error al eliminar: ' + error.message)
        myTickets.value = originalTickets // Revert if failed
    } else {
        emit('data-changed')
        loadMyTickets()
    }
}

function cancelEdit() {
    showForm.value = false
    ticketMode.value = 'add'
    editingId.value = null
    newTicket.value = {
        type: 'venta', date: 14, price: 0, zone: '', phone: '', seeks: '', offers: '', dia_busca: 14, dia_ofrece: 14
    }
    // Do NOT clear ticketMessage here if called from saveTicket success
}

async function saveTicket() {
    if (isSaving.value) return
    isSaving.value = true
    ticketMessage.value = ''

    let error = null
    let data = null
    const wasEditing = ticketMode.value === 'edit'
    let table = newTicket.value.type === 'venta' ? 'ventas' : 'cambios'

    const payload = newTicket.value.type === 'venta'
        ? { dia: newTicket.value.date, zona: newTicket.value.zone, precio: newTicket.value.price, tel: newTicket.value.phone }
        : { busca: newTicket.value.seeks, dia_busca: newTicket.value.dia_busca, ofrece: newTicket.value.offers, dia_ofrece: newTicket.value.dia_ofrece, tel: newTicket.value.phone }

    if (ticketMode.value === 'add') {
        const { data: inserted, error: err } = await supabase.from(table).insert([{ ...payload, created_at: new Date() }]).select()
        error = err
        data = inserted
    } else {
        const { data: updated, error: err } = await supabase.from(table).update(payload).eq('id', editingId.value).select()
        error = err
        data = updated
    }

    if (error) {
        ticketMessage.value = 'Error: ' + error.message
    } else {
        cancelEdit() // Reset form

        ticketMessage.value = wasEditing ? 'Ticket actualizado correctamente!' : 'Ticket agregado correctamente!'

        // Optimistic / Immediate Update
        if (data && data.length > 0) {
            const type = table === 'ventas' ? 'venta' : 'cambio'
            const newItem = { ...data[0], type: type, table: table }

            if (wasEditing) {
                myTickets.value = myTickets.value.map(t => t.id === newItem.id ? newItem : t)
            } else {
                myTickets.value.unshift(newItem)
            }
        }

        emit('data-changed')
        // We rely on optimistic update + Realtime subscription
    }
    isSaving.value = false
}

function handleLogout() {
    supabase.auth.signOut()
    emit('logout')
}

onMounted(() => {
    loadStatus()
    loadMyTickets()
    loadSecret()

    // Realtime subscriptions for tickets
    supabase.channel('admin-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, () => loadMyTickets(false))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cambios' }, () => loadMyTickets(false))
        .subscribe()
})
</script>

<template>
    <div class="bg-white p-6 rounded-xl shadow-lg border border-indigo-100 mt-8">
        <div class="flex justify-between items-center mb-6 border-b pb-4">
            <h2 class="text-xl font-bold text-indigo-900">Panel de Administración ({{ user.email }})</h2>
            <button @click="handleLogout" class="text-sm text-red-600 hover:text-red-800 font-medium">Cerrar
                Sesión</button>
        </div>

        <div class="flex gap-4 mb-6">
            <button @click="activeTab = 'tickets'"
                :class="['pb-2 px-4 transition-colors', activeTab === 'tickets' ? 'border-b-2 border-indigo-600 text-indigo-600 font-bold' : 'text-gray-500 hover:text-gray-700']">Gestionar
                Tickets</button>
            <button @click="activeTab = 'schedule'"
                :class="['pb-2 px-4 transition-colors', activeTab === 'schedule' ? 'border-b-2 border-indigo-600 text-indigo-600 font-bold' : 'text-gray-500 hover:text-gray-700']">Mi
                Estado</button>
            <button @click="activeTab = 'config'"
                :class="['pb-2 px-4 transition-colors', activeTab === 'config' ? 'border-b-2 border-indigo-600 text-indigo-600 font-bold' : 'text-gray-500 hover:text-gray-700']">Configuración</button>
        </div>

        <!-- TICKET TAB -->
        <div v-if="activeTab === 'tickets'">
            <div v-if="!showForm" class="mb-6 flex justify-end">
                <button @click="showForm = true"
                    class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-indigo-700 transition">
                    + Agregar Nuevo Ticket
                </button>
            </div>

            <form v-if="showForm" @submit.prevent="saveTicket"
                class="space-y-4 max-w-lg mx-auto mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 class="font-bold text-lg text-gray-800 mb-2">{{ ticketMode === 'add' ? 'Agregar Nuevo Ticket' :
                    'Editar Ticket' }}</h3>

                <div>
                    <label class="block text-sm font-medium text-gray-700">Tipo</label>
                    <select v-model="newTicket.type" :disabled="ticketMode === 'edit'"
                        class="w-full border border-gray-300 p-2 rounded">
                        <option value="venta">Venta</option>
                        <option value="cambio">Cambio</option>
                    </select>
                </div>

                <div v-if="newTicket.type === 'venta'" class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Día</label>
                            <select v-model="newTicket.date" class="w-full border border-gray-300 p-2 rounded">
                                <option :value="13">13 Feb</option>
                                <option :value="14">14 Feb</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Precio</label>
                            <input v-model="newTicket.price" type="number" min="0" inputmode="numeric"
                                class="w-full border border-gray-300 p-2 rounded">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Zona / Asiento</label>
                        <input v-model="newTicket.zone" type="text" class="w-full border border-gray-300 p-2 rounded"
                            required>
                    </div>
                </div>

                <div v-else class="space-y-4">
                    <div class="grid grid-cols-1 gap-4">
                        <div class="border p-3 rounded-md bg-white">
                            <label class="block text-sm font-bold text-gray-700 mb-1">Busca</label>
                            <input v-model="newTicket.seeks" type="text" class="w-full border p-2 rounded mb-2">
                        </div>
                        <div class="border p-3 rounded-md bg-white">
                            <label class="block text-sm font-bold text-gray-700 mb-1">Ofrece</label>
                            <input v-model="newTicket.offers" type="text" class="w-full border p-2 rounded mb-2">
                        </div>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700">Teléfono</label>
                    <input v-model="newTicket.phone" type="tel" inputmode="numeric" pattern="[0-9]*"
                        @input="newTicket.phone = newTicket.phone.replace(/[^0-9]/g, '')"
                        class="w-full border border-gray-300 p-2 rounded" required>
                </div>

                <div class="flex gap-2">
                    <button type="button" @click="cancelEdit"
                        class="w-1/3 bg-gray-500 text-white py-2 rounded">Cancelar</button>
                    <button type="submit" :disabled="isSaving"
                        :class="['flex-1 text-white py-2 rounded font-bold', isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700']">
                        {{ isSaving ? 'Guardando...' : (ticketMode === 'add' ? 'Guardar' : 'Actualizar') }}
                    </button>
                </div>

                <p v-if="ticketMessage" class="text-sm text-center mt-2 font-medium"
                    :class="ticketMessage.includes('Error') ? 'text-red-500' : 'text-green-600'">
                    {{ ticketMessage }}
                </p>

            </form>

            <div class="border-t pt-6">
                <h3 class="font-bold text-lg text-gray-800 mb-4">Tickets Existentes</h3>
                <div v-if="loadingTickets" class="text-center text-gray-500">Cargando...</div>
                <div v-else class="space-y-2 max-h-80 overflow-y-auto">
                    <div v-for="ticket in myTickets" :key="ticket.id"
                        class="flex justify-between items-center bg-gray-50 p-3 rounded border">
                        <div>
                            <span
                                :class="['text-xs px-2 py-0.5 rounded font-bold uppercase mr-2', ticket.type === 'venta' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700']">
                                {{ ticket.type }}
                            </span>
                            <span class="text-sm font-medium text-gray-700">
                                {{ ticket.type === 'venta' ? ticket.zona : `Cambio` }}
                            </span>
                            <span class="text-xs text-gray-500 ml-2">
                                📱 {{ ticket.tel }}
                            </span>
                        </div>
                        <div class="flex gap-2">
                            <button @click="editTicket(ticket)"
                                class="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase">Editar</button>
                            <button @click="deleteTicket(ticket)"
                                class="text-red-600 hover:text-red-800 text-xs font-bold uppercase">Borrar</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- SCHEDULE TAB -->
        <div v-else-if="activeTab === 'schedule'">
            <div class="flex flex-col items-center justify-center py-12">
                <h3 class="text-lg font-bold text-gray-700 mb-6">Mi Disponibilidad Actual</h3>

                <div v-if="!myStatus">
                    <p class="text-gray-500 mb-4">No se encontró perfil de administrador.</p>
                </div>

                <div v-else>
                    <button @click="toggleStatus"
                        :class="['w-48 h-48 rounded-full flex flex-col items-center justify-center transition-transform transform active:scale-95 shadow-xl border-8',
                            myStatus.es_disponible ? 'bg-green-500 border-green-300 text-white' : 'bg-red-500 border-red-300 text-white']">
                        <span class="text-6xl mb-2">{{ myStatus.es_disponible ? '😃' : '🛑' }}</span>
                        <span class="text-2xl font-bold uppercase">
                            {{ myStatus.es_disponible ? 'Disponible' : 'No Disponible' }}
                        </span>
                        <span class="text-sm mt-2 opacity-80">(Clic para cambiar)</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- CONFIG TAB -->
        <div v-else-if="activeTab === 'config'" class="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 class="text-lg font-bold text-gray-800 mb-4">Confíguración Global</h3>

            <div class="bg-white p-6 rounded shadow-sm border">
                <label class="block text-sm font-bold text-indigo-900 mb-2">Palabra Secreta del Grupo</label>
                <p class="text-xs text-gray-500 mb-4">Esta es la palabra que los usuarios deben ingresar para ver los
                    números de contacto.</p>

                <div class="flex gap-3">
                    <input v-model="secretWord" type="text"
                        class="flex-grow border p-3 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Ej: FANT2026">
                    <button @click="saveSecret" :disabled="isSavingSecret"
                        class="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">
                        {{ isSavingSecret ? 'Guardando...' : 'Guardar' }}
                    </button>
                </div>
                <p v-if="secretMessage" class="mt-3 text-sm font-medium"
                    :class="secretMessage.includes('Error') ? 'text-red-500' : 'text-green-600'">
                    {{ secretMessage }}
                </p>
            </div>
        </div>

    </div>
</template>
