<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase'

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

const emit = defineEmits(['login-success'])

async function handleLogin() {
    loading.value = true
    errorMsg.value = ''

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
    })

    if (error) {
        errorMsg.value = error.message
    } else {
        emit('login-success', data.user)
    }
    loading.value = false
}
</script>

<template>
    <div class="max-w-md mx-auto bg-white p-8 rounded-xl shadow-md border border-gray-100">
        <h2 class="text-2xl font-bold text-center text-indigo-800 mb-6">Acceso Admin</h2>
        <form @submit.prevent="handleLogin" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700">Email</label>
                <input v-model="email" type="email" required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">Contraseña</label>
                <input v-model="password" type="password" required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
            </div>
            <div v-if="errorMsg" class="text-red-500 text-sm text-center">{{ errorMsg }}</div>
            <button type="submit" :disabled="loading"
                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                {{ loading ? 'Ingresando...' : 'Ingresar' }}
            </button>
        </form>
    </div>
</template>
