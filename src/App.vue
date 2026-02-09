<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from './supabase'
import logo from './assets/logo.png'
import Login from './components/Login.vue'
import AdminPanel from './components/AdminPanel.vue'

// State
const boletos = ref({ ventas: [], cambios: [] })
const admins = ref([])
const user = ref(null)
const showLogin = ref(false)

// Secret Word State
const secretWord = ref('')
const inputSecret = ref('')
const showSecretModal = ref(false)
const secretError = ref('')
const verifiedTicketIds = ref([]) // IDs of tickets unlocked by user
const pendingTicketId = ref(null) // ID of ticket currently trying to unlock

// Filters
const searchQuery = ref('')
const filterDia = ref('todos')
const filterCat = ref('todos')
const filterPrice = ref('')
const priceSort = ref('default')
const showInfo = ref(false)

// Data Loading
async function loadData() {
  // Load Ventas
  const { data: ventasData, error: vError } = await supabase
    .from('ventas')
    .select('*')

  if (ventasData) boletos.value.ventas = ventasData
  if (vError) console.error('Error loading ventas:', vError)

  // Load Cambios
  const { data: cambiosData, error: cError } = await supabase
    .from('cambios')
    .select('*')
    .order('created_at', { ascending: false })

  if (cambiosData) boletos.value.cambios = cambiosData
  if (cError) console.error('Error loading cambios:', cError)

  // Load Admin Status (from perfiles, only admins)
  const { data: adminData, error: aError } = await supabase
    .from('perfiles')
    .select('*')
    .eq('es_admin', true)

  if (adminData) {
    admins.value = adminData
  }
}

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

// Auth
async function checkUser() {
  const { data } = await supabase.auth.getUser()
  user.value = data.user
}

function handleLoginSuccess(userData) {
  user.value = userData
  showLogin.value = false
  loadData()
}

function handleLogout() {
  user.value = null
  verifiedTicketIds.value = [] // Reset unlocked tickets on logout
}

// Helper: Check if a specific ticket is unlocked
function isTicketUnlocked(ticketId) {
  if (user.value) return true // Admins see everything
  return verifiedTicketIds.value.includes(ticketId)
}

function handleContact(ticket) {
  if (isTicketUnlocked(ticket.id)) {
    // Already unlocked: Open WhatsApp
    window.open(getWhatsAppLink(ticket.tel), '_blank')
  } else {
    // Locked: Open Modal
    pendingTicketId.value = ticket.id
    inputSecret.value = ''
    secretError.value = ''
    showSecretModal.value = true
  }
}

function verifySecret() {
  if (inputSecret.value.trim().toLowerCase() === secretWord.value.trim().toLowerCase()) {
    if (pendingTicketId.value) {
      verifiedTicketIds.value.push(pendingTicketId.value)
    }
    showSecretModal.value = false
    secretError.value = ''
    inputSecret.value = ''
    pendingTicketId.value = null
  } else {
    secretError.value = 'Palabra incorrecta. Revisa el grupo de WhatsApp.'
  }
}

function cancelUnlock() {
  showSecretModal.value = false
  inputSecret.value = ''
  secretError.value = ''
  pendingTicketId.value = null
}

// Realtime Handlers
function handleVentas(payload) {
  const list = boletos.value.ventas
  if (payload.eventType === 'INSERT') {
    list.unshift(payload.new)
  } else if (payload.eventType === 'UPDATE') {
    const idx = list.findIndex(t => t.id === payload.new.id)
    if (idx !== -1) list[idx] = payload.new
  } else if (payload.eventType === 'DELETE') {
    const idx = list.findIndex(t => t.id === payload.old.id)
    if (idx !== -1) list.splice(idx, 1)
  }
}

function handleCambios(payload) {
  const list = boletos.value.cambios
  if (payload.eventType === 'INSERT') {
    list.unshift(payload.new)
  } else if (payload.eventType === 'UPDATE') {
    const idx = list.findIndex(t => t.id === payload.new.id)
    if (idx !== -1) list[idx] = payload.new
  } else if (payload.eventType === 'DELETE') {
    const idx = list.findIndex(t => t.id === payload.old.id)
    if (idx !== -1) list.splice(idx, 1)
  }
}

function handlePerfiles(payload) {
  if (payload.eventType === 'UPDATE') {
    const idx = admins.value.findIndex(a => a.id === payload.new.id)
    if (payload.new.es_admin) {
      if (idx !== -1) admins.value[idx] = payload.new
      else admins.value.push(payload.new) // Add if newly made admin or just missing
    } else if (idx !== -1) {
      admins.value.splice(idx, 1) // Remove if no longer admin
    }
  }
}

onMounted(() => {
  loadData()
  loadSecret()
  checkUser()

  // Realtime subscriptions
  supabase.channel('public-db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, handleVentas)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cambios' }, handleCambios)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, handlePerfiles)
    .subscribe()
})

