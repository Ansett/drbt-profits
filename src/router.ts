import { createWebHistory, createRouter } from 'vue-router'

import EthView from './Eth.vue'
import SolView from './Sol.vue'

const routes = [
  { path: '/', redirect: '/eth', },
  { path: '/eth', component: EthView },
  { path: '/sol', component: SolView },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})