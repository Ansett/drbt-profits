export const getPtNumberInput = (extra = {}) => ({
  decrementButton: {
    root: {
      class: 'p-button-outlined p-button-secondary',
      ...extra,
    },
  },
  incrementButton: {
    root: {
      class: 'p-button-outlined p-button-secondary',
      ...extra,
    },
  },
})

export const SELL_TAX = 5
export const ETH_PRICE = 2900
export const SELL_GAS_PRICE = 0.01
export const DAY_DELIMITATION = 9 // in the by-day table, a day is considered to start at 9am UTC
export const AVERAGE_LP_TO_MC_RATIO = 0.1

// https://etherscan.io/accounts/label/mev-builder?subcatid=undefined&size=100&start=0&col=3&order=desc (transform to lowercase)
export const BUILDER_ADDYS = [
  '0x95222290dd7278aa3ddd389cc1e1d165cc4bafe5', // beaverbuild
  '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97', // Titan Builder
  '0x1f9090aae28b8a3dceadf281b0f12828e676c326', // rsync-builder
  '0xdafea492d9c6733ae3d56b7ed1adb60692c98bc5', // Flashbots: Builder
  '0x4675c7e5baafbffbca748158becba61ef3b0a263', // MEV Builder
  '0x690b9a9e9aa1c9db991c7721a92d351db4fac990', // builder0x69
  '0xf2f5c73fa04406b1995e397b55c24ab1f3ea726c', // bloXroute
]

export const EXCLUDED_FROM_ACCURACY = [
  '0xa902d325e0e1EA19fF0d455CB7444A2C87A5128D', // GOAT: wrong call MC ?
  '0x68d009F251FF3a271477F77aCb704C3b0F32a0c0', // CHAD: my call was worse
  '0x8F341C422e8071424eaEdd4C5600145DE4FA79A6', // $FSTRK: my call was worse
  '0x00240E4cc8e07dAD1ca0167f5A0BA52a8327F45E', // DRAGON: my call was worse
]