const filteredVentas = computed(() => {
  if (filterCat.value !== 'todos' && filterCat.value !== 'venta') return []

  let result = boletos.value.ventas.filter(b => {
    const matchesSearch = Object.values(b).some(val => String(val).toLowerCase().includes(searchQuery.value.toLowerCase()))
    const matchesDia = filterDia.value === 'todos' || b.dia == filterDia.value
    const matchesPrecio = !filterPrice.value || (b.precio && b.precio <= Number(filterPrice.value))
    return matchesSearch && matchesDia && matchesPrecio
  })

  // Apply Sorting
  if (priceSort.value === 'asc') {
    result.sort((a, b) => (Number(a.precio) || 0) - (Number(b.precio) || 0))
  } else if (priceSort.value === 'desc') {
    result.sort((a, b) => (Number(b.precio) || 0) - (Number(a.precio) || 0))
  }

  return result
})

const filteredCambios = computed(() => {
  if (filterCat.value !== 'todos' && filterCat.value !== 'cambio') return []

  return boletos.value.cambios.filter(b => {
    const matchesSearch = Object.values(b).some(val => String(val).toLowerCase().includes(searchQuery.value.toLowerCase()))
    const matchesDia = filterDia.value === 'todos' || b.dia_busca == filterDia.value || b.dia_ofrece == filterDia.value
    return matchesSearch && matchesDia
  })
})

function limpiarFiltros() {
  searchQuery.value = ''
  filterDia.value = 'todos'
  filterCat.value = 'todos'
  filterPrice.value = ''
  priceSort.value = 'default'
}

function maskPhone(tel) {
  if (!tel) return ''
  const str = String(tel)
  if (str.length < 4) return '******'
  return '******' + str.slice(-4)
}

function getWhatsAppLink(tel) {
  const cleanTel = String(tel).replace(/\s/g, '')
  const message = `Hola, estoy interesado en tu boleto publicado en SafeTicket.

Para seguridad de ambos, sigamos la Dinámica de Seguridad SafeTicket:
1. El vendedor (tú) entrega el boleto a un Admin para validación.
2. Yo (comprador) te pago DIRECTAMENTE a ti.
3. El Admin me libera el boleto una vez confirmado el pago.

Puedes contactar a los Admins disponibles para iniciar el proceso aquí:
Admin Vane: 899 205 1168
Admin Crayola: 56 5740 3993
O en: ${window.location.origin}
(Revisa la sección "Estatus de Admins")`

  return `https://wa.me/52${cleanTel}?text=${encodeURIComponent(message)}`
}
</script>

