import { createWebHistory, createRouter } from 'vue-router'

import EthView from './Eth.vue'
import SolView from './Sol.vue'
import TokenSolView from './TokenSol.vue'
import WalletsView from './Wallets.vue'

const routes = [
  { path: '/', redirect: '/sol', },
  { path: '/eth', component: EthView },
  { path: '/sol', component: SolView },
  { path: '/token-sol', component: TokenSolView },
  { path: '/wallets', component: WalletsView },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})