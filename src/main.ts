import './assets/base.css'
import 'primeicons/primeicons.css'
import 'primevue/resources/themes/lara-dark-indigo/theme.css'
import 'primeflex/primeflex.css'

import Bugsnag from '@bugsnag/js'
import BugsnagPluginVue from '@bugsnag/plugin-vue'

import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
// import DialogService from "primevue/dialogservice";

import { createApp } from 'vue'
import App from './App.vue'

Bugsnag.start({
  apiKey: import.meta.env.VITE_BUGSNAP_API,
  plugins: [new BugsnagPluginVue()],
})
const bugsnagVue = Bugsnag.getPlugin('vue')!

const app = createApp(App)
app.use(bugsnagVue)
app.use(PrimeVue)
app.use(ToastService)
// app.use(DialogService);
app.mount('#app')
