# Testnet Deployment Guide

## Overview
This guide explains how to deploy the Notary-Mediated Escrow System to testnet for testing purposes.

## Prerequisites
- Node.js 18+ and npm installed
- A wallet with testnet ETH (Sepolia, Goerli, Mumbai, etc.)
- RPC endpoint URL for your chosen testnet

## Supported Testnets
- **Sepolia** (Ethereum) - chainId: 11155111
- **Goerli** (Ethereum) - chainId: 5 (deprecated)
- **Mumbai** (Polygon) - chainId: 80001
- **BSC Testnet** - chainId: 97
- **Optimism Sepolia** - chainId: 11155420
- **Base Sepolia** - chainId: 84532
- **Arbitrum Sepolia** - chainId: 421614

## Setup Instructions

### 1. Install Dependencies
```bash
cd /home/c0bw3b/Proj/multisig
npm install
```

### 2. Create .env File
Create a `.env` file in the project root:
```env
# Your private key (testnet only!)
PRIVATE_KEY=0xYourPrivateKeyHere

# RPC endpoints
SEPOLIA_RPC=https://sepolia.infura.io/v3/YourInfuraKey
GOERLI_RPC=https://goerli.infura.io/v3/YourInfuraKey
MUMBAI_RPC=https://polygon-mumbai.g.alchemy.com/v2/YourAlchemyKey
BSC_TESTNET=https://data-seprelay.istanbul.binance.org
OPTIMISM_SEPOLIA=https://sepolia.optimism.io
BASE_SEPOLIA=https://sepolia.base.org
ARBITRUM_SEPOLIA=https://sepolia.arb1.io

# Optional: Etherscan API key for contract verification
ETHERSCAN_API_KEY=YourEtherscanKey
```

### 3. Get Testnet ETH
- **Sepolia**: https://faucet.sepolia.dev/
- **Goerli**: https://goerlifaucet.com/
- **Mumbai**: https://faucet.polygon.technology/
- **BSC Testnet**: https://testnet.binance.org/withdraw

### 4. Deploy to Testnet
```bash
# Deploy to Sepolia
npx hardhat run scripts/deploy.js --network sepolia

# Deploy to Mumbai
npx hardhat run scripts/deploy.js --network mumbai

# Deploy to BSC Testnet
npx hardhat run scripts/deploy.js --network bscTestnet
```

## After Deployment
The deploy script will output the deployed addresses:
- MultiSigWallet address
- NotaryMediatedEscrow address
- EscrowFactory address

## Using the Contracts

### Create a New Escrow
```javascript
const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
const factory = EscrowFactory.attach("0xFactoryAddress");

// Create escrow with default notary
const tx = await factory.createEscrowWithDefaultNotary(
    clientAddress,
    sellerAddress,
    ethers.utils.parseEther("5.0") // 5 ETH
);
await tx.wait();
```

### Full Workflow
1. **Intake**: Create escrow with client, seller, notary
2. **Discovery**: Upload gallery, select plot
3. **Funding**: Client funds escrow
4. **Due Diligence**: Notary uploads documents, client verifies
5. **Negotiation**: Notary sets rates
6. **Execution**: Proceed with purchase, execute fiat bridge
7. **Transfer Registry**: Upload lodgement receipt, complete transfer
8. **Release**: State-gated release authorization

### Release Authorization
The system supports four release types:
- **DD Fee**: Released after funding to treasury
- **Facilitation Fee**: Released after completion to treasury
- **Refund**: Only in cancelled state (pre-execution)
- **Seller Proceeds**: After completion to seller

## Testnet Testing Tips

### Using Hardhat Node (Local Testnet)
```bash
# Start local node
npx hardhat node

# In another terminal, deploy
npx hardhat run scripts/deploy.js --network localhost
```

### Using Foundry (Alternative)
```bash
# Deploy using Foundry
forge create --rpc-url http://127.0.0.1:8545 --private-key 0x... \
  scripts/Deploy.s.sol:DeployScript
```

### Testing with Multiple Accounts
```javascript
const [deployer, client, seller, notary, treasury] = await ethers.getSigners();

// Use different signers for different roles
await escrow.connect(client).fundEscrow(0, true, { value: amount });
await escrow.connect(notary).uploadDocument(0, 0, hash);
```

## Verification
After deploying to a testnet, verify contracts on Etherscan/BscScan:
```bash
npx hardhat verify --network sepolia 0xContractAddress "constructor args"
```

## Troubleshooting
- **Insufficient balance**: Get more testnet ETH from faucet
- **Nonce too low**: Reset nonce in wallet or wait for pending transactions
- **Gas too low**: Increase gas price in .env (GAS_PRICE_GWEI)
- **Contract already deployed**: Use a fresh wallet or different testnet

## Security Notes
- **Never use mainnet keys in testnet scripts**
- **Testnet contracts are for testing only**
- **Always verify contract code before mainnet deployment**
- **Use hardware wallets for real deployments**