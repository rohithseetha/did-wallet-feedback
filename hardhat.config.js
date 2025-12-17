require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("dotenv").config();

const { PRIVATE_KEY, LOCAL_PRIVATE_KEY, MAIN_PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: LOCAL_PRIVATE_KEY
        ? [LOCAL_PRIVATE_KEY]
        : {
            mnemonic: "test test test test test test test test test test test junk",
            count: 20,
            accountsBalance: "10000000000000000000000" // 10000 ETH
          },
      mining: {
        auto: true,
        interval: 0
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      accounts: LOCAL_PRIVATE_KEY ? [LOCAL_PRIVATE_KEY] : undefined
    },
    avalanche: {
      url: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
      chainId: 43114,
      accounts: MAIN_PRIVATE_KEY ? [MAIN_PRIVATE_KEY] : (PRIVATE_KEY ? [PRIVATE_KEY] : []),
      gasPrice: 225000000000
    },
    fuji: {
      url: process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: MAIN_PRIVATE_KEY ? [MAIN_PRIVATE_KEY] : (PRIVATE_KEY ? [PRIVATE_KEY] : []),
      gasPrice: 225000000000
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      timeout: 120000
    }
  },
  paths: {
    sources: "./src/contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },
  mocha: {
    timeout: 40000
  }
};
