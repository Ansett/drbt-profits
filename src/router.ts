import { createWebHistory, createRouter } from 'vue-router'

import EthView from './Eth.vue'
import SolView from './Sol.vue'
import RhView from './Robinhood.vue'
import TokenRhView from './TokenRh.vue'
import TokenSolView from './TokenSol.vue'
import WalletsView from './Wallets.vue'
import ApiKeysView from './ApiKeys.vue'

const routes = [
  { path: '/', redirect: '/rh/simulations' },
  { path: '/rh', redirect: '/rh/simulations' },
  { path: '/sol', redirect: '/sol/simulations' },
  { path: '/eth', redirect: '/eth/simulations' },
  { path: '/rh/simulations', component: RhView },
  { path: '/rh/match', component: TokenRhView },
  { path: '/sol/simulations', component: SolView },
  { path: '/sol/match', component: TokenSolView },
  { path: '/eth/simulations', component: EthView },
  { path: '/wallets', component: WalletsView },
  { path: '/keys', component: ApiKeysView },
  { path: '/api-keys', redirect: '/keys' },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
