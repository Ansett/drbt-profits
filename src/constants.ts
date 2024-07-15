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
export const DEFAULT_GAS_USED = 200000
export const SELL_GAS_PRICE = 0.01
export const DAY_DELIMITATION = 9 // in the by-day table, a day is considered to start at 9am UTC
export const AVERAGE_LP_TO_MC_RATIO = 0.1
export const XS_WORTH_OF_ONCHAIN_DATA = 5 // at least 5x to fetch data
export const MIN_CALLS_FOR_HASHES = 5
export const CURRENT_CACHED_BLOCK_VERSION = 2
export const WRAPPED_ETH_ADDY = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase()
export const INITIAL_TP_SIZE_CODE = -1

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
  '0xDfB20f7297AAD51e883bBA1D21a46deFB097c821', // BJORN: my call delay was worse
  '0xC37E1F6CCCC16C6B44FF7406Fb4F645C9CcaE39E', // INC: my call delay was worse
  '0x02EeDc3D0cB09E0450C9ed2917005e9bd22Cf763', // LANDWOLF: my call delay was worse
  '0x4d147243154DcF40DdE549414200CE49dCaF9f60', // LAO: my call delay was worse
  '0xd7F218C3f9F42A6fc02A6a213E48DcCdC39508A1', // Win Ai: my call delay was worse
  '0xF5eA85e512713D69f80Dba8F25c728653fc48524', // HTE: my call delay was worse
  '0xBbAF29697c6c1F247C7EC8c9610417fCCAfeE61a', // NEAI: my call delay was worse
  '0x51bb045AEA9531Be97ca4892B1b72D7003Ac4AA3', // AI NFT: my call delay was worse
]
