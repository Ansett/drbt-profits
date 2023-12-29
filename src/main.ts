import "./assets/base.css";
import "primeicons/primeicons.css";
import "primevue/resources/themes/lara-dark-indigo/theme.css";
import "primeflex/primeflex.css";

import PrimeVue from "primevue/config";
import ToastService from "primevue/toastservice";
import { createApp } from "vue";
import App from "./App.vue";

const app = createApp(App);
app.use(PrimeVue);
app.use(ToastService);
app.mount("#app");