<template>
  <div class="bg-gray-50 min-h-screen font-sans flex flex-col">
    <nav class="bg-indigo-700 text-white p-6 sticky top-0 z-50 shadow-lg">
      <div class="max-w-6xl mx-auto flex flex-col md:row justify-between items-center gap-4">
        <div class="flex items-center gap-3">
          <img :src="logo" alt="SafeTicket Logo" class="h-12 w-auto bg-white rounded-full p-1">
          <h1 class="text-2xl font-bold tracking-tight">SafeTicket MCRMX 2026</h1>
        </div>
        <div class="relative w-full md:w-1/2 flex gap-2">
          <input type="text" v-model="searchQuery" placeholder="Busca sección, zona o teléfono..."
            class="w-full p-3 rounded-full text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-300 shadow-inner">
          <button v-if="!user" @click="showLogin = true"
            class="bg-indigo-900 px-4 rounded-full hover:bg-indigo-800 font-bold text-xs uppercase tracking-wide">
            Admin
          </button>
        </div>
      </div>
    </nav>

    <!-- LOGIN MODAL -->
    <div v-if="showLogin" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div class="relative w-full max-w-md">
        <button @click="showLogin = false"
          class="absolute top-2 right-2 text-gray-500 hover:text-gray-700 font-bold bg-white rounded-full p-1 w-8 h-8 flex items-center justify-center shadow">X</button>
        <Login @login-success="handleLoginSuccess" />
      </div>
    </div>

    <!-- SECRET WORD MODAL -->
    <div v-if="showSecretModal"
      class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
      <div class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
        <h3 class="text-2xl font-bold text-indigo-900 mb-2">🔐 Acceso Seguro</h3>
        <p class="text-gray-600 mb-4 text-sm">Ingresa la palabra secreta del grupo de WhatsApp para ver este contacto.
        </p>

        <input v-model="inputSecret" @keyup.enter="verifySecret" type="text" placeholder="Palabra Secreta..."
          class="w-full p-3 border-2 border-indigo-100 rounded-lg text-center text-lg focus:border-indigo-500 focus:outline-none mb-2 upper">

        <p v-if="secretError" class="text-red-500 text-sm mb-3 font-medium">{{ secretError }}</p>

        <div class="flex gap-2">
          <button @click="cancelUnlock"
            class="flex-1 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium">Cancelar</button>
          <button @click="verifySecret"
            class="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-lg transition">Desbloquear</button>
        </div>
      </div>
    </div>

    <!-- ADMIN PANEL -->
    <div v-if="user" class="max-w-7xl mx-auto p-4 md:p-8 pb-0">
      <AdminPanel :user="user" @logout="handleLogout" @data-changed="loadData" />
    </div>

    <main class="max-w-7xl mx-auto p-4 md:p-8 flex-grow">

      <!-- Sección de Información y Horarios -->
      <div v-if="!user" class="mb-8 bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
        <button @click="showInfo = !showInfo"
          class="flex justify-between items-center w-full text-blue-900 font-bold text-lg hover:text-blue-700 transition">
          <span class="flex items-center gap-2">ℹ️ Información Importante</span>
          <span class="text-2xl">{{ showInfo ? '−' : '+' }}</span>
        </button>

        <div v-show="showInfo" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-blue-200 pt-4">
          <!-- Dinámica Estática (Hardcoded text) -->
          <div>
            <h3 class="font-bold text-xl text-indigo-800 mb-2">Nuestra Dinámica de Seguridad</h3>
            <div class="bg-white p-4 rounded-lg border border-gray-100 shadow-sm text-gray-700 space-y-3">

              <ul class="list-disc list-inside space-y-2">
                <li>
                  <strong class="text-indigo-700">Traspaso Ético:</strong> Solo facilitamos el traspaso de boletos de
                  personas que realmente no pueden asistir. No permitimos el lucro excesivo.
                </li>
                <li>
                  <strong class="text-indigo-700">Precios Justos:</strong> Fomentamos precios transparentes y cercanos
                  al costo original para apoyar a la comunidad de fans.
                </li>
              </ul>

              <div class="mt-4">
                <strong class="block text-indigo-800 mb-1 uppercase text-sm font-bold">Dinámica:</strong>
                <ol class="list-decimal list-inside space-y-1 text-sm">
                  <li>El vendedor nos entrega el boleto para su verificación. Nosotros lo resguardamos para asegurar que
                    sea válido y único.</li>
                  <li>Una vez validado el boleto.</li>
                  <li>Pedimos que el comprador haga el pago correspondiente <strong
                      class="text-black">DIRECTAMENTE</strong> al vendedor.</li>
                  <li>Una vez confirmado el pago, liberamos el boleto al comprador.</li>
                </ol>
              </div>

              <div class="pt-2 border-t border-gray-100 mt-2">
                <p class="text-sm">
                  <strong class="text-indigo-700">Garantía de Entrega:</strong> Con esta dinámica, el comprador tiene la
                  certeza de que recibirá su acceso y el vendedor tiene su dinero.
                </p>
              </div>

            </div>
          </div>

          <!-- Horarios / Estatus Admins -->
          <div>
            <h3 class="font-bold text-xl text-indigo-800 mb-2">Estatus de Admins</h3>
            <div class="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
              <p class="text-xs text-gray-500 mb-3 text-center">Disponibilidad de los administradores para atenderte.
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div v-for="admin in admins" :key="admin.id"
                  class="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                  <div class="flex items-center gap-2">
                    <div
                      :class="['w-3 h-3 rounded-full', admin.es_disponible ? 'bg-green-500 animate-pulse' : 'bg-red-500']">
                    </div>
                    <span class="font-bold text-gray-700">{{ admin.nombre || 'Admin' }}</span>
                  </div>
                  <span
                    :class="['text-xs font-bold px-2 py-1 rounded uppercase', admin.es_disponible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700']">
                    {{ admin.es_disponible ? 'Disponible' : 'Ocupado' }}
                  </span>
                </div>
              </div>

              <div v-if="admins.length === 0" class="text-center text-sm text-gray-400 mt-4">
                No hay información de estatus disponible.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Día del Evento</label>
          <select v-model="filterDia" class="w-full p-2 border rounded-md">
            <option value="todos">Todos los días</option>
            <option value="13">13 de Febrero</option>
            <option value="14">14 de Febrero</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Categoría</label>
          <select v-model="filterCat" class="w-full p-2 border rounded-md">
            <option value="todos">Venta y Cambios</option>
            <option value="venta">Solo Venta</option>
            <option value="cambio">Solo Cambios</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Precio Máximo</label>
          <input type="number" v-model="filterPrice" placeholder="Ej: 3000" class="w-full p-2 border rounded-md">
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Ordenar</label>
          <select v-model="priceSort" class="w-full p-2 border rounded-md">
            <option value="default">Default</option>
            <option value="asc">Precio: Menor a Mayor</option>
            <option value="desc">Precio: Mayor a Menor</option>
          </select>
        </div>
        <div class="flex items-end">
          <button @click="limpiarFiltros"
            class="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-md font-medium transition">
            Limpiar Filtros
          </button>
        </div>
      </div>

      <div v-if="filteredVentas.length > 0">
        <h2 class="text-xl font-bold mb-4 text-indigo-900 border-b-2 border-indigo-200 pb-2">Boletos en Venta</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          <div v-for="(b, index) in filteredVentas" :key="'venta-' + index"
            class="card bg-white p-4 rounded-lg shadow-sm border-l-4 border-indigo-500 hover:shadow-lg transition-transform transform hover:-translate-y-1">
            <div class="flex justify-between items-start">
              <span class="text-xs font-bold uppercase px-2 py-1 bg-indigo-100 text-indigo-700 rounded">Feb {{ b.dia
              }}</span>
              <span class="text-lg font-bold text-gray-800">${{ b.precio }}</span>
            </div>
            <h3 class="mt-2 font-semibold text-gray-700">{{ b.zona }}</h3>

            <p class="text-sm text-gray-500 mt-2 font-mono">📱 {{ isTicketUnlocked(b.id) ? b.tel : maskPhone(b.tel) }}
            </p>

            <button @click="handleContact(b)"
              :class="['block w-full mt-3 text-center py-2 rounded text-sm font-bold transition', isTicketUnlocked(b.id) ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200']">
              {{ isTicketUnlocked(b.id) ? '💬 Contactar Vendedor' : '🔒 Desbloquear Contacto' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="filteredCambios.length > 0">
        <h2 class="text-xl font-bold mb-4 text-emerald-900 border-b-2 border-emerald-200 pb-2">Intercambios
          (Busca/Ofrece)</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="(b, index) in filteredCambios" :key="'cambio-' + index"
            class="card bg-white p-4 rounded-lg shadow-sm border-l-4 border-emerald-500 hover:shadow-lg transition-transform transform hover:-translate-y-1">
            <div class="flex justify-between mb-2">
              <span class="text-xs font-bold uppercase px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Busca: Feb {{
                b.dia_busca }}</span>
              <span class="text-xs font-bold uppercase px-2 py-1 bg-blue-100 text-blue-700 rounded">Ofrece: Feb {{
                b.dia_ofrece }}</span>
            </div>
            <p class="text-sm"><strong>Busca:</strong> <span class="text-red-600">{{ b.busca }}</span></p>
            <p class="text-sm"><strong>Ofrece:</strong> <span class="text-emerald-600">{{ b.ofrece }}</span></p>

            <p class="text-sm mt-3 pt-2 border-t font-mono">📱 {{ isTicketUnlocked(b.id) ? b.tel : maskPhone(b.tel) }}
            </p>

            <button @click="handleContact(b)"
              :class="['block w-full mt-3 text-center py-2 rounded text-sm font-bold transition', isTicketUnlocked(b.id) ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200']">
              {{ isTicketUnlocked(b.id) ? '💬 Contactar Vendedor' : '🔒 Desbloquear Contacto' }}
            </button>
          </div>
        </div>
      </div>

    </main>

    <!-- FOOTER / AVISO DE PRIVACIDAD -->
    <footer class="bg-gray-800 text-gray-400 py-8 px-4 mt-8">
      <div class="max-w-4xl mx-auto text-sm">
        <h4 class="text-white font-bold mb-4 uppercase">Aviso de Privacidad</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p class="mb-2"><strong class="text-gray-300">Finalidad:</strong> Los datos de contacto facilitados se
              utilizan exclusivamente para conectar a compradores y vendedores de boletos dentro de la dinámica de
              seguridad del grupo.</p>
            <p class="mb-2"><strong class="text-gray-300">Confidencialidad:</strong> Garantizamos el resguardo de la
              información y no la compartimos con terceros ajenos a la transacción.</p>
          </div>
          <div>
            <p class="mb-2"><strong class="text-gray-300">Consentimiento:</strong> Al usar este sitio, aceptas que tu
              información de contacto sea visible para miembros verificados del grupo.</p>
            <p class="mb-2"><strong class="text-gray-300">Intermediario:</strong> "SafeTicket" y sus administradores
              actúan únicamente como intermediarios de confianza para validación, no somos responsables finales del uso
              de los boletos.</p>
          </div>
        </div>
        <p class="text-xs text-center mt-6 border-t border-gray-700 pt-4">© 2026 SafeTicket MCRMX. Todos los derechos
          reservados.</p>
      </div>
    </footer>
  </div>
</template>

<style>
/* CSS adicional si es necesario, pero Tailwind maneja la mayoría */
</style>
